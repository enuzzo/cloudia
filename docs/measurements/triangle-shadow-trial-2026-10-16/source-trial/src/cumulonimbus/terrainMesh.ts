import {
 BufferAttribute,BufferGeometry,Color,DepthFormat,DepthTexture,FloatType,Mesh,MeshBasicNodeMaterial,
 NearestFilter,NoBlending,NoColorSpace,PerspectiveCamera,RenderTarget,RGBAFormat,Scene,Vector3,WebGPUCoordinateSystem,
 type Node,type Texture,type WebGPURenderer,
} from 'three/webgpu';
import {attribute,positionWorld,normalWorld,uniform,varying,vec4} from 'three/tsl';
import {EARTH_RADIUS,GROUND_LEVEL} from './landscape';
import {terrainSurfaceSample,type TerrainSurfaceSample} from './terrainSurface';
import {TerrainShadow,type TerrainShadowVector} from './TerrainShadow';

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
export interface TerrainMeshOptions {cellsPerSide?:number;levels?:number;spacingKm?:number;normalMode?:'analytic-blend'|'geometry'}
export interface TerrainMeshData {
 positions:Float32Array;normals:Float32Array;surface:Float32Array;indices:Uint32Array;
 /** CPU-only cell -> first triangle index. Missing hole cells are 0xffffffff. */
 cellFirstIndex:Uint32Array;
 stats:{vertices:number;triangles:number;stitchedCells:number;levels:number;cellsPerSide:number;
  baseSpacingKm:number;outerExtentKm:number;geometryBytes:number;sampleCalls:number;minimumHeightKm:number;maximumHeightKm:number;
  normalBlendStartRadiusKm:number;normalBlendEndRadiusKm:number;normalMode:'analytic-blend'|'geometry'};
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

export function buildTerrainMeshData(sample:TerrainSampler=terrainSurfaceSample,options:TerrainMeshOptions={}):TerrainMeshData{
 const cells=options.cellsPerSide??TERRAIN_MESH_DEFAULTS.cellsPerSide,levels=options.levels??TERRAIN_MESH_DEFAULTS.levels;
 const spacing=options.spacingKm??TERRAIN_MESH_DEFAULTS.spacingKm;
 const normalMode=options.normalMode??'analytic-blend';
 if(normalMode!=='analytic-blend'&&normalMode!=='geometry')throw new RangeError('Invalid terrain normal mode');
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
 blendTerrainMeshNormals(data.positions,data.normals,data.indices,cells,normalMode==='geometry');
 return {...data,cellFirstIndex,stats:{vertices:vertices.size,triangles:indices.length/3,stitchedCells,levels,cellsPerSide:cells,baseSpacingKm:spacing,outerExtentKm:extent,
  geometryBytes:data.positions.byteLength+data.normals.byteLength+data.surface.byteLength+data.indices.byteLength,sampleCalls:vertices.size,minimumHeightKm,maximumHeightKm,
  normalBlendStartRadiusKm:cells*TERRAIN_NORMAL_ANALYTIC_WIDTH_KM/2,normalBlendEndRadiusKm:cells*TERRAIN_NORMAL_GEOMETRIC_WIDTH_KM/2,normalMode}};
}

/** Height of the actual Float32 triangles, including the seam fans. Constant
 * bounded neighbourhood lookup, no analytic H evaluation or full-mesh scan.
 * Adjacent cells/levels cover Float32 rounding on shared edges; taking their
 * maximum is conservative at the tiny barycentric boundary tolerance.
 */
export function terrainMeshHeightAt(data:TerrainMeshData,x:number,z:number):number|null{
 if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError('Nonfinite terrain mesh query');
 const {cellsPerSide:cells,levels,baseSpacingKm:spacing}=data.stats,half=cells/2,hole=cells/4;
 const maximum=Math.max(Math.abs(x),Math.abs(z));
 let selected=0;while(selected<levels&&maximum>Math.fround(half*spacing*2**selected))selected++;
 if(selected===levels)return null;
 let result=-Infinity;
 for(let level=Math.max(0,selected-1);level<=Math.min(levels-1,selected+1);level++){
  const step=spacing*2**level,cx=Math.floor(x/step),cz=Math.floor(z/step);
  for(let iz=cz-1;iz<=cz+1;iz++)for(let ix=cx-1;ix<=cx+1;ix++){
   if(ix< -half||ix>=half||iz< -half||iz>=half)continue;
   const first=data.cellFirstIndex[(level*cells+iz+half)*cells+ix+half];if(first===0xffffffff)continue;
   const triangles=stitchEdge(ix,iz,level,hole)<0?2:5;
   for(let triangle=0;triangle<triangles;triangle++){
    const i=first+triangle*3,a=data.indices[i]*3,b=data.indices[i+1]*3,c=data.indices[i+2]*3,p=data.positions;
    const den=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);
    const wa=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/den;
    const wb=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/den,wc=1-wa-wb;
    if(Math.min(wa,wb,wc)>=-1e-7)result=Math.max(result,wa*p[a+1]+wb*p[b+1]+wc*p[c+1]);
   }
  }
 }
 return Number.isFinite(result)?result:null;
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
export interface TerrainMeshConfiguration extends TerrainMeshOptions {
 sample?:TerrainSampler;shade:(input:TerrainShadeInputs)=>Node<'vec3'>;
 nearKm?:number;farKm?:number;
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
 constructor(configuration:TerrainMeshConfiguration){
  const data=buildTerrainMeshData(configuration.sample,configuration);this.data=data;this.geometryStats=data.stats;
  this.geometry=new BufferGeometry();
  this.geometry.setAttribute('position',new BufferAttribute(data.positions,3));this.geometry.setAttribute('normal',new BufferAttribute(data.normals,3));
  this.geometry.setAttribute('terrainSurface',new BufferAttribute(data.surface,2));this.geometry.setIndex(new BufferAttribute(data.indices,1));
  this.geometry.computeBoundingSphere();this.geometry.computeBoundingBox();
  this.shadow=new TerrainShadow(new Scene(),this.geometry.boundingBox!,this.geometry);
  this.camera=new PerspectiveCamera(32,1,configuration.nearKm??TERRAIN_MESH_DEFAULTS.nearKm,configuration.farKm??TERRAIN_MESH_DEFAULTS.farKm);
  this.camera.coordinateSystem=WebGPUCoordinateSystem;
  this.material=new MeshBasicNodeMaterial();this.material.name='Cloudia terrain radiance and km distance';
  this.material.blending=NoBlending;this.material.fog=false;this.material.premultipliedAlpha=false;this.material.toneMapped=false;
  this.material.depthTest=true;this.material.depthWrite=true;
  const surface=varying(attribute('terrainSurface','vec2'),'terrainSurfaceVarying'),distance=positionWorld.sub(this.origin).length();
  this.material.fragmentNode=vec4(configuration.shade({positionWorld,normal:normalWorld.normalize(),height:surface.x,coast:surface.y,distance,pixelKm:distance.mul(this.pixelAngle),shadowVisibility:this.shadow.visibility(positionWorld)}),distance);
  this.mesh=new Mesh(this.geometry,this.material);this.scene.add(this.mesh);
  this.target=makeTarget();
 }
 get texture():Texture{return this.target.texture;}
 surfaceY(x:number,z:number):number|null{return terrainMeshHeightAt(this.data,x,z);}
 resize(width:number,height:number):void{
  if(this.disposed)throw new Error('Terrain mesh disposed');
  if(!Number.isInteger(width)||width<=0||!Number.isInteger(height)||height<=0)throw new RangeError('Invalid terrain target size');
  this.target.setSize(width,height);
 }
 render(renderer:WebGPURenderer,frame:TerrainCameraFrame,sunVector:TerrainShadowVector):void{
  if(this.disposed)throw new Error('Terrain mesh disposed');
  this.reversedDepth=renderer.reversedDepthBuffer;
  this.shadow.render(renderer,sunVector);
  configureTerrainCamera(this.camera,frame,this.target.width,this.target.height);
  this.origin.value.fromArray(components(frame.origin));this.pixelAngle.value=2*Math.fround(frame.tanFov)/this.target.height;
  const previousTarget=renderer.getRenderTarget(),previousMRT=renderer.getMRT(),previousColour=renderer.getClearColor(new Color()),previousAlpha=renderer.getClearAlpha();
  const previousDepth=renderer.reversedDepthBuffer?1-renderer.getClearDepth():renderer.getClearDepth(),previousAutoClear=renderer.autoClear;
  try{
   renderer.setMRT(null);renderer.setRenderTarget(this.target);renderer.autoClear=false;
   renderer.setClearColor(0,-1);renderer.setClearDepth(1);renderer.clear(true,true,false);
   renderer.render(this.scene,this.camera);
  }finally{
   renderer.autoClear=previousAutoClear;renderer.setClearColor(previousColour,previousAlpha);renderer.setClearDepth(previousDepth);
   renderer.setRenderTarget(previousTarget);renderer.setMRT(previousMRT);
  }
 }
 stats(){
  const pixels=this.target.width*this.target.height;
  return {...this.geometryStats,geometryScope:'First visible triangle of this static stitched mesh; not exact analytic-height intersection',
   shadow:this.shadow.stats(),width:this.target.width,height:this.target.height,colourFormat:'rgba32float',distanceComponent:'alpha; km from actual camera origin; -1 miss',
   colourDistanceBytes:pixels*16,depthBytes:pixels*4,targetPayloadBytes:pixels*20,
   cpuTriangleLookupBytes:this.data.cellFirstIndex.byteLength,
   normalPolicy:this.geometryStats.normalMode==='geometry'?'Shared incident-area-weighted actual mesh normal at every vertex; no bilinear-source gradient seams':'Shared vertex normal; analytic near, smooth width-based blend to incident-area-weighted mesh normal before coarse rings',
   memoryScope:'Nominal retained geometry and target/depth payload only; CPU construction temporaries and driver residency/peak are unmeasured',
   perFrameCpuHeightSamples:0,nearKm:this.camera.near,farKm:this.camera.far,reversedDepthBuffer:this.reversedDepth,cache:'No cached geometry pass; terrain shading stays live each render'};
 }
 dispose():void{if(this.disposed)return;this.disposed=true;this.shadow.dispose();this.target.dispose();this.geometry.dispose();this.material.dispose();this.scene.remove(this.mesh);}
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
