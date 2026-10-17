import {
 BufferAttribute,BufferGeometry,Color,DepthFormat,DepthTexture,FloatType,Mesh,MeshBasicNodeMaterial,
 NearestFilter,NoBlending,NoColorSpace,PerspectiveCamera,RenderTarget,RGBAFormat,Scene,Vector3,Vector4,WebGPUCoordinateSystem,
 type Node,type Texture,type WebGPURenderer,
} from 'three/webgpu';
import {attribute,positionWorld,normalWorld,uniform,varying,vec4} from 'three/tsl';
import {EARTH_RADIUS,GROUND_LEVEL} from './landscape';
import {terrainSurfaceSample,type TerrainSurfaceSample} from './terrainSurface';
import {TerrainShadow,type TerrainShadowVector} from './TerrainShadow';
import {appendTerrainSplitTriangle} from './terrainSplitTriangle';

/** Static world-space triangulation; this is the rendered geometry, not an exact
 * intersection oracle for the underlying analytic height field. No skirts, no
 * camera-relative rebuild, no per-frame CPU terrain evaluation.
 */
export const TERRAIN_MESH_DEFAULTS=Object.freeze({cellsPerSide:128,levels:10,spacingKm:.032,nearKm:.025,farKm:1600});
/** Normal policy for the authored ~1.76km child ridges: complete the blend
 * before the default ring steps to 1.024km. Not a sampling-error certificate.
 */
export const TERRAIN_NORMAL_ANALYTIC_WIDTH_KM=.256;
export const TERRAIN_NORMAL_GEOMETRIC_WIDTH_KM=.512;
export type TerrainSampler=(x:number,z:number)=>TerrainSurfaceSample;
export interface TerrainMeshRefinement {
 /** Original source-node lattice; min values are node centres, not pixel edges. */
 sourceGrid:{minXKm:number;minZKm:number;spacingKm:number;columns:number;rows:number};
 /** Closed measured domain; only source nodes in this rectangle select faces. */
 domain:{minXKm:number;maxXKm:number;minZKm:number;maxZKm:number};
 maxErrorKm:number;
 /** Fail explicitly on overflow; never truncate selection or subdivision. */
 limits:{maxProbeCount:number;maxVertices:number;maxTriangles:number;maxGeometryBytes:number};
}
export interface TerrainMeshOptions {cellsPerSide?:number;levels?:number;spacingKm?:number;normalMode?:'analytic-blend'|'geometry';refinement?:TerrainMeshRefinement}
export interface TerrainMeshRefinementStats {
 originalVertices:number;originalTriangles:number;probeSampleCalls:number;vertexSampleCalls:number;totalSampleCalls:number;
 nodesAboveThreshold:number;eligibleNodesAboveThreshold:number;markedRedFaces:number;greenFaces:number;
 splitEdgeCount:number;addedVertices:number;addedTriangles:number;addedGeometryBytes:number;
 sourceSpacingKm:number;maxErrorKm:number;selectedNodeColumns:number;selectedNodeRows:number;
 sourceGrid:TerrainMeshRefinement['sourceGrid'];selectionDomain:TerrainMeshRefinement['domain'];
 originalFacesBySplitEdgeCount:[number,number,number,number];maximumCellTriangles:number;cellTriangleCountBytes:number;
 midpointVerticesOutsideDomain:number;boundsKm:{min:[number,number,number];max:[number,number,number]};
}
export interface TerrainMeshData {
 positions:Float32Array;normals:Float32Array;surface:Float32Array;indices:Uint32Array;
 /** CPU-only cell -> first triangle index. Missing hole cells are 0xffffffff. */
 cellFirstIndex:Uint32Array;
 /** Present only when refinement is enabled; zero for original hole cells. */
 cellTriangleCount?:Uint8Array;
 stats:{vertices:number;triangles:number;stitchedCells:number;levels:number;cellsPerSide:number;
  baseSpacingKm:number;outerExtentKm:number;geometryBytes:number;sampleCalls:number;minimumHeightKm:number;maximumHeightKm:number;
  normalBlendStartRadiusKm:number;normalBlendEndRadiusKm:number;normalMode:'analytic-blend'|'geometry';refinement?:TerrainMeshRefinementStats};
}
function blendTerrainMeshNormals(positions:Float32Array,normals:Float32Array,indices:Uint32Array,cells:number,geometricOnly:boolean):void{
 const accumulated=new Float64Array(normals.length);
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const abx=positions[b]-positions[a],aby=positions[b+1]-positions[a+1],abz=positions[b+2]-positions[a+2];
  const acx=positions[c]-positions[a],acy=positions[c+1]-positions[a+1],acz=positions[c+2]-positions[a+2];
  // The unnormalised cross weighs each face by twice its area. In particular,
  // a small stitch-fan triangle does not count as much as a full grid triangle.
  const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
  for(const vertex of [a,b,c]){accumulated[vertex]+=nx;accumulated[vertex+1]+=ny;accumulated[vertex+2]+=nz;}
 }
 for(let i=0;i<normals.length;i+=3){
  const length=Math.hypot(accumulated[i],accumulated[i+1],accumulated[i+2]);
  if(!(length>0)||!Number.isFinite(length)||accumulated[i+1]<=0)throw new RangeError('Invalid geometric terrain normal');
  // A continuous world-space width avoids a discontinuous switch on ring ID.
  // Welded seam vertices receive one final normal shared by both levels.
  const width=2*Math.max(Math.abs(positions[i]),Math.abs(positions[i+2]))/cells;
  const t=Math.max(0,Math.min(1,(width-TERRAIN_NORMAL_ANALYTIC_WIDTH_KM)/(TERRAIN_NORMAL_GEOMETRIC_WIDTH_KM-TERRAIN_NORMAL_ANALYTIC_WIDTH_KM))),weight=geometricOnly?1:t*t*(3-2*t);
  if(weight===0)continue;
  const x=normals[i]*(1-weight)+accumulated[i]/length*weight,y=normals[i+1]*(1-weight)+accumulated[i+1]/length*weight,z=normals[i+2]*(1-weight)+accumulated[i+2]/length*weight;
  const mixedLength=Math.hypot(x,y,z);
  normals[i]=x/mixedLength;normals[i+1]=y/mixedLength;normals[i+2]=z/mixedLength;
 }
}
function stitchEdge(x:number,z:number,level:number,hole:number):number{
 if(level===0)return -1;
 if(x===hole&&z>=-hole&&z<hole)return 0;
 if(z===-hole-1&&x>=-hole&&x<hole)return 1;
 if(x===-hole-1&&z>=-hole&&z<hole)return 2;
 if(z===hole&&x>=-hole&&x<hole)return 3;
 return -1;
}

/** Stable form of -R + sqrt((R+h)^2-x^2-z^2), avoiding a subtraction of ~6371km. */
export function terrainMeshSurfaceY(x:number,z:number,heightKm:number):number{
 const radius=EARTH_RADIUS+heightKm,r2=x*x+z*z,radialY=Math.sqrt(radius*radius-r2);
 if(!Number.isFinite(radialY))throw new RangeError('Terrain mesh exceeds the upper spherical hemisphere');
 return GROUND_LEVEL+heightKm-r2/(radius+radialY);
}

interface RefinementPlan extends TerrainMeshRefinement {firstX:number;lastX:number;firstZ:number;lastZ:number;probeCount:number}
function refinementPlan(value:TerrainMeshRefinement,normalMode:string):RefinementPlan{
 const grid={...value.sourceGrid},domain={...value.domain},limits={...value.limits},maxErrorKm=value.maxErrorKm;
 if(normalMode!=='geometry'||![grid.minXKm,grid.minZKm,grid.spacingKm,domain.minXKm,domain.maxXKm,domain.minZKm,domain.maxZKm,maxErrorKm].every(Number.isFinite)
  ||grid.spacingKm<=0||maxErrorKm<=0||![grid.columns,grid.rows].every(n=>Number.isSafeInteger(n)&&n>=2)
  ||![limits.maxProbeCount,limits.maxVertices,limits.maxTriangles,limits.maxGeometryBytes].every(n=>Number.isSafeInteger(n)&&n>0)||Object.keys(limits).length!==4||limits.maxVertices>0xffffffff)
  throw new RangeError('Invalid bounded terrain refinement configuration');
 const maxX=grid.minXKm+(grid.columns-1)*grid.spacingKm,maxZ=grid.minZKm+(grid.rows-1)*grid.spacingKm;
 if(!Number.isFinite(maxX)||!Number.isFinite(maxZ)||domain.minXKm>domain.maxXKm||domain.minZKm>domain.maxZKm
  ||domain.minXKm<grid.minXKm||domain.minZKm<grid.minZKm||domain.maxXKm>maxX||domain.maxZKm>maxZ)
  throw new RangeError('Terrain refinement domain is outside its source-node grid');
 const firstX=Math.ceil((domain.minXKm-grid.minXKm)/grid.spacingKm),lastX=Math.floor((domain.maxXKm-grid.minXKm)/grid.spacingKm);
 const firstZ=Math.ceil((domain.minZKm-grid.minZKm)/grid.spacingKm),lastZ=Math.floor((domain.maxZKm-grid.minZKm)/grid.spacingKm);
 const probeCount=(lastX-firstX+1)*(lastZ-firstZ+1);
 if(firstX>lastX||firstZ>lastZ||!Number.isSafeInteger(probeCount)||probeCount>limits.maxProbeCount)
  throw new RangeError('Terrain refinement source-node probe budget exceeded or empty');
 return {sourceGrid:grid,domain,limits,maxErrorKm,firstX,lastX,firstZ,lastZ,probeCount};
}

export function buildTerrainMeshData(sample:TerrainSampler=terrainSurfaceSample,options:TerrainMeshOptions={}):TerrainMeshData{
 const cells=options.cellsPerSide??TERRAIN_MESH_DEFAULTS.cellsPerSide,levels=options.levels??TERRAIN_MESH_DEFAULTS.levels;
 const spacing=options.spacingKm??TERRAIN_MESH_DEFAULTS.spacingKm;
 const normalMode=options.normalMode??'analytic-blend';
 if(normalMode!=='analytic-blend'&&normalMode!=='geometry')throw new RangeError('Invalid terrain normal mode');
 const refinement=options.refinement===undefined?undefined:refinementPlan(options.refinement,normalMode);
 if(!Number.isInteger(cells)||cells<4||cells%4!==0||cells>256||!Number.isInteger(levels)||levels<1||levels>12||!Number.isFinite(spacing)||spacing<=0)throw new RangeError('Invalid bounded terrain mesh grid');
 const extent=cells/2*spacing*2**(levels-1);
 if(Math.SQRT2*extent>=EARTH_RADIUS)throw new RangeError('Terrain mesh domain exceeds the spherical hemisphere');
 const positions:number[]=[],normals:number[]=[],surface:number[]=[],indices:number[]=[],vertices=new Map<string,number>();
 const cellFirstIndex=new Uint32Array(levels*cells*cells).fill(0xffffffff);
 let minimumHeightKm=Infinity,maximumHeightKm=-Infinity,stitchedCells=0;
 const vertex=(ix:number,iz:number)=>{
  const key=`${ix},${iz}`,existing=vertices.get(key);if(existing!==undefined)return existing;
  // Integer coordinates on the finest grid are the weld key. Convert to km once.
  const x=Math.fround(ix*spacing),z=Math.fround(iz*spacing),value=sample(x,z),h=value.heightKm;
  if(![h,value.slopeX,value.slopeZ,value.coastKm].every(Number.isFinite)||h<0)throw new RangeError('Nonfinite or negative terrain sample');
  const radius=EARTH_RADIUS+h,radialY=Math.sqrt(radius*radius-x*x-z*z);
  const dx=(radius*value.slopeX-x)/radialY,dz=(radius*value.slopeZ-z)/radialY,length=Math.hypot(dx,1,dz);
  const index=vertices.size;vertices.set(key,index);
  positions.push(x,terrainMeshSurfaceY(x,z,h),z);normals.push(-dx/length,1/length,-dz/length);surface.push(h,value.coastKm);
  minimumHeightKm=Math.min(minimumHeightKm,h);maximumHeightKm=Math.max(maximumHeightKm,h);
  return index;
 };
 const half=cells/2,hole=cells/4;
 for(let level=0;level<levels;level++){
  const step=2**level;
  for(let z=-half;z<half;z++)for(let x=-half;x<half;x++){
   if(level>0&&x>=-hole&&x<hole&&z>=-hole&&z<hole)continue;
   cellFirstIndex[(level*cells+z+half)*cells+x+half]=indices.length;
   // SW -> NW -> NE -> SE gives +Y winding in the (x,z) plane.
   const corners=[[x*step,z*step],[x*step,(z+1)*step],[(x+1)*step,(z+1)*step],[(x+1)*step,z*step]];
   const split=stitchEdge(x,z,level,hole);
   if(split<0){
    const c=corners.map(([ix,iz])=>vertex(ix,iz));indices.push(c[0],c[1],c[2],c[0],c[2],c[3]);
   }else{
    const polygon:number[]=[];
    for(let edge=0;edge<4;edge++){
     const a=corners[edge],b=corners[(edge+1)%4];polygon.push(vertex(a[0],a[1]));
     if(edge===split)polygon.push(vertex((a[0]+b[0])/2,(a[1]+b[1])/2));
    }
    const centre=vertex((x+.5)*step,(z+.5)*step);
    for(let edge=0;edge<polygon.length;edge++)indices.push(centre,polygon[edge],polygon[(edge+1)%polygon.length]);
    stitchedCells++;
   }
  }
 }
 const data={positions:new Float32Array(positions),normals:new Float32Array(normals),surface:new Float32Array(surface),indices:new Uint32Array(indices)};
 const baseline:TerrainMeshData={...data,cellFirstIndex,stats:{vertices:vertices.size,triangles:indices.length/3,stitchedCells,levels,cellsPerSide:cells,baseSpacingKm:spacing,outerExtentKm:extent,
  geometryBytes:data.positions.byteLength+data.normals.byteLength+data.surface.byteLength+data.indices.byteLength,sampleCalls:vertices.size,minimumHeightKm,maximumHeightKm,
  normalBlendStartRadiusKm:cells*TERRAIN_NORMAL_ANALYTIC_WIDTH_KM/2,normalBlendEndRadiusKm:cells*TERRAIN_NORMAL_GEOMETRIC_WIDTH_KM/2,normalMode}};
 const result=refinement?refineTerrainMeshData(baseline,sample,refinement):baseline;
 blendTerrainMeshNormals(result.positions,result.normals,result.indices,cells,normalMode==='geometry');
 return result;
}

/** Height of the actual Float32 triangles, including the seam fans. Constant
 * bounded neighbourhood lookup, no analytic H evaluation or full-mesh scan.
 * Adjacent cells/levels cover Float32 rounding on shared edges; taking their
 * maximum is conservative at the tiny barycentric boundary tolerance.
 */
export interface TerrainMeshHit {faceIndex:number;y:number}
export function terrainMeshHitAt(data:TerrainMeshData,x:number,z:number):TerrainMeshHit|null{
 if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError('Nonfinite terrain mesh query');
 const {cellsPerSide:cells,levels,baseSpacingKm:spacing}=data.stats,half=cells/2,hole=cells/4;
 const maximum=Math.max(Math.abs(x),Math.abs(z));
 let selected=0;while(selected<levels&&maximum>Math.fround(half*spacing*2**selected))selected++;
 if(selected===levels)return null;
 let result=-Infinity,winningFace=-1;
 for(let level=Math.max(0,selected-1);level<=Math.min(levels-1,selected+1);level++){
  const step=spacing*2**level,cx=Math.floor(x/step),cz=Math.floor(z/step);
  for(let iz=cz-1;iz<=cz+1;iz++)for(let ix=cx-1;ix<=cx+1;ix++){
   if(ix< -half||ix>=half||iz< -half||iz>=half)continue;
   const cell=(level*cells+iz+half)*cells+ix+half,first=data.cellFirstIndex[cell];if(first===0xffffffff)continue;
   const triangles=data.cellTriangleCount?.[cell]??(stitchEdge(ix,iz,level,hole)<0?2:5);
   for(let triangle=0;triangle<triangles;triangle++){
    const i=first+triangle*3,a=data.indices[i]*3,b=data.indices[i+1]*3,c=data.indices[i+2]*3,p=data.positions;
    const den=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);
    const wa=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/den;
    const wb=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/den,wc=1-wa-wb;
    if(Math.min(wa,wb,wc)>=-1e-7){
     const height=wa*p[a+1]+wb*p[b+1]+wc*p[c+1];
     if(height>result||winningFace<0||(Object.is(result,-0)&&Object.is(height,0)))winningFace=i/3;
     result=Math.max(result,height);
    }
   }
  }
 }
 return Number.isFinite(result)?{faceIndex:winningFace,y:result}:null;
}
export function terrainMeshHeightAt(data:TerrainMeshData,x:number,z:number):number|null{return terrainMeshHitAt(data,x,z)?.y??null;}

/** One source-node-selected red/green pass on ORIGINAL faces and edges only.
 * Selection queries use the original Float32 mesh. Shared-edge midpoints are
 * allocated once, including neighbours outside the measured selection domain.
 */
function refineTerrainMeshData(base:TerrainMeshData,sample:TerrainSampler,plan:RefinementPlan):TerrainMeshData{
 const originalVertices=base.stats.vertices,originalTriangles=base.stats.triangles,{limits,sourceGrid:grid,domain}=plan;
 const checkBudget=(vertices:number,triangles:number)=>{
  const bytes=32*vertices+12*triangles;
  if(vertices>limits.maxVertices||triangles>limits.maxTriangles||bytes>limits.maxGeometryBytes)
   throw new RangeError('Terrain refinement geometry budget exceeded; no subdivision truncated');
 };
 checkBudget(originalVertices,originalTriangles);
 if(!Number.isSafeInteger(originalVertices*originalVertices))throw new RangeError('Terrain refinement edge keys exceed exact integer range');
 const red=new Uint8Array(originalTriangles);let nodesAboveThreshold=0,eligibleNodesAboveThreshold=0,markedRedFaces=0,probeSampleCalls=0;
 for(let iz=plan.firstZ;iz<=plan.lastZ;iz++)for(let ix=plan.firstX;ix<=plan.lastX;ix++){
  const x=grid.minXKm+ix*grid.spacingKm,z=grid.minZKm+iz*grid.spacingKm,value=sample(x,z);probeSampleCalls++;
  if(![value.heightKm,value.slopeX,value.slopeZ,value.coastKm].every(Number.isFinite)||value.heightKm<0)throw new RangeError('Invalid terrain refinement probe sample');
  const hit=terrainMeshHitAt(base,x,z);
  if(!hit)throw new RangeError('Terrain refinement node has no original mesh hit');
  if(Math.abs(terrainMeshSurfaceY(x,z,value.heightKm)-hit.y)<=plan.maxErrorKm)continue;
  nodesAboveThreshold++;
  const offset=hit.faceIndex*3,a=base.indices[offset]*3,b=base.indices[offset+1]*3,c=base.indices[offset+2]*3,p=base.positions;
  const span=Math.max(Math.max(p[a],p[b],p[c])-Math.min(p[a],p[b],p[c]),Math.max(p[a+2],p[b+2],p[c+2])-Math.min(p[a+2],p[b+2],p[c+2]));
  if(span<grid.spacingKm)continue;
  eligibleNodesAboveThreshold++;
  if(!red[hit.faceIndex]){red[hit.faceIndex]=1;markedRedFaces++;}
 }
 if(probeSampleCalls!==plan.probeCount)throw new RangeError('Terrain refinement source-node count changed');
 // Keys encode unordered ORIGINAL endpoint IDs exactly, not rounded positions.
 const key=(a:number,b:number)=>Math.min(a,b)*originalVertices+Math.max(a,b),midpoints=new Map<number,number>();
 for(let face=0;face<originalTriangles;face++)if(red[face]){
  const offset=face*3,a=base.indices[offset],b=base.indices[offset+1],c=base.indices[offset+2];
  for(const edge of [key(a,b),key(b,c),key(c,a)])if(!midpoints.has(edge))midpoints.set(edge,originalVertices+midpoints.size);
 }
 const splitEdgeCount=midpoints.size,vertices=originalVertices+splitEdgeCount,childCounts=new Uint8Array(originalTriangles);
 const originalFacesBySplitEdgeCount:[number,number,number,number]=[0,0,0,0];let triangles=0,greenFaces=0;
 for(let face=0;face<originalTriangles;face++){
  const offset=face*3,a=base.indices[offset],b=base.indices[offset+1],c=base.indices[offset+2];
  const splits=Number(midpoints.has(key(a,b)))+Number(midpoints.has(key(b,c)))+Number(midpoints.has(key(c,a)));
  childCounts[face]=splits+1;triangles+=splits+1;originalFacesBySplitEdgeCount[splits]++;
  if(splits>0&&!red[face])greenFaces++;
 }
 if(triangles>4*originalTriangles||splitEdgeCount>3*originalTriangles||triangles-originalTriangles>2*splitEdgeCount)
  throw new RangeError('Terrain refinement exceeded one-pass structural bound');
 checkBudget(vertices,triangles);
 const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),surface=new Float32Array(vertices*2),indices=new Uint32Array(triangles*3);
 positions.set(base.positions);normals.set(base.normals);surface.set(base.surface);
 let minimumHeightKm=base.stats.minimumHeightKm,maximumHeightKm=base.stats.maximumHeightKm,midpointVerticesOutsideDomain=0;
 for(const [edge,index] of midpoints){
  const a=Math.floor(edge/originalVertices),b=edge-a*originalVertices;
  const x=Math.fround((base.positions[3*a]+base.positions[3*b])/2),z=Math.fround((base.positions[3*a+2]+base.positions[3*b+2])/2);
  const value=sample(x,z),h=value.heightKm;
  if(![h,value.slopeX,value.slopeZ,value.coastKm].every(Number.isFinite)||h<0)throw new RangeError('Invalid terrain refinement midpoint sample');
  positions[index*3]=x;positions[index*3+1]=terrainMeshSurfaceY(x,z,h);positions[index*3+2]=z;
  // Geometry-mode shared incident normals are recalculated after all children.
  normals[index*3+1]=1;surface[index*2]=h;surface[index*2+1]=value.coastKm;
  minimumHeightKm=Math.min(minimumHeightKm,h);maximumHeightKm=Math.max(maximumHeightKm,h);
  if(x<domain.minXKm||x>domain.maxXKm||z<domain.minZKm||z>domain.maxZKm)midpointVerticesOutsideDomain++;
 }
 const cellFirstIndex=new Uint32Array(base.cellFirstIndex.length).fill(0xffffffff),cellTriangleCount=new Uint8Array(base.cellFirstIndex.length);
 const {cellsPerSide:cells,levels}=base.stats,half=cells/2,hole=cells/4,cellOutput:number[]=[];
 let originalCursor=0,childCursor=0,maximumCellTriangles=0;
 for(let cell=0;cell<base.cellFirstIndex.length;cell++){
  const first=base.cellFirstIndex[cell];if(first===0xffffffff)continue;
  if(first!==originalCursor)throw new RangeError('Terrain refinement original cell order is not contiguous');
  const level=Math.floor(cell/(cells*cells)),x=cell%cells-half,z=Math.floor(cell/cells)%cells-half;
  const originalCount=stitchEdge(x,z,level,hole)<0?2:5;cellOutput.length=0;
  for(let i=first;i<first+originalCount*3;i+=3){
   const a=base.indices[i],b=base.indices[i+1],c=base.indices[i+2];
   appendTerrainSplitTriangle(cellOutput,a,b,c,midpoints.get(key(a,b))??-1,midpoints.get(key(b,c))??-1,midpoints.get(key(c,a))??-1);
  }
  const count=cellOutput.length/3;
  if(count<originalCount||count>20||!Number.isInteger(count))throw new RangeError('Terrain refinement child cell count is invalid');
  let expected=0;for(let face=first/3;face<first/3+originalCount;face++)expected+=childCounts[face];
  if(count!==expected)throw new RangeError('Terrain refinement split helper count mismatch');
  cellFirstIndex[cell]=childCursor;cellTriangleCount[cell]=count;indices.set(cellOutput,childCursor);
  childCursor+=cellOutput.length;originalCursor+=originalCount*3;maximumCellTriangles=Math.max(maximumCellTriangles,count);
 }
 if(originalCursor!==base.indices.length||childCursor!==indices.length||levels*cells*cells!==cellTriangleCount.length)throw new RangeError('Terrain refinement did not cover original cells exactly');
 const min:[number,number,number]=[Infinity,Infinity,Infinity],max:[number,number,number]=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<positions.length;i+=3)for(let axis=0;axis<3;axis++){
  min[axis]=Math.min(min[axis],positions[i+axis]);max[axis]=Math.max(max[axis],positions[i+axis]);
 }
 const vertexSampleCalls=originalVertices+splitEdgeCount,totalSampleCalls=vertexSampleCalls+probeSampleCalls;
 const geometryBytes=positions.byteLength+normals.byteLength+surface.byteLength+indices.byteLength;
 const refinement:TerrainMeshRefinementStats={originalVertices,originalTriangles,probeSampleCalls,vertexSampleCalls,totalSampleCalls,
  nodesAboveThreshold,eligibleNodesAboveThreshold,markedRedFaces,greenFaces,splitEdgeCount,addedVertices:splitEdgeCount,
  addedTriangles:triangles-originalTriangles,addedGeometryBytes:geometryBytes-base.stats.geometryBytes,sourceSpacingKm:grid.spacingKm,maxErrorKm:plan.maxErrorKm,
  sourceGrid:grid,selectionDomain:domain,
  selectedNodeColumns:plan.lastX-plan.firstX+1,selectedNodeRows:plan.lastZ-plan.firstZ+1,originalFacesBySplitEdgeCount,maximumCellTriangles,
  cellTriangleCountBytes:cellTriangleCount.byteLength,midpointVerticesOutsideDomain,boundsKm:{min,max}};
 return {positions,normals,surface,indices,cellFirstIndex,cellTriangleCount,stats:{...base.stats,vertices,triangles,geometryBytes,
  sampleCalls:totalSampleCalls,minimumHeightKm,maximumHeightKm,refinement}};
}

type TerrainVector=readonly number[]|{readonly x:number;readonly y:number;readonly z:number};
export interface TerrainCameraFrame {
 origin:TerrainVector;forward:TerrainVector;right:TerrainVector;up:TerrainVector;
 aspect:number;tanFov:number;inspection:number;
}
function components(value:TerrainVector):[number,number,number]{
 const p='x' in value?[value.x,value.y,value.z]:[value[0],value[1],value[2]];
 if(p.length!==3||!p.every(Number.isFinite))throw new RangeError('Invalid terrain camera basis');
 return p.map(Math.fround) as [number,number,number];
}

/** Off-axis camera matching F+R*ndcX*aspect*tan+U*(ndcY-s)*tan.
 * Standard perspective yields ndcY=y/(-z)/tan-e[9], hence e[9]=-s.
 * Store the shift as a view offset so Three may rebuild WebGPU/reversed-Z depth
 * projection without discarding the vertical principal point.
 */
export function configureTerrainCamera(camera:PerspectiveCamera,frame:TerrainCameraFrame,width:number,height:number):void{
 if(!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0||![frame.aspect,frame.tanFov,frame.inspection].every(Number.isFinite)||frame.aspect<=0||frame.tanFov<=0)throw new RangeError('Invalid terrain camera projection');
 const origin=components(frame.origin),forward=components(frame.forward),right=components(frame.right),up=components(frame.up);
 camera.fov=2*Math.atan(Math.fround(frame.tanFov))*180/Math.PI;
 const shift=.16*(1-Math.fround(frame.inspection));
 camera.setViewOffset(width,height,0,shift*height/2,width,height);
 camera.aspect=Math.fround(frame.aspect);camera.updateProjectionMatrix();
 camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;
 camera.matrixWorld.makeBasis(new Vector3(...right),new Vector3(...up),new Vector3(...forward).negate());
 camera.matrixWorld.setPosition(...origin);camera.matrix.copy(camera.matrixWorld);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();camera.position.fromArray(origin);
}

export interface TerrainShadeInputs {positionWorld:Node<'vec3'>;normal:Node<'vec3'>;height:Node<'float'>;coast:Node<'float'>;distance:Node<'float'>;pixelKm:Node<'float'>;shadowVisibility:Node<'float'>}
export interface TerrainRasterCacheInputs {values:readonly number[];textures:readonly Texture[]}

type TerrainRasterCacheKey={state:unknown[];attachments:Texture[];versions:number[];firstBindings:boolean[]};
const sameRasterState=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
function rasterTextureState(texture:Texture,includeVersion=true):unknown[]{
 const image=texture.image as {width?:number;height?:number;depth?:number}|undefined;
 return [texture,texture.source,image,includeVersion?texture.version:null,includeVersion?texture.source.version:null,
  image?.width,image?.height,image?.depth,texture.mapping,texture.channel,texture.format,texture.internalFormat,texture.type,texture.colorSpace,
  texture.wrapS,texture.wrapT,'wrapR' in texture?texture.wrapR:null,texture.magFilter,texture.minFilter,texture.anisotropy,texture.generateMipmaps,
  texture.flipY,texture.premultiplyAlpha,texture.unpackAlignment,texture.mipmaps,texture.mipmaps.length,
  'compareFunction' in texture?texture.compareFunction:null,texture.matrixAutoUpdate,
  ...texture.offset.toArray(),...texture.repeat.toArray(),...texture.center.toArray(),texture.rotation,...texture.matrix.elements];
}
function rasterAttributeState(attribute:ReturnType<BufferGeometry['getAttribute']>|null):unknown[]{
 if(!attribute)return [null];
 const data='data' in attribute?attribute.data:attribute;
 return [attribute,data,data.array,data.version,data.count,data.usage,attribute.itemSize,attribute.normalized,
  'gpuType' in attribute?attribute.gpuType:null,'offset' in attribute?attribute.offset:null,'stride' in data?data.stride:null];
}
function rasterObjectState(object:Mesh|Scene):unknown[]{
 return [object,object.parent,object.visible,object.layers.mask,object.renderOrder,object.frustumCulled,
  object.matrixAutoUpdate,object.matrixWorldAutoUpdate,...object.position.toArray(),...object.quaternion.toArray(),...object.scale.toArray(),
  ...object.matrix.elements,...object.matrixWorld.elements];
}
function rasterGeometryState(geometry:BufferGeometry,positionOnly=false):unknown[]{
 const state:unknown[]=[geometry,geometry.drawRange.start,geometry.drawRange.count,...rasterAttributeState(geometry.index),
  geometry.boundingBox,...(geometry.boundingBox?[...geometry.boundingBox.min.toArray(),...geometry.boundingBox.max.toArray()]:[]),
  geometry.boundingSphere,...(geometry.boundingSphere?[...geometry.boundingSphere.center.toArray(),geometry.boundingSphere.radius]:[])];
 const names=positionOnly?['position']:Object.keys(geometry.attributes).sort();
 for(const name of names)state.push(name,...rasterAttributeState(geometry.getAttribute(name)));
 for(const group of geometry.groups)state.push(group.start,group.count,group.materialIndex);
 return [...state,'groups',geometry.groups.length];
}
function sameRasterKey(a:TerrainRasterCacheKey,b:TerrainRasterCacheKey,firstBind=false):boolean{
 return sameRasterState(a.state,b.state)&&a.versions.length===b.versions.length&&a.versions.every((value,i)=>
  Object.is(value,b.versions[i])||(firstBind&&a.firstBindings[Math.floor(i/2)]&&b.versions[i]>=value));
}

export interface TerrainMeshConfiguration extends TerrainMeshOptions {
 /** Prevalidated, exclusively owned static arrays. Cannot be combined with builder inputs. */
 data?:TerrainMeshData;
 sample?:TerrainSampler;shade:(input:TerrainShadeInputs)=>Node<'vec3'>;
 nearKm?:number;farKm?:number;
 /** Opt in only when these finite values/textures describe every mutable shade
  * dependency. No descriptor means live rendering; arbitrary closures cannot
  * be introspected. Static geometry/scene and exclusive target ownership apply.
  */
 cacheInputs?:()=>TerrainRasterCacheInputs;
}

/** One live terrain prepass. All lighting bindings are supplied by the caller's
 * shade closure. Returned RGB is linear radiance before cloudFilm/fog; alpha is
 * physical world distance in km, -1 on miss. Full-resolution nearest loads only.
 */
export class TerrainMesh {
 readonly camera:PerspectiveCamera;
 readonly geometry:BufferGeometry;
 readonly material:MeshBasicNodeMaterial;
 readonly target:ReturnType<typeof makeTarget>;
 readonly mesh:Mesh;
 readonly shadow:TerrainShadow;
 private readonly scene=new Scene();
 private readonly origin=uniform(new Vector3());
 private readonly pixelAngle=uniform(1);
 private readonly geometryStats:TerrainMeshData['stats'];
 private readonly data:TerrainMeshData;
 private disposed=false;
 private reversedDepth:boolean|null=null;
 private readonly cacheInputs:TerrainMeshConfiguration['cacheInputs'];
 private cacheKey:TerrainRasterCacheKey|null=null;
 private casterState:unknown[]|null=null;
 private requests=0;private submissions=0;private hits=0;private epoch=0;
 private readonly boundAttachments=new WeakSet<Texture>();
 private readonly trackedTextures=new Map<Texture,()=>void>();
 private readonly onTargetDisposed=()=>{
  this.boundAttachments.delete(this.target.texture);if(this.target.depthTexture)this.boundAttachments.delete(this.target.depthTexture);
  this.invalidateColour();
 };
 private readonly onShadowDisposed=()=>this.invalidateColour();
 private readonly onGeometryDisposed=()=>this.invalidateGeometry();
 private readonly onMaterialDisposed=()=>this.invalidateColour();
 constructor(configuration:TerrainMeshConfiguration){
  this.cacheInputs=configuration.cacheInputs;
  if(configuration.data&&[configuration.sample,configuration.refinement,configuration.cellsPerSide,configuration.levels,configuration.spacingKm,configuration.normalMode].some(v=>v!==undefined))throw new RangeError('Static terrain data cannot be combined with builder inputs');
  const data=configuration.data??buildTerrainMeshData(configuration.sample,configuration);this.data=data;this.geometryStats=data.stats;
  this.geometry=new BufferGeometry();
  this.geometry.setAttribute('position',new BufferAttribute(data.positions,3));this.geometry.setAttribute('normal',new BufferAttribute(data.normals,3));
  this.geometry.setAttribute('terrainSurface',new BufferAttribute(data.surface,2));this.geometry.setIndex(new BufferAttribute(data.indices,1));
  this.geometry.computeBoundingSphere();this.geometry.computeBoundingBox();
  this.shadow=new TerrainShadow(this.scene,this.geometry.boundingBox!);
  this.camera=new PerspectiveCamera(32,1,configuration.nearKm??TERRAIN_MESH_DEFAULTS.nearKm,configuration.farKm??TERRAIN_MESH_DEFAULTS.farKm);
  this.camera.coordinateSystem=WebGPUCoordinateSystem;
  this.material=new MeshBasicNodeMaterial();this.material.name='Cloudia terrain radiance and km distance';
  this.material.blending=NoBlending;this.material.fog=false;this.material.premultipliedAlpha=false;this.material.toneMapped=false;
  this.material.depthTest=true;this.material.depthWrite=true;
  const surface=varying(attribute('terrainSurface','vec2'),'terrainSurfaceVarying'),distance=positionWorld.sub(this.origin).length();
  this.material.fragmentNode=vec4(configuration.shade({positionWorld,normal:normalWorld.normalize(),height:surface.x,coast:surface.y,distance,pixelKm:distance.mul(this.pixelAngle),shadowVisibility:this.shadow.visibility(positionWorld)}),distance);
  this.mesh=new Mesh(this.geometry,this.material);this.scene.add(this.mesh);
  this.target=makeTarget();
  if(this.cacheInputs){
   this.target.addEventListener('dispose',this.onTargetDisposed);this.shadow.target.addEventListener('dispose',this.onShadowDisposed);
   this.geometry.addEventListener('dispose',this.onGeometryDisposed);this.material.addEventListener('dispose',this.onMaterialDisposed);
  }
 }
 private invalidateColour():void{if(this.disposed)return;this.epoch++;this.cacheKey=null;}
 /** Conservative invalidation of colour AND shadow for external target writes
  * or same-owner renderer/backend resets. Also required for mutable shade
  * dependencies absent from cacheInputs/versioning.
  */
 invalidate():void{if(this.disposed)return;this.invalidateColour();this.shadow.invalidate();}
 /** Call after raw caster/world mutations, recomputing geometry bounds first.
  * Attribute/index versions and owned transforms are also checked automatically.
  * Raw array writes without needsUpdate and arbitrary callback changes are not
  * discovered by the cache; the geometry/scene ownership contract stays static.
  */
 invalidateGeometry():void{if(this.disposed)return;this.invalidate();this.casterState=null;}
 private trackTextures(textures:readonly Texture[]):void{
  const current=new Set(textures);
  for(const [texture,listener] of this.trackedTextures)if(!current.has(texture)){
   texture.removeEventListener('dispose',listener);this.trackedTextures.delete(texture);
  }
  for(const texture of current)if(!this.trackedTextures.has(texture)){
   const listener=()=>{this.boundAttachments.delete(texture);this.invalidateColour();};
   texture.addEventListener('dispose',listener);this.trackedTextures.set(texture,listener);
  }
 }
 private readCasterState(renderer:WebGPURenderer):unknown[]{
  return [renderer,renderer.backend,renderer.reversedDepthBuffer,...rasterGeometryState(this.geometry,true),
   this.mesh.geometry,...rasterObjectState(this.scene),...rasterObjectState(this.mesh)];
 }
 private readCacheKey(renderer:WebGPURenderer,frame:TerrainCameraFrame,sunVector:TerrainShadowVector):TerrainRasterCacheKey{
  const input=this.cacheInputs!();
  if(!input||!Array.isArray(input.values)||!input.values.every(Number.isFinite)||!Array.isArray(input.textures)||
   !input.textures.every(texture=>texture?.isTexture===true))throw new RangeError('Invalid terrain raster cache inputs');
  const attachments=[this.target.texture,...(this.target.depthTexture?[this.target.depthTexture]:[])];
  const shadow=this.shadow.stats().cache,shadowTarget=this.shadow.target;
  this.trackTextures([...attachments,...input.textures,shadowTarget.texture,...(shadowTarget.depthTexture?[shadowTarget.depthTexture]:[])]);
  const material=this.material;
  const state:unknown[]=[renderer,renderer.backend,renderer.reversedDepthBuffer,renderer.coordinateSystem,
   renderer.outputColorSpace,renderer.toneMapping,renderer.toneMappingExposure,renderer.getPixelRatio(),
   ...renderer.getViewport(new Vector4()).toArray(),...renderer.getScissor(new Vector4()).toArray(),renderer.getScissorTest(),
   this.epoch,...components(frame.origin),...components(frame.forward),...components(frame.right),...components(frame.up),
   frame.aspect,frame.tanFov,frame.inspection,...components(sunVector),this.camera.near,this.camera.far,this.camera.coordinateSystem,
   ...this.camera.projectionMatrix.elements,...this.camera.matrixWorld.elements,
   this.target,this.target.width,this.target.height,this.target.depth,this.target.samples,this.target.depthBuffer,this.target.stencilBuffer,
   this.target.resolveColorBuffer,this.target.resolveDepthBuffer,this.target.resolveStencilBuffer,
   ...this.target.viewport.toArray(),...this.target.scissor.toArray(),this.target.scissorTest,
   ...rasterGeometryState(this.geometry),this.mesh.geometry,this.mesh.material,...rasterObjectState(this.scene),...rasterObjectState(this.mesh),
   this.scene.overrideMaterial,material,material.version,material.fragmentNode,material.vertexNode,material.side,material.visible,
   material.depthTest,material.depthWrite,material.depthFunc,material.colorWrite,material.blending,material.transparent,material.opacity,
   material.alphaTest,material.premultipliedAlpha,material.toneMapped,material.fog,material.polygonOffset,material.polygonOffsetFactor,material.polygonOffsetUnits,
   shadowTarget,shadowTarget.width,shadowTarget.height,shadowTarget.samples,shadow.valid,shadow.submissions,shadow.epoch,
   ...rasterTextureState(shadowTarget.texture),...(shadowTarget.depthTexture?rasterTextureState(shadowTarget.depthTexture):[null]),
   'shade-values',input.values.length,...input.values,'shade-textures',input.textures.length];
  for(const texture of input.textures)state.push(...rasterTextureState(texture));
  for(const texture of attachments)state.push(...rasterTextureState(texture,false));
  return {state,attachments,versions:attachments.flatMap(texture=>[texture.version,texture.source.version]),
   firstBindings:attachments.map(texture=>!this.boundAttachments.has(texture))};
 }
 get texture():Texture{return this.target.texture;}
 surfaceY(x:number,z:number):number|null{return terrainMeshHeightAt(this.data,x,z);}
 resize(width:number,height:number):void{
  if(this.disposed)throw new Error('Terrain mesh disposed');
  if(!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0)throw new RangeError('Invalid terrain target size');
  if(width!==this.target.width||height!==this.target.height)this.invalidateColour();
  this.target.setSize(width,height);
 }
 render(renderer:WebGPURenderer,frame:TerrainCameraFrame,sunVector:TerrainShadowVector):void{
  if(this.disposed)throw new Error('Terrain mesh disposed');
  this.requests++;
  try{
   this.reversedDepth=renderer.reversedDepthBuffer;
   if(this.cacheInputs){
    const caster=this.readCasterState(renderer);
    if(this.casterState&&!sameRasterState(caster,this.casterState))this.invalidateGeometry();
    this.shadow.render(renderer,sunVector);this.casterState=caster;
   }else this.shadow.render(renderer,sunVector);
   configureTerrainCamera(this.camera,frame,this.target.width,this.target.height);
   this.origin.value.fromArray(components(frame.origin));this.pixelAngle.value=2*Math.fround(frame.tanFov)/this.target.height;
   const requested=this.cacheInputs?this.readCacheKey(renderer,frame,sunVector):null;
   if(requested&&this.cacheKey&&sameRasterKey(this.cacheKey,requested)){this.hits++;return;}
   // Clear/draw/restore failures must never preserve an entry for overwritten pixels.
   this.cacheKey=null;
   const previousTarget=renderer.getRenderTarget(),previousMRT=renderer.getMRT(),previousColour=renderer.getClearColor(new Color()),previousAlpha=renderer.getClearAlpha();
   const previousDepth=renderer.reversedDepthBuffer?1-renderer.getClearDepth():renderer.getClearDepth(),previousAutoClear=renderer.autoClear;
   try{
    renderer.setMRT(null);renderer.setRenderTarget(this.target);renderer.autoClear=false;
    renderer.setClearColor(0,-1);renderer.setClearDepth(1);renderer.clear(true,true,false);
    this.submissions++;renderer.render(this.scene,this.camera);
   }finally{
    renderer.autoClear=previousAutoClear;renderer.setClearColor(previousColour,previousAlpha);renderer.setClearDepth(previousDepth);
    renderer.setRenderTarget(previousTarget);renderer.setMRT(previousMRT);
   }
   if(requested&&!this.disposed){
    for(const texture of requested.attachments)this.boundAttachments.add(texture);
    const completed=this.readCacheKey(renderer,frame,sunVector);
    // Only first-bind version increments of owned attachments may differ. Shade,
    // caster, epoch and all other resource/config changes require another draw.
    if(sameRasterKey(requested,completed,true)&&sameRasterState(this.casterState!,this.readCasterState(renderer))&&this.shadow.stats().cache.valid)this.cacheKey=completed;
   }
  }catch(error){this.cacheKey=null;throw error;}
 }
 stats(){
  const pixels=this.target.width*this.target.height;
  return {...this.geometryStats,geometryScope:'First visible triangle of this static stitched mesh; not exact analytic-height intersection',
   shadow:this.shadow.stats(),width:this.target.width,height:this.target.height,colourFormat:'rgba32float',distanceComponent:'alpha; km from actual camera origin; -1 miss',
   colourDistanceBytes:pixels*16,depthBytes:pixels*4,targetPayloadBytes:pixels*20,
   cpuTriangleLookupBytes:this.data.cellFirstIndex.byteLength+(this.data.cellTriangleCount?.byteLength??0),
   normalPolicy:this.geometryStats.normalMode==='geometry'?'Shared incident-area-weighted actual mesh normal at every vertex; no bilinear-source gradient seams':'Shared vertex normal; analytic near, smooth width-based blend to incident-area-weighted mesh normal before coarse rings',
   memoryScope:'Nominal retained geometry and target/depth payload only; CPU construction temporaries and driver residency/peak are unmeasured',
   perFrameCpuHeightSamples:0,nearKm:this.camera.near,farKm:this.camera.far,reversedDepthBuffer:this.reversedDepth,cache:{enabled:!!this.cacheInputs,requests:this.requests,hits:this.hits,submissions:this.submissions,epoch:this.epoch,valid:this.cacheKey!==null,
    scope:'Owner-local CPU requests/render attempts; hits skip colour clear/draw. Not GPU completion, presentation or FPS.',
    ownership:'Static scene/geometry and exclusive target. cacheInputs covers every mutable shade binding; invalidate for external writes/reset, invalidateGeometry for raw caster/world changes after updating bounds.'}};
 }
 dispose():void{
  if(this.disposed)return;this.disposed=true;this.cacheKey=null;this.casterState=null;
  this.target.removeEventListener('dispose',this.onTargetDisposed);this.shadow.target.removeEventListener('dispose',this.onShadowDisposed);
  this.geometry.removeEventListener('dispose',this.onGeometryDisposed);this.material.removeEventListener('dispose',this.onMaterialDisposed);
  for(const [texture,listener] of this.trackedTextures)texture.removeEventListener('dispose',listener);this.trackedTextures.clear();
  this.shadow.dispose();this.target.dispose();this.geometry.dispose();this.material.dispose();this.scene.remove(this.mesh);
 }
}

function makeTarget(){
 // Explicit 32F distance and depth; no optional float32 filtering or Tier1.
 const depthTexture=new DepthTexture(1,1,FloatType);depthTexture.format=DepthFormat;
 depthTexture.minFilter=NearestFilter;depthTexture.magFilter=NearestFilter;
 const target=new RenderTarget(1,1,{type:FloatType,format:RGBAFormat,minFilter:NearestFilter,magFilter:NearestFilter,
  depthBuffer:true,depthTexture,stencilBuffer:false,samples:0,generateMipmaps:false});
 target.texture.colorSpace=NoColorSpace;target.texture.flipY=false;
 return target;
}
