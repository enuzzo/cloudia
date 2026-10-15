#!/usr/bin/env python3
"""Create an external, reviewable proposal. Does not edit the project."""
from pathlib import Path
import argparse,difflib,hashlib,json,subprocess
ap=argparse.ArgumentParser()
ap.add_argument('--project',type=Path,required=True)
ap.add_argument('--guard-km',type=float,default=3/255+2**-15)
a=ap.parse_args()
assert a.guard_km==3/255+2**-15, "Use the independently reviewed one-code + ALU candidate budget"
out=Path(__file__).resolve().parent
base='a1efb8e489d31c417ebb2dd6b06cbc2e8dfaca1c'
paths=['src/cumulonimbus/precipitation.ts','src/cumulonimbus/cloudShader.ts','src/cumulonimbus/GPUSceneEngine.ts']
original={}
for path in paths:
 blob=subprocess.check_output(['git','show',f'{base}:{path}'],cwd=a.project)
 assert (a.project/path).read_bytes()==blob, f'Working source differs from explicit checkpoint: {path}'
 original[path]=blob.decode()
modified=dict(original)

def change(path,old,new):
 assert modified[path].count(old)==1, (path,'expected exactly one match',old)
 modified[path]=modified[path].replace(old,new,1)

p=paths[0]
change(p,'export const RAIN_EXTINCTION=.85;','export const RAIN_EXTINCTION=.85;\n// One G code of possible filter overshoot plus 30.5 mm ALU budget.\n// Requires the declared sampler bound; CPU checks alone do not qualify it.\nexport const RAIN_BASE_UPPER_GUARD_KM=3/255+2**-15;')
helper='''/** Highest decoded base that can contribute to a positive bilinear R sample.
 * R and G filter independently: include every G texel in a one-texel halo of
 * encoded R>0, including transparent high-G neighbours and clamped map edges.
 * Read the actual RG8 bytes; a rounded-to-zero source emits no rain.
 */
export function precipitationMaxBaseReference(map:Uint8Array,size=RAIN_MAP_SIZE):number|null{
 let maxG=-1;
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  if(!(map[(z*size+x)*2]>0))continue;
  for(let zz=Math.max(0,z-1);zz<=Math.min(size-1,z+1);zz++)for(let xx=Math.max(0,x-1);xx<=Math.min(size-1,x+1);xx++){
   maxG=Math.max(maxG,map[(zz*size+xx)*2+1]);
  }
 }
 return maxG<0?null:maxG/255*3-.5;
}
'''
change(p,'const SOURCE_TOP=2.5;',helper+'const SOURCE_TOP=2.5;')
p=paths[1]
change(p,'RAIN_WIND_DISPLACEMENT_BOUND,RAIN_EXTINCTION}', 'RAIN_WIND_DISPLACEMENT_BOUND,RAIN_EXTINCTION,RAIN_BASE_UPPER_GUARD_KM}')
change(p,'ground:f32, rainBounds:vec4<f32>, rainMap:', 'ground:f32, rainBounds:vec4<f32>, maxBaseRef:f32, rainMap:')
change(p,'  let rainUpper=vec3<f32>(rainMaxXZ.x,2.8,rainMaxXZ.y)+drift;', '''  let rainUpper=vec3<f32>(rainMaxXZ.x,2.8,rainMaxXZ.y)+drift;
  // Optical-only bound; keep the fixed box and all ray/sample boundaries intact.
  let rainCeiling=.72+(maxBaseRef-.72)/growth.x+.3+${RAIN_BASE_UPPER_GUARD_KM};''')
change(p,'    if(rainRegion){\n      // Estimate the emitting height,', '''    // The attachment is zero above the bounded final positive-R base.
    if(rainRegion&&rp.y<=rainCeiling){
      // Estimate the emitting height,''')
p=paths[2]
change(p,'RGFormat, RepeatWrapping,', 'RGFormat, RepeatWrapping, ClampToEdgeWrapping,')
change(p,'    this.rainTexture.minFilter=LinearFilter;', '    this.rainTexture.wrapS=ClampToEdgeWrapping;this.rainTexture.wrapT=ClampToEdgeWrapping;\n    this.rainTexture.minFilter=LinearFilter;')
change(p,'precipitationFootprint,precipitationSourceBounds,RAIN_MAP_SIZE,RAIN_SAMPLE_STEP,RAIN_EXTINCTION}', 'precipitationFootprint,precipitationSourceBounds,precipitationMaxBaseReference,RAIN_MAP_SIZE,RAIN_SAMPLE_STEP,RAIN_EXTINCTION,RAIN_BASE_UPPER_GUARD_KM}')
change(p,'  private readonly rainBounds = uniform(new Vector4(0,0,0,0));','  private readonly rainBounds = uniform(new Vector4(0,0,0,0));\n  private readonly maxBaseRef=uniform(-.5);')
change(p,'    this.rainTexture.image.data=rainMap;','    this.rainTexture.image.data=rainMap;\n    this.maxBaseRef.value=precipitationMaxBaseReference(rainMap)??-.5;')
change(p,'ground:this.ground,rainBounds:this.rainBounds,rainMap:', 'ground:this.ground,rainBounds:this.rainBounds,maxBaseRef:this.maxBaseRef,rainMap:')
change(p,'precipitationSourceBounds:this.rainBounds.value.toArray(),','precipitationSourceBounds:this.rainBounds.value.toArray(),precipitationMaxBaseReferenceKm:this.maxBaseRef.value,precipitationUpperGuardKm:RAIN_BASE_UPPER_GUARD_KM,')
change(p,"rendererVersion:'observatory-v40-terrain-camera-focus'", "rendererVersion:'observatory-v42-rain-upper-bound-external'")

patch=''
artifacts=[]
for path in paths:
 for stage,text in [('before',original[path]),('after',modified[path])]:
  f=out/stage/path;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(text)
  data=f.read_bytes();artifacts.append({'file':str(f.relative_to(out)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
 patch+=''.join(difflib.unified_diff(original[path].splitlines(True),modified[path].splitlines(True),fromfile='a/'+path,tofile='b/'+path))
ref_path='src/cumulonimbus/medium.ts'
ref_data=subprocess.check_output(['git','show',f'{base}:{ref_path}'],cwd=a.project)
assert (a.project/ref_path).read_bytes()==ref_data
ref=out/'reference'/ref_path;ref.parent.mkdir(parents=True,exist_ok=True);ref.write_bytes(ref_data)
artifacts.append({'file':str(ref.relative_to(out)),'bytes':len(ref_data),'sha256':hashlib.sha256(ref_data).hexdigest()})
test_name='src/cumulonimbus/precipitationUpper.test.ts'
test_data=(out/'precipitationUpper.test.ts').read_bytes()
test_out=out/'after'/test_name;test_out.parent.mkdir(parents=True,exist_ok=True);test_out.write_bytes(test_data)
artifacts.append({'file':str(test_out.relative_to(out)),'bytes':len(test_data),'sha256':hashlib.sha256(test_data).hexdigest()})
test_patch=''.join(difflib.unified_diff([],test_data.decode().splitlines(True),fromfile='/dev/null',tofile='b/'+test_name))
(out/'precipitationUpper.test.patch').write_text(test_patch)
artifacts.append({'file':'precipitationUpper.test.patch','bytes':len(test_patch.encode()),'sha256':hashlib.sha256(test_patch.encode()).hexdigest()})
for extra_name in ['repro.mjs','repro-result.json']:
 extra=out/extra_name
 if extra.is_file():
  extra_data=extra.read_bytes();artifacts.append({'file':extra_name,'bytes':len(extra_data),'sha256':hashlib.sha256(extra_data).hexdigest()})
(out/'rain-upper-bound.patch').write_text(patch)
data=patch.encode();artifacts.append({'file':'rain-upper-bound.patch','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
manifest={'status':'EXTERNAL PROPOSAL ONLY: NOT APPLIED OR GPU-QUALIFIED','baseCommit':base,'project':str(a.project),'guardKm':a.guard_km,'rendererLabel':'observatory-v42-rain-upper-bound-external','proposedVitest':'after/src/cumulonimbus/precipitationUpper.test.ts; separate optional test patch, not run here','helper':'precipitationMaxBaseReference(map,size=64):number|null','uniform':'maxBaseRef decoded CPU f64, uploaded as f32; update at each installVolume, reset to -.5 for no positive R','contracts':['rainUpper remains 2.8; rainNear/rainFar/rainRegion and union bounds unchanged','t/ds/jitter/cloud-reference/density/light expressions unchanged','guard modifies only entry to existing rain optical block','same RG8 map and linear no-mipmap sampler; ClampToEdgeWrapping defaults now explicit; no extra resources or temporal cache'],'precisionStatus':'Conditional on filter overshoot <= one UNORM8 G code; 3/255 km filter allowance + 2**-15 km ALU. WGSL textureSampleLevel has no universal stated ULP bound; real sampler qualification pending','artifacts':artifacts,'generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'out':str(out),'base':base,'guardKm':a.guard_km,'patchBytes':len(data)}))
