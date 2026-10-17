import type {TerrainMeshData,TerrainMeshRefinement,TerrainSampler} from './terrainMesh';

export interface TerrainSourcePatchOptions {coreHalfExtentKm:number;outerCutKm:number;retainedInnerHalfExtentKm?:number}
interface SeamLookup {innerHalfExtentKm:number;outerHalfExtentKm:number;bins:number;paddingKm:number;sides:readonly {first:Uint32Array;faces:Uint32Array}[]}
export interface TerrainSourcePatchLookup {
 coreHalfExtentKm:number;spacingKm:number;cells:number;sourceFirstIndex:number;cellRows:Uint32Array;
 holeFirst:number;holeLast:number;sourceHoleHalfExtentKm?:number;queryPaddingKm:number;seams:readonly SeamLookup[];
}
export interface TerrainSourcePatchStats {
 coreHalfExtentKm:number;outerCutKm:number;sourceSpacingKm:number;retainedInnerHalfExtentKm?:number;sourceHoleHalfExtentKm?:number;
 sourceVertices:number;sourceTriangles:number;innerVertices:number;innerTriangles:number;outerVertices:number;outerTriangles:number;
 innerSeamTriangles:number;outerSeamTriangles:number;seamTriangles:number;coreVertices?:number;coreTriangles?:number;
 newSampleCalls:number;lookupBytes:number;prePatchSampleCalls:number;prePatchStitchedCells:number;
 prePatchRefinement:TerrainMeshData['stats']['refinement'];
}

/** Retain actual v61 near/outer faces and insert source-node triangles only in
 * the intervening annulus. An omitted inner cut preserves the uniform R1 mesh.
 * No normals, alternate height formula, new seam vertex or geometric clipper.
 */
export function applyTerrainSourcePatch(base:TerrainMeshData,sample:TerrainSampler,plan:TerrainMeshRefinement,
 option:TerrainSourcePatchOptions,surfaceY:(x:number,z:number,height:number)=>number,isStitchCell:(cell:number)=>boolean):TerrainMeshData{
 const H=option.coreHalfExtentKm,C=option.outerCutKm,I=option.retainedInnerHalfExtentKm,g=plan.sourceGrid,s=g.spacingKm,{limits}=plan;
 if(![H,C].every(Number.isFinite)||!(H>0&&C>H&&C<base.stats.outerExtentKm)||H!==Math.fround(H)||C!==Math.fround(C)
  ||base.stats.normalMode!=='geometry'||!base.stats.refinement||I!==undefined&&(!Number.isFinite(I)||I<=0||I>=H||I!==Math.fround(I)))
  throw new RangeError('Invalid terrain source patch configuration');
 const firstX=(-H-g.minXKm)/s,firstZ=(-H-g.minZKm)/s,n=2*H/s;
 if(![firstX,firstZ,n].every(Number.isSafeInteger)||n<1||(n+1)*(n+1)>limits.maxProbeCount||firstX<0||firstZ<0||firstX+n>=g.columns||firstZ+n>=g.rows
  ||plan.domain.minXKm> -H||plan.domain.maxXKm<H||plan.domain.minZKm> -H||plan.domain.maxZKm<H)
  throw new RangeError('Terrain source patch is not a closed source-node square');
 const ringCut=(radius:number)=>Array.from({length:base.stats.levels},(_,level)=>{
  const step=base.stats.baseSpacingKm*2**level,k=Math.round(radius/step);
  return k>=base.stats.cellsPerSide/4&&k<=base.stats.cellsPerSide/2&&Math.fround(k*step)===radius;
 }).some(Boolean);
 if(!ringCut(C)||I!==undefined&&!ringCut(I))throw new RangeError('Terrain source patch cut is not a ring grid line');
 // Strictly outside the actual Float32 inner cut, on the declared node grid.
 // Reflection in this symmetric source square yields the opposite node too.
 const holeLast=I===undefined?0:Math.floor((I+H)/s)+1,holeFirst=I===undefined?0:n-holeLast,J=I===undefined?undefined:-H+holeLast*s;
 if(J!==undefined&&(!(J>I!&&J<H)||J!==Math.fround(J)||holeFirst<0))throw new RangeError('Terrain source annulus has no closed node band');
 const inHoleRow=(iz:number)=>J!==undefined&&iz>holeFirst&&iz<holeLast;
 const holeCells=J===undefined?0:holeLast-holeFirst,vertexRows=new Uint32Array(n+2),cellRows=new Uint32Array(n+1);
 for(let iz=0;iz<=n;iz++)vertexRows[iz+1]=vertexRows[iz]+n+1-(inHoleRow(iz)?holeCells-1:0);
 for(let iz=0;iz<n;iz++)cellRows[iz+1]=cellRows[iz]+n-(J!==undefined&&iz>=holeFirst&&iz<holeLast?holeCells:0);
 const sourceVertices=vertexRows[n+1],sourceTriangles=cellRows[n]*2;
 const budget=(vertices:number,triangles:number)=>{
  if(![vertices,triangles,32*vertices+12*triangles].every(Number.isSafeInteger)||vertices>0x7fffffff||triangles*3>0xffffffff||vertices>limits.maxVertices||triangles>limits.maxTriangles
   ||32*vertices+12*triangles>limits.maxGeometryBytes)throw new RangeError('Terrain source patch geometry budget exceeded; no truncation');
 };
 budget(sourceVertices,sourceTriangles);
 const p=base.positions,oldToNew=new Int32Array(base.stats.vertices).fill(-1),keep=new Uint8Array(base.stats.triangles);
 const boundaries=[I,C].map(()=>({edges:Array.from({length:4},()=>new Set<string>()),nodes:Array.from({length:4},()=>new Set<number>())}));
 let retainedVertices=0,innerVertices=0,outerVertices=0,innerTriangles=0,outerTriangles=0;
 const map=(id:number,kind:number)=>{if(oldToNew[id]<0){oldToNew[id]=retainedVertices++;if(kind===1)innerVertices++;else outerVertices++;}return oldToNew[id];};
 const inside=(ids:number[],r:number)=>ids.every(id=>Math.abs(p[id*3])<=r&&Math.abs(p[id*3+2])<=r);
 const outside=(ids:number[],r:number)=>ids.every(id=>p[id*3]>=r)||ids.every(id=>p[id*3]<=-r)||ids.every(id=>p[id*3+2]>=r)||ids.every(id=>p[id*3+2]<=-r);
 const onSide=(id:number,side:number,r:number)=>side===0?p[id*3+2]===-r&&Math.abs(p[id*3])<=r:side===1?p[id*3]===r&&Math.abs(p[id*3+2])<=r:side===2?p[id*3+2]===r&&Math.abs(p[id*3])<=r:p[id*3]===-r&&Math.abs(p[id*3+2])<=r;
 const edgeKey=(a:number,b:number)=>a<b?`${a},${b}`:`${b},${a}`;
 for(let face=0;face<base.stats.triangles;face++){
  const ids=[base.indices[face*3],base.indices[face*3+1],base.indices[face*3+2]],kind=I!==undefined&&inside(ids,I)?1:outside(ids,C)?2:0;
  if(!kind){if(!inside(ids,C)||I!==undefined&&!outside(ids,I))throw new RangeError('Terrain source patch cut crosses an old face');continue;}
  keep[face]=kind;if(kind===1)innerTriangles++;else outerTriangles++;ids.forEach(id=>map(id,kind));
  const radius=kind===1?I!:C,boundary=boundaries[kind-1];
  for(let side=0;side<4;side++)for(let e=0;e<3;e++){
   const a=ids[e],b=ids[(e+1)%3];if(!onSide(a,side,radius)||!onSide(b,side,radius))continue;
   const key=edgeKey(a,b);if(boundary.edges[side].has(key))throw new RangeError('Duplicate terrain source patch boundary edge');
   boundary.edges[side].add(key);boundary.nodes[side].add(a);boundary.nodes[side].add(b);
  }
 }
 // SW→SE→NE→NW chains share their actual corner IDs, including green nodes.
 const parameter=(id:number,side:number)=>(side===0?p[id*3]:side===1?p[id*3+2]:side===2?-p[id*3]:-p[id*3+2]);
 const oldChains=(which:number,radius:number)=>{
  const boundary=boundaries[which],chains=boundary.nodes.map((set,side)=>{
   const chain=[...set].sort((a,b)=>parameter(a,side)-parameter(b,side));
   if(chain.length<2||parameter(chain[0],side)!==-radius||parameter(chain[chain.length-1],side)!==radius||boundary.edges[side].size!==chain.length-1)
    throw new RangeError('Incomplete terrain source patch boundary');
   for(let i=1;i<chain.length;i++)if(!(parameter(chain[i-1],side)<parameter(chain[i],side))||!boundary.edges[side].has(edgeKey(chain[i-1],chain[i])))
    throw new RangeError('Nonconforming terrain source patch boundary chain');
   return chain.map(id=>oldToNew[id]);
  });
  for(let side=0;side<4;side++)if(chains[side][chains[side].length-1]!==chains[(side+1)%4][0])throw new RangeError('Unwelded terrain source patch corner');
  return chains;
 };
 const outer=oldChains(1,C),near=I===undefined?undefined:oldChains(0,I);
 const outerSeamTriangles=outer.reduce((sum,chain)=>sum+n+chain.length-1,0),innerSeamTriangles=near?.reduce((sum,chain)=>sum+holeCells+chain.length-1,0)??0;
 const seamTriangles=innerSeamTriangles+outerSeamTriangles,vertices=retainedVertices+sourceVertices,triangles=innerTriangles+outerTriangles+sourceTriangles+seamTriangles;
 budget(vertices,triangles);
 const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),surface=new Float32Array(vertices*2),indices=new Uint32Array(triangles*3);
 for(let old=0;old<base.stats.vertices;old++)if(oldToNew[old]>=0){const id=oldToNew[old];positions.set(p.subarray(old*3,old*3+3),id*3);normals.set(base.normals.subarray(old*3,old*3+3),id*3);surface.set(base.surface.subarray(old*2,old*2+2),id*2);}
 const cellFirstIndex=new Uint32Array(base.cellFirstIndex.length).fill(0xffffffff),cellTriangleCount=new Uint8Array(base.cellFirstIndex.length);
 let cursor=0,oldCursor=0,stitchedCells=0;
 for(let cell=0;cell<base.cellFirstIndex.length;cell++){
  const first=base.cellFirstIndex[cell];if(first===0xffffffff)continue;
  const count=base.cellTriangleCount?.[cell];if(first!==oldCursor||!count)throw new RangeError('Terrain source patch old cell traversal differs');
  const start=cursor;
  for(let t=0;t<count;t++){const i=first+t*3;if(!keep[i/3])continue;for(let e=0;e<3;e++)indices[cursor++]=oldToNew[base.indices[i+e]];}
  if(cursor>start){cellFirstIndex[cell]=start;cellTriangleCount[cell]=(cursor-start)/3;if(isStitchCell(cell))stitchedCells++;}oldCursor+=count*3;
 }
 if(oldCursor!==base.indices.length||cursor!==(innerTriangles+outerTriangles)*3)throw new RangeError('Terrain source patch retained traversal incomplete');
 let minHeight=Infinity,maxHeight=-Infinity;
 for(let i=0;i<retainedVertices;i++){minHeight=Math.min(minHeight,surface[i*2]);maxHeight=Math.max(maxHeight,surface[i*2]);}
 const sourceID=(ix:number,iz:number)=>{
  if(inHoleRow(iz)&&ix>holeFirst&&ix<holeLast)throw new RangeError('Terrain source annulus requested an omitted vertex');
  return retainedVertices+vertexRows[iz]+ix-(inHoleRow(iz)&&ix>=holeLast?holeCells-1:0);
 };
 for(let iz=0;iz<=n;iz++)for(let ix=0;ix<=n;ix++){
  if(inHoleRow(iz)&&ix>holeFirst&&ix<holeLast)continue;
  const x=g.minXKm+(firstX+ix)*s,z=g.minZKm+(firstZ+iz)*s,v=sample(x,z),id=sourceID(ix,iz);
  if(![x,z,v.heightKm,v.slopeX,v.slopeZ,v.coastKm].every(Number.isFinite)||v.heightKm<0)throw new RangeError('Invalid terrain source patch node sample');
  positions[id*3]=x;positions[id*3+1]=surfaceY(x,z,v.heightKm);positions[id*3+2]=z;normals[id*3+1]=1;surface[id*2]=v.heightKm;surface[id*2+1]=v.coastKm;
  if(!Number.isFinite(positions[id*3+1]))throw new RangeError('Nonfinite terrain source patch Float32 position');
  minHeight=Math.min(minHeight,v.heightKm);maxHeight=Math.max(maxHeight,v.heightKm);
 }
 const sourceFirstIndex=cursor;
 for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){
  if(J!==undefined&&iz>=holeFirst&&iz<holeLast&&ix>=holeFirst&&ix<holeLast)continue;
  const sw=sourceID(ix,iz),nw=sourceID(ix,iz+1),ne=sourceID(ix+1,iz+1),se=sourceID(ix+1,iz);indices.set([sw,nw,ne,sw,ne,se],cursor);cursor+=6;
 }
 if(cursor-sourceFirstIndex!==sourceTriangles*3)throw new RangeError('Terrain source annulus cell count differs');
 const sourceChains=(lo:number,hi:number)=>[Array.from({length:hi-lo+1},(_,i)=>sourceID(lo+i,lo)),Array.from({length:hi-lo+1},(_,i)=>sourceID(hi,lo+i)),
  Array.from({length:hi-lo+1},(_,i)=>sourceID(hi-i,hi)),Array.from({length:hi-lo+1},(_,i)=>sourceID(lo,hi-i))];
 const seams:SeamLookup[]=[];
 const zipper=(a:number[][],b:number[][],small:number,large:number,binsPerSide:number)=>{
  const sides:SeamLookup['sides'][number][]=[];let maximumFaceSpan=s;
  for(let side=0;side<4;side++){
   const bins:number[][]=Array.from({length:binsPerSide},()=>[]);let ai=0,bi=0;
   const t=(id:number,radius:number)=>(parameterNew(id)+radius)/(2*radius);
   function parameterNew(id:number){return side===0?positions[id*3]:side===1?positions[id*3+2]:side===2?-positions[id*3]:-positions[id*3+2];}
   const emit=(ids:readonly number[],params:readonly number[])=>{
    const [u,v,w]=ids.map(id=>id*3),up=(positions[v+2]-positions[u+2])*(positions[w]-positions[u])-(positions[v]-positions[u])*(positions[w+2]-positions[u+2]);
    if(!(up>0))throw new RangeError('Degenerate or reversed terrain source patch seam');
    maximumFaceSpan=Math.max(maximumFaceSpan,Math.max(positions[u],positions[v],positions[w])-Math.min(positions[u],positions[v],positions[w]),Math.max(positions[u+2],positions[v+2],positions[w+2])-Math.min(positions[u+2],positions[v+2],positions[w+2]));
    const lo=Math.max(0,Math.min(binsPerSide-1,Math.floor(Math.min(...params)*binsPerSide))),hi=Math.max(0,Math.min(binsPerSide-1,Math.floor(Math.max(...params)*binsPerSide)));
    for(let bin=lo;bin<=hi;bin++)bins[bin].push(cursor);indices.set(ids,cursor);cursor+=3;
   };
   while(ai<a[side].length-1||bi<b[side].length-1){
    if(bi===b[side].length-1||(ai<a[side].length-1&&t(a[side][ai+1],small)<=t(b[side][bi+1],large))){
     emit([a[side][ai],a[side][ai+1],b[side][bi]],[t(a[side][ai],small),t(a[side][ai+1],small),t(b[side][bi],large)]);ai++;
    }else{emit([a[side][ai],b[side][bi+1],b[side][bi]],[t(a[side][ai],small),t(b[side][bi+1],large),t(b[side][bi],large)]);bi++;}
   }
   const first=new Uint32Array(binsPerSide+1);for(let i=0;i<binsPerSide;i++)first[i+1]=first[i]+bins[i].length;
   const faces=new Uint32Array(first[binsPerSide]);for(let i=0;i<binsPerSide;i++)faces.set(bins[i],first[i]);sides.push({first,faces});
  }
  seams.push({innerHalfExtentKm:small,outerHalfExtentKm:large,bins:binsPerSide,sides,paddingKm:4e-7*maximumFaceSpan+32*Number.EPSILON*Math.max(1,large)});
 };
 if(near)zipper(near,sourceChains(holeFirst,holeLast),I!,J!,holeCells);
 zipper(sourceChains(0,n),outer,H,C,n);
 if(cursor!==indices.length)throw new RangeError('Terrain source patch triangle count differs');
 const lookup:TerrainSourcePatchLookup={coreHalfExtentKm:H,spacingKm:s,cells:n,sourceFirstIndex,cellRows,holeFirst,holeLast,sourceHoleHalfExtentKm:J,
  seams,queryPaddingKm:Math.max(...seams.map(seam=>seam.paddingKm))};
 const lookupBytes=cellFirstIndex.byteLength+cellTriangleCount.byteLength+cellRows.byteLength+seams.reduce((bytes,seam)=>bytes+seam.sides.reduce((sum,row)=>sum+row.first.byteLength+row.faces.byteLength,0),0);
 const sourcePatch:TerrainSourcePatchStats={coreHalfExtentKm:H,outerCutKm:C,sourceSpacingKm:s,retainedInnerHalfExtentKm:I,sourceHoleHalfExtentKm:J,
  sourceVertices,sourceTriangles,innerVertices,innerTriangles,outerVertices,outerTriangles,innerSeamTriangles,outerSeamTriangles,seamTriangles,
  ...(I===undefined?{coreVertices:sourceVertices,coreTriangles:sourceTriangles}:{}),newSampleCalls:sourceVertices,lookupBytes,
  prePatchSampleCalls:base.stats.sampleCalls,prePatchStitchedCells:base.stats.stitchedCells,prePatchRefinement:base.stats.refinement};
 const oldStats={...base.stats};delete oldStats.refinement;
 return {positions,normals,surface,indices,cellFirstIndex,cellTriangleCount,sourcePatchLookup:lookup,stats:{...oldStats,vertices,triangles,stitchedCells,geometryBytes:32*vertices+12*triangles,
  sampleCalls:base.stats.sampleCalls+sourceVertices,minimumHeightKm:minHeight,maximumHeightKm:maxHeight,sourcePatch}};
}

/** Local candidates only; caller retains the ordinary Float32 triangle test. */
export function terrainSourcePatchFaces(data:TerrainMeshData,x:number,z:number,visit:(indexOffset:number)=>void):void{
 const patch=data.sourcePatchLookup;if(!patch)return;
 const {coreHalfExtentKm:H,spacingKm:s,cells:n,sourceFirstIndex:first,sourceHoleHalfExtentKm:J,holeFirst:lo,holeLast:hi}=patch,r=Math.max(Math.abs(x),Math.abs(z));
 if(r<=H+patch.queryPaddingKm&&(J===undefined||r>=J-patch.queryPaddingKm)){
  const cx=Math.floor((x+H)/s),cz=Math.floor((z+H)/s);
  for(let iz=cz-1;iz<=cz+1;iz++)for(let ix=cx-1;ix<=cx+1;ix++)if(ix>=0&&ix<n&&iz>=0&&iz<n){
   const holeRow=J!==undefined&&iz>=lo&&iz<hi;if(holeRow&&ix>=lo&&ix<hi)continue;
   const offset=first+(patch.cellRows[iz]+ix-(holeRow&&ix>=hi?hi-lo:0))*6;visit(offset);visit(offset+3);
  }
 }
 for(const seam of patch.seams){
  if(r<seam.innerHalfExtentKm-seam.paddingKm||r>seam.outerHalfExtentKm+seam.paddingKm)continue;
  for(let side=0;side<4;side++){
   const radius=side===0?-z:side===1?x:side===2?z:-x;if(radius<=0)continue;
   const coordinate=side===0?x:side===1?z:side===2?-x:-z,u=(coordinate/radius+1)*.5,bin=Math.max(0,Math.min(seam.bins-1,Math.floor(u*seam.bins))),row=seam.sides[side];
   for(let j=Math.max(0,bin-1);j<=Math.min(seam.bins-1,bin+1);j++)for(let k=row.first[j];k<row.first[j+1];k++)visit(row.faces[k]);
  }
 }
}
