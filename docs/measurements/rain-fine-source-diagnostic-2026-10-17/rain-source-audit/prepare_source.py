"""Source-only preparation. Does not import or run TypeScript or generate a volume."""
from pathlib import Path
import hashlib, json, difflib

ROOT = Path(__file__).resolve().parent
REPO = Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
MANIFEST = REPO/'docs/measurements/terrain-optical-material-2026-10-17/source/final-manifest.json'
EXPECTED_MANIFEST_SHA = '2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73'
NAMES = ['volume','light','sun','motion','inclinedShoulder','precipitation','landscape','aerial','terrainSurface']
sha = lambda b: hashlib.sha256(b).hexdigest()
def save(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != raw: raise RuntimeError(f'Refuse overwrite: {path}')
    else: path.write_bytes(raw)
def once(text, old, new):
    if text.count(old) != 1: raise RuntimeError(f'Anchor not unique: {old[:100]}')
    return text.replace(old, new)

raw_manifest=MANIFEST.read_bytes()
assert sha(raw_manifest)==EXPECTED_MANIFEST_SHA
manifest=json.loads(raw_manifest)
assert len(manifest)==141
save(ROOT/'canonical-141-manifest.json',raw_manifest)
inputs=[]; texts={}
for name in NAMES:
    rel=f'src/cumulonimbus/{name}.ts'; raw=(REPO/rel).read_bytes()
    assert sha(raw)==manifest[rel], f'Canonical source drift: {rel}'
    save(ROOT/'baseline'/rel,raw); texts[name]=raw.decode()
    inputs.append({'path':f'baseline/{rel}','canonicalPath':rel,'bytes':len(raw),'sha256':sha(raw)})

volume=texts['volume']
signature='export function generateVolume(size = VOLUME_RESOLUTION, seed = 71, progress?: (fraction: number) => void): CloudVolume {'
derived_signature=signature.replace('): CloudVolume {',', auditFineDensity?: (density: Float32Array, envelope: DetailVolume) => void): CloudVolume {')
volume=once(volume,signature,derived_signature)
hook_anchor='  // Parallel light-space rays preserve fine shadows without repeated diffusion.\n'
volume=once(volume,hook_anchor,'  auditFineDensity?.(density,envelope); // Synchronous diagnostic borrow, after fine density and before light bakes.\n'+hook_anchor)
for name in ['light','sun','motion','inclinedShoulder']:
    volume=volume.replace(f"'./{name}'",f"'../baseline/src/cumulonimbus/{name}'")
inverse=volume.replace(derived_signature,signature).replace('  auditFineDensity?.(density,envelope); // Synchronous diagnostic borrow, after fine density and before light bakes.\n','')
for name in ['light','sun','motion','inclinedShoulder']:
    inverse=inverse.replace(f"'../baseline/src/cumulonimbus/{name}'",f"'./{name}'")
assert inverse==texts['volume']

precip=texts['precipitation']
old_signature='export function precipitationFootprint(volume:DetailVolume,size=RAIN_MAP_SIZE):Uint8Array{'
new_signature='export function precipitationFootprintFromScalarDensity(volumeSize:number,densityAt:(index:number)=>number,size=RAIN_MAP_SIZE):Uint8Array{'
start=precip.index(old_signature)
prefix=precip[:start]; body=precip[start:]
assert body.rstrip().endswith('return data;\n}')
old_read='const d=volume.data[((zz*volume.size+y)*volume.size+xx)*4]/255;'
new_read='const d=densityAt((zz*volumeSize+y)*volumeSize+xx);'
body=once(body,old_read,new_read)
body=once(body,old_signature,new_signature).replace('volume.size','volumeSize')
inverse_body=once(body,new_signature,old_signature).replace('volumeSize','volume.size')
inverse_body=once(inverse_body,'const d=densityAt((zz*volume.size+y)*volume.size+xx);',old_read)
assert inverse_body==texts['precipitation'][start:]
precip=prefix+body
for name in ['volume','landscape']:
    precip=precip.replace(f"'./{name}'",f"'../baseline/src/cumulonimbus/{name}'")
save(ROOT/'instrumented/volume.ts',volume.encode())
save(ROOT/'instrumented/precipitation.ts',precip.encode())
patch=''
for name,after in [('volume',volume),('precipitation',precip)]:
    patch+=''.join(difflib.unified_diff(texts[name].splitlines(True),after.splitlines(True),fromfile=f'baseline/src/cumulonimbus/{name}.ts',tofile=f'instrumented/{name}.ts'))
save(ROOT/'instrumentation.patch',patch.encode())
record={'canonicalManifestSHA256':EXPECTED_MANIFEST_SHA,'canonicalManifestEntries':len(manifest),'verifiedDependencyFiles':inputs,
    'instrumented':[{'path':f'instrumented/{name}.ts','bytes':len(text.encode()),'sha256':sha(text.encode())} for name,text in [('volume',volume),('precipitation',precip)]],
    'guards':{'inverseVolumeExactlyCanonical':True,'inverseReducerBodyExactlyCanonical':True,'allOriginalBakesPreserved':True,
        'reducerSourceStartLine':texts['precipitation'][:start].count('\n')+1,'hookBeforeCanonicalLine':texts['volume'][:texts['volume'].index(hook_anchor)].count('\n')+1},
    'execution':'SOURCE I/O ONLY; no TypeScript import, recipe, test, build or model executed',
    'dependencyScope':'Nine local TS dependency files individually checked against the pinned 141-entry manifest; no new dependency or node_modules access.'}
save(ROOT/'source-provenance.json',(json.dumps(record,indent=2)+'\n').encode())
print(json.dumps({'status':'SOURCE_PREPARED_ONLY','verifiedDependencies':len(inputs),'instrumented':record['instrumented'],'guards':record['guards']},indent=2))
