"""Verify saved evidence and source overlays only; no model/GPU/measurement replay."""
from pathlib import Path
import gzip,hashlib,json,math,struct
here=Path(__file__).resolve().parent;root=here.parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((here/p).read_text())
m=read('manifest.json')
for name,v in m['files'].items():
 b=(here/name).read_bytes();assert len(b)==v['bytes'] and sha(b)==v['sha256'],name
assert m['payloadCount']==len(m['files']) and m['payloadBytes']==sum(v['bytes'] for v in m['files'].values())
base=read('source/base-manifest.json');assert len(base)==129
canonical={p:(root/p).read_bytes() for p in base}
for p,h in base.items():assert sha(canonical[p])==h,p
asset=gzip.decompress((here/'assets/liguria-apuane-glo30-mesh.bin.gz').read_bytes());assert len(asset)==37639536 and sha(asset)=='59fc118c9676fffd2b96ac1d52ed04cc5fe4a34bf06e1e1c3069562b3690a831'
assetPath='src/cumulonimbus/assets/liguria-apuane-glo30-mesh.bin'
def overlay(parent,name):
 result=dict(parent);descriptor=read('source/'+name+'-overlay.json')
 for p in descriptor['deleted']:del result[p]
 for p in descriptor['changedOrAdded']:result[p]=asset if p==assetPath else (here/'source'/name/p).read_bytes()
 expected=read('source/'+descriptor['manifest']);assert set(result)==set(expected)
 for p,h in expected.items():assert sha(result[p])==h,(name,p)
 return result
candidate=overlay(canonical,'candidate-source');assert len(candidate)==135
difference=overlay(candidate,'difference-source');assert len(difference)==137
for content,folder,manifest in [(candidate,'source-r0-overlay','candidate-manifest-r0.json'),(difference,'difference-source-r0-overlay','difference-manifest-r0.json')]:
 old=dict(content)
 for p in (here/'source'/folder).rglob('*'):
  if p.is_file():old[p.relative_to(here/'source'/folder).as_posix()]=p.read_bytes()
 expected=read('source/'+manifest);assert set(old)==set(expected)
 for p,h in expected.items():assert sha(old[p])==h,(folder,p)
cdm=gzip.decompress((here/'glo30-dem/glo30-62_5m-recomputed-coast.cdm1.bin.gz').read_bytes());assert len(cdm)==16793636 and sha(cdm)=='79f84ba70848724549f65c4d4f6758041f10068dc9885156894c36e7bc2c4cd1'
holdout=(here/'glo30-dem/holdout-native-m.f64le.bin').read_bytes();assert len(holdout)==147456*8 and sha(holdout)=='be7e34ad823f6499773c556dc6f05524665df1c3a93a26d8703cfb05632b65e9'
png=(here/'browser/candidate-after-forced-native.png').read_bytes();meta=read('browser/candidate-after-forced-native.json');assert len(png)==meta['png']['byteLength']==2977207 and sha(png)==meta['png']['sha256']=='90c8db0b4d7b9b3d4d31f80cf770007138359ede99fd3d1ce23b93ddac678e65'
assert png[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',png[16:24])==(2474,1844)
alias=read('browser/baseline-png-alias.json');assert sha((root/alias['path']).read_bytes())==alias['sha256']
a=read('browser/candidate-first-f32.json');b=read('browser/difference-first-f32.json');steady=read('browser/candidate-second-f32.json')
for d in [a,b]:
 assert d['status']=='FAIL_F32_DIFFERENCE' and d['stable'] and d['cacheStateQualified']
 assert d['cached']['sha256']=='04239524bbd9181fda93fc4a207ff450edd0a92cf6c470a09a0e6134ceb2caab'
 assert d['fresh']['sha256']=='d7dfd69b584300db49db81af4224caa0bf93952636628872cc43ea541eab6b8d'
assert steady['status']=='COMPLETE_IDENTICAL_F32' and steady['cached']['sha256']==steady['fresh']['sha256']==b['fresh']['sha256']
r=b['difference']['rgba'];assert r['changedWords']==21 and r['changedPixels']==7 and r['changedAlphaWords']==0 and r['changedWordsByChannel']==[7,7,7,0]
examples=r['firstDifferences'];assert len(examples)==7
changed=[0]*4;delta=[0.0]*4
for p in examples:
 for c in range(4):
  x=p['before']['bits'][c];y=p['after']['bits'][c];changed[c]+=x!=y
  xv=struct.unpack('<f',struct.pack('<I',x))[0];yv=struct.unpack('<f',struct.pack('<I',y))[0]
  assert xv==p['before']['values'][c] and yv==p['after']['values'][c]
  delta[c]=max(delta[c],abs(yv-xv))
  if c<3:assert yv<xv
assert changed==[7,7,7,0] and delta==r['maxFiniteAbsDeltaByChannel']
xs=[p['x'] for p in examples];ys=[p['y'] for p in examples]
assert r['boundingRect']=={'x':min(xs),'y':min(ys),'width':max(xs)-min(xs)+1,'height':max(ys)-min(ys)+1}
assert not b['difference']['shadow']['identical'] and b['readbackRequests']==4
for file in ['candidate-console.json','difference-console.json','restored-v60-console.json']:assert read('browser/'+file)==[]
pre=read('mesh-preflight/run/stdout.json');run=read('mesh-preflight/run/run.json');assert run['gatePass']
s=pre['candidate'];assert s['geometryBytes']==32*s['vertices']+12*s['triangles']==34689040
ratio=pre['holdout']['candidate']['rmsMetres']/pre['holdout']['baseline']['rmsMetres'];assert math.isclose(ratio,run['holdoutRMSRatio'],abs_tol=1e-14) and ratio<=.9
assert pre['holdout']['landPoints']==83424 and pre['holdout']['allPoints']==147456
print(json.dumps({'status':'PASS_SAVED_EVIDENCE_ONLY','payloads':m['payloadCount'],'canonicalSourcePins':129,'candidatePins':135,'differencePins':137,'R0OverlaysExact':True,'gzipAssetsExact':True,'reproducedSavedPair':True,'changedWords':21,'changedRgbPixels':7,'changedAlphaWords':0,'modelOrGPUReplayed':False},indent=2))
