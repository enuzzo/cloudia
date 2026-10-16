import {describe,expect,it} from 'vitest';
import {appendTerrainSplitTriangle} from './terrainSplitTriangle';

type Point=readonly [number,number];
type Triangle=readonly [number,number,number];
type Edge=readonly [number,number];
const signedTwiceArea=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const triangles=(out:readonly number[]):Triangle[]=>{
 expect(out.length%3).toBe(0);
 return Array.from({length:out.length/3},(_,i)=>[out[i*3],out[i*3+1],out[i*3+2]] as const);
};
const edges=(face:Triangle):Edge[]=>[[face[0],face[1]],[face[1],face[2]],[face[2],face[0]]];
const directed=(a:number,b:number)=>`${a}>${b}`;
const undirected=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
const splitEdge=(a:number,b:number,mid:number):Edge[]=>mid>=0?[[a,mid],[mid,b]]:[[a,b]];
const canonical=(faces:readonly Triangle[])=>faces.map(([a,b,c])=>[
 `${a},${b},${c}`,`${b},${c},${a}`,`${c},${a},${b}`,
].sort()[0]).sort();

/** Independent topological contract: each boundary halfedge occurs once in its
 * original orientation; every other edge occurs twice with opposite direction.
 * A connected single-boundary patch must also retain Euler characteristic 1.
 */
function inspectPatch(faces:readonly Triangle[],points:ReadonlyMap<number,Point>,boundary:readonly Edge[],expectedTwiceArea:number){
 const incident=new Map<string,Edge[]>(),used=new Set<number>();
 let sumArea=0;
 for(const face of faces){
  expect(new Set(face).size).toBe(3);
  for(const id of face){expect(points.has(id)).toBe(true);used.add(id);}
  const area=signedTwiceArea(points.get(face[0])!,points.get(face[1])!,points.get(face[2])!);
  expect(Math.sign(area)).toBe(Math.sign(expectedTwiceArea));sumArea+=area;
  for(const edge of edges(face)){
   const key=undirected(...edge),list=incident.get(key)??[];list.push(edge);incident.set(key,list);
  }
 }
 expect(sumArea).toBe(expectedTwiceArea);
 const expected=new Set(boundary.map(([a,b])=>directed(a,b)));
 const observed:string[]=[];
 for(const list of incident.values()){
  if(list.length===1){observed.push(directed(...list[0]));}
  else{
   expect(list.length).toBe(2);expect(list[0][0]).toBe(list[1][1]);expect(list[0][1]).toBe(list[1][0]);
  }
 }
 expect(new Set(observed)).toEqual(expected);expect(observed.length).toBe(expected.size);
 expect(used.size-incident.size+faces.length).toBe(1);
 // Connectivity is checked separately from Euler; disjoint patches must fail.
 const visited=new Set<number>(),pending=[...used].slice(0,1);
 while(pending.length){
  const id=pending.pop()!;if(visited.has(id))continue;visited.add(id);
  for(const list of incident.values())for(const [a,b] of list){if(a===id&&!visited.has(b))pending.push(b);if(b===id&&!visited.has(a))pending.push(a);}
 }
 expect(visited.size).toBe(used.size);
}

function checkCoverage(faces:readonly Triangle[],points:ReadonlyMap<number,Point>,samples:readonly Point[]){
 for(const sample of samples){
  let inclusive=0,strict=0;
  for(const face of faces){
   const a=points.get(face[0])!,b=points.get(face[1])!,c=points.get(face[2])!,sign=Math.sign(signedTwiceArea(a,b,c));
   const side=[signedTwiceArea(a,b,sample)*sign,signedTwiceArea(b,c,sample)*sign,signedTwiceArea(c,a,sample)*sign];
   if(side.every(v=>v>=0))inclusive++;
   if(side.every(v=>v>0))strict++;
  }
  expect(inclusive).toBeGreaterThan(0);expect(strict).toBeLessThanOrEqual(1);
 }
}

// Integer/dyadic coordinates make all sample predicates exact here: no epsilon,
// random search, DEM sampler or geometric criterion is part of this proposal.
const triangleSamples=(a:Point,b:Point,c:Point):Point[]=>{
 const samples:Point[]=[];
 for(let i=0;i<8;i++)for(let j=0;j<8;j++){
  const u=(4*i+1)/32,v=(4*j+2)/32;
  if(u+v<1)samples.push([a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]),a[1]+u*(b[1]-a[1])+v*(c[1]-a[1])]);
 }
 return samples;
};
const makePoints=(a:Point,b:Point,c:Point)=>new Map<number,Point>([
 [7,a],[13,b],[29,c],
 [103,[(a[0]+b[0])/2,(a[1]+b[1])/2]],
 [104,[(b[0]+c[0])/2,(b[1]+c[1])/2]],
 [105,[(c[0]+a[0])/2,(c[1]+a[1])/2]],
]);
const masks=[0,1,2,3,4,5,6,7];

describe('eight midpoint masks, oriented area and conformity',()=>{
 it('appends the exact original triplet for mask0 and preserves the caller prefix',()=>{
  const out=[901,902,903];appendTerrainSplitTriangle(out,7,13,29,-1,-1,-1);
  expect(out).toEqual([901,902,903,7,13,29]);
 });
 it.each(masks)('mask %i preserves winding, boundary, disk topology and sampled coverage',mask=>{
  for(const coords of [[[0,0],[8,0],[0,8]],[[1,-2],[9,1],[-2,7]]] as const){
   const [pointA,pointB,pointC]=coords;
   const points=makePoints(pointA,pointB,pointC),ab=mask&1?103:-1,bc=mask&2?104:-1,ca=mask&4?105:-1;
   const out:number[]=[];appendTerrainSplitTriangle(out,7,13,29,ab,bc,ca);
   const faces=triangles(out),boundary=[...splitEdge(7,13,ab),...splitEdge(13,29,bc),...splitEdge(29,7,ca)];
   expect(faces.length).toBe(1+[ab,bc,ca].filter(id=>id>=0).length);
   inspectPatch(faces,points,boundary,signedTwiceArea(pointA,pointB,pointC));
   checkCoverage(faces,points,triangleSamples(pointA,pointB,pointC));
   const allowed=new Set([7,13,29,...[ab,bc,ca].filter(id=>id>=0)]);
   expect(out.every(id=>allowed.has(id))).toBe(true);
   for(const [a,b,mid] of [[7,13,ab],[13,29,bc],[29,7,ca]])if(mid>=0){
    expect(faces.flatMap(edges).some(([x,y])=>undirected(x,y)===undirected(a,b))).toBe(false);
   }
  }
 });
 it.each(masks)('mask %i has the same triangles under cyclic rotations and preserves reversed winding',mask=>{
  const ab=mask&1?103:-1,bc=mask&2?104:-1,ca=mask&4?105:-1;
  const original:number[]=[],rotated1:number[]=[],rotated2:number[]=[],reversed:number[]=[];
  appendTerrainSplitTriangle(original,7,13,29,ab,bc,ca);
  appendTerrainSplitTriangle(rotated1,13,29,7,bc,ca,ab);
  appendTerrainSplitTriangle(rotated2,29,7,13,ca,ab,bc);
  expect(canonical(triangles(rotated1))).toEqual(canonical(triangles(original)));
  expect(canonical(triangles(rotated2))).toEqual(canonical(triangles(original)));
  appendTerrainSplitTriangle(reversed,7,29,13,ca,bc,ab);
  const points=makePoints([0,0],[8,0],[0,8]);
  inspectPatch(triangles(reversed),points,[...splitEdge(7,29,ca),...splitEdge(29,13,bc),...splitEdge(13,7,ab)],-64);
  checkCoverage(triangles(reversed),points,triangleSamples([0,0],[8,0],[0,8]));
 });
});

describe('shared midpoint IDs across ordinary neighbours and an existing stitched fan',()=>{
 it.each(masks)('ordinary neighbours retain opposite seam halfedges for mask %i',mask=>{
  const points=new Map<number,Point>([[0,[0,0]],[1,[8,0]],[2,[0,8]],[3,[4,0]],[4,[4,4]],[5,[0,4]],[6,[8,8]],[7,[8,4]],[8,[4,8]]]);
  const ab=mask&1?3:-1,shared=mask&2?4:-1,ca=mask&4?5:-1;
  const bd=mask&4?7:-1,dc=mask&1?8:-1,out:number[]=[];
  appendTerrainSplitTriangle(out,0,1,2,ab,shared,ca);
  appendTerrainSplitTriangle(out,1,6,2,bd,dc,shared);
  inspectPatch(triangles(out),points,[...splitEdge(0,1,ab),...splitEdge(1,6,bd),...splitEdge(6,2,dc),...splitEdge(2,0,ca)],128);
  const samples:Point[]=[];
  for(let i=0;i<8;i++)for(let j=0;j<8;j++)samples.push([i+.25,j+.5]);
  checkCoverage(triangles(out),points,samples);
 });
 it.each([0,1,2,3])('existing stitch halves accept shared quarter-edge IDs, pattern %i',pattern=>{
  // A-B-M and A-M-C adjoin the B-D-M / M-D-C fan. The existing M is
  // already a vertex; refining B-M or M-C must reuse Q/R on both sides.
  const points=new Map<number,Point>([[0,[-8,0]],[1,[0,0]],[2,[0,8]],[3,[0,4]],[4,[8,4]],[5,[0,2]],[6,[0,6]]]);
  const q=pattern&1?5:-1,r=pattern&2?6:-1,out:number[]=[];
  appendTerrainSplitTriangle(out,0,1,3,-1,q,-1);
  appendTerrainSplitTriangle(out,0,3,2,-1,r,-1);
  appendTerrainSplitTriangle(out,1,4,3,-1,-1,q);
  appendTerrainSplitTriangle(out,3,4,2,-1,-1,r);
  inspectPatch(triangles(out),points,[[0,1],[1,4],[4,2],[2,0]],128);
  checkCoverage(triangles(out),points,[...triangleSamples([-8,0],[0,0],[0,4]),...triangleSamples([-8,0],[0,4],[0,8]),...triangleSamples([0,0],[8,4],[0,4]),...triangleSamples([0,4],[8,4],[0,8])]);
  expect(out.includes(5)).toBe(q>=0);expect(out.includes(6)).toBe(r>=0);
 });
});
