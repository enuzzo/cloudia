import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BufferAttribute,BufferGeometry,DoubleSide,FrontSide,Mesh,MeshBasicNodeMaterial,PerspectiveCamera,Raycaster,Vector2,Vector3,WebGPUCoordinateSystem} from 'three/webgpu';
import {buildTerrainMeshData,configureTerrainCamera,TERRAIN_MESH_DEFAULTS} from '../source/src/cumulonimbus/terrainMesh';
import {decodeTerrainDem,createDemTerrainSampler} from '../source/src/cumulonimbus/terrainDem';
import {terrainSurfaceSample} from '../source/src/cumulonimbus/terrainSurface';
import {terrainShadowFrame,terrainShadowLookupPoint,terrainShadowProject,terrainShadowCompare,TERRAIN_SHADOW_DEFAULTS} from '../source/src/cumulonimbus/TerrainShadow';

const started=performance.now();
const protocol=JSON.parse(readFileSync(new URL('../PROTOCOL.json',import.meta.url),'utf8'));
const native=JSON.parse(readFileSync(new URL('../baseline-native.json',import.meta.url),'utf8'));
const m=native.metadata,W=native.png.width,H=native.png.height;
assert.equal(W,2474);assert.equal(H,1844);
const points=JSON.parse(readFileSync(new URL('./selected-pixels.json',import.meta.url),'utf8'));
assert.equal(points.length,12);assert.deepEqual(points.map((p:any)=>({id:p.id,pixelCentre:p.pixelCentre,selectionIsArtifact:p.selectionIsArtifact})),protocol.pixelsSelectedBeforeRun);
assert.equal(m.quality,'ultra');assert.equal(m.nominalSteps,384);
const raw=readFileSync(new URL('../source/src/cumulonimbus/assets/liguria-apuane-dem.bin',import.meta.url));
const assetSHA256=createHash('sha256').update(raw).digest('hex');
const dem=decodeTerrainDem(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const meshStart=performance.now();
const data=buildTerrainMeshData(createDemTerrainSampler(dem,terrainSurfaceSample),{cellsPerSide:256,levels:9,normalMode:'geometry'});
assert.equal(data.stats.vertices,465409);assert.equal(data.stats.triangles,929792);
const meshMs=performance.now()-meshStart;
const geometry=new BufferGeometry();
geometry.setAttribute('position',new BufferAttribute(data.positions,3));
geometry.setIndex(new BufferAttribute(data.indices,1));
geometry.computeBoundingBox();geometry.computeBoundingSphere();
assert(geometry.boundingBox);
const material=new MeshBasicNodeMaterial();assert.equal(material.side,FrontSide);
const mesh=new Mesh(geometry,material);mesh.updateMatrixWorld(true);
const cam=m.camera;
const frame={origin:cam.origin.map(Math.fround),forward:cam.forward.map(Math.fround),right:cam.right.map(Math.fround),up:cam.up.map(Math.fround),aspect:Math.fround(cam.aspect),tanFov:Math.fround(cam.tanHalfVerticalFov),inspection:Math.fround(cam.approach)};
const camera=new PerspectiveCamera(32,1,TERRAIN_MESH_DEFAULTS.nearKm,TERRAIN_MESH_DEFAULTS.farKm);
camera.coordinateSystem=WebGPUCoordinateSystem;
configureTerrainCamera(camera,frame,W,H);
const light=terrainShadowFrame(m.lighting.sunDirection,geometry.boundingBox!);
assert.equal(light.resolution,2048);assert.equal(light.radiusKm,64);
const raycaster=new Raycaster(),rows:any[]=[];
const maximumRowsToKeep=3;
let raycasts=0,maxManualDirectionError=0;
function vec(a:number[]){return new Vector3(a[0],a[1],a[2]);}
function triangle(faceIndex:number){
 const base=faceIndex*3,ids=[data.indices[base],data.indices[base+1],data.indices[base+2]];
 return {faceIndex,indices:ids,vertices:ids.map(i=>Array.from(data.positions.subarray(i*3,i*3+3)))};
}
function hitRecord(hit:any){
 assert(Number.isInteger(hit.faceIndex)&&hit.face);
 return {...triangle(hit.faceIndex),point:hit.point.toArray(),distanceKm:hit.distance,geometricNormal:hit.face.normal.toArray()};
}
function cast(origin:Vector3,direction:Vector3,side:number,near:number,far:number){
 material.side=side;raycaster.set(origin,direction);raycaster.near=near;raycaster.far=far;
 const t=performance.now();raycasts++;
 const hits=raycaster.intersectObject(mesh,false);
 return {hits,elapsedMs:performance.now()-t};
}
for(const point of points){
 const [px,py]=point.pixelCentre;
 const ndc=new Vector2(px/W*2-1,1-py/H*2);
 raycaster.near=TERRAIN_MESH_DEFAULTS.nearKm;raycaster.far=TERRAIN_MESH_DEFAULTS.farKm;
 material.side=FrontSide;raycaster.setFromCamera(ndc,camera);
 const receiverRay=raycaster.ray.clone();
 const manual=vec(frame.forward).addScaledVector(vec(frame.right),ndc.x*frame.aspect*frame.tanFov).addScaledVector(vec(frame.up),(ndc.y-.16*(1-frame.inspection))*frame.tanFov).normalize();
 const manualDirectionError=manual.distanceTo(receiverRay.direction);maxManualDirectionError=Math.max(maxManualDirectionError,manualDirectionError);
 assert(manualDirectionError<1e-10,'configureTerrainCamera off-axis direction mismatch');
 const receiverStart=performance.now();raycasts++;
 const receivers=raycaster.intersectObject(mesh,false),receiverMs=performance.now()-receiverStart;
 if(receivers.length===0){rows.push({id:point.id,pixelCentre:[px,py],status:'NO_RECEIVER',png:{baselineRGB:point.baselineRGB,unshadowedRGB:point.unshadowedRGB,selectionIsArtifact:point.selectionIsArtifact},cameraRay:{ndc:ndc.toArray(),origin:receiverRay.origin.toArray(),direction:receiverRay.direction.toArray(),manualDirectionError},interpretation:'No terrain-mesh receiver; retained without replacing this selected pixel.'});continue;}
 const receiver=receivers[0],nr=receiver.face!.normal;
 const receiverClipDepthKm=-receiver.point.clone().applyMatrix4(camera.matrixWorldInverse).z;
 const receiverClipInterior=receiverClipDepthKm>camera.near+.0001&&receiverClipDepthKm<camera.far-1;
 assert(receiverClipInterior,'receiver is not safely inside planar camera clipping');
 assert(nr.dot(receiverRay.direction)<0,'receiver must be FrontSide');
 const lookup=terrainShadowLookupPoint(receiver.point,light),projection=terrainShadowProject(lookup,light);
 assert(projection.u>=0&&projection.v>=0&&projection.u<1&&projection.v<1,'selected shadow lookup outside map');
 const gridX=projection.u*2048,gridY=projection.v*2048,i=Math.floor(gridX),j=Math.floor(gridY);
 const uvCentre=[(i+.5)/2048,(j+.5)/2048];
 const xLight=(uvCentre[0]-.5)*128,yLight=(.5-uvCentre[1])*128;
 const casterOrigin=light.center.clone().addScaledVector(light.right,xLight).addScaledVector(light.up,yLight).addScaledVector(light.sun,light.distanceKm);
 const casterRayDirection=light.sun.clone().negate();
 const casterRun=cast(casterOrigin,casterRayDirection,FrontSide,light.nearKm,light.farKm);
 assert(casterRun.hits.length>0,`${point.id}: no raster caster`);
 const caster=casterRun.hits[0],nc=caster.face!.normal,normalSun=nc.dot(light.sun);
 assert(normalSun>0,'caster must be FrontSide toward Sun');
 const qCentre=caster.point.clone().sub(light.center).dot(light.sun);
 const dqX=-nc.dot(light.right)/normalSun*.0625,dqY=nc.dot(light.up)/normalSun*.0625;
 const casterPlaneMinimum=qCentre-.5*(Math.abs(dqX)+Math.abs(dqY))-.001;
 assert([qCentre,dqX,dqY,casterPlaneMinimum].every(Number.isFinite),'nonfinite affine caster result');
 const rawVisibility=terrainShadowCompare(projection.heightKm,casterPlaneMinimum,0);
 const edge=Math.max(Math.abs(projection.u*2-1),Math.abs(projection.v*2-1));
 const t=Math.max(0,Math.min(1,(edge-.85)/.15)),fade=t*t*(3-2*t);
 const finalVisibility=rawVisibility+(1-rawVisibility)*fade;
 const casterSharedIndices=[caster.face!.a,caster.face!.b,caster.face!.c].filter(v=>[receiver.face!.a,receiver.face!.b,receiver.face!.c].includes(v));
 const physicalStart=receiver.point.clone().addScaledVector(light.sun,.00001);
 const physicalRun=cast(physicalStart,light.sun,DoubleSide,0,20);
 const ignored:any[]=[],accepted:any[]=[];
 for(const hit of physicalRun.hits){
  const shared=[hit.face!.a,hit.face!.b,hit.face!.c].some(v=>[receiver.face!.a,receiver.face!.b,receiver.face!.c].includes(v));
  const nearReceiver=hit.point.distanceTo(receiver.point)<=1e-5;
  if(hit.faceIndex===receiver.faceIndex){ignored.push({reason:'own-face',faceIndex:hit.faceIndex,distanceKm:hit.distance});continue;}
  if(shared&&nearReceiver){ignored.push({reason:'shared-vertex-near-receiver-1e-5km',faceIndex:hit.faceIndex,distanceKm:hit.distance});continue;}
  accepted.push(hit);
 }
 const blocker=accepted[0]??null;
 const physicalFarPastMeshMaximum=light.sun.y>0&&physicalStart.y+20*light.sun.y>geometry.boundingBox!.max.y;
 const isArtifact=point.selectionIsArtifact,hasOffDifference=point.unshadowedRGB.some((v:number,k:number)=>v!==point.baselineRGB[k]);
 const cpuShadow=finalVisibility<1;
 const strictArtifactMismatch=isArtifact&&hasOffDifference&&!cpuShadow;
 const physicallyUnoccluded=blocker===null&&physicalFarPastMeshMaximum;
 const physicalClassification=blocker?'BLOCKED':physicallyUnoccluded?'UNOCCLUDED_ENTIRE_MESH':'NO_BLOCKER_WITHIN_20KM_ONLY';
 rows.push({id:point.id,pixelCentre:[px,py],png:{baselineRGB:point.baselineRGB,unshadowedRGB:point.unshadowedRGB,offDifference:hasOffDifference,selectionIsArtifact:isArtifact},
  cameraRay:{ndc:ndc.toArray(),origin:receiverRay.origin.toArray(),direction:receiverRay.direction.toArray(),manualDirectionError},
  receiver:{...hitRecord(receiver),normalDotSun:nr.dot(light.sun),normalDotCameraRay:nr.dot(receiverRay.direction),clipDepthKm:receiverClipDepthKm,safelyInsidePlanarClip:receiverClipInterior,hitCount:receivers.length,elapsedMs:receiverMs},
  baselineLookup:{point:lookup.toArray(),radialOffsetKm:.03125,uv:[projection.u,projection.v],gridCoordinate:[gridX,gridY],pixel:[i,j],texelCentreUV:uvCentre,
   distanceToNearestPixelBoundaryTexels:Math.min(gridX-i,1-(gridX-i),gridY-j,1-(gridY-j)),distanceToCoverageEdgeUV:Math.min(projection.u,1-projection.u,projection.v,1-projection.v),heightKm:projection.heightKm},
  caster:{...hitRecord(caster),origin:casterOrigin.toArray(),direction:casterRayDirection.toArray(),normalDotSun:normalSun,qCentreKm:qCentre,
   affineDqPerPixelKm:[dqX,dqY],storedMinimumKm:casterPlaneMinimum,lookupMinusStoredKm:projection.heightKm-casterPlaneMinimum,
   sameFaceAsReceiver:caster.faceIndex===receiver.faceIndex,sharedIndices:casterSharedIndices,hitCount:casterRun.hits.length,elapsedMs:casterRun.elapsedMs,
   selection:'first FrontSide hit / maximum RAW solar height at texel centre, then minimum of that winning plane (not max plane minimum)'},
  shadow:{rawVisibility,coverageFade:fade,finalVisibility,cpuShadow,pngArtifactRequiresShadow:isArtifact&&hasOffDifference,strictArtifactMismatch,
   controlCaveat:'Unchanged control RGB alone does not prove visibility=1; diffuse/rounding may hide a shadow.'},
  physicalSunRay:{origin:physicalStart.toArray(),direction:light.sun.toArray(),startOffsetKm:.00001,farKm:20,side:'DoubleSide',
   rawHitCount:physicalRun.hits.length,ignoredNearOrOwn:ignored.slice(0,maximumRowsToKeep),ignoredCount:ignored.length,
   blocker:blocker?hitRecord(blocker):null,blockerCount:accepted.length,otherFirstHits:accepted.slice(1,maximumRowsToKeep).map(hitRecord),
   farPastEntireMeshMaximumY:physicalFarPastMeshMaximum,physicallyUnoccluded,classification:physicalClassification,elapsedMs:physicalRun.elapsedMs,
   scope:'Occlusion of this actual mesh from receiver+1cm toward Sun; no other objects, no GPU raster/float32 parity claim'},
  interpretation:strictArtifactMismatch?'CPU/PNG ARTIFACT MISMATCH: no fix inferred':cpuShadow&&!blocker?'CPU SHADOW WITHOUT PHYSICAL BLOCKER IN THIS MESH; diagnostic candidate, not GPU proof':cpuShadow&&blocker?'CPU shadow and physical blocker both present':!cpuShadow&&blocker?'CPU lit but physical blocker present; diagnostic mismatch':'CPU lit and no physical blocker'});
}
const report={status:rows.some(r=>r.shadow?.strictArtifactMismatch)?'CPU_PNG_MISMATCH_NO_FIX_INFERRED':'CPU_TWELVE_REFERENCE_COMPLETE_NO_GPU_PROOF',
 scope:'Twelve preselected native pixels, no adaptive replacement; actual frozen Float32 mesh, CPU Three rays and affine caster reference, not GPU bit/raster parity or unbiased frequency/art assessment',
 sourceManifestSHA256:protocol.sourceManifestSHA256,assetSHA256,meshStats:data.stats,bounds:{min:geometry.boundingBox!.min.toArray(),max:geometry.boundingBox!.max.toArray()},
 frame:{camera:{...frame,nearKm:camera.near,farKm:camera.far,coordinateSystem:camera.coordinateSystem,view:camera.view,projectionMatrix:camera.projectionMatrix.toArray()},
 light:{center:light.center.toArray(),sun:light.sun.toArray(),right:light.right.toArray(),up:light.up.toArray(),distanceKm:light.distanceKm,nearKm:light.nearKm,farKm:light.farKm,radiusKm:light.radiusKm,resolution:light.resolution,constants:TERRAIN_SHADOW_DEFAULTS}},
 raycasts,maxManualDirectionError,timings:{meshBuildMs:meshMs,totalMs:performance.now()-started},
 counts:{selected:points.length,noReceiver:rows.filter(r=>r.status==='NO_RECEIVER').length,artifactMismatch:rows.filter(r=>r.shadow?.strictArtifactMismatch).length,cpuShadow:rows.filter(r=>r.shadow?.cpuShadow).length,physicalBlocker:rows.filter(r=>r.physicalSunRay?.blocker).length,physicallyUnoccluded:rows.filter(r=>r.physicalSunRay?.physicallyUnoccluded).length,candidateControlsPhysicallyUnoccluded:rows.filter(r=>r.id.startsWith('C')&&r.physicalSunRay?.physicallyUnoccluded).length,falseShadowWholeMesh:rows.filter(r=>r.shadow?.cpuShadow&&r.physicalSunRay?.physicallyUnoccluded).length},rows};
material.dispose();geometry.dispose();
console.log(JSON.stringify(report,null,2));
