import {trace} from './trace.ts';
import {Lookup,type Pack} from './data.ts';
export function regressions(pack:Pack,matrix:any[]){
 const rows:any[]=[],failures:any[]=[];
 const poses=[...matrix,{name:'far-sea-relief-zero',origin:[0,2,0],ray:[Math.sqrt(1-.045**2),-.045,0]}];
 for(const p of poses){const physical:any[]=[];
  for(const scale of[.5,1,2]){const r=trace({...p,ray:p.ray.map((x:number)=>x*scale)},new Lookup(pack),{maxHeightEvaluations:128}),span=r.interval?.map((x:number)=>x*scale);rows.push({name:p.name,scale,status:r.status,physicalIntervalKm:span,heightEvaluations:r.heightEvaluations,seaOnly:r.seaOnly??false});physical.push({r,span});}
  const base=physical[1];for(const other of[physical[0],physical[2]]){if(base.r.status!==other.r.status)failures.push({kind:'ray-scaling-status',name:p.name,base:base.r.status,current:other.r.status});if(base.span&&other.span&&(base.span[0]>other.span[1]+.001||other.span[0]>base.span[1]+.001))failures.push({kind:'ray-scaling-enclosure',name:p.name,base:base.span,current:other.span});}
 }
 for(const [name,pose,options]of[['zero-ray',{name:'zero',origin:[0,2,0],ray:[0,0,0]},{}],['nan-ray',{name:'nan',origin:[0,2,0],ray:[NaN,1,0]},{}],['shrunk-ledger',poses[0],{errorScale:.5}]] as const){let rejected=false;try{trace(pose as any,new Lookup(pack),options);}catch{rejected=true;}if(!rejected)failures.push({kind:'invalid-input-not-rejected',name});}
 return{rows,failureCount:failures.length,failures};
}
