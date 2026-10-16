// Archive adaptation: only import/source paths and optional output destination differ from the original runner.
/** Replay three verbatim engine method bodies, never instantiate a GPU engine.
 * Synthetic colors/LUT isolate controller state; no rendered-pixel claim. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector2,Vector3} from '../../../node_modules/three/build/three.webgpu.js';
const sourcePath=new URL('./after/GPUSceneEngine.ts',import.meta.url);
const source=readFileSync(sourcePath,'utf8');
const SUN_LEFT=[-.75,.8,.24],SUN_RIGHT=[.75,.8,.24];
const solarDirection=(side,low=false)=>new Vector3(...(side?SUN_RIGHT:SUN_LEFT)).setY(low?.025:.8).normalize().toArray();
const DataUtils={toHalfFloat:value=>value}; // Packed bytes are irrelevant to direction/lobe continuity.
function body(signature){
  const start=source.indexOf(signature);if(start<0)throw Error(`Missing ${signature}`);
  const open=source.indexOf('{',start),end=source.indexOf('\n  }',open);
  if(end<0)throw Error(`Missing end ${signature}`);
  return source.slice(open+1,end);
}
const methodBodies={action:body('  action(action:string)'),applySky:body('  private applySky(result:SkyResult)'),advance:body('  private advanceAtmosphere(dt:number)')};
const helperPath=new URL('./after/solarTransition.ts',import.meta.url);
const helperSource=readFileSync(helperPath,'utf8');
const helperStart=helperSource.indexOf('export function interpolateSolarDirection(');
const helperOpen=helperSource.indexOf('{',helperStart),helperEnd=helperSource.lastIndexOf('}');
const helperBody=helperSource.slice(helperOpen+1,helperEnd);
const interpolateSolarDirection=new Function('from','to','blend','out',helperBody);
const scope={SUN_LEFT,SUN_RIGHT,solarDirection,interpolateSolarDirection,DataUtils,LinearFilter:1,NoColorSpace:''};
const compile=(args,text)=>new Function(...Object.keys(scope),`return function(${args}){${text}}`)(...Object.values(scope));
const action=compile('action',methodBodies.action),applySky=compile('result',methodBodies.applySky),advance=compile('dt',methodBodies.advance);
const unit=value=>new Vector3(...value).normalize();
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,unit(a).dot(unit(b)))))*180/Math.PI;
function fixture(low){
  const sun=unit(solarDirection(0,low));
  const f={destroyed:false,side:0,lightSide:{value:0},sun:{value:sun},sunFrom:sun.clone(),sunTarget:sun.clone(),lightSideFrom:0,lightSideTarget:0,sunsetAmount:{value:+low},sunsetFrom:+low,sunsetTarget:+low,
    skyData:new Float32Array([1,2,3,1]),skyFromData:new Float32Array([1,2,3,1]),skyPacked:new Float32Array(4),skyFromPacked:new Float32Array(4),skyTexture:{},skyFromTexture:{},
    solarColor:{value:new Vector3(1,.9,.8)},solarFrom:new Vector3(1,.9,.8),solarTarget:new Vector3(1,.9,.8),ambientColor:{value:new Vector3(.2,.3,.4)},ambientFrom:new Vector3(.2,.3,.4),ambientTarget:new Vector3(.2,.3,.4),
    weather:{value:new Vector3(1,0,0)},weatherFrom:new Vector2(1,0),weatherTarget:new Vector2(1,0),weatherState:{step(){},rain:0},precipitationTime:{value:0},forcingTime:0,
    atmosphereProgress:1,atmosphereBlend:{value:1},quad:{},invalidate(){},state(){},syncIntegratorVariant(){},pendingSky:[],
    updateAtmosphere(){this.pendingSky.push({side:this.side});},advanceAtmosphere:advance};
  return f;
}
function state(f,label,timeMs){return {label,timeMs,sideTarget:f.side,lightSide:f.lightSide.value,sun:f.sun.value.toArray(),sunset:f.sunsetAmount.value,blend:f.atmosphereBlend.value,solar:f.solarColor.value.toArray(),sky0:f.skyFromData[0]+(f.skyData[0]-f.skyFromData[0])*f.atmosphereBlend.value};}
function run(low){
  const f=fixture(low),samples=[state(f,'before-command',0)];
  action.call(f,'light');samples.push(state(f,'after-command-before-frame',0));
  advance.call(f,1/60);samples.push(state(f,'frame-before-sky-reply',1000/60));
  // Result is synthetic, including unchanged preset height but different light colors.
  applySky.call(f,{side:1,data:new Float32Array([4,5,6,1]),solar:[.8,.9,1],ambient:[.4,.3,.2],haze:1,overcast:0,sunset:+low});
  samples.push(state(f,'sky-reply-fade-at-zero',200));
  advance.call(f,1/60);samples.push(state(f,'first-frame-after-sky-reply',200+1000/60));
  advance.call(f,1.2-1/60);samples.push(state(f,'halfway-fade',1400));
  action.call(f,'light');advance.call(f,1/60);samples.push(state(f,'reversed-target-awaiting-reply',1400+1000/60));
  applySky.call(f,{side:0,data:new Float32Array([1,2,3,1]),solar:[1,.9,.8],ambient:[.2,.3,.4],haze:1,overcast:0,sunset:+low});
  samples.push(state(f,'reversed-reply-fade-at-zero',1600));
  return {preset:low?'low-sun':'day',samples,observations:{
    commandShadowJump:Math.abs(samples[1].lightSide-samples[0].lightSide),
    renderedFrameStillUsesOldDirectionDegrees:angle(samples[2].sun,samples[0].sun),
    directionJumpAtReplyDegrees:angle(samples[3].sun,samples[2].sun),
    skyBlendAtDirectionJump:samples[3].blend,
    solarChangeAtDirectionJump:Math.max(...samples[3].solar.map((v,i)=>Math.abs(v-samples[2].solar[i]))),
    directionJumpOnInterruptedReplyDegrees:angle(samples[7].sun,samples[6].sun)
  }};
}
const results=[run(false),run(true)];
for(const r of results){
  if(r.observations.commandShadowJump!==0||r.observations.directionJumpAtReplyDegrees>1e-5||r.observations.directionJumpOnInterruptedReplyDegrees>1e-5||r.observations.skyBlendAtDirectionJump!==0||r.observations.solarChangeAtDirectionJump!==0)throw Error('Coherent replay has a discontinuity');
}
const report={date:new Date().toISOString(),sourceCommit:'working tree atop 59bb8d3',helperSha256:createHash('sha256').update(helperSource).digest('hex'),sourcePath:sourcePath.pathname,sourceSha256:createHash('sha256').update(source).digest('hex'),
  scope:'Actual action, applySky and advanceAtmosphere method bodies and actual interpolateSolarDirection function body extracted unchanged except TypeScript signatures. Stub state and synthetic sky LUT/color values, no GPU/DOM/frame rendering/worker latency measurement. Event timing is intentionally simulated. Vector math is actual Three0.186.0. DataUtils half packing stubbed because LUT bytes are not used to establish sun/cache timing. Does not establish the cause of close-up fog or visible flicker under ordinary continuous thermal motion.',
  methodSha256:Object.fromEntries(Object.entries(methodBodies).map(([name,text])=>[name,createHash('sha256').update(text).digest('hex')])),results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,results:results.map(r=>({preset:r.preset,...r.observations}))},null,2));
