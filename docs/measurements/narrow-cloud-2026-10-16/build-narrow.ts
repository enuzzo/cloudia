/** External diagnostic: reuses the frozen macro; never calls generateVolume. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bakeOccupancy,BOUNDS_SIZE} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/volume.ts';
const directory='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/narrow-cloud';
const cache='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work';
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const manifest=JSON.parse(readFileSync(cache+'/data/manifest.json','utf8'));
const volumePath='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/volume.ts';
if(sha(readFileSync(volumePath))!==manifest.sourceHashesAfter.volume)throw new Error('Volume helper changed since the cached macro; review required.');
const macro=readFileSync(cache+'/data/macro-rgba8.bin');
if(macro.length!==manifest.files['macro-rgba8.bin'].bytes||sha(macro)!==manifest.files['macro-rgba8.bin'].sha256)throw new Error('Macro hash mismatch');
const fine=256,size=128,guardKm=.001,warpKm=[.08,.06,.08],h=BOUNDS_SIZE.map(v=>v/size);
const radius=BOUNDS_SIZE.map((extent,a)=>Math.ceil((warpKm[a]+guardKm+extent/fine)/(extent/size)));
if(radius.some(r=>r!==2))throw new Error('This experiment proves only 256/128 and radius2.');
const before=sha(macro),started=performance.now(),scratch={size,data:new Uint8Array(size**3*4)};
bakeOccupancy({size:fine,data:macro},scratch,[guardKm,guardKm,guardKm]);
const narrow=new Uint8Array(size**3),seeds=new Uint8Array(size**3);
let occupied=0,rawPositive=0,seedCount=0;
for(let i=0;i<narrow.length;i++){narrow[i]=scratch.data[i*4+3];occupied+=Number(narrow[i]>0);}
for(let z=0;z<fine;z++)for(let y=0;y<fine;y++)for(let x=0;x<fine;x++)if(macro[((z*fine+y)*fine+x)*4]>0){
 rawPositive++;const j=((z>>1)*size+(y>>1))*size+(x>>1);if(!seeds[j]){seeds[j]=1;seedCount++;}
}
// Exhaustive raw-corner audit, compressed by identical 2x2x2 seed cells.
// Prefix sum of UNMARKED mask texels proves each seed's entire clipped r2 cube is marked.
const edge=size+1,prefix=new Uint32Array(edge**3),at=(x:number,y:number,z:number)=>(z*edge+y)*edge+x;
for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++)prefix[at(x+1,y+1,z+1)]=narrow[(z*size+y)*size+x]===0?1:0;
for(let z=0;z<edge;z++)for(let y=0;y<edge;y++)for(let x=1;x<edge;x++)prefix[at(x,y,z)]+=prefix[at(x-1,y,z)];
for(let z=0;z<edge;z++)for(let y=1;y<edge;y++)for(let x=0;x<edge;x++)prefix[at(x,y,z)]+=prefix[at(x,y-1,z)];
for(let z=1;z<edge;z++)for(let y=0;y<edge;y++)for(let x=0;x<edge;x++)prefix[at(x,y,z)]+=prefix[at(x,y,z-1)];
let seedCubesWithUnmarked=0;
for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(seeds[(z*size+y)*size+x]){
 const lo=[x,y,z].map((v,a)=>Math.max(0,v-radius[a])),hi=[x,y,z].map((v,a)=>Math.min(size,v+radius[a]+1));let count=0;
 for(let c=0;c<2;c++)for(let b=0;b<2;b++)for(let a=0;a<2;a++)count+=((a+b+c)%2?1:-1)*prefix[at(a?hi[0]:lo[0],b?hi[1]:lo[1],c?hi[2]:lo[2])];
 if(count!==0)seedCubesWithUnmarked++;
}
// Every possible macro vertex (including faces), support endpoint and signed warp.
// Cartesian separation makes the 1D exhaustive checks sufficient for all 3D corner combinations.
const f=Math.fround,axisFailures:any[]=[];let axisCases=0;
for(let a=0;a<3;a++)for(let i=0;i<fine;i++)for(const supportSign of [-1,1])for(const warpSign of [-1,1])for(const guardSign of [-1,1]){
 const macroCenter=(i+.5)/fine,macroPoint=macroCenter+supportSign/fine;
 const local=macroPoint+warpSign*warpKm[a]/BOUNDS_SIZE[a]+guardSign*guardKm/BOUNDS_SIZE[a];
 const q=f(local),idx=Math.min(size-1,Math.floor(f(Math.max(0,Math.min(1,q))*size))),seed=i>>1;
 axisCases++;if(Math.abs(idx-seed)>radius[a])axisFailures.push({a,i,supportSign,warpSign,guardSign,q,idx,seed});
}
// An r1 mask misses an actual contributing macro corner under maximum Z fine warp.
const q=64,i=2*q+1,endpointInset=.0017,macroPoint=(i+.5)/fine+1/fine-endpointInset;
const local=macroPoint+warpKm[2]/BOUNDS_SIZE[2],nearest=Math.floor(f(f(local)*size));
// Consistent liquid material: fine.r=0 -> warpZ=-.08, fine.b=1 -> erosion=.38.
// Other two macro coordinates can lie at that corner's centre after their bounded warp.
const rawCornerWeight=endpointInset*fine,erosion=.38,liquidDensity=(rawCornerWeight-erosion)/(1-erosion);
const r1Counterexample={axis:2,macroIndex:i,seed:q,endpointInsetNormalized:endpointInset,localNormalized:local,nearest,
 fineR:0,fineB:1,warpZKm:-.08,rawCornerR:255,rawCornerWeight,erosion,liquidDensity,
 aboveOriginalDensityGate:liquidDensity>.002,missedByRadius1:Math.abs(nearest-q)>1,coveredByRadius2:Math.abs(nearest-q)<=2};
const after=sha(macro),checks={macroUnchanged:before===after,allRawPositiveSeedCubesCovered:seedCubesWithUnmarked===0,
 allSignedCornerAndBoundaryCasesCovered:axisFailures.length===0,radius1CounterexampleWorks:r1Counterexample.missedByRadius1&&r1Counterexample.coveredByRadius2&&r1Counterexample.aboveOriginalDensityGate};
const report={kind:'external-post-flow-narrow-mask',date:new Date().toISOString(),status:Object.values(checks).every(Boolean)?'PASS':'FAIL',checks,
 dimensions:[size,size,size],format:'R8Unorm',bytes:narrow.length,rawMacroPositiveVertices:rawPositive,positiveSeedCells:seedCount,
 markedTexels:occupied,markedPercent:100*occupied/narrow.length,guardKm,radius,warpKm,
 macroVoxelKm:BOUNDS_SIZE.map(v=>v/fine),maskVoxelKm:h,
 nearestCellSlackKm:h.map((v,a)=>1.75*v-warpKm[a]),
 rawCornerAudit:{method:'Every raw R>0 vertex maps to a seed; every texel of each clipped radius2 seed cube is marked, verified via a 3D unmarked-prefix sum.',seedCubesWithUnmarked,axisCases,axisFailures,r1Counterexample},
 macroSha256:before,narrowSha256:sha(narrow),manifestSha256:sha(readFileSync(cache+'/data/manifest.json')),
 sourceVolumeSha256:sha(readFileSync('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/volume.ts')),
 scriptSha256:sha(readFileSync(import.meta.path)),buildAndAuditMs:performance.now()-started,
 caveat:'CPU mask construction and integer support audit only. Existing macro linear sampler footprint/range semantics remain a precondition; no GPU compilation, pixel or performance validation.'};
writeFileSync(directory+'/narrow-r8.bin',narrow);writeFileSync(directory+'/build-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=1;
