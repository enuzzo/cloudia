import {terrainHeight,groundIntersection,EARTH_RADIUS,GROUND_LEVEL} from '../../src/cumulonimbus/landscape';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Pinned reproduction, not a cloud bake or a GPU/first-hit solver acceptance test.
// Usage: bun docs/experiments/terrain-intersection-case-2026-10-15.ts [output.json]
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const expectedLandscapeSha256='72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99';
const landscapeSha256=sha(readFileSync(new URL('../../src/cumulonimbus/landscape.ts',import.meta.url)));
if(landscapeSha256!==expectedLandscapeSha256)throw new Error('Landscape source changed; inspect the clone and intentionally update its provenance before reproducing.');
const scriptSha256=sha(readFileSync(new URL(import.meta.url)));
const output=process.argv[2]??new URL('../measurements/terrain-intersection-2026-10-15/case.json',import.meta.url);

const origin=[16.4296875,2.9365234375,9.797174393178826e-16],ray=[-.9641481825534892,-.26536443258056197,-5.903704928339342e-17],sea=groundIntersection(origin,ray)!;
const residual=(t:number)=>{const p=origin.map((v,i)=>v+ray[i]*t);return Math.hypot(p[0],p[1]+EARTH_RADIUS-GROUND_LEVEL,p[2])-EARTH_RADIUS-terrainHeight(p[0],p[2]);};
let t=sea;const history:any[]=[];
for(let j=0;j<6;j++){const p=origin.map((v,i)=>v+ray[i]*t),len=Math.hypot(p[0],p[1]+EARTH_RADIUS-GROUND_LEVEL,p[2]),incidence=Math.min(-.045,(p[0]*ray[0]+(p[1]+EARTH_RADIUS-GROUND_LEVEL)*ray[1]+p[2]*ray[2])/len);history.push({iteration:j,t,residual:residual(t),incidence});t=Math.max(0,Math.min(sea,t-residual(t)/incidence));}
history.push({iteration:6,t,residual:residual(t)});
let bracket:null|number[]=null;for(let a=0;a<sea;a+=.005){const b=Math.min(sea,a+.005);if(residual(a)>=0&&residual(b)<0){bracket=[a,b];break;}}
if(bracket){let [a,b]=bracket;for(let i=0;i<32;i++){const m=(a+b)*.5;if(residual(m)<0)b=m;else a=m;}bracket=[a,b];}
if(!bracket||Math.abs(residual(t))<1||t-(bracket[0]+bracket[1])*.5<2)throw new Error('Pinned nonconvergence witness changed unexpectedly');
const report={landscapeSha256,expectedLandscapeSha256,scriptSha256,generatedVolumes:0,pose:{approach:0,yaw:Math.PI/2,pitch:0,aspect:16/9,uv:[.5,.9],tanFov:.2867,target:[.4296875,2.9365234375,0]},method:'CPU mathematical clone of WGSL six-pass solver with current f32 terrainHeight reference; double ray/sphere arithmetic. A 5m first-sign-crossing scan plus bisection diagnoses this one smooth crossing; not proof against arbitrary sub5m terrain features, not GPU readback.',origin,ray,seaDistance:sea,history,firstCrossingBracket:bracket,solverDistanceErrorKm:bracket?t-(bracket[0]+bracket[1])*.5:null};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
