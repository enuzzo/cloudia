import type {TerrainMeshData,TerrainMeshRefinement,TerrainSampler} from './terrainMesh';

export interface TerrainSourcePatchOptions {coreHalfExtentKm:number;outerCutKm:number}
export interface TerrainSourcePatchLookup {
 coreHalfExtentKm:number;outerCutKm:number;spacingKm:number;cells:number;coreFirstIndex:number;queryPaddingKm:number;
 /** Per-side CSR bins contain triangle index offsets, not vertex IDs. */
 seam:readonly {first:Uint32Array;faces:Uint32Array}[];
}
export interface TerrainSourcePatchStats {
 coreHalfExtentKm:number;outerCutKm:number;sourceSpacingKm:number;
 coreVertices:number;coreTriangles:number;outerVertices:number;outerTriangles:number;seamTriangles:number;
 newSampleCalls:number;lookupBytes:number;prePatchSampleCalls:number;prePatchStitchedCells:number;
 prePatchRefinement:TerrainMeshData['stats']['refinement'];
}

/** Replace the interior only after the ordinary one-pass refinement. The old
 * outer faces retain their vertex/surface values and cell traversal order.
 * This helper does not evaluate normals or introduce a second height formula.
 */
export function applyTerrainSourcePatch(base:TerrainMeshData,sample:TerrainSampler,plan:TerrainMeshRefinement,
 option:TerrainSourcePatchOptions,surfaceY:(x:number,z:number,height:number)=>number,isStitchCell:(cell:number)=>boolean):TerrainMeshData{
 const H=option.coreHalfExtentKm,C=option.outerCutKm,g=plan.sourceGrid,s=g.spacingKm,{limits}=plan;
 if(![H,C].every(Number.isFinite)||!(H>0&&C>H&&C<base.stats.outerExtentKm)||H!==Math.fround(H)||C!==Math.fround(C)
  ||base.stats.normalMode!=='geometry'||!base.stats.refinement)throw new RangeError('Invalid terrain source patch configuration');
 const firstX=(-H-g.minXKm)/s,firstZ=(-H-g.minZKm)/s,n=2*H/s;
 if(![firstX,firstZ,n].every(Number.isSafeInteger)||n<1||firstX<0||firstZ<0||firstX+n>=g.columns||firstZ+n>=g.rows
  ||plan.domain.minXKm> -H||plan.domain.maxXKm<H||plan.domain.minZKm> -H||plan.domain.maxZKm<H)
  throw new RangeError('Terrain source patch is not a closed source-node square');
 // The cut must be an existing ring grid line, not an arbitrary clip plane.
 if(!Array.from({length:base.stats.levels},(_,level)=>{
  const step=base.stats.baseSpacingKm*2**level,k=Math.round(C/step);
  return k>=base.stats.cellsPerSide/4&&k<=base.stats.cellsPerSide/2&&Math.fround(k*step)===C;
 }).some(Boolean))throw new RangeError('Terrain source patch cut is not a ring grid line');
 const coreVertices=(n+1)*(n+1),coreTriangles=2*n*n;
 const budget=(vertices:number,triangles:number)=>{
  if(![vertices,triangles,32*vertices+12*triangles].every(Number.isSafeInteger)||vertices>0x7fffffff||triangles*3>0xffffffff||vertices>limits.maxVertices||triangles>limits.maxTriangles
   ||32*vertices+12*triangles>limits.maxGeometryBytes)throw new RangeError('Terrain source patch geometry budget exceeded; no truncation');
 };
 budget(coreVertices,coreTriangles);
 const p=base.positions,oldVertices=base.stats.vertices,oldToNew=new Int32Array(oldVertices).fill(-1),keep=new Uint8Array(base.stats.triangles);
 const edgeSets=[new Set<string>(),new Set<string>(),new Set<string>(),new Set<string>()];
 const boundary=[new Set<number>(),new Set<number>(),new Set<number>(),new Set<number>()];
 let outerVertices=0,outerTriangles=0;
 const map=(id:number)=>{if(oldToNew[id]<0)oldToNew[id]=outerVertices++;return oldToNew[id];};
 const onSide=(id:number,side:number)=>side===0?p[id*3+2]===-C&&Math.abs(p[id*3])<=C:side===1?p[id*3]===C&&Math.abs(p[id*3+2])<=C:side===2?p[id*3+2]===C&&Math.abs(p[id*3])<=C:p[id*3]===-C&&Math.abs(p[id*3+2])<=C;
 const edgeKey=(a:number,b:number)=>a<b?`${a},${b}`:`${b},${a}`;
 for(let face=0;face<base.stats.triangles;face++){
  const ids=[base.indices[face*3],base.indices[face*3+1],base.indices[face*3+2]];
  const outside=ids.every(id=>p[id*3]>=C)||ids.every(id=>p[id*3]<=-C)||ids.every(id=>p[id*3+2]>=C)||ids.every(id=>p[id*3+2]<=-C);
  if(!outside){
   if(!ids.every(id=>Math.abs(p[id*3])<=C&&Math.abs(p[id*3+2])<=C))throw new RangeError('Terrain source patch cut crosses an old face');
   continue;
  }
  keep[face]=1;outerTriangles++;ids.forEach(map);
  for(let side=0;side<4;side++)for(let e=0;e<3;e++){
   const a=ids[e],b=ids[(e+1)%3];if(!onSide(a,side)||!onSide(b,side))continue;
   const key=edgeKey(a,b);if(edgeSets[side].has(key))throw new RangeError('Duplicate terrain source patch boundary edge');
   edgeSets[side].add(key);boundary[side].add(a);boundary[side].add(b);
  }
 }
 // Positive side parameter follows SW→SE→NE→NW. Each strip has identical
 // corner IDs to its neighbours; refined green midpoints remain on the chain.
 const parameter=(id:number,side:number)=>(side===0?p[id*3]:side===1?p[id*3+2]:side===2?-p[id*3]:-p[id*3+2]);
 const outer=boundary.map((set,side)=>{
  const chain=[...set].sort((a,b)=>parameter(a,side)-parameter(b,side));
  if(chain.length<2||parameter(chain[0],side)!==-C||parameter(chain[chain.length-1],side)!==C||edgeSets[side].size!==chain.length-1)
   throw new RangeError('Incomplete terrain source patch outer boundary');
  for(let i=1;i<chain.length;i++)if(!(parameter(chain[i-1],side)<parameter(chain[i],side))||!edgeSets[side].has(edgeKey(chain[i-1],chain[i])))
   throw new RangeError('Nonconforming terrain source patch boundary chain');
  return chain.map(id=>oldToNew[id]);
 });
 for(let side=0;side<4;side++)if(outer[side][outer[side].length-1]!==outer[(side+1)%4][0])throw new RangeError('Unwelded terrain source patch outer corner');
 const seamTriangles=outer.reduce((sum,chain)=>sum+n+chain.length-1,0),vertices=outerVertices+coreVertices,triangles=outerTriangles+coreTriangles+seamTriangles;
 budget(vertices,triangles);
 const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),surface=new Float32Array(vertices*2),indices=new Uint32Array(triangles*3);
 for(let old=0;old<oldVertices;old++)if(oldToNew[old]>=0){const id=oldToNew[old];positions.set(p.subarray(old*3,old*3+3),id*3);normals.set(base.normals.subarray(old*3,old*3+3),id*3);surface.set(base.surface.subarray(old*2,old*2+2),id*2);}
 const cellFirstIndex=new Uint32Array(base.cellFirstIndex.length).fill(0xffffffff),cellTriangleCount=new Uint8Array(base.cellFirstIndex.length);
 let cursor=0,oldCursor=0,stitchedCells=0;
 for(let cell=0;cell<base.cellFirstIndex.length;cell++){
  const first=base.cellFirstIndex[cell];if(first===0xffffffff)continue;
  const count=base.cellTriangleCount?.[cell];if(first!==oldCursor||!count)throw new RangeError('Terrain source patch old cell traversal differs');
  const start=cursor;
  for(let t=0;t<count;t++){const i=first+t*3;if(!keep[i/3])continue;for(let e=0;e<3;e++)indices[cursor++]=oldToNew[base.indices[i+e]];}
  if(cursor>start){cellFirstIndex[cell]=start;cellTriangleCount[cell]=(cursor-start)/3;if(isStitchCell(cell))stitchedCells++;}
  oldCursor+=count*3;
 }
 if(oldCursor!==base.indices.length||cursor!==outerTriangles*3)throw new RangeError('Terrain source patch outer traversal incomplete');
 let minHeight=Infinity,maxHeight=-Infinity;
 for(let i=0;i<outerVertices;i++){minHeight=Math.min(minHeight,surface[i*2]);maxHeight=Math.max(maxHeight,surface[i*2]);}
 const coreID=(ix:number,iz:number)=>outerVertices+iz*(n+1)+ix;
 for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
  const x=g.minXKm+(firstX+ix)*s,z=g.minZKm+(firstZ+iz)*s,v=sample(x,z),id=coreID(ix,iz);
  if(![x,z,v.heightKm,v.slopeX,v.slopeZ,v.coastKm].every(Number.isFinite)||v.heightKm<0)throw new RangeError('Invalid terrain source patch node sample');
  positions[id*3]=x;positions[id*3+1]=surfaceY(x,z,v.heightKm);positions[id*3+2]=z;normals[id*3+1]=1;surface[id*2]=v.heightKm;surface[id*2+1]=v.coastKm;
  if(!Number.isFinite(positions[id*3+1]))throw new RangeError('Nonfinite terrain source patch Float32 position');
  minHeight=Math.min(minHeight,v.heightKm);maxHeight=Math.max(maxHeight,v.heightKm);
 }
 const coreFirstIndex=cursor;
 for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){
  const sw=coreID(ix,iz),nw=coreID(ix,iz+1),ne=coreID(ix+1,iz+1),se=coreID(ix+1,iz);
  indices.set([sw,nw,ne,sw,ne,se],cursor);cursor+=6;
 }
 const inner=[Array.from({length:n+1},(_,i)=>coreID(i,0)),Array.from({length:n+1},(_,i)=>coreID(n,i)),
  Array.from({length:n+1},(_,i)=>coreID(n-i,n)),Array.from({length:n+1},(_,i)=>coreID(0,n-i))];
 const seam:TerrainSourcePatchLookup['seam'][number][]=[];let maximumFaceSpan=s;
 for(let side=0;side<4;side++){
  const a=inner[side],b=outer[side],bins:number[][]=Array.from({length:n},()=>[]);let ai=0,bi=0;
  const t=(id:number,radius:number)=>(parameterNew(id,side)+radius)/(2*radius);
  function parameterNew(id:number,which:number){return which===0?positions[id*3]:which===1?positions[id*3+2]:which===2?-positions[id*3]:-positions[id*3+2];}
  const emit=(ids:readonly number[])=>{
   const [u,v,w]=ids.map(id=>id*3),up=(positions[v+2]-positions[u+2])*(positions[w]-positions[u])-(positions[v]-positions[u])*(positions[w+2]-positions[u+2]);
   if(!(up>0))throw new RangeError('Degenerate or reversed terrain source patch seam');
   maximumFaceSpan=Math.max(maximumFaceSpan,Math.max(positions[u],positions[v],positions[w])-Math.min(positions[u],positions[v],positions[w]),Math.max(positions[u+2],positions[v+2],positions[w+2])-Math.min(positions[u+2],positions[v+2],positions[w+2]));
   const params=ids.map(id=>t(id,id<outerVertices?C:H)),lo=Math.max(0,Math.min(n-1,Math.floor(Math.min(...params)*n))),hi=Math.max(0,Math.min(n-1,Math.floor(Math.max(...params)*n)));
   for(let bin=lo;bin<=hi;bin++)bins[bin].push(cursor);
   indices.set(ids,cursor);cursor+=3;
  };
  while(ai<a.length-1||bi<b.length-1){
   if(bi===b.length-1||(ai<a.length-1&&t(a[ai+1],H)<=t(b[bi+1],C))){emit([a[ai],a[ai+1],b[bi]]);ai++;}
   else{emit([a[ai],b[bi+1],b[bi]]);bi++;}
  }
  const first=new Uint32Array(n+1);for(let i=0;i<n;i++)first[i+1]=first[i]+bins[i].length;
  const faces=new Uint32Array(first[n]);for(let i=0;i<n;i++)faces.set(bins[i],first[i]);seam.push({first,faces});
 }
 if(cursor!==indices.length)throw new RangeError('Terrain source patch triangle count differs');
 // The existing barycentric test accepts weights down to -1e-7. A candidate
 // can therefore lie slightly outside a projected face AABB; route that band.
 const lookup:TerrainSourcePatchLookup={coreHalfExtentKm:H,outerCutKm:C,spacingKm:s,cells:n,coreFirstIndex,seam,queryPaddingKm:4e-7*maximumFaceSpan+32*Number.EPSILON*Math.max(1,C)};
 const lookupBytes=cellFirstIndex.byteLength+cellTriangleCount.byteLength+seam.reduce((bytes,row)=>bytes+row.first.byteLength+row.faces.byteLength,0);
 const sourcePatch:TerrainSourcePatchStats={coreHalfExtentKm:H,outerCutKm:C,sourceSpacingKm:s,coreVertices,coreTriangles,outerVertices,outerTriangles,seamTriangles,
  newSampleCalls:coreVertices,lookupBytes,prePatchSampleCalls:base.stats.sampleCalls,prePatchStitchedCells:base.stats.stitchedCells,prePatchRefinement:base.stats.refinement};
 const oldStats={...base.stats};delete oldStats.refinement;
 return {positions,normals,surface,indices,cellFirstIndex,cellTriangleCount,sourcePatchLookup:lookup,stats:{...oldStats,vertices,triangles,stitchedCells,geometryBytes:32*vertices+12*triangles,
  sampleCalls:base.stats.sampleCalls+coreVertices,minimumHeightKm:minHeight,maximumHeightKm:maxHeight,sourcePatch}};
}

/** Enumerate a fixed local candidate set; the caller applies its ordinary
 * Float32-triangle barycentric test and maximum-height boundary rule. */
export function terrainSourcePatchFaces(data:TerrainMeshData,x:number,z:number,visit:(indexOffset:number)=>void):void{
 const patch=data.sourcePatchLookup;if(!patch)return;
 const {coreHalfExtentKm:H,outerCutKm:C,spacingKm:s,cells:n,coreFirstIndex:first}=patch,r=Math.max(Math.abs(x),Math.abs(z));
 const tolerance=patch.queryPaddingKm;
 if(r<=H+tolerance){
  const cx=Math.floor((x+H)/s),cz=Math.floor((z+H)/s);
  for(let iz=cz-1;iz<=cz+1;iz++)for(let ix=cx-1;ix<=cx+1;ix++)if(ix>=0&&ix<n&&iz>=0&&iz<n){const offset=first+(iz*n+ix)*6;visit(offset);visit(offset+3);}
 }
 if(r<H-tolerance||r>C+tolerance)return;
 // Checking both adjacent bins also covers roundoff at radial strip corners.
 for(let side=0;side<4;side++){
  const radius=side===0?-z:side===1?x:side===2?z:-x;if(radius<=0)continue;
  const coordinate=side===0?x:side===1?z:side===2?-x:-z,u=(coordinate/radius+1)*.5,bin=Math.max(0,Math.min(n-1,Math.floor(u*n))),row=patch.seam[side];
  for(let j=Math.max(0,bin-1);j<=Math.min(n-1,bin+1);j++)for(let k=row.first[j];k<row.first[j+1];k++)visit(row.faces[k]);
 }
}
