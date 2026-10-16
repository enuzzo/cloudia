#!/usr/bin/env python3
import argparse,gzip,hashlib,json,pathlib
parser=argparse.ArgumentParser();parser.add_argument('--verify-runtime',type=pathlib.Path);args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((root/'MANIFEST.json').read_text())
actual={str(f.relative_to(root)) for f in root.rglob('*') if f.is_file() and f!=root/'MANIFEST.json'}
assert actual==set(manifest),('Payload list differs',actual.symmetric_difference(manifest))
for f,m in manifest.items():
 data=(root/f).read_bytes();assert len(data)==m['bytes'] and sha(data)==m['sha256'],f
originals=json.loads((root/'ORIGINALS.json').read_text())
for x in originals:
 data=(root/x['path']).read_bytes();data=gzip.decompress(data) if x['encoding']=='gzip' else data
 assert len(data)==x['bytes'] and sha(data)==x['sha256'],x['path']
names=['baseline74-near60','a74-fixed60-sun','a74-fixed60-sunset','b74-fixed60-sun','b74-fixed60-sunset']
raw={n:json.loads(gzip.decompress((root/'browser'/(n+'.raw.json.gz')).read_bytes())) for n in names}
a=raw[names[0]];shared=['seed','quality','output','internal','nominalSteps','volume','detailVolume','simulationTimeStart','simulationTimeEnd','flowMode','paused','outputMode']
for n,r in raw.items():
 assert all(r[k]==a[k] for k in shared),n
 assert all(r['camera'][k]==a['camera'][k] for k in ['origin','target','approach','yaw','pitch']),n
 assert not r['skyPending'] and r['weather']['atmosphereTransition']==1,n
 assert r['weather']['wind']==.55 and r['weather']['dispersion']==0 and r['weather']['rain']==0,n
 q=r['queuePrefix'];assert q['status']=='completed' and q['confirmedPrefixId']==q['measuredSubmissions'] and q['unconfirmedMeasuredFrames']==0,n
for suffix in ['sun','sunset']:
 x,y=raw['a74-fixed60-'+suffix],raw['b74-fixed60-'+suffix]
 assert x['sunDirection']==y['sunDirection'] and x['sunsetAmount']==y['sunsetAmount']
assert a['quality']=='ultra' and a['volume']==[256]*3 and a['detailVolume']==[128]*3 and a['nominalSteps']==384
assert a['output']==a['internal']==[1920,1080] and a['simulationTimeStart']==a['simulationTimeEnd']==60
base=json.loads((root/'trial/baseline-source-manifest.json').read_text());candidate=json.loads((root/'trial/source-manifest.json').read_text())
assert len(base)==len(candidate)==122 and set(base)==set(candidate)
changed={f for f in base if base[f]!=candidate[f]}
assert changed=={'src/cumulonimbus/volume.ts','src/cumulonimbus/GPUSceneEngine.ts','src/cumulonimbus/lifecycle.test.ts'}
for f in changed:assert sha((root/'candidate-overrides'/f).read_bytes())==candidate[f],f
runtime_count=0
if args.verify_runtime:
 for f in base:
  data=(args.verify_runtime/f).read_bytes();assert sha(data)==base[f],('Base runtime drift',f)
  rebuilt=(root/'candidate-overrides'/f).read_bytes() if f in changed else data
  assert sha(rebuilt)==candidate[f],('Virtual candidate differs',f)
  runtime_count+=1
numeric={variant:json.loads((root/'interior05-diagnostic-results-r2'/(variant+'-rays.json')).read_text()) for variant in ['A','B']}
execution=json.loads((root/'interior05-diagnostic-results-r2/execution.json').read_text())
for record in execution:
 assert record['status']=='PASS_EXECUTION' and record['exitCode']==0 and record['terminalObservedByPopen']
 assert record['childCpuSeconds']<180 and record['elapsedSeconds']<240
 assert record['peakRSSBytesSampled']<2*1024**3 and record['cumulativeOwnedChildPeakRSSBytes']<2*1024**3
 assert sha((root/'interior05-diagnostic-results-r2'/(record['variant']+'-rays.json')).read_bytes())==record['validation']['resultSHA256']
for variant,result in numeric.items():
 assert result['volume']==256 and result['detail']==128 and result['flow']==16 and len(result['rays'])==13
 assert not result['terrainLimited'] and result['origin']==a['camera']['origin'] and result['target']==a['camera']['target']
 assert result['inspection']==.6 and result['centerHalf']['stepKm']==.0005
 for ray in result['rays']:
  assert ray['terrain']['provenUnoccluded'] and abs(ray['weightIdentityError'])<1e-12
for x,y in zip(numeric['A']['rays'],numeric['B']['rays']):
 assert x['uv']==y['uv'] and x['ray']==y['ray']
 assert y['first']['rho002']['sampleDistanceKm']>x['first']['rho002']['sampleDistanceKm']
print('PASS',len(manifest),'payloads;',len(originals),'lossless originals; 5 camera/settings exact windows; all5 complete queue prefixes;',runtime_count,'runtime sources checked; 3 candidate overrides')
print('No volume regeneration, browser replay, RGB equality, compositor presentation, native image or global art/FPS acceptance implied.')
