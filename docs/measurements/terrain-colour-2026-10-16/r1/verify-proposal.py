"""Read-only reproduction of the six-colour derivation; stdlib only."""
from pathlib import Path
import json,hashlib,struct
r=Path(__file__).resolve().parent
q=json.loads((r/'comparison.json').read_text());p=q['inputs']['palette']
assert hashlib.sha256(Path(p['path']).read_bytes()).hexdigest()==p['sha256']
palette={a['classCode']:a for a in json.loads(Path(p['path']).read_text())['palette']}
f32=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
y=[.2126,.7152,.0722];dot=lambda a:sum(x*w for x,w in zip(a,y))
a=(r/'terrainSurface.before.ts').read_text();expected=a
for e in q['endpoints']:
    c=palette[e['classCode']]['chromaticityY1median'];c=[v/dot(c) for v in c]
    new=[dot(e['oldLiteral'])*v for v in c]
    literal=','.join(format(f32(v),'.9g') for v in new)
    assert literal==e['proposedLiteral']
    # Original literals are recorded precisely in the frozen before snapshot.
    old=','.join(format(v,'.3f').lstrip('0') for v in e['oldLiteral'])
    needle='vec3<f32>('+old+')';assert expected.count(needle)==1,needle
    expected=expected.replace(needle,'vec3<f32>('+literal+')')
assert expected==(r/'terrainSurface.after.ts').read_text()
candidate=expected.replace(' let denseForest=',' // S2 2021 guides tree/grass chromaticity only; endpoint authored Y is retained.\n let denseForest=',1)
assert candidate==(r/'candidate-source/src/cumulonimbus/terrainSurface.ts').read_text()
m=json.loads((r/'trial-source-manifest.json').read_text());changed=[]
for name,sha in m['sourceHashesAfter'].items():
    path=r/'candidate-source'/name
    assert hashlib.sha256(path.read_bytes()).hexdigest()==sha,name
    if sha!=m['sourceHashesBefore'][name]:changed.append(name)
assert set(changed)=={'src/cumulonimbus/terrainSurface.ts','src/cumulonimbus/GPUSceneEngine.ts'}
report={'status':'PASS_SIX_COLOURS_REDERIVED_AND_119_SOURCE_HASHES_VERIFIED',
 'changedFiles':changed,'classSampleCounts':{str(c):palette[c]['acceptedSamples'] for c in [10,30]},
 'sourceFiles':len(m['sourceHashesAfter']),'maxF32EndpointYAbsDelta':q['maxBinary32EndpointYAbsDelta'],
 'limits':'CPU derivation/structural proof only; not WGSL/GPU colour, image, luminance or performance parity.'}
(r/'proposal-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
