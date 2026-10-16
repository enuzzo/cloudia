/** Indexed, edge-connected smoothing groups of the existing terrain triangles.
 * No elevation evaluation or new surface detail. The input is never mutated.
 */
export interface TerrainCreaseNormalInput {
 positions:Float32Array;normals:Float32Array;surface:Float32Array;indices:Uint32Array;
}
export interface TerrainCreaseNormalLimits {
 maxVertices:number;maxTriangles:number;maxIncidentFaces:number;
}
export const TERRAIN_CREASE_NORMAL_LIMITS:Readonly<TerrainCreaseNormalLimits>=Object.freeze({
 maxVertices:700000,maxTriangles:1300000,maxIncidentFaces:128,
});
export interface TerrainCreaseNormalStats {
 algorithm:'indexed-edge-connected-area-weighted-v1';angleDegrees:number;
 inputVertices:number;outputVertices:number;addedVertices:number;triangles:number;corners:number;
 splitSourceVertices:number;singleGroupVertices:number;unusedVertices:number;
 maximumIncidentFaces:number;maximumGroups:number;vertexPairTests:number;
 edgeEndpointPairs:number;smoothEdgeEndpointPairs:number;sharpEdgeEndpointPairs:number;
 inputGeometryBytes:number;outputGeometryBytes:number;addedGeometryBytes:number;
 nominalScratchBytes:number;nominalOutputCapacityBytes:number;nominalOwnedPeakTypedArrayBytes:number;
 limits:TerrainCreaseNormalLimits;
}
export interface TerrainCreaseNormalResult extends TerrainCreaseNormalInput {stats:TerrainCreaseNormalStats}

function requireInput(value:unknown,message:string):asserts value {
 if(!value)throw new RangeError(message);
}

/** Components join only along an actual shared edge whose dihedral is <=angle.
 * Connectivity is transitive: an alternate smooth fan can reconnect a hard
 * edge's endpoints. A hard adjacency need not split both endpoint normals.
 * A vertex with zero/one group retains its original normal bits exactly.
 * Split vertices get Float64 area-weighted sums in original face order.
 */
export function applyTerrainCreaseNormals(
 input:TerrainCreaseNormalInput,angleDegrees=45,requested:Partial<TerrainCreaseNormalLimits>={},
):TerrainCreaseNormalResult {
 const {positions,normals,surface,indices}=input;
 requireInput(positions instanceof Float32Array&&normals instanceof Float32Array&&surface instanceof Float32Array&&indices instanceof Uint32Array,
  'Terrain crease requires Float32 attributes and Uint32 indices');
 requireInput(positions.length>0&&positions.length%3===0&&normals.length===positions.length&&surface.length===positions.length/3*2&&
  indices.length>0&&indices.length%3===0,'Invalid terrain crease attribute lengths');
 requireInput(Number.isFinite(angleDegrees)&&angleDegrees>=0&&angleDegrees<=180,'Invalid terrain crease angle');
 const limits={...TERRAIN_CREASE_NORMAL_LIMITS,...requested};
 for(const key of ['maxVertices','maxTriangles','maxIncidentFaces'] as const){
  requireInput(Number.isSafeInteger(limits[key])&&limits[key]>0&&limits[key]<=TERRAIN_CREASE_NORMAL_LIMITS[key],
   `Invalid terrain crease ${key} limit`);
 }
 const vertices=positions.length/3,triangles=indices.length/3,corners=indices.length;
 requireInput(vertices<=limits.maxVertices&&triangles<=limits.maxTriangles,'Terrain crease input exceeds geometry limits');
 for(let i=0;i<vertices;i++){
  const j=i*3,k=i*2;
  requireInput(Number.isFinite(positions[j])&&Number.isFinite(positions[j+1])&&Number.isFinite(positions[j+2])&&
   Number.isFinite(surface[k])&&Number.isFinite(surface[k+1]),'Nonfinite terrain crease position/surface');
  const length=Math.hypot(normals[j],normals[j+1],normals[j+2]);
  requireInput(Number.isFinite(length)&&Math.abs(length-1)<=1e-4,'Terrain crease input normal must be finite and unit length');
 }

 // CSR retains corner/face order. No global edge map or string keys.
 const offsets=new Uint32Array(vertices+1);
 for(let i=0;i<corners;i++){
  const vertex=indices[i];requireInput(vertex<vertices,'Terrain crease index out of bounds');offsets[vertex+1]++;
 }
 let maximumIncidentFaces=0;
 for(let v=0;v<vertices;v++){
  const count=offsets[v+1];maximumIncidentFaces=Math.max(maximumIncidentFaces,count);
  requireInput(count<=limits.maxIncidentFaces,'Terrain crease incident-face limit exceeded');
  offsets[v+1]+=offsets[v];
 }
 const cursor=offsets.slice(0,vertices),incidentCorners=new Uint32Array(corners);
 for(let corner=0;corner<corners;corner++)incidentCorners[cursor[indices[corner]]++]=corner;

 // The cross expression/order matches the existing area-weighted normal bake.
 const areaVectors=new Float64Array(triangles*3),areaSquared=new Float64Array(triangles);
 for(let f=0;f<triangles;f++){
  const i=f*3,a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const abx=positions[b]-positions[a],aby=positions[b+1]-positions[a+1],abz=positions[b+2]-positions[a+2];
  const acx=positions[c]-positions[a],acy=positions[c+1]-positions[a+1],acz=positions[c+2]-positions[a+2];
  const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx,square=nx*nx+ny*ny+nz*nz;
  requireInput(Number.isFinite(square)&&square>0,'Degenerate/nonfinite terrain crease triangle');
  areaVectors[i]=nx;areaVectors[i+1]=ny;areaVectors[i+2]=nz;areaSquared[f]=square;
 }

 const degree=limits.maxIncidentFaces,parent=new Uint32Array(degree),otherA=new Uint32Array(degree),otherB=new Uint32Array(degree);
 const groupVertex=new Int32Array(degree),sums=new Float64Array(degree*3);
 const root=(i:number):number=>{
  let result=i;while(parent[result]!==result)result=parent[result];
  while(parent[i]!==i){const next=parent[i];parent[i]=result;i=next;}return result;
 };
 // Squared comparison makes the exact 45-degree case (cos²=.5) inclusive
 // without a fitted tolerance or a normalization-rounding threshold change.
 const cosine=angleDegrees===0?1:angleDegrees===90?0:angleDegrees===180?-1:Math.cos(angleDegrees*Math.PI/180);
 const cosineSquared=angleDegrees===45?.5:cosine*cosine;
 const compatible=(fa:number,fb:number):boolean=>{
  if(angleDegrees===180)return true;
  const a=fa*3,b=fb*3,dot=areaVectors[a]*areaVectors[b]+areaVectors[a+1]*areaVectors[b+1]+areaVectors[a+2]*areaVectors[b+2];
  if(cosine>=0&&dot<0)return false;
  if(cosine<0&&dot>=0)return true;
  const product=areaSquared[fa]*areaSquared[fb],square=dot*dot;
  requireInput(Number.isFinite(product)&&product>0&&Number.isFinite(square),'Terrain crease angle arithmetic out of range');
  return cosine>=0?square>=cosineSquared*product:square<=cosineSquared*product;
 };

 let outputPositions:Float32Array|null=null,outputNormals:Float32Array|null=null,outputSurface:Float32Array|null=null,outputIndices:Uint32Array|null=null;
 let nextVertex=vertices,splitSourceVertices=0,singleGroupVertices=0,unusedVertices=0,maximumGroups=0;
 let vertexPairTests=0,edgeEndpointPairs=0,smoothEdgeEndpointPairs=0,sharpEdgeEndpointPairs=0;
 const capacityVertices=Math.min(limits.maxVertices,vertices+corners);
 const allocateOutput=()=>{
  if(outputPositions)return;
  outputPositions=new Float32Array(capacityVertices*3);outputPositions.set(positions);
  outputNormals=new Float32Array(capacityVertices*3);outputNormals.set(normals);
  outputSurface=new Float32Array(capacityVertices*2);outputSurface.set(surface);
  outputIndices=indices.slice();
 };
 for(let v=0;v<vertices;v++){
  const start=offsets[v],count=offsets[v+1]-start;
  if(count===0){unusedVertices++;continue;}
  for(let j=0;j<count;j++){
   parent[j]=j;
   const corner=incidentCorners[start+j],faceStart=corner-corner%3,local=corner%3;
   otherA[j]=indices[faceStart+(local+1)%3];otherB[j]=indices[faceStart+(local+2)%3];
  }
  let groups=count;
  for(let j=0;j<count;j++)for(let k=j+1;k<count;k++){
   vertexPairTests++;
   // Sharing just v is insufficient: the two faces must share a second index.
   if(otherA[j]!==otherA[k]&&otherA[j]!==otherB[k]&&otherB[j]!==otherA[k]&&otherB[j]!==otherB[k])continue;
   edgeEndpointPairs++;
   if(!compatible(Math.floor(incidentCorners[start+j]/3),Math.floor(incidentCorners[start+k]/3))){sharpEdgeEndpointPairs++;continue;}
   smoothEdgeEndpointPairs++;
   const a=root(j),b=root(k);if(a!==b){parent[Math.max(a,b)]=Math.min(a,b);groups--;}
  }
  maximumGroups=Math.max(maximumGroups,groups);
  if(groups===1){singleGroupVertices++;continue;}
  requireInput(nextVertex+groups-1<=limits.maxVertices,'Terrain crease output vertex limit exceeded');
  splitSourceVertices++;allocateOutput();groupVertex.fill(-1,0,count);sums.fill(0,0,count*3);
  // CSR visits faces in the same order as the original cross accumulation.
  for(let j=0;j<count;j++){
   const group=root(j),face=Math.floor(incidentCorners[start+j]/3)*3,sum=group*3;
   sums[sum]+=areaVectors[face];sums[sum+1]+=areaVectors[face+1];sums[sum+2]+=areaVectors[face+2];
  }
  let first=true;
  for(let j=0;j<count;j++){
   const group=root(j);
   if(groupVertex[group]<0){
    const target=first?v:nextVertex++;first=false;groupVertex[group]=target;
    if(target!==v){
     outputPositions!.set(positions.subarray(v*3,v*3+3),target*3);
     outputSurface!.set(surface.subarray(v*2,v*2+2),target*2);
    }
    const sum=group*3,length=Math.hypot(sums[sum],sums[sum+1],sums[sum+2]);
    requireInput(Number.isFinite(length)&&length>0,'Terrain crease smoothing group has no finite normal');
    outputNormals![target*3]=sums[sum]/length;outputNormals![target*3+1]=sums[sum+1]/length;outputNormals![target*3+2]=sums[sum+2]/length;
   }
   outputIndices![incidentCorners[start+j]]=groupVertex[group];
  }
 }

 // Return exact-size buffers, not views retaining the maximum output capacity.
 const resultPositions=outputPositions?(outputPositions as Float32Array).slice(0,nextVertex*3):positions;
 const resultNormals=outputNormals?(outputNormals as Float32Array).slice(0,nextVertex*3):normals;
 const resultSurface=outputSurface?(outputSurface as Float32Array).slice(0,nextVertex*2):surface;
 const resultIndices=outputIndices??indices;
 const inputGeometryBytes=positions.byteLength+normals.byteLength+surface.byteLength+indices.byteLength;
 const outputGeometryBytes=resultPositions.byteLength+resultNormals.byteLength+resultSurface.byteLength+resultIndices.byteLength;
 const nominalScratchBytes=offsets.byteLength+cursor.byteLength+incidentCorners.byteLength+areaVectors.byteLength+areaSquared.byteLength+
  parent.byteLength+otherA.byteLength+otherB.byteLength+groupVertex.byteLength+sums.byteLength;
 const nominalOutputCapacityBytes=outputPositions?capacityVertices*32+indices.byteLength:0;
 return {positions:resultPositions,normals:resultNormals,surface:resultSurface,indices:resultIndices,stats:{
  algorithm:'indexed-edge-connected-area-weighted-v1',angleDegrees,inputVertices:vertices,outputVertices:nextVertex,addedVertices:nextVertex-vertices,
  triangles,corners,splitSourceVertices,singleGroupVertices,unusedVertices,maximumIncidentFaces,maximumGroups,
  vertexPairTests,edgeEndpointPairs,smoothEdgeEndpointPairs,sharpEdgeEndpointPairs,
  inputGeometryBytes,outputGeometryBytes,addedGeometryBytes:outputGeometryBytes-inputGeometryBytes,nominalScratchBytes,nominalOutputCapacityBytes,
  // Owned array payload during final slicing; the output index is shared with
  // capacity storage and counted once. Not a claim about process/GC peak RSS.
  nominalOwnedPeakTypedArrayBytes:nominalScratchBytes+nominalOutputCapacityBytes+
   (outputPositions?resultPositions.byteLength+resultNormals.byteLength+resultSurface.byteLength:0),limits,
 }};
}
