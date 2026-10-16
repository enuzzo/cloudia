/** These view and budget choices are fixed before any replay or page build.
 * No expected CPU status, hit distance, witness or oracle result enters page selection. */
import type {Pose} from './trace-compact.ts';
import {SOURCE_SHA,LEDGER_VERSION,PageBuilder,decodeKey,keyForRect,type PageRequest,type Key} from './compact.ts';
export const PROTOCOL={heightCap:16,visits:256,stack:48,toleranceKm:.001,targetPageKm:.25,maxBytes:8*1024*1024,trainingRounds:3,neighborPolicy:'four face neighbors of the blocking leaf, from current metadata only; primary requests first',primaryUnresolvedGate:333,metadataRecordReductionGate:.5,holdoutYawRad:.003} as const;
const f=Math.fround;
export function cleanPose(r:any):Pose{return{name:r.name,origin:[...r.origin],ray:[...r.ray]};}
function offset(p:Pose,yaw:number,pitch:number,name:string):Pose{
 const speed=Math.hypot(...p.ray),theta=Math.atan2(p.ray[2],p.ray[0])+yaw,phi=Math.asin(p.ray[1]/speed)+pitch,c=Math.cos(phi)*speed;
 return{name,origin:[...p.origin],ray:[f(c*Math.cos(theta)),f(Math.sin(phi)*speed),f(c*Math.sin(theta))]};
}
export function bundles(rays:any[]){
 const find=(name:string)=>{const r=rays.find(r=>r.name===name);if(!r)throw Error('Missing declared bundle seed '+name);return cleanPose(r);};
 const seeds=[find('home-down-1-5'),find('coastal-horizon-0-14'),{name:'coast-transition-designed-view',origin:[16,2.5,0],ray:[f(-Math.sqrt(1-.4**2)),f(-.4),0]}];
 const training:Pose[]=[],holdout:Pose[]=[],yawHoldout:Pose[]=[];
 for(const seed of seeds){for(const x of[-1,0,1])for(const y of[-1,0,1])training.push(offset(seed,x*.001,y*.001,`train:${seed.name}:${x}:${y}`));for(const x of[-1.5,-.5,.5,1.5])for(const y of[-1.5,-.5,.5,1.5])holdout.push(offset(seed,x*.001,y*.001,`holdout:${seed.name}:${x}:${y}`));for(const yaw of[-.003,.003])for(const pitch of[-.001,0,.001])yawHoldout.push(offset(seed,yaw,pitch,`yaw-holdout:${seed.name}:${yaw}:${pitch}`));}
 const controls=[find('coastal-horizon-38-17'),find('low-x-16-dy0')];return{training,holdout,yawHoldout,controls};
}
export function requestsFromNormalCap(rows:any[]):PageRequest[]{
 const seen=new Set<Key>(),requests:PageRequest[]=[];
 for(const r of rows){if(!r.status.startsWith('unresolved')||r.blockerKey===null||r.blockerKey===undefined)continue;const key=r.blockerKey;decodeKey(key);if(seen.has(key))continue;seen.add(key);requests.push({key,targetKm:PROTOCOL.targetPageKm,sourceSha256:SOURCE_SHA,ledgerVersion:LEDGER_VERSION,kind:'blocker',from:r.name});}
 return requests.sort((a,b)=>a.key-b.key);
}
export function neighborRequests(builder:PageBuilder,primary:PageRequest[]):PageRequest[]{const seen=new Set(primary.map(r=>r.key)),out:PageRequest[]=[];for(const p of primary)for(const key of builder.neighbors(p.key)){if(seen.has(key))continue;seen.add(key);out.push({...p,key,kind:'neighbor-prefetch',from:'face-neighbor-of:'+p.key});}return out.sort((a,b)=>a.key-b.key);}
