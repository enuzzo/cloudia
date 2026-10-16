/** Exact multi-source 26-neighbour BFS from existing frozen occupancy. No cloud bake/GPU. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/narrow-cloud/empty-certificate-research';
const hash=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const input=readFileSync(path+'/../narrow-r8.bin');
if(input.length!==128**3||hash(input)!=='ad38c2b581882a0686e3d81031e0972fbd1cc0fb4bb9dab09c43451387e418ad')throw new Error('Frozen mask mismatch');
const N=128,n=N**3,d=new Uint8Array(n);d.fill(255);const queue=new Uint32Array(n);let tail=0;
for(let i=0;i<n;i++)if(input[i]>0){d[i]=0;queue[tail++]=i;}
const occupied=tail,started=performance.now();
if(occupied===0)throw new Error('This diagnostic expects nonempty occupied support.');
for(let head=0;head<tail;head++){
 const i=queue[head],x=i%N,y=(i>>>7)%N,z=i>>>14,nd=d[i]+1;
 for(let dz=-1;dz<=1;dz++){const zz=z+dz;if(zz<0||zz>=N)continue;
  for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=N)continue;
   const base=(zz*N+yy)*N;
   for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=N)continue;const j=base+xx;
    if(d[j]===255){d[j]=nd;queue[tail++]=j;}
   }
  }
 }
}
const histogram:Array<number>=[];let mappingErrors=0,maxD=0;
for(let i=0;i<n;i++){histogram[d[i]]=(histogram[d[i]]??0)+1;maxD=Math.max(maxD,d[i]);if((input[i]>0)!==(d[i]===0))mappingErrors++;}
// Independent brute-force L-infinity minima at 64 deterministic cells.
let bruteErrors=0;const cases=[];
for(let k=0;k<64;k++){
 const i=(Math.imul(k+1,1664525)+1013904223)>>>0,j=i%n,x=j%N,y=(j>>>7)%N,z=j>>>14;let best=N;
 for(let s=0;s<occupied;s++){const at=queue[s],dd=Math.max(Math.abs(x-at%N),Math.abs(y-(at>>>7)%N),Math.abs(z-(at>>>14)));best=Math.min(best,dd);if(best===0)break;}
 if(best!==d[j])bruteErrors++;cases.push({index:j,distance:d[j],brute:best});
}
if(tail!==n||maxD===255||mappingErrors||bruteErrors)throw new Error('Distance qualification failed');
writeFileSync(path+'/distance-r8.bin',d);
const report={kind:'exact-chebyshev-26-bfs',newBakes:0,gpuExecuted:false,size:N,inputSha256:hash(input),distanceSha256:hash(d),scriptSha256:hash(readFileSync(import.meta.path)),occupied,visited:tail,maxD,histogram,mappingErrors,bruteErrors,bruteCases:cases,wallMs:performance.now()-started,
 encoding:'D=0 occupied; D>=1 empty. Distinct from original binary255 occupied/0 empty. R8Unorm decoding must round(load.r*255). No new GPU resource.',
 geometry:'All cells with index distance <=D-1 are empty; (D-1)*min(cellSize) is a conservative L-infinity radius from any point in the queried nearest cell, with clamp projection handled separately.'};
writeFileSync(path+'/distance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',occupied,visited:tail,maxD,mappingErrors,bruteErrors,wallMs:report.wallMs,distanceSha256:report.distanceSha256}));
