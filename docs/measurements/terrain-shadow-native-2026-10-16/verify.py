#!/usr/bin/env python3
"""Verify archived bytes and evidence; no Cloudia/helper/GPU execution."""
from pathlib import Path
import argparse,hashlib,json,struct
from PIL import Image

root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--runtime-source',type=Path);args=parser.parse_args()
load=lambda p:json.loads(p.read_text())
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=load(root/'MANIFEST.json')
for name,info in manifest['files'].items():
 p=root/name
 assert p.is_file() and p.stat().st_size==info['bytes'] and digest(p)==info['sha256'],name

baseline=root.parent/'native-frame-export-2026-10-16/browser/main74-sun-terrain-native'
assert digest(baseline.with_suffix('.png'))=='af8877ac93db6fcd50ab3ceece43ac1a40fc7d21c41151afb3a9620ca7586be5'
assert digest(baseline.with_suffix('.json'))=='f59d46a8b6a022f9b9a9e7e2faca1164e1d8acbfeb0aee05dbb10903f84fbbff'
base=load(baseline.with_suffix('.json'))['metadata']
fields=['camera','quality','nominalSteps','volume','detailVolume','output','internal','canvas','material','lighting','weather','paused','seed','flowMode']
images={'baseline':Image.open(baseline.with_suffix('.png')).convert('RGB')}
for prefix,version in [('unshadowed','experiment-v57-terrain-unshadowed'),('normal-clearance','experiment-v57-terrain-normal-clearance')]:
 name=prefix+'74-sun-terrain-native';p=root/'browser'/name;meta=load(p.with_suffix('.json'));transfer=load(p.with_suffix('.transfer.json'));data=p.with_suffix('.png').read_bytes();info=meta['png'];m=meta['metadata']
 assert data[:16]==b'\x89PNG\r\n\x1a\n\0\0\0\rIHDR' and list(struct.unpack('>II',data[16:24]))==[2474,1844]
 assert len(data)==info['byteLength'] and hashlib.sha256(data).hexdigest()==info['sha256'] and info['mime']=='image/png'
 assert m['rendererVersion']==version and all(m[k]==base[k] for k in fields)
 assert m['volume']==[256]*3 and m['detailVolume']==[128]*3 and m['nominalSteps']==384 and m['quality']=='ultra'
 assert m['clocks']['simulationTime']==m['clocks']['flowFieldTime']==60 and m['clocks']['forcingTime']==m['clocks']['precipitationUniformTime']==0
 total=22+4*((len(data)+2)//3);count=(total+65535)//65536
 assert meta['textExport']['partCharacters']==65536 and meta['textExport']['parts']==count and meta['textExport']['totalCharacters']==total
 assert transfer['status']=='PASS_VISIBLE_PARTS_ROUNDTRIP' and transfer['captureId']==meta['captureId'] and transfer['sha256']==info['sha256'] and transfer['bytes']==len(data) and transfer['parts']==count
 assert len(transfer['ledger'])==count
 for i,item in enumerate(transfer['ledger']):
  start=i*65536+1;end=min((i+1)*65536,total)
  assert item=={'part':i+1,'characters':end-start+1,'label':f'Parte {i+1} di {count} · caratteri {start}–{end} di {total}'}
 with Image.open(p.with_suffix('.png')) as image:image.verify()
 with Image.open(p.with_suffix('.png')) as image:
  image.load();assert image.size==(2474,1844) and image.convert('RGBA').getextrema()[3]==(255,255)
  images[prefix]=image.convert('RGB')

rois={'all':(0,0,2474,1844),**load(root/'PROTOCOL.json')['ROIs']}
for prefix,report_name in [('unshadowed','ablation-comparison.json'),('normal-clearance','normal-comparison.json')]:
 expected=load(root/report_name)['differences']
 for roi,rect in rois.items():
  aa=images['baseline'].crop(rect).tobytes();bb=images[prefix].crop(rect).tobytes();delta=[int(y)-int(x) for x,y in zip(aa,bb)]
  changed=sum(aa[i:i+3]!=bb[i:i+3] for i in range(0,len(aa),3))
  row=expected[roi]
  assert changed==row.get('changedPixels',row.get('changedVsBaseline')) and len(aa)//3==row['pixels']
  if 'minChannelDelta' in row:assert min(delta)==row['minChannelDelta'] and max(delta)==row['maxChannelDelta'] and abs(sum(delta)/len(delta)-row['meanChannelDelta'])<1e-12
  if 'changedVsUnshadowed' in row:
   oo=images['unshadowed'].crop(rect).tobytes();assert sum(oo[i:i+3]!=bb[i:i+3] for i in range(0,len(aa),3))==row['changedVsUnshadowed']
for name in ['checks.json','normal-checks.json']:
 checks=load(root/name);assert [c['name'] for c in checks]==['typecheck','app-build','hero-build'] and all(c['exitCode']==0 and c['terminalObservedByPopen'] for c in checks)
cpu=load(root/'normal-clearance-proposal/cpu-r2.stdout.json');run=load(root/'normal-clearance-proposal/cpu-r2-run.json')
assert cpu['status']=='PASS_NUMERICAL_SCOPE_ONLY' and cpu['assertions']==654 and cpu['planeRows']==126 and cpu['limits']['multiFaceTexelFalseShadowNotSolved']
assert run['pass'] and run['exitCode']==0 and run['cpuSeconds']<5 and run['peakRSSBytes']<2**31 and not run['wallKilled']
restored=load(root/'browser/ordinary-restored.json');assert restored['animatedPauseButton']==1 and restored['diagnosticPNGControls']==0 and restored['canvas']=={'width':2474,'height':1844} and restored['logs']==[]

if args.runtime_source:
 base_manifest=load(root/'base-source-manifest.json');assert len(base_manifest)==124
 old='observatory-v57-native-frame-export'
 for name,h in base_manifest.items():
  data=(args.runtime_source/name).read_bytes();assert hashlib.sha256(data).hexdigest()==h,name
  for prefix,version in [('unshadowed','experiment-v57-terrain-unshadowed'),('normal-clearance','experiment-v57-terrain-normal-clearance')]:
   candidate=data
   if name in ['src/cumulonimbus/GPUSceneEngine.ts','src/cumulonimbus/lifecycle.test.ts']:candidate=candidate.replace(old.encode(),version.encode())
   if prefix=='unshadowed' and name=='src/cumulonimbus/GPUSceneEngine.ts':candidate=candidate.replace(b'terrainSurfaceMaterial(point,height,coast,normal,distance,pixelKm,sun,solar,ambient,solarVisibility,coverA,coverB)',b'terrainSurfaceMaterial(point,height,coast,normal,distance,pixelKm,sun,solar,ambient,1.0,coverA,coverB)')
   if prefix=='normal-clearance' and name=='src/cumulonimbus/TerrainShadow.ts':candidate=(root/'normal-clearance-proposal/after'/name).read_bytes()
   assert hashlib.sha256(candidate).hexdigest()==load(root/(prefix+'-source-manifest.json'))[name],prefix+':'+name
print(json.dumps({'status':'PASS_ARCHIVED_EVIDENCE','payloads':len(manifest['files']),'payloadBytes':sum(x['bytes'] for x in manifest['files'].values()),'nativePNG':2,'unshadowedChangedPixels':1778,'normalChangedPixels':1006,'savedCPUAssertions':654,'runtimeAndVirtual124':bool(args.runtime_source),'visualVerdict':'REJECTED','noNewTestsOrGPU':True}))
