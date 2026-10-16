from pathlib import Path
import hashlib,json,difflib,shutil
P=Path(__file__).resolve().parent
BASE=P.parent/'normal-clearance-source'
REL=Path('src/cumulonimbus/TerrainShadow.ts')
def sha(b): return hashlib.sha256(b).hexdigest()
def put(path,data):
 path.parent.mkdir(parents=True,exist_ok=True)
 if isinstance(data,str):path.write_text(data)
 else:path.write_bytes(data)
before=(P/'before/TerrainShadow.ts').read_text() if (P/'before/TerrainShadow.ts').exists() else (BASE/REL).read_text()
assert sha(before.encode())=='0fa68e56eed14e400d7fb18381aac2d3a6823a5a4f28f927fa267e3d9a6d095e', 'baseline source drift'
(P/'PROTOCOL.json').write_text(json.dumps({
 'state':'FROZEN BEFORE STANDALONE CPU ORACLE; NOT IMPLEMENTED IN PRODUCT',
 'baseSource':str(BASE),'baseTerrainShadowSHA256':sha(before.encode()),
 'scope':'one receiver lookup-point change; exact same caster, 1 textureLoad, target, depth, map resolution, mesh, material and transport',
 'formula':'e=radius/resolution; c=clamp(dot(ng,radial),0,1); lookup=point+e*radial+e*(1-c)*ng',
 'ng':'actual fragment geometric normal from dpdx/dpdy(point), oriented toward planet radial; scale each finite derivative before cross; protected normalization and radial fallback for degeneracy',
 'precision':'CPU double helper plus explicitly labelled f32 ALU surrogate; not GPU derivative evaluation or WGSL compile qualification',
 'predeclaredTests':['flat preserves old lookup exactly','planar signed distance from independent plane equation equals e for nondegenerate derivatives','60/80/89 degree slopes and derivative sign/scale invariance','two-face crease tested on each actual face, not extrapolated into neighbor','zero/parallel/tiny derivative radial fallback','finite f32 inputs at extreme derivative magnitudes avoid cross overflow by rescaling','joint UV and solar-height projection from the same biased point','separate 200m blocker remains shadowed','35m real contact can be lost and must be reported as a limitation','multi-face texel false shadow can remain and is not declared solved'],
 'gates':{'finite':True,'doublePlaneDistanceAbsKm':1e-11,'f32PlaneDistanceAbsKm':2e-6,'offsetLengthMaxKm':(.03125*2**.5)+2e-6,'flatExact':True,'extraTextureLoads':0},
 'budget':{'cpuSeconds':5,'wallSeconds':15,'rssBytes':2147483648,'noFullMeshGrid':True,'noGPU':True,'noBuild':True,'noProductTests':True},
 'stopRule':'Native unshadowed attribution identifies the shadow branch, not false-vs-true shadow by itself. CPU properties do not prove acne resolved or art acceptance. Any numerical gate failure is preserved; no tuning/retry.',
 'preexistingNativeEvidence':{'allPixels':4562056,'changedPixels':1778,'allChannelDeltasNonnegative':'reported by root','ROIChanges':{'L1':721,'L2':216,'L3':328}},
 },indent=2)+'\n')
old='''export function terrainShadowLookupPoint(point:TerrainShadowVector,frame:TerrainShadowFrame):Vector3{
 const original=vector(point),planetCenter=frame.center.clone().add(new Vector3(0,-EARTH_RADIUS,0));
 return original.clone().addScaledVector(original.clone().sub(planetCenter).normalize(),frame.radiusKm/frame.resolution);
}'''
new='''export function terrainShadowLookupPoint(point:TerrainShadowVector,frame:TerrainShadowFrame,derivativeX?:TerrainShadowVector,derivativeY?:TerrainShadowVector):Vector3{
 const original=vector(point),planetCenter=frame.center.clone().add(new Vector3(0,-EARTH_RADIUS,0));
 const radial=original.clone().sub(planetCenter).normalize(),e=frame.radiusKm/frame.resolution;
 const lookup=original.clone().addScaledVector(radial,e);
 if(derivativeX===undefined&&derivativeY===undefined)return lookup; // No inferred face normal in legacy CPU callers.
 if(derivativeX===undefined||derivativeY===undefined)throw new RangeError('Both terrain face derivatives are required');
 const dx=vector(derivativeX),dy=vector(derivativeY);
 // Scaling preserves a finite nondegenerate face normal without cross overflow.
 dx.divideScalar(Math.max(Math.abs(dx.x),Math.abs(dx.y),Math.abs(dx.z),1e-20));
 dy.divideScalar(Math.max(Math.abs(dy.x),Math.abs(dy.y),Math.abs(dy.z),1e-20));
 const face=dx.cross(dy),lengthSquared=face.lengthSq();
 if(lengthSquared<=1e-20)return lookup; // Degenerate/near-parallel screen footprint: retain radial policy.
 face.multiplyScalar(1/Math.sqrt(lengthSquared));
 if(face.dot(radial)<0)face.negate();
 const cosine=Math.max(0,Math.min(1,face.dot(radial)));
 return lookup.addScaledVector(face,e*(1-cosine));
}'''
assert before.count(old)==1
out=before.replace(old,new)
out=out.replace('''export function terrainShadowVisibility(point:TerrainShadowVector,frame:TerrainShadowFrame,sample:(x:number,y:number)=>number):number{
 const p=terrainShadowProject(terrainShadowLookupPoint(point,frame),frame);''','''export function terrainShadowVisibility(point:TerrainShadowVector,frame:TerrainShadowFrame,sample:(x:number,y:number)=>number,derivativeX?:TerrainShadowVector,derivativeY?:TerrainShadowVector):number{
 const p=terrainShadowProject(terrainShadowLookupPoint(point,frame,derivativeX,derivativeY),frame);''')
oldw=''' let size=textureDimensions(shadowMap);
 // Half of the actual light texel in km, radially above the visible receiver.
 let radial=normalize(point-center+vec3<f32>(0.0,${EARTH_RADIUS}.0,0.0));
 let lookupPoint=point+radial*(radius/f32(size.x));'''
neww=''' // Derivatives must execute in uniform fragment control flow, before the UV branch below.
 let dx=dpdx(point);let dy=dpdy(point);
 let size=textureDimensions(shadowMap);
 let radial=normalize(point-center+vec3<f32>(0.0,${EARTH_RADIUS}.0,0.0));
 // Rescale before cross so every finite derivative component stays bounded.
 let scaleX=max(max(abs(dx.x),abs(dx.y)),abs(dx.z));
 let scaleY=max(max(abs(dy.x),abs(dy.y)),abs(dy.z));
 let faceCross=cross(dx/max(scaleX,1e-20),dy/max(scaleY,1e-20));
 let lengthSquared=dot(faceCross,faceCross);
 let rawNormal=faceCross*inverseSqrt(max(lengthSquared,1e-20));
 let alignment=dot(rawNormal,radial);
 let oriented=select(-rawNormal,rawNormal,alignment>=0.0);
 let valid=lengthSquared>1e-20;
 let faceNormal=select(radial,oriented,valid);
 let cosine=select(1.0,clamp(abs(alignment),0.0,1.0),valid);
 let e=radius/f32(size.x);
 // Complete the radial offset to half-texel clearance from this face plane.
 // UV and solar height both use this same point; visible geometry is unchanged.
 let lookupPoint=point+radial*e+faceNormal*(e*(1.0-cosine));'''
assert out.count(oldw)==1
out=out.replace(oldw,neww)
out=out.replace('''/** Elevate only the shadow lookup receiver by half a light texel along the
 * planet radial, never the visible mesh. In the default map this is 31.25m.
 * Both UV and solar height must use this elevated point; a global q offset
 * would produce a different and excessive bias when the Sun is near horizontal.
 */''','''/** Trial: keep the radial half-texel offset, optionally completing its
 * clearance from the actual face plane. With derivatives supplied, ng·delta=e
 * in real arithmetic; |delta|<=sqrt(2)*e. This is not a multi-face shadow proof.
 * Both UV and solar height use this same point; visible geometry is unchanged.
 */''')
out=out.replace("receiverPolicy:'Only shadow lookup point elevated along planet radial by half one light texel; geometry/radiance point unchanged; contact shadows below this scale may disappear',","receiverPolicy:'Trial: radial half-texel plus missing geometric face-normal clearance; local offset 31.25–44.20m; geometry/radiance point unchanged; contact shadows may disappear',")
put(P/'before/TerrainShadow.ts',before)
put(P/'after'/REL,out)
for dep in ['landscape.ts','aerial.ts','terrainSurface.ts']:
 put(P/'after/src/cumulonimbus'/dep,(BASE/'src/cumulonimbus'/dep).read_bytes())
put(P/'TerrainShadow.patch',''.join(difflib.unified_diff(before.splitlines(True),out.splitlines(True),fromfile='a/src/cumulonimbus/TerrainShadow.ts',tofile='b/src/cumulonimbus/TerrainShadow.ts')))
put(P/'lookup-point.wgsl',neww+'\n')
print(json.dumps({'beforeSHA256':sha(before.encode()),'afterSHA256':sha(out.encode()),'patchSHA256':sha((P/'TerrainShadow.patch').read_bytes())}))
