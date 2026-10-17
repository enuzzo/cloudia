import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {endianness} from 'node:os';

export const EPS=1e-12;
export const close=(a,b,label)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<EPS,label);
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function layoutBytes(lobes){
 assert.equal(endianness(),'LE');
 let count=1;for(const lobe of lobes)count+=1+lobe.length;
 const values=new Float64Array(count);let at=0;values[at++]=lobes.length;
 for(const lobe of lobes){values[at++]=lobe.length;for(const value of lobe){assert(Number.isFinite(value));values[at++]=value;}}
 return Buffer.from(values.buffer);
}
export const tupleExact=(a,b,label)=>assert(layoutBytes(a).equals(layoutBytes(b)),label);

export function uniformXZ(before,after,ids,delta,label){
 assert.equal(before.length,after.length,`${label}: primitive count`);
 assert.equal(new Set(ids).size,ids.length,`${label}: duplicate IDs`);
 for(const id of ids){
  const a=before[id],b=after[id];assert(a&&b,`${label}: missing ID ${id}`);assert.equal(a.length,b.length);
  close(b[0]-a[0],delta[0],`${label}: X shift ${id}`);close(b[2]-a[2],delta[1],`${label}: Z shift ${id}`);
  for(let component=0;component<a.length;component++)if(component!==0&&component!==2)
   assert(Object.is(a[component],b[component]),`${label}: non-XZ tuple changed ${id}/${component}`);
 }
}

export function pretransformAnchor(before,after,declaredDelta){
 tupleExact(before.liquid,after.liquid,'Raw liquid layout changed during anchoring');
 tupleExact(before.summits,after.summits,'Raw summit layout changed');tupleExact(before.foundations,after.foundations,'Raw foundation layout changed');
 assert.equal(before.iceCores.length,2);assert.equal(after.iceCores.length,2);
 const mature=before.summits.reduce((i,value,index)=>value[1]>=before.summits[i][1]?index:i,0);
 const F=before.foundations[mature].slice(0,3),M=before.summits[mature].slice(0,3),C=before.iceCores[0].slice(0,3);
 assert(M[1]>F[1],'Feeding axis must rise');
 const ratio=(C[1]-F[1])/(M[1]-F[1]);
 const expectedAtY=[F[0]+ratio*(M[0]-F[0]),C[1],F[2]+ratio*(M[2]-F[2])];
 const observedDelta=[after.iceCores[0][0]-C[0],after.iceCores[0][2]-C[2]];
 close(after.iceCores[0][0],expectedAtY[0],'Proximal core must lie on feeding axis at its unchanged Y');
 close(after.iceCores[0][2],expectedAtY[2],'Proximal core must lie on feeding axis in Z');
 close(observedDelta[0],declaredDelta[0],'Declared/raw observed delta X');close(observedDelta[1],declaredDelta[1],'Declared/raw observed delta Z');
 uniformXZ(before.iceCores,after.iceCores,[0,1],observedDelta,'Both raw ice cores');
 return {F,M,C,ratio,expectedProximal:expectedAtY,observedProximal:after.iceCores[0].slice(0,3),declaredDelta:[...declaredDelta],observedDelta};
}

export function contraction(stage){
 const {axis,radius,limit,extent,scale,before,after}=stage;
 assert.equal(before.length,after.length);assert([0,2].includes(axis)&&[3,5].includes(radius));
 const measured=Math.max(...before.map(lobe=>Math.abs(lobe[axis])+lobe[radius]));
 close(measured,extent,'Declared extent differs from actual pre-axis tuples');
 const expectedScale=Math.min(1,limit/measured);assert(scale>0&&scale<=1);close(scale,expectedScale,'Whole-axis scale');
 for(let id=0;id<before.length;id++){
  assert.equal(before[id].length,after[id].length);
  for(let component=0;component<before[id].length;component++){
   if(component===axis||component===radius)close(after[id][component],before[id][component]*expectedScale,`Contraction ${axis}/${id}/${component}`);
   else assert(Object.is(after[id][component],before[id][component]),`Contraction changed another component ${axis}/${id}/${component}`);
  }
 }
 const postExtent=Math.max(...after.map(lobe=>Math.abs(lobe[axis])+lobe[radius]));
 assert(postExtent<=limit+EPS,'Contraction exceeds texture halo limit');
 return {axis,radius,limit,extent:measured,scale,postExtent,primitiveCount:before.length,beforeSHA256:hash(layoutBytes(before)),afterSHA256:hash(layoutBytes(after))};
}

export function recipeIdentity(a,b){
 tupleExact(a.lobes,b.lobes,'Unchanged-family final recipe differs');assert.deepEqual(a.afterRng,b.afterRng,'Unchanged-family RNG differs');
 return {exact:true,lobes:a.lobes.length,layoutSHA256:hash(layoutBytes(a.lobes)),rngStreams:a.afterRng};
}
