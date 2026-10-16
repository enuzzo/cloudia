import {
 Box3,Color,DepthFormat,DepthTexture,FloatType,MeshBasicNodeMaterial,NearestFilter,NoBlending,NoColorSpace,Vector2,type BufferGeometry,
 OrthographicCamera,RedFormat,RenderTarget,Vector3,WebGPUCoordinateSystem,type Node,type Scene,type Texture,type WebGPURenderer,
} from 'three/webgpu';
import {positionWorld,screenCoordinate,texture,uniform,wgslFn} from 'three/tsl';
import {EARTH_RADIUS} from './landscape';
import {TerrainShadowCaster} from './TerrainShadowCaster';
import {TERRAIN_SHADOW_CLIP_WGSL} from './terrainShadowClip';

export type TerrainShadowVector=readonly number[]|{readonly x:number;readonly y:number;readonly z:number};
export const TERRAIN_SHADOW_DEFAULTS=Object.freeze({resolution:2048,radiusKm:64,clearHeightKm:-1e6,
 baseBiasKm:.001,fadeStart:.85});
export interface TerrainShadowFrame {
 center:Vector3;sun:Vector3;right:Vector3;up:Vector3;distanceKm:number;nearKm:number;farKm:number;
 minimumCasterHeightKm:number;maximumCasterHeightKm:number;radiusKm:number;resolution:number;
}
function vector(value:TerrainShadowVector):Vector3{
 const result='x' in value?new Vector3(value.x,value.y,value.z):new Vector3(value[0],value[1],value[2]);
 if(!result.toArray().every(Number.isFinite))throw new RangeError('Nonfinite terrain shadow vector');
 return result;
}
/** All mesh corners fit the light-depth range, including casters outside the
 * receiver's world-XZ square. XY coverage remains the light's 128km square.
 */
export function terrainShadowFrame(sunVector:TerrainShadowVector,bounds:Box3,resolution=2048,radiusKm=64):TerrainShadowFrame{
 if(bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw new RangeError('Invalid terrain shadow caster bounds');
 if(!Number.isInteger(resolution)||resolution<1||!Number.isFinite(radiusKm)||radiusKm<=0)throw new RangeError('Invalid terrain shadow map');
 const center=new Vector3(0,-4,0),sun=vector(sunVector);
 if(sun.lengthSq()<1e-16)throw new RangeError('Zero terrain sun direction');sun.normalize();
 const reference=Math.abs(sun.y)>.99?new Vector3(0,0,1):new Vector3(0,1,0);
 const right=reference.cross(sun).normalize(),up=sun.clone().cross(right).normalize();
 let qMin=Infinity,qMax=-Infinity;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const height=new Vector3(x,y,z).sub(center).dot(sun);qMin=Math.min(qMin,height);qMax=Math.max(qMax,height);
 }
 const distanceKm=qMax+1;
 return {center,sun,right,up,distanceKm,nearKm:.5,farKm:distanceKm-qMin+1,
  minimumCasterHeightKm:qMin,maximumCasterHeightKm:qMax,radiusKm,resolution};
}
export function terrainShadowProject(point:TerrainShadowVector,frame:TerrainShadowFrame){
 const relative=vector(point).sub(frame.center),heightKm=relative.dot(frame.sun);
 return {u:.5+relative.dot(frame.right)/(2*frame.radiusKm),v:.5-relative.dot(frame.up)/(2*frame.radiusKm),
  heightKm,depthKm:frame.distanceKm-heightKm};
}
export function terrainShadowCompare(receiverHeightKm:number,storedHeightKm:number,biasKm:number):number{
 return receiverHeightKm+biasKm>=storedHeightKm?1:0;
}
/** Conservative minimum of the caster face's affine solar-height plane over
 * one light-map texel, plus 1m numerical margin. Derivatives are km per texel.
 * This deliberately erodes contact shadows at unresolved sub-texel distances.
 * It is not a bound on unrelated triangles hidden inside the same texel.
 */
export function terrainShadowCasterMinimum(heightKm:number,derivativeXKm:number,derivativeYKm:number):number{
 return heightKm-.5*(Math.abs(derivativeXKm)+Math.abs(derivativeYKm))-TERRAIN_SHADOW_DEFAULTS.baseBiasKm;
}
/** Elevate only the shadow lookup receiver by half a light texel along the
 * planet radial, never the visible mesh. In the default map this is 31.25m.
 * Both UV and solar height must use this elevated point; a global q offset
 * would produce a different and excessive bias when the Sun is near horizontal.
 */
export function terrainShadowLookupPoint(point:TerrainShadowVector,frame:TerrainShadowFrame):Vector3{
 const original=vector(point),planetCenter=frame.center.clone().add(new Vector3(0,-EARTH_RADIUS,0));
 return original.clone().addScaledVector(original.clone().sub(planetCenter).normalize(),frame.radiusKm/frame.resolution);
}
/** CPU map-addressing oracle. One stored caster-face minimum replaces the old
 * 3x3 receiver-plane extrapolation, which was invalid across terrain creases.
 */
export function terrainShadowVisibility(point:TerrainShadowVector,frame:TerrainShadowFrame,sample:(x:number,y:number)=>number):number{
 const p=terrainShadowProject(terrainShadowLookupPoint(point,frame),frame);
 if(p.u<0||p.v<0||p.u>=1||p.v>=1)return 1;
 const visibility=terrainShadowCompare(p.heightKm,sample(Math.floor(p.u*frame.resolution),Math.floor(p.v*frame.resolution)),0);
 const edge=Math.max(Math.abs(p.u*2-1),Math.abs(p.v*2-1)),t=Math.max(0,Math.min(1,(edge-TERRAIN_SHADOW_DEFAULTS.fadeStart)/(1-TERRAIN_SHADOW_DEFAULTS.fadeStart)));
 return visibility+(1-visibility)*t*t*(3-2*t);
}

export const TERRAIN_SHADOW_CASTER_WGSL=/* wgsl */`
fn terrainShadowCasterMinimum(point:vec3<f32>, center:vec3<f32>, sun:vec3<f32>)->f32 {
 let height=dot(point-center,sun);
 // Orthographic light pixels: these are actual face-height changes per texel.
 // Store the affine face's minimum across the texel, never extrapolate the
 // receiver plane into neighbouring triangles during the visibility lookup.
 return height-.5*(abs(dpdx(height))+abs(dpdy(height)))-.001;
}
`;
export const TERRAIN_SHADOW_WGSL=/* wgsl */`
fn terrainMeshShadowVisibility(point:vec3<f32>, shadowMap:texture_2d<f32>, center:vec3<f32>, sun:vec3<f32>, right:vec3<f32>, up:vec3<f32>, radius:f32)->f32 {
 let size=textureDimensions(shadowMap);
 // Half of the actual light texel in km, radially above the visible receiver.
 let radial=normalize(point-center+vec3<f32>(0.0,${EARTH_RADIUS}.0,0.0));
 let lookupPoint=point+radial*(radius/f32(size.x));
 let relative=lookupPoint-center;
 let uv=vec2<f32>(.5+dot(relative,right)/(2.0*radius),.5-dot(relative,up)/(2.0*radius));
 if(any(uv<vec2<f32>(0.0)) || any(uv>=vec2<f32>(1.0))){return 1.0;}
 let pixel=vec2<i32>(floor(uv*vec2<f32>(size)));
 let height=dot(relative,sun);
 let stored=textureLoad(shadowMap,pixel,0).r;
 let visibility=select(0.0,1.0,height>=stored);
 let edge=max(abs(uv.x*2.0-1.0),abs(uv.y*2.0-1.0));
 return mix(visibility,1.0,smoothstep(.85,1.0,edge));
}
`;
const visibilityFunction=wgslFn(TERRAIN_SHADOW_WGSL);
const casterMinimumFunction=wgslFn(TERRAIN_SHADOW_CASTER_WGSL);
const clippedMinimumFunction=wgslFn(TERRAIN_SHADOW_CLIP_WGSL);

interface TerrainShadowCacheKey {
 renderer:WebGPURenderer;reversedDepth:boolean;sun:number[];bounds:number[];
 width:number;height:number;colour:Texture;colourVersion:number;depth:Texture|null;depthVersion:number|null;epoch:number;
}
function sameShadowInputs(a:TerrainShadowCacheKey,b:TerrainShadowCacheKey):boolean{
 return a.renderer===b.renderer&&a.reversedDepth===b.reversedDepth&&a.epoch===b.epoch&&a.width===b.width&&a.height===b.height&&
  a.colour===b.colour&&a.depth===b.depth&&a.sun.every((value,i)=>Object.is(value,b.sun[i]))&&a.bounds.every((value,i)=>Object.is(value,b.bounds[i]));
}
function sameShadowCache(a:TerrainShadowCacheKey,b:TerrainShadowCacheKey):boolean{
 return sameShadowInputs(a,b)&&a.colourVersion===b.colourVersion&&a.depthVersion===b.depthVersion;
}

/** Live shadow pass of the exact shared terrain mesh. R32F stores relative
 * world height along the Sun; depth32 selects the first light-visible triangle.
 * Hardware reversed depth changes selection, never the height comparison sign.
 */
export class TerrainShadow {
 readonly target:RenderTarget;
 readonly camera=new OrthographicCamera(-64,64,64,-64,.5,512);
 readonly material:MeshBasicNodeMaterial;
 private readonly caster:TerrainShadowCaster;
 private readonly mapSize=uniform(new Vector2(TERRAIN_SHADOW_DEFAULTS.resolution,TERRAIN_SHADOW_DEFAULTS.resolution));
 private readonly center=uniform(new Vector3(0,-4,0));
 private readonly sun=uniform(new Vector3(0,1,0));
 private readonly right=uniform(new Vector3(1,0,0));
 private readonly up=uniform(new Vector3(0,0,-1));
 private readonly radius=uniform(TERRAIN_SHADOW_DEFAULTS.radiusKm);
 private disposed=false;
 private frame:TerrainShadowFrame|null=null;
 private reversedDepth:boolean|null=null;
 private cacheKey:TerrainShadowCacheKey|null=null;
 private requests=0;private submissions=0;private hits=0;private epoch=0;
 private trackedColour:Texture|null=null;private trackedDepth:Texture|null=null;
 private readonly onContentDisposed=()=>this.invalidate();
 constructor(private readonly scene:Scene,private readonly bounds:Box3,sourceGeometry:BufferGeometry){
  this.caster=new TerrainShadowCaster(sourceGeometry,{center:this.center,sun:this.sun,scene});this.material=this.caster.material;
  const resolution=TERRAIN_SHADOW_DEFAULTS.resolution;
  const depthTexture=new DepthTexture(resolution,resolution,FloatType);depthTexture.format=DepthFormat;
  depthTexture.minFilter=NearestFilter;depthTexture.magFilter=NearestFilter;
  this.target=new RenderTarget(resolution,resolution,{type:FloatType,format:RedFormat,minFilter:NearestFilter,magFilter:NearestFilter,
   depthBuffer:true,depthTexture,stencilBuffer:false,samples:0,generateMipmaps:false});
  this.target.texture.colorSpace=NoColorSpace;this.target.texture.flipY=false;
  this.camera.coordinateSystem=WebGPUCoordinateSystem;this.camera.matrixAutoUpdate=false;this.camera.matrixWorldAutoUpdate=false;
  this.material.name='Cloudia terrain shadow relative solar height';this.material.blending=NoBlending;this.material.fog=false;
  this.material.premultipliedAlpha=false;this.material.toneMapped=false;this.material.depthTest=true;this.material.depthWrite=true;
  // Derivatives are evaluated before the clipping function enters divergent control flow.
  const baselineMinimum=(casterMinimumFunction({point:positionWorld,center:this.center,sun:this.sun}) as Node<'float'>).toVar('terrainBaselineCasterMinimum');
  const [aUVQ,bUVQ,cUVQ]=this.caster.cornersUVQ;
  this.material.fragmentNode=clippedMinimumFunction({aUVQ,bUVQ,cUVQ,screenPixel:screenCoordinate.xy,mapSize:this.mapSize,baselineMinimum}) as Node<'float'>;
  this.target.addEventListener('dispose',this.onContentDisposed);
  this.trackedColour=this.target.texture;this.trackedDepth=this.target.depthTexture;
  this.trackedColour.addEventListener('dispose',this.onContentDisposed);
  this.trackedDepth?.addEventListener('dispose',this.onContentDisposed);
 }
 get texture():Texture{return this.target.texture;}
 visibility(point:Node<'vec3'>):Node<'float'>{
  return visibilityFunction({point,shadowMap:texture(this.target.texture),center:this.center,sun:this.sun,right:this.right,up:this.up,radius:this.radius}) as Node<'float'>;
 }
 /** Call after owned-caster/world-bounds changes or target writes/reset.
  * Source geometry is packed at construction: source edits require recreating this owner. */
 invalidate():void{if(this.disposed)return;this.epoch++;this.cacheKey=null;}
 private trackAttachments():void{
  const colour=this.target.texture,depth=this.target.depthTexture;
  if(colour===this.trackedColour&&depth===this.trackedDepth)return;
  this.trackedColour?.removeEventListener('dispose',this.onContentDisposed);this.trackedDepth?.removeEventListener('dispose',this.onContentDisposed);
  this.trackedColour=colour;this.trackedDepth=depth;
  colour.addEventListener('dispose',this.onContentDisposed);depth?.addEventListener('dispose',this.onContentDisposed);
  this.invalidate();
 }
 private key(renderer:WebGPURenderer,frame:TerrainShadowFrame):TerrainShadowCacheKey{
  return {renderer,reversedDepth:renderer.reversedDepthBuffer,sun:frame.sun.toArray(),bounds:[...this.bounds.min.toArray(),...this.bounds.max.toArray()],
   width:this.target.width,height:this.target.height,colour:this.target.texture,colourVersion:this.target.texture.version,
   depth:this.target.depthTexture,depthVersion:this.target.depthTexture?.version??null,epoch:this.epoch};
 }
 render(renderer:WebGPURenderer,sunVector:TerrainShadowVector):void{
  if(this.disposed)throw new Error('Terrain shadow disposed');
  const frame=terrainShadowFrame(sunVector,this.bounds);this.frame=frame;this.reversedDepth=renderer.reversedDepthBuffer;
  this.requests++;
  this.trackAttachments();
  const requested=this.key(renderer,frame);
  if(this.cacheKey&&sameShadowCache(this.cacheKey,requested)){this.hits++;return;}
  // A failed new clear/draw must never leave the old key valid for overwritten pixels.
  this.cacheKey=null;
  this.sun.value.copy(frame.sun);this.right.value.copy(frame.right);this.up.value.copy(frame.up);
  this.mapSize.value.set(this.target.width,this.target.height);
  this.camera.near=frame.nearKm;this.camera.far=frame.farKm;this.camera.updateProjectionMatrix();
  const origin=frame.center.clone().addScaledVector(frame.sun,frame.distanceKm);
  this.camera.matrixWorld.makeBasis(frame.right,frame.up,frame.sun);this.camera.matrixWorld.setPosition(origin);
  this.camera.matrix.copy(this.camera.matrixWorld);this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();this.camera.position.copy(origin);
  const previousTarget=renderer.getRenderTarget(),previousMRT=renderer.getMRT(),previousColour=renderer.getClearColor(new Color()),previousAlpha=renderer.getClearAlpha();
  const previousDepth=renderer.reversedDepthBuffer?1-renderer.getClearDepth():renderer.getClearDepth(),previousAutoClear=renderer.autoClear,previousOverride=this.scene.overrideMaterial;
  try{
   this.scene.overrideMaterial=this.material;renderer.setMRT(null);renderer.setRenderTarget(this.target);renderer.autoClear=false;
   renderer.setClearColor(new Color(TERRAIN_SHADOW_DEFAULTS.clearHeightKm,0,0),1);renderer.setClearDepth(1);renderer.clear(true,true,false);
   this.submissions++;renderer.render(this.scene,this.camera);
  }finally{
   this.scene.overrideMaterial=previousOverride;renderer.autoClear=previousAutoClear;renderer.setClearColor(previousColour,previousAlpha);renderer.setClearDepth(previousDepth);
   renderer.setRenderTarget(previousTarget);renderer.setMRT(previousMRT);
  }
  // Three may increment attachment versions at first bind. Commit only the final
  // versions, and never erase an invalidate() or changed bounds/target during draw.
  if(!this.disposed){
   this.trackAttachments();const completed=this.key(renderer,frame);
   if(sameShadowInputs(requested,completed))this.cacheKey=completed;
  }
 }
 stats(){return {resolution:TERRAIN_SHADOW_DEFAULTS.resolution,radiusKm:TERRAIN_SHADOW_DEFAULTS.radiusKm,
  coverage:'128km square in light right/up coordinates, centered at [0,-4,0], outer 15% fades to lit; not global terrain shadows',
  colourFormat:'r32float relative solar height km; -1000000 clear',depthFormat:'depth32float',
  colourBytes:this.target.width*this.target.height*4,depthBytes:this.target.width*this.target.height*4,targetPayloadBytes:this.target.width*this.target.height*8,
  baseBiasKm:TERRAIN_SHADOW_DEFAULTS.baseBiasKm,receiverRadialOffsetKm:TERRAIN_SHADOW_DEFAULTS.radiusKm/TERRAIN_SHADOW_DEFAULTS.resolution,
  filter:'One nearest textureLoad; no receiver-plane extrapolation or PCF blur; outside coverage lit',
  biasPolicy:'Minimum of raw-depth winning triangle intersected with addressed light texel minus1m; invalid/degenerate clipping falls back to original affine texel minimum',
  receiverPolicy:'Only shadow lookup point elevated along planet radial by half one light texel; geometry/radiance point unchanged; contact shadows below this scale may disappear',
  biasLimit:'One nearest winner per texel still cannot represent multiple faces or pointwise coverage; radial receiver shift and fallback can lose contact shadows; no physical-visibility guarantee',
  caster:this.caster.stats(),
  depthFit:this.frame?{nearKm:this.frame.nearKm,farKm:this.frame.farKm,cameraDistanceKm:this.frame.distanceKm,minimumCasterHeightKm:this.frame.minimumCasterHeightKm,maximumCasterHeightKm:this.frame.maximumCasterHeightKm}:null,
  reversedDepthBuffer:this.reversedDepth,updates:'Exact-input cached triangle caster map; terrain colour draw stays live; source geometry borrowed, packed caster owned',
  cache:{requests:this.requests,submissions:this.submissions,hits:this.hits,epoch:this.epoch,valid:this.cacheKey!==null,
   scope:'Owner-local CPU calls: requests are validated render calls, submissions are renderer.render attempts (including throws), hits skip shadow clear/draw; no GPU completion or presentation claim',
   ownership:'Static packed casters and exclusive target; source-geometry edits require recreating owner; invalidate after packed-caster or target writes/backend reset; disposed owner is terminal'}};}
 dispose():void{
  if(this.disposed)return;this.disposed=true;this.cacheKey=null;
  this.target.removeEventListener('dispose',this.onContentDisposed);
  this.trackedColour?.removeEventListener('dispose',this.onContentDisposed);this.trackedDepth?.removeEventListener('dispose',this.onContentDisposed);
  this.trackedColour=null;this.trackedDepth=null;this.target.dispose();this.caster.dispose();
 }
}
