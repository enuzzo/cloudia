import {
 BufferAttribute,BufferGeometry,DoubleSide,FrontSide,Mesh,MeshBasicNodeMaterial,PerspectiveCamera,Raycaster,
 Vector2,Vector3,WebGPUCoordinateSystem,type Intersection,
} from 'three/webgpu';
import {configureTerrainCamera,TERRAIN_MESH_DEFAULTS,type TerrainCameraFrame} from './terrainMesh';
import {
 terrainShadowCasterMinimum,terrainShadowCompare,terrainShadowFrame,terrainShadowLookupPoint,
 terrainShadowProject,TERRAIN_SHADOW_DEFAULTS,type TerrainShadowVector,
} from './TerrainShadow';

export interface TerrainShadowWitnessPoint {readonly id:string;readonly uv:readonly [number,number]}
const originalPixels=[
 ['L1-artifact',71.5,856.5],['L1-control',64.5,856.5],
 ['L2-artifact',431.5,849.5],['L2-control',431.5,844.5],
 ['L3-artifact',903.5,651.5],['L3-control',903.5,646.5],
 ['C1-ocean',2200.5,1100.5],['C2-coastal-lowland',1800.5,930.5],
 ['C3-plain',2200.5,700.5],['C4-ridge-L1',170.5,805.5],
 ['C5-ridge-L2',460.5,800.5],['C6-ridge-L3',925.5,610.5],
] as const;
/** Historical identifiers are selection labels, never current material/artifact classes.
 * The fixed top-origin UVs survive a change of output size; no new pixels are searched.
 */
export const TERRAIN_SHADOW_WITNESS_POINTS:readonly TerrainShadowWitnessPoint[]=Object.freeze(
 originalPixels.map(([id,x,y])=>Object.freeze({id,uv:Object.freeze([x/2474,y/1844] as const)})),
);
const WALL_BUDGET_MS=40000,MAX_RAYS=36,MAX_JSON_BYTES=128*1024;
const MAX_VERTICES=700000,MAX_TRIANGLES=1300000;
const PHYSICAL_FAR_KM=20,PHYSICAL_OFFSET_KM=.00001,MAX_RETAINED_HITS=3;
type TerrainHit=Intersection;
interface WitnessLookup {
 point:number[];radialOffsetKm:number;uv:[number,number];heightKm:number;insideMap:boolean;
 gridCoordinate?:[number,number];pixel?:[number,number];texelCentreUV?:[number,number];
 distanceToNearestPixelBoundaryTexels?:number;distanceToCoverageEdgeUV?:number;
}
interface WitnessRow {
 id:string;uv:number[];pixelCentre:number[];originalPixelCentre:number[];status:string;
 cameraRay?:Record<string,unknown>;receiver?:Record<string,unknown>;
 baselineLookup?:WitnessLookup;caster?:Record<string,unknown>;
 shadow?:{rawVisibility:number;coverageFade:number;finalVisibility:number;cpuShadow:boolean};
 physicalSunRay?:Record<string,unknown>;
 interpretation?:string;
}
class SnapshotBudgetExceeded extends Error {constructor(readonly phase:string){super('Cooperative snapshot wall budget exhausted');}}
function requireInput(value:unknown,message:string):asserts value {if(!value)throw new RangeError(message);}
function components(value:TerrainShadowVector):[number,number,number]{
 const values='x' in value?[value.x,value.y,value.z]:[value[0],value[1],value[2]];
 requireInput(values.every(Number.isFinite),'Nonfinite witness camera vector');
 return values.map(Math.fround) as [number,number,number];
}
const vec=(values:readonly number[])=>new Vector3(values[0],values[1],values[2]);

/** Browser-safe CPU reference of the already-installed, identity-transform terrain.
 * Borrows geometry and buffers without changing/disposal; owns only a tiny material.
 * At most 12 receiver + 12 caster + 12 physical rays, with no adaptive replacement.
 * The 40s wall budget is checked BETWEEN synchronous rays, not a hard preemption.
 */
export function auditTerrainShadowWitness(
 geometry:BufferGeometry,inputFrame:TerrainCameraFrame,sun:TerrainShadowVector,
 width:number,height:number,points:readonly TerrainShadowWitnessPoint[],
){
 const started=performance.now();
 requireInput(Number.isSafeInteger(width)&&width>0&&Number.isSafeInteger(height)&&height>0&&
  width*height<=8388608,'Witness output must be positive integer dimensions within the native-export 8388608-pixel cap');
 requireInput(points.length===12,'Witness requires exactly the twelve fixed UVs');
 points.forEach((point,i)=>{
  const expected=TERRAIN_SHADOW_WITNESS_POINTS[i];
  requireInput(point.id===expected.id&&point.uv.length===2&&point.uv[0]===expected.uv[0]&&point.uv[1]===expected.uv[1],
   'Witness UV selection/order differs from the twelve archived positions');
 });
 const position=geometry.getAttribute('position'),index=geometry.getIndex();
 requireInput(position instanceof BufferAttribute&&position.itemSize===3&&position.array instanceof Float32Array&&!position.normalized&&
  Number.isInteger(position.count)&&position.count>0&&position.count<=MAX_VERTICES,
  'Witness needs the installed Float32 XYZ position attribute');
 requireInput(index&&index.itemSize===1&&index.array instanceof Uint32Array&&index.count>0&&index.count%3===0&&
  index.count/3<=MAX_TRIANGLES&&!index.normalized,'Witness needs Uint32 triangles within the 1300000-triangle cap');
 requireInput(geometry.groups.length===0&&geometry.drawRange.start===0&&geometry.drawRange.count>=index.count,
  'Witness supports only the full, ungrouped terrain draw');
 const bounds=geometry.boundingBox,sphere=geometry.boundingSphere;
 requireInput(bounds&&!bounds.isEmpty()&&[...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),
  'Witness needs existing finite geometry.boundingBox');
 // Three Mesh.raycast would compute and assign a missing sphere: reject instead of mutating borrowed geometry.
 requireInput(sphere&&Number.isFinite(sphere.radius)&&sphere.radius>0&&sphere.center.toArray().every(Number.isFinite),
  'Witness needs existing finite geometry.boundingSphere to avoid mutating geometry');
 requireInput([inputFrame.aspect,inputFrame.tanFov,inputFrame.inspection].every(Number.isFinite)&&
  inputFrame.aspect>0&&inputFrame.tanFov>0&&inputFrame.inspection>=0&&inputFrame.inspection<=1,
  'Invalid witness camera projection');
 const frame:TerrainCameraFrame={origin:components(inputFrame.origin),forward:components(inputFrame.forward),
  right:components(inputFrame.right),up:components(inputFrame.up),aspect:Math.fround(inputFrame.aspect),
  tanFov:Math.fround(inputFrame.tanFov),inspection:Math.fround(inputFrame.inspection)};
 const camera=new PerspectiveCamera(32,1,TERRAIN_MESH_DEFAULTS.nearKm,TERRAIN_MESH_DEFAULTS.farKm);
 camera.coordinateSystem=WebGPUCoordinateSystem;configureTerrainCamera(camera,frame,width,height);
 const light=terrainShadowFrame(sun,bounds),texelKm=2*light.radiusKm/light.resolution;
 const material=new MeshBasicNodeMaterial(),mesh=new Mesh(geometry,material),raycaster=new Raycaster();
 mesh.updateMatrixWorld(true);
 const rows:WitnessRow[]=[];
 let raycasts=0,maxManualDirectionError=0,budgetPhase:string|null=null;
 let cpuShadowCount=0,blockerCount=0,unoccludedCount=0,noReceiverCount=0,noCasterCount=0,clipUnsafeCount=0;
 function checkBudget(phase:string){if(performance.now()-started>=WALL_BUDGET_MS)throw new SnapshotBudgetExceeded(phase);}
 function triangle(faceIndex:number){
  requireInput(Number.isInteger(faceIndex)&&faceIndex>=0&&faceIndex*3+2<index!.count,'Invalid witness hit face index');
  const ids=[index!.getX(faceIndex*3),index!.getX(faceIndex*3+1),index!.getX(faceIndex*3+2)];
  const vertices=ids.map(id=>{
   requireInput(Number.isInteger(id)&&id>=0&&id<position.count,'Invalid witness hit vertex index');
   const vertex=[position.getX(id),position.getY(id),position.getZ(id)];
   requireInput(vertex.every(Number.isFinite),'Nonfinite witness hit vertex');return vertex;
  });
  return {faceIndex,indices:ids,vertices};
 }
 function hitRecord(hit:TerrainHit){
  requireInput(hit.faceIndex!==undefined&&hit.faceIndex!==null&&hit.face,'Witness hit lacks a triangle');
  const normal=hit.normal;
  requireInput(!normal||normal.toArray().every(Number.isFinite),'Nonfinite interpolated witness normal');
  return {...triangle(hit.faceIndex),point:hit.point.toArray(),distanceKm:hit.distance,geometricNormal:hit.face.normal.toArray(),
   interpolatedVertexNormal:normal?.toArray()??null,interpolatedVertexNormalDotSun:normal?.dot(light.sun)??null,
   interpolatedVertexNormalLength:normal?.length()??null};
 }
 function cast(phase:string,origin:Vector3,direction:Vector3,side:typeof FrontSide|typeof DoubleSide,near:number,far:number){
  checkBudget(phase);requireInput(raycasts<MAX_RAYS,'Witness ray limit exceeded');
  material.side=side;raycaster.set(origin,direction);raycaster.near=near;raycaster.far=far;
  const before=performance.now();raycasts++;
  const hits=raycaster.intersectObject(mesh,false);
  return {hits,elapsedMs:performance.now()-before};
 }
 try{
  for(const [pointIndex,point] of points.entries()){
   const row:WitnessRow={id:point.id,uv:[...point.uv],pixelCentre:[point.uv[0]*width,point.uv[1]*height],
    originalPixelCentre:[originalPixels[pointIndex][1],originalPixels[pointIndex][2]],status:'STARTED'};
   rows.push(row);
   const ndc=new Vector2(point.uv[0]*2-1,1-point.uv[1]*2);
   material.side=FrontSide;raycaster.setFromCamera(ndc,camera);
   const receiverRay=raycaster.ray.clone();
   const manual=vec(components(frame.forward)).addScaledVector(vec(components(frame.right)),ndc.x*frame.aspect*frame.tanFov)
    .addScaledVector(vec(components(frame.up)),(ndc.y-.16*(1-frame.inspection))*frame.tanFov).normalize();
   const manualDirectionError=manual.distanceTo(receiverRay.direction);
   maxManualDirectionError=Math.max(maxManualDirectionError,manualDirectionError);
   requireInput(manualDirectionError<1e-10,'Witness camera off-axis direction mismatch');
   row.cameraRay={ndc:ndc.toArray(),origin:receiverRay.origin.toArray(),direction:receiverRay.direction.toArray(),manualDirectionError};
   const receiverRun=cast(`${point.id}:receiver`,receiverRay.origin,receiverRay.direction,FrontSide,camera.near,camera.far);
   const receiver=receiverRun.hits[0];
   if(!receiver){noReceiverCount++;row.status='NO_RECEIVER';continue;}
   const receiverRecord=hitRecord(receiver),nr=receiver.face!.normal;
   const clipDepthKm=-receiver.point.clone().applyMatrix4(camera.matrixWorldInverse).z;
   const safelyInsidePlanarClip=clipDepthKm>camera.near+.0001&&clipDepthKm<camera.far-1;
   requireInput(nr.dot(receiverRay.direction)<0,'Witness receiver is not FrontSide');
   row.receiver={...receiverRecord,normalDotSun:nr.dot(light.sun),normalDotCameraRay:nr.dot(receiverRay.direction),
    clipDepthKm,safelyInsidePlanarClip,hitCount:receiverRun.hits.length,elapsedMs:receiverRun.elapsedMs};
   if(!safelyInsidePlanarClip){clipUnsafeCount++;row.status='RECEIVER_OUTSIDE_SAFE_PLANAR_CLIP';continue;}
   const lookup=terrainShadowLookupPoint(receiver.point,light),projection=terrainShadowProject(lookup,light);
   const inside=projection.u>=0&&projection.v>=0&&projection.u<1&&projection.v<1;
   let rawVisibility=1,coverageFade=1,finalVisibility=1;
   row.baselineLookup={point:lookup.toArray(),radialOffsetKm:light.radiusKm/light.resolution,
    uv:[projection.u,projection.v],heightKm:projection.heightKm,insideMap:inside};
   if(inside){
    const gridX=projection.u*light.resolution,gridY=projection.v*light.resolution,i=Math.floor(gridX),j=Math.floor(gridY);
    const uvCentre:[number,number]=[(i+.5)/light.resolution,(j+.5)/light.resolution];
    Object.assign(row.baselineLookup,{gridCoordinate:[gridX,gridY],pixel:[i,j],texelCentreUV:uvCentre,
     distanceToNearestPixelBoundaryTexels:Math.min(gridX-i,1-(gridX-i),gridY-j,1-(gridY-j)),
     distanceToCoverageEdgeUV:Math.min(projection.u,1-projection.u,projection.v,1-projection.v)});
    const casterOrigin=light.center.clone().addScaledVector(light.right,(uvCentre[0]-.5)*2*light.radiusKm)
     .addScaledVector(light.up,(.5-uvCentre[1])*2*light.radiusKm).addScaledVector(light.sun,light.distanceKm);
    const casterDirection=light.sun.clone().negate();
    const casterRun=cast(`${point.id}:caster`,casterOrigin,casterDirection,FrontSide,light.nearKm,light.farKm);
    const caster=casterRun.hits[0];
    let storedMinimumKm:number=TERRAIN_SHADOW_DEFAULTS.clearHeightKm;
    if(caster){
     const record=hitRecord(caster),nc=caster.face!.normal,normalSun=nc.dot(light.sun);
     requireInput(normalSun>0,'Witness caster is not FrontSide toward Sun');
     const qCentreKm=caster.point.clone().sub(light.center).dot(light.sun);
     const dqX=-nc.dot(light.right)/normalSun*texelKm,dqY=nc.dot(light.up)/normalSun*texelKm;
     storedMinimumKm=terrainShadowCasterMinimum(qCentreKm,dqX,dqY);
     requireInput([qCentreKm,dqX,dqY,storedMinimumKm].every(Number.isFinite),'Nonfinite witness affine caster result');
     row.caster={...record,origin:casterOrigin.toArray(),direction:casterDirection.toArray(),normalDotSun:normalSun,qCentreKm,
      affineDqPerPixelKm:[dqX,dqY],storedMinimumKm,lookupMinusStoredKm:projection.heightKm-storedMinimumKm,
      cornersUVQ:record.vertices.map(vertex=>{const q=terrainShadowProject(vertex,light);return [q.u,q.v,q.heightKm];}),
      sameFaceAsReceiver:caster.faceIndex===receiver.faceIndex,sharedIndices:record.indices.filter(id=>receiverRecord.indices.includes(id)),
      hitCount:casterRun.hits.length,elapsedMs:casterRun.elapsedMs,
      selection:'first FrontSide hit / maximum RAW q at texel centre, then whole-footprint affine minimum of that plane; no clipping'};
    }else{
     noCasterCount++;row.caster={status:'NO_CASTER_AT_CENTRE',storedMinimumKm,elapsedMs:casterRun.elapsedMs};
    }
    rawVisibility=terrainShadowCompare(projection.heightKm,storedMinimumKm,0);
    const edge=Math.max(Math.abs(projection.u*2-1),Math.abs(projection.v*2-1));
    const t=Math.max(0,Math.min(1,(edge-TERRAIN_SHADOW_DEFAULTS.fadeStart)/(1-TERRAIN_SHADOW_DEFAULTS.fadeStart)));
    coverageFade=t*t*(3-2*t);finalVisibility=rawVisibility+(1-rawVisibility)*coverageFade;
   }else row.caster={status:'NOT_CAST_OUTSIDE_MAP'};
   const cpuShadow=finalVisibility<1;if(cpuShadow)cpuShadowCount++;
   row.shadow={rawVisibility,coverageFade,finalVisibility,cpuShadow};
   const physicalStart=receiver.point.clone().addScaledVector(light.sun,PHYSICAL_OFFSET_KM);
   const physicalRun=cast(`${point.id}:physical`,physicalStart,light.sun,DoubleSide,0,PHYSICAL_FAR_KM);
   const ignored:Array<{reason:string;faceIndex:number|null|undefined;distanceKm:number}>=[],accepted:TerrainHit[]=[];
   let ignoredCount=0;
   for(const hit of physicalRun.hits){
    requireInput(hit.face,'Physical witness hit lacks face');
    const shared=[hit.face.a,hit.face.b,hit.face.c].some(id=>receiverRecord.indices.includes(id));
    const reason=hit.faceIndex===receiver.faceIndex?'own-face':shared&&hit.point.distanceTo(receiver.point)<=PHYSICAL_OFFSET_KM?'shared-vertex-near-receiver-1e-5km':null;
    if(reason){ignoredCount++;if(ignored.length<MAX_RETAINED_HITS)ignored.push({reason,faceIndex:hit.faceIndex,distanceKm:hit.distance});}
    else accepted.push(hit);
   }
   const blocker=accepted[0]??null;
   const farPastEntireMeshMaximumY=light.sun.y>0&&physicalStart.y+PHYSICAL_FAR_KM*light.sun.y>bounds.max.y;
   const physicallyUnoccluded=blocker===null&&farPastEntireMeshMaximumY;
   if(blocker)blockerCount++;if(physicallyUnoccluded)unoccludedCount++;
   row.physicalSunRay={origin:physicalStart.toArray(),direction:light.sun.toArray(),startOffsetKm:PHYSICAL_OFFSET_KM,
    farKm:PHYSICAL_FAR_KM,side:'DoubleSide',rawHitCount:physicalRun.hits.length,ignoredNearOrOwn:ignored,ignoredCount,
    blocker:blocker?hitRecord(blocker):null,blockerCount:accepted.length,
    otherFirstHits:accepted.slice(1,MAX_RETAINED_HITS).map(hitRecord),farPastEntireMeshMaximumY,physicallyUnoccluded,
    classification:blocker?'BLOCKED':physicallyUnoccluded?'UNOCCLUDED_ENTIRE_MESH':'NO_BLOCKER_WITHIN_20KM_ONLY',elapsedMs:physicalRun.elapsedMs};
   row.interpretation=cpuShadow?(blocker?'CPU_SHADOW_AND_PHYSICAL_BLOCKER':physicallyUnoccluded?
    'CPU_SHADOW_PHYSICALLY_UNOCCLUDED_REFERENCE_ONLY':'CPU_SHADOW_NO_BLOCKER_WITHIN_20KM_ONLY'):
    blocker?'CPU_LIT_PHYSICAL_BLOCKER_REFERENCE_MISMATCH':'CPU_LIT_NO_PHYSICAL_BLOCKER';
   row.status='COMPLETE';
  }
 }catch(error){
  if(!(error instanceof SnapshotBudgetExceeded))throw error;
  budgetPhase=error.phase;const row=rows[rows.length-1];if(row)row.status='BUDGET_EXCEEDED_PARTIAL';
 }finally{material.dispose();}
 const elapsedMs=performance.now()-started;
 if(elapsedMs>=WALL_BUDGET_MS&&budgetPhase===null)budgetPhase='after-last-completed-ray';
 const report={
  schema:'cloudia-terrain-shadow-witness-v1',status:budgetPhase?'BUDGET_EXCEEDED_PARTIAL':'COMPLETE_CPU_REFERENCE_ONLY',
  scope:'Twelve archived UVs on the already-installed identity-transform indexed Float32 geometry; CPU Three rays/affine baseline reference only. No mesh/DEM build, asset reads, buffer copies/hashes or GPU readback.',
  geometry:{vertices:position.count,indices:index.count,triangles:index.count/3,
   bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},ownership:'Borrowed geometry/attributes/index/bounds untouched. Only proxy material disposed; no source geometry disposal.'},
  frame:{camera:{...frame,width,height,nearKm:camera.near,farKm:camera.far,coordinateSystem:camera.coordinateSystem,
   view:camera.view,projectionMatrix:camera.projectionMatrix.toArray()},
   light:{center:light.center.toArray(),sun:light.sun.toArray(),right:light.right.toArray(),up:light.up.toArray(),
    distanceKm:light.distanceKm,nearKm:light.nearKm,farKm:light.farKm,radiusKm:light.radiusKm,resolution:light.resolution,constants:TERRAIN_SHADOW_DEFAULTS}},
  selection:{originalOutput:[2474,1844],coordinates:'Normalized top-origin UV from the twelve archived pixel centres; no replacement. Historical IDs do not classify current pixels.',requested:points.length},
  counts:{visited:rows.length,complete:rows.filter(row=>row.status==='COMPLETE').length,noReceiver:noReceiverCount,
   unsafeCameraClip:clipUnsafeCount,noCasterAtCentre:noCasterCount,cpuShadow:cpuShadowCount,physicalBlocker:blockerCount,physicallyUnoccluded:unoccludedCount},
  raycasts,maxManualDirectionError,timings:{browserElapsedMs:elapsedMs,wallBudgetMs:WALL_BUDGET_MS,budgetPhase,
   withinObservedWallBudget:elapsedMs<WALL_BUDGET_MS,scope:'performance.now elapsed time, NOT CPU usage or RSS. Cooperative check before each ray; one synchronous Raycaster call cannot be preempted.'},
  limits:{maximumPoints:12,maximumRays:MAX_RAYS,physicalMaximumKm:PHYSICAL_FAR_KM,physicalStartOffsetKm:PHYSICAL_OFFSET_KM,
   maximumVertices:MAX_VERTICES,maximumTriangles:MAX_TRIANGLES,
   maximumRetainedExtraHits:MAX_RETAINED_HITS,maximumJSONBytes:MAX_JSON_BYTES},
  limitations:[
   'No GPU raster/filter/depth-f32 parity or readback; reversed-Z affects depth representation, while this CPU camera establishes the geometric ray.',
   'CPU fround camera basis/scalars plus Float64 Three ray/plane algebra are not GPU operation-order emulation.',
   'FrontSide centre winner followed by affine minimum may differ from raster coverage/depth ties; no winner clipping, conservative coverage or new bias is tested.',
   'Geometric face normal is NOT the interpolated/rough shading normal. NdotSun alone does not predict RGB; ambient/water/sea may not use direct shadow.',
   'Optional hit.normal is Three CPU barycentric vertex interpolation, ray-oriented by Three and not necessarily unit length; its raw dotSun is not the final normalWorld+rough shading normal.',
   'No old RGB or old face IDs are reused; current IDs/corners refer only to the supplied installed geometry.',
   'No blocker beyond20km is excluded unless the positive-Y Sun endpoint is above the entire mesh maximum Y.',
   'Unchanged PNG RGB alone does not prove visibility=1. This selected sample is not global acne frequency, physical sunlight truth, FPS or artistic acceptance.',
  ],rows,
 };
 requireInput(JSON.stringify(report).length<MAX_JSON_BYTES,'Witness compact report exceeded128KiB');
 return report;
}
