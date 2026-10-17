export type AttachmentPoint=readonly [number,number,number];
export type AttachmentLobe=readonly [number,number,number,number,number,number,number?];
export interface UpdraftAttachmentResult {
 status:'axis-coincident'|'already-contained'|'attached';
 axisPoint:[number,number,number];directionXZ:[number,number];headDistanceKm:number;
 /** No ray direction exists for an axis-coincident head. */
 boundaryDistanceKm:number|null;translationXZ:[number,number];
 /** Exact quadric ray intervals, sorted by entry; not a density certificate. */
 intervals:readonly (readonly [number,number])[];
}

/** Place a young head centre on the ray-connected mature core boundary.
 * Inputs are already contracted world-space primitives. The function is pure;
 * it neither scales a radius nor samples a field, noise, or density volume.
 */
export function prepareUpdraftAttachment(matureFoot:AttachmentPoint,matureHead:AttachmentPoint,
 matureBody:readonly AttachmentLobe[],youngHead:AttachmentPoint):UpdraftAttachmentResult {
 if(![...matureFoot,...matureHead,...youngHead].every(Number.isFinite)||!(matureHead[1]>matureFoot[1])||!matureBody.length)
  throw new RangeError('Invalid updraft attachment axis or head');
 for(const lobe of matureBody)if(!lobe.slice(0,6).every(Number.isFinite)||!(lobe[3]>0&&lobe[4]>0&&lobe[5]>0))
  throw new RangeError('Invalid updraft attachment body');
 const height=(youngHead[1]-matureFoot[1])/(matureHead[1]-matureFoot[1]);
 const axisPoint:[number,number,number]=[matureFoot[0]+(matureHead[0]-matureFoot[0])*height,youngHead[1],matureFoot[2]+(matureHead[2]-matureFoot[2])*height];
 const dx=youngHead[0]-axisPoint[0],dz=youngHead[2]-axisPoint[2],headDistanceKm=Math.hypot(dx,dz);
 if(!axisPoint.every(Number.isFinite)||!Number.isFinite(headDistanceKm))throw new RangeError('Nonfinite updraft attachment ray');
 const atOrigin=(lobe:AttachmentLobe)=>((axisPoint[0]-lobe[0])/lobe[3])**2+((axisPoint[1]-lobe[1])/lobe[4])**2+((axisPoint[2]-lobe[2])/lobe[5])**2-1;
 if(!matureBody.some(lobe=>atOrigin(lobe)<=0))throw new RangeError('Updraft attachment axis is outside the mature body');
 if(headDistanceKm===0)return {status:'axis-coincident',axisPoint,directionXZ:[0,0],headDistanceKm,boundaryDistanceKm:null,translationXZ:[0,0],intervals:[]};
 const directionXZ:[number,number]=[dx/headDistanceKm,dz/headDistanceKm],intervals:Array<[number,number]>=[];
 for(const lobe of matureBody){
  const x=axisPoint[0]-lobe[0],z=axisPoint[2]-lobe[2],rx2=lobe[3]**2,rz2=lobe[5]**2;
  const a=directionXZ[0]**2/rx2+directionXZ[1]**2/rz2;
  const b=2*(x*directionXZ[0]/rx2+z*directionXZ[1]/rz2),c=atOrigin(lobe),discriminant=b*b-4*a*c;
  if(![a,b,c,discriminant].every(Number.isFinite)||!(a>0))throw new RangeError('Nonfinite updraft attachment quadric');
  if(discriminant<0)continue;
  // Stable quadratic roots avoid cancellation at an almost radial boundary.
  const root=Math.sqrt(discriminant),q=-.5*(b+(b<0?-root:root));
  const first=q===0?0:q/a,second=q===0?0:c/q;
  if(!Number.isFinite(first)||!Number.isFinite(second))throw new RangeError('Nonfinite updraft attachment interval');
  intervals.push([Math.min(first,second),Math.max(first,second)]);
 }
 intervals.sort((a,b)=>a[0]-b[0]);
 let boundaryDistanceKm:number|null=null;
 for(const [entry,exit] of intervals){
  if(boundaryDistanceKm===null){if(entry<=0&&exit>=0)boundaryDistanceKm=exit;}
  else if(entry<=boundaryDistanceKm)boundaryDistanceKm=Math.max(boundaryDistanceKm,exit);
  else break;
 }
 if(boundaryDistanceKm===null||!Number.isFinite(boundaryDistanceKm))throw new RangeError('Updraft attachment has no axis-connected body interval');
 if(headDistanceKm<=boundaryDistanceKm)return {status:'already-contained',axisPoint,directionXZ,headDistanceKm,boundaryDistanceKm,translationXZ:[0,0],intervals};
 const amount=boundaryDistanceKm-headDistanceKm;
 const translationXZ:[number,number]=[directionXZ[0]*amount,directionXZ[1]*amount];
 if(!translationXZ.every(Number.isFinite))throw new RangeError('Nonfinite updraft attachment translation');
 return {status:'attached',axisPoint,directionXZ,headDistanceKm,boundaryDistanceKm,translationXZ,intervals};
}
