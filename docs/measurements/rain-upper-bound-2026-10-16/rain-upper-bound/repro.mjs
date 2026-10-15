// Small external CPU-only checks. Loads the exact helper from after/, not product.
// Requires Node >=22.13 for stripTypeScriptTypes; no packages, GPU or cloud bake.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const read=relative=>fs.readFileSync(path.join(dir,relative),'utf8');
const manifest=JSON.parse(read('manifest.json'));
const candidate=read('after/src/cumulonimbus/precipitation.ts');
const helperText=candidate.match(/export function precipitationMaxBaseReference\([\s\S]*?\n}\n/)?.[0];
assert(helperText,'Candidate helper not found');
const mapSize=candidate.match(/export const RAIN_MAP_SIZE=([^;]+);/)?.[0];
const guardText=candidate.match(/export const RAIN_BASE_UPPER_GUARD_KM=([^;]+);/)?.[0];
assert(mapSize&&guardText);
const code=stripTypeScriptTypes(mapSize+'\n'+guardText+'\n'+helperText,{mode:'strip'});
const {precipitationMaxBaseReference:maxBase,RAIN_BASE_UPPER_GUARD_KM:guard}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
assert.equal(guard,manifest.guardKm);
const mediumText=read('reference/src/cumulonimbus/medium.ts').match(/export function integrateMediaSegment\([\s\S]*?\n}\n/)?.[0];
assert(mediumText);
const {integrateMediaSegment}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(mediumText,{mode:'strip'})).toString('base64'));
const results=[],fixtures=[];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(name,fn)=>{const details=fn();results.push({name,passed:true,...details});};
const newMap=n=>new Uint8Array(n*n*2);
const put=(a,n,x,z,r,g)=>{a[(z*n+x)*2]=r;a[(z*n+x)*2+1]=g;};
const decode=g=>g/255*3-.5;
const f=Math.fround;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
// Independent RG sampling, normalized coordinates, texel-centred and clamp-to-edge.
function linear(map,n,u,v,mode='f64'){
 const px=u*n-.5,pz=v*n-.5,x=Math.floor(px),z=Math.floor(pz),tx=px-x,tz=pz-z;
 const tex=(xx,zz,c)=>map[(clamp(zz,0,n-1)*n+clamp(xx,0,n-1))*2+c]/255;
 const mix=(a,b,t)=>mode==='f64'?a+(b-a)*t:mode==='f32-fused'?f(f(a)+f(t)*f(f(b)-f(a))):f(f(f(a)*f(1-f(t)))+f(f(b)*f(t)));
 return [0,1].map(c=>mix(mix(tex(x,z,c),tex(x+1,z,c),tx),mix(tex(x,z+1,c),tex(x+1,z+1,c),tx),tz));
}
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const sourceBase=(g,growth)=>.72+(g*3-.5-.72)/growth;
const sourceBaseF32=(g,growth)=>f(f(.72)+f(f(f(f(g)*f(3))-f(.5))-f(.72))/f(growth));
// Each binary operation rounded; this is an emulation, not GPU filter qualification.
const sourceBaseSequential=(g,growth)=>f(f(.72)+f(f(f(f(f(g)*f(3))-f(.5))-f(.72))/f(growth)));
const upperF32=(b,growth)=>f(f(f(f(.72)+f(f(f(b)-f(.72))/f(growth)))+f(.3))+f(guard));
const attachedF32=(base,y)=>{
 const a=f(f(base)-f(.08)),b=f(f(base)+f(.3));
 const t=clamp(f(f(f(y)-a)/f(b-a)),0,1);
 return f(f(1)-f(f(t*t)*f(f(3)-f(2*t))));
};
let rng=0x9e3779b9;
const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296;};

check('empty R channel and encoded-zero emission ignore all height-only padding',()=>{
 for(const n of [1,2,8,64]){
  const map=newMap(n);for(let i=1;i<map.length;i+=2)map[i]=255;
  assert.equal(maxBase(map,n),null);
  // Actual byte rounding, no unquantized positive mass may bypass R>0.
  map[0]=Math.round(.49);assert.equal(maxBase(map,n),null);
 }
 return {sizes:[1,2,8,64]};
});
check('zero-R high-G sentinel invalidates a positive-R-only maximum',()=>{
 const n=6,map=newMap(n);put(map,n,1,1,1,40);put(map,n,2,1,0,255);
 assert.equal(maxBase(map,n),2.5);
 const [r,g]=linear(map,n,2.4/n,1.5/n),y=sourceBase(g,1)+.1;
 assert(r>0);assert(1-smooth(sourceBase(g,1)-.08,sourceBase(g,1)+.3,y)>0);
 assert(y>=decode(40)+.3+guard,'Unsafe positive-R-only guard should wrongly skip');
 assert(y<maxBase(map,n)+.3+guard,'Correct halo guard must retain this sample');
 fixtures.push({name:'independent-RG-sentinel',size:n,bytes:Array.from(map),sha256:sha(map)});
 return {filteredR:r,filteredG:g,negativeControlPositiveROnlyWronglySkips:true};
});
check('diagonal halo and every map corner retain all bilinear G contributors',()=>{
 let tested=0;
 const n=5;
 for(const [x,z] of [[0,0],[n-1,0],[0,n-1],[n-1,n-1],[2,2]]){
  const map=newMap(n),dx=x===n-1?-1:1,dz=z===n-1?-1:1;
  put(map,n,x,z,1,0);put(map,n,x+dx,z+dz,0,255);
  assert.equal(maxBase(map,n),2.5);
  for(const du of [-.999,-.5,0,.5,.999])for(const dv of [-.999,-.5,0,.5,.999]){
   const u=clamp((x+.5+du)/n,0,1),v=clamp((z+.5+dv)/n,0,1);
   const [r,g]=linear(map,n,u,v);if(r>0)assert(decode(g*255)<=maxBase(map,n)+1e-12);
   tested++;
  }
 }
 return {bilinearSamples:tested};
});
check('unrelated sentinel excluded; the lowest valid base is distinct from no emission',()=>{
 const n=8,map=newMap(n);put(map,n,4,4,255,64);put(map,n,0,0,0,255);
 assert.equal(maxBase(map,n),decode(64));
 const one=newMap(1);put(one,1,0,0,1,0);assert.equal(maxBase(one,1),-.5);
 put(one,1,0,0,0,255);assert.equal(maxBase(one,1),null);
 return {maxBaseWithDistantSentinel:maxBase(map,n),oneTexelBase:-.5};
});
check('decode uses actual rounded RG8 bytes rather than base moments',()=>{
 const n=8,map=newMap(n),rawBase=1.103,encoded=Math.round((rawBase+.5)/3*255);
 put(map,n,3,3,1,encoded);
 assert.equal(maxBase(map,n),decode(encoded));assert.notEqual(maxBase(map,n),rawBase);
 fixtures.push({name:'rounded-base',size:n,bytes:Array.from(map),sha256:sha(map)});
 return {rawBaseForNegativeControl:rawBase,encodedG:encoded,decodedBound:maxBase(map,n)};
});
check('independent bilinear and f32 emulations have zero attachment beyond the guard',()=>{
 let positiveSamples=0,zeroAttachmentChecks=0,retainedPositiveSamples=0;
 const modes=['f64','f32-fused','f32-weighted'];
 const growths=[1,f(1/.68),f(1.125),f(1.32)];
 for(let fixture=0;fixture<8;fixture++){
  const n=8,map=newMap(n),x=fixture%4+2,z=Math.floor(fixture/4)+3;
  for(let i=1;i<map.length;i+=2)map[i]=255; // many unrelated height sentinels
  for(let zz=z-1;zz<=z+1;zz++)for(let xx=x-1;xx<=x+1;xx++)put(map,n,xx,zz,0,Math.floor(random()*221));
  map[(z*n+x)*2]=fixture%2?255:1;
  const bound=maxBase(map,n);assert(bound!==null&&bound<2.5);
  for(let sample=0;sample<400;sample++){
   const u=(x+.5+(random()*1.9998-.9999))/n,v=(z+.5+(random()*1.9998-.9999))/n;
   for(const mode of modes){
    const [r,g]=linear(map,n,u,v,mode);if(!(r>0))continue;positiveSamples++;
    for(const growth of growths){
     const upper=upperF32(f(bound),growth);
     for(const base of [sourceBase(g,growth),sourceBaseF32(g,growth),sourceBaseSequential(g,growth)]){
      for(const y of [upper,f(upper+.00001),f(upper+.2)]){
       assert.equal(attachedF32(base,y),0,JSON.stringify({fixture,mode,bound,g,base,upper,growth,y}));zeroAttachmentChecks++;
      }
      const y=f(base);
      const original=r*attachedF32(base,y),guarded=y<=upper?original:0;
      assert.equal(guarded,original);if(original>0)retainedPositiveSamples++;
     }
    }
   }
  }
 }
 assert(positiveSamples>0&&retainedPositiveSamples>0);
 return {positiveSamples,zeroAttachmentChecks,retainedPositiveSamples,modes,growths,limit:'CPU arithmetic/filter emulations only, not normative GPU precision'};
});
check('one-code filter overshoot and three upward division ULPs fit the stated budget',()=>{
 const scratch=new ArrayBuffer(4),floats=new Float32Array(scratch),bits=new Uint32Array(scratch);
 const up=x=>{floats[0]=x;if(x===0){bits[0]=1;return floats[0];}bits[0]+=x>0?1:-1;return floats[0];};
 let checked=0,minGap=Infinity;
 for(let encoded=0;encoded<=255;encoded++){
  const map=newMap(1);put(map,1,0,0,1,encoded);
  const bound=f(maxBase(map,1));
  // Deliberately allow one whole code beyond the largest G contributor.
  const g=f(encoded/255+1/255);
  for(const growth of [1,f(1/.68),f(1.125),f(1.32)]){
   const numerator=f(f(f(g*f(3))-f(.5))-f(.72));
   let division=f(numerator/growth);division=up(up(up(division)));
   const worstBase=f(f(.72)+division),upper=upperF32(bound,growth);
   assert.equal(attachedF32(worstBase,upper),0,JSON.stringify({encoded,growth,worstBase,upper}));
   const gap=upper-f(worstBase+f(.3));assert(gap>=0);minGap=Math.min(minGap,gap);checked++;
  }
 }
 return {checked,guardKm:guard,minRemainingGapKm:minGap,filterAssumption:'overshoot <= 1 G code',divisionPerturbation:'three upward f32 ULPs, not a real GPU measurement'};
});
check('synthetic rays preserve f32 t/ds and co-located media through zero-source intervals',()=>{
 const n=8,map=newMap(n),emptyMap=newMap(n);
 for(let z=2;z<=5;z++)for(let x=2;x<=5;x++)put(map,n,x,z,255,136);
 const cases=[];
 for(const inspection of [0,1])for(const direction of [-1,1])cases.push({name:`rain-${inspection}-${direction}`,map,inspection,direction,strength:.8});
 cases.push({name:'no-positive-R',map:emptyMap,inspection:0,direction:-1,strength:.8});
 cases.push({name:'weather-zero',map,inspection:.7,direction:-1,strength:0});
 const summaries=[];
 for(const c of cases){
  const run=enabled=>{
   const S=f(7/384),E=f(.0546875),near=f(.05),far=f(3.2),rainNear=f(.2),rainFar=f(2.9),jitter=f(.37191);
   const hasRain=c.strength>.001&&maxBase(c.map,n)!==null;
   const growth=f(1.125),ceiling=upperF32(f(maxBase(c.map,n)??-.5),growth);
   const mix=(a,b,w)=>f(f(a)+f(f(b-a)*f(w)));
   const entry=mix(S,Math.min(S,Math.max(.0015,near*.008)),c.inspection);
   let t=f(near+f(Math.min(entry,hasRain?.006:entry)*jitter));if(hasRain&&near<rainNear)t=Math.min(t,rainNear);
   let T=1,L=[0,0,0],avoided=0,thin=0;const trace=[];
   for(let i=0;i<8192&&t<far&&T>=.006;i++){
    const region=hasRain&&t>=rainNear&&t<rainFar;
    const support=t>.34&&t<.50?1:0;
    const ordinary=mix(S,Math.min(S,Math.max(.0015,t*.008)),c.inspection);
    const media=region?Math.min(ordinary,.006):ordinary;
    const boundary=region?f(rainFar-t):f(far-t),until=hasRain&&t<rainNear?f(rainNear-t):f(far-t);
    const ds=f(Math.min(support<=0&&!region?E:media,boundary,until));assert(ds>0);
    const y=f((c.direction<0?2.8:0)+c.direction*t);
    let rain=0;
    if(region&&(!enabled||y<=ceiling)){
     const [r,g]=linear(c.map,n,.45+.02*Math.sin(t),.45,'f32-weighted');
     rain=f(c.strength*r*attachedF32(sourceBaseSequential(g,growth),y)*.85);
    }else if(region&&enabled)avoided++;
    const cloud=t>.400&&t<.424?f(.7*18):0;if(cloud>0)thin++;
    trace.push([t,ds,cloud,rain]);
    if(cloud>0||rain>0){
     const cell=integrateMediaSegment(cloud,[.6,.7,.8],rain,[.25,.3,.35],ds);
     L=L.map((v,k)=>f(v+f(T*cell.radiance[k])));T=f(T*cell.transmittance);
    }
    t=f(t+ds);
   }
   return {trace,L,T,avoided,thin};
  };
  const baseline=run(false),candidate=run(true);
  assert.deepEqual(candidate.trace,baseline.trace);assert.deepEqual(candidate.L,baseline.L);assert.equal(candidate.T,baseline.T);
  assert.equal(candidate.thin,baseline.thin);assert(candidate.thin>0);
  if(c.strength>0&&maxBase(c.map,n)!==null)assert(candidate.avoided>0);
  summaries.push({name:c.name,samples:candidate.trace.length,thinCloudSamples:candidate.thin,avoidedOpticalBlocks:candidate.avoided,traceSha256:sha(JSON.stringify(candidate.trace)),exactF32TraceAndMediaEqual:true});
 }
 return {cases:summaries,limit:'Synthetic analytic cloud/rain field with actual CPU media helper; not current volume, WGSL execution or rendered-image equivalence'};
});
check('shader edit leaves all ray/sample/cloud expressions byte-identical',()=>{
 const before=read('before/src/cumulonimbus/cloudShader.ts');
 let after=read('after/src/cumulonimbus/cloudShader.ts');
 const changes=[
 ['RAIN_WIND_DISPLACEMENT_BOUND,RAIN_EXTINCTION,RAIN_BASE_UPPER_GUARD_KM}','RAIN_WIND_DISPLACEMENT_BOUND,RAIN_EXTINCTION}'],
 ['ground:f32, rainBounds:vec4<f32>, maxBaseRef:f32, rainMap:','ground:f32, rainBounds:vec4<f32>, rainMap:'],
 ['  let rainUpper=vec3<f32>(rainMaxXZ.x,2.8,rainMaxXZ.y)+drift;\n  // Optical-only bound; keep the fixed box and all ray/sample boundaries intact.\n  let rainCeiling=.72+(maxBaseRef-.72)/growth.x+.3+${RAIN_BASE_UPPER_GUARD_KM};','  let rainUpper=vec3<f32>(rainMaxXZ.x,2.8,rainMaxXZ.y)+drift;'],
 ['    // The attachment is zero above the bounded final positive-R base.\n    if(rainRegion&&rp.y<=rainCeiling){\n      // Estimate the emitting height,','    if(rainRegion){\n      // Estimate the emitting height,']
 ];
 for(const [old,replacement] of changes){assert.equal(after.split(old).length,2);after=after.replace(old,replacement);}
 assert.equal(after,before);
 const engine=read('after/src/cumulonimbus/GPUSceneEngine.ts');
 assert(engine.includes('this.rainTexture.image.data=rainMap;\n    this.maxBaseRef.value=precipitationMaxBaseReference(rainMap)??-.5;'));
 return {entireShaderRestoredAfterReversingOnlyImportParameterCeilingAndOpticalGuard:true,uploadUpdateAndEmptyResetPresent:true};
});
const result={status:'EXTERNAL CPU CHECKS PASSED; PROPOSAL NOT APPLIED OR GPU-QUALIFIED',baseCommit:manifest.baseCommit,guardKm:guard,helperSourceSha256:sha(helperText),scriptSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),tests:results,encodedFixtures:fixtures,limits:['Uses the exact candidate helper with TypeScript types stripped by Node, not a second implementation.','Bilinear RG sampling is independent CPU code; three arithmetic modes do not qualify GPU filtering precision.','No real volume or rainfall map was generated or loaded; fixture RG8 bytes are explicit in this report. Synthetic rays also use an analytic thin cloud, not a generated cloud.','Static shader reversal demonstrates sample/cloud expressions unchanged; no WGSL execution or pixel equivalence test.','No speedup, submitted/completed/presented FPS or physical calibration is measured.']};
fs.writeFileSync(path.join(dir,'repro-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:results.length,result:path.join(dir,'repro-result.json'),tests:results.map(x=>x.name)},null,2));
