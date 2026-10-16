/** Independent finite probes of newly generated leaf metadata, in addition to
 * exact serialized-value/key checks. These are not a universal CPU/GPU proof. */
import {ideal} from './baseline/validate.ts';
import {terrainHeight} from './baseline/landscape.source.ts';
import {CompactLookup,keyForRect,type CompactPack} from './compact.ts';
import type {Node} from './baseline/data.ts';
export function validatePages(nodes:Node[],resident:CompactPack,originalNodeCount:number){
 let seed=0x593ac127;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const leaves=nodes.filter(n=>n.index>=originalNodeCount&&!n.firstChild),lookup=new CompactLookup(resident),failures:any[]=[];let samples=0,ledgerMaxRatio=0;
 const selected=new Set<number>();if(leaves.length)for(let j=0;j<Math.min(2048,leaves.length);j++)selected.add(Math.floor(j*leaves.length/Math.min(2048,leaves.length)));
 for(const j of selected){const n=leaves[j],q=lookup.get(n.index,keyForRect(n.rect,n.level)),g=lookup.getGradient(q),r=q.rect;for(let k=0;k<5;k++){const x=k<4?(k&1?r.x1:r.x0):r.x0+rand()*(r.x1-r.x0),z=k<4?(k&2?r.z1:r.z0):r.z0+rand()*(r.z1-r.z0),v=ideal(x,z),cpu=terrainHeight(x,z);samples++;ledgerMaxRatio=Math.max(ledgerMaxRatio,Math.abs(cpu-v.v)/q.errorKm);const inside=(a:number,b:number,c:number)=>c>=a-1e-10&&c<=b+1e-10;if(!inside(q.height[0],q.height[1],cpu)||!inside(g.gx[0],g.gx[1],v.x)||!inside(g.gz[0],g.gz[1],v.z)||Math.abs(cpu-v.v)>q.errorKm+1e-10)failures.push({kind:'new-page-bound-ledger',node:n.index,key:q.key,x,z,cpu,ideal:v,height:q.height,gradient:g,errorKm:q.errorKm});}}
 return{newLeafCount:leaves.length,selectedLeaves:selected.size,samples,ledgerMaxRatio,failures,failureCount:failures.length,finiteQualified:failures.length===0,universalHostCertificate:false,GPUQualified:false};
}
