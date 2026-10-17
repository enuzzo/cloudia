#!/usr/bin/env python3
"""Verify frozen evidence/source hashes. Does not rebuild, render, profile or replay GPU."""
from pathlib import Path
import hashlib,json,struct,subprocess,sys
here=Path(__file__).resolve().parent
repo=here.parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
load=lambda p:json.loads(p.read_text())
manifest=load(here/'MANIFEST.json')
assert {r['path'] for r in manifest['files']}=={str(p.relative_to(here)) for p in here.rglob('*') if p.is_file() and p!=here/'MANIFEST.json'},'Payload census differs'
for row in manifest['files']:
 raw=(here/row['path']).read_bytes()
 assert len(raw)==row['bytes'] and sha(raw)==row['sha256'],row['path']
index=load(here/'source/INDEX.json');base=load(here/'source/baseline-manifest.json');basebytes={}
for p,h in base.items():
 raw=subprocess.run(['git','show',index['baseGitCommit']+':'+p],cwd=repo,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10).stdout
 assert sha(raw)==h,p;basebytes[p]=raw
sources={}
for name,variant in index['variants'].items():
 source=load(here/variant['manifest']);assert len(source)==variant['fileCount']
 for p,h in source.items():
  row=variant['files'][p];assert row['sha256']==h
  raw=(here/row['stored']).read_bytes() if 'stored' in row else basebytes[row['baseGitPath']]
  assert sha(raw)==h,(name,p)
 sources[name]=len(source)
pack=load(here/'optical-data/MANIFEST.json');alias=load(here/'optical-data/ASSET-ALIAS.json')
for row in pack['files']:
 p=here/alias['stored'] if row['path']==alias['originalPath'] else here/'optical-data'/row['path']
 raw=p.read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256'],row['path']
images={}
for p in (here/'browser').glob('*.png'):
 raw=p.read_bytes();assert raw[:8]==b'\x89PNG\r\n\x1a\n';images[sha(raw)]={'bytes':len(raw),'size':list(struct.unpack('>II',raw[16:24]))}
metadata=0;audits=0;performance=0
alpha='29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c'
for p in (here/'browser').glob('*.json'):
 j=load(p)
 if isinstance(j,dict) and 'png' in j and 'metadata' in j:
  png=j['png'];actual=images[png['sha256']];assert actual['bytes']==png['byteLength'] and actual['size']==[png['width'],png['height']]
  assert j['metadata']['quality']=='ultra' and j['metadata']['volume']==[256]*3 and j['metadata']['detailVolume']==[128]*3 and j['metadata']['nominalSteps']==384
  metadata+=1
 if isinstance(j,dict) and j.get('reportKind')=='terrain-raster-cache-full-f32-v1':
  assert j['status']=='COMPLETE_IDENTICAL_F32' and j['identical'] and j['stable'] and j['cacheStateQualified']
  assert j['cached']['sha256']==j['fresh']['sha256'] and j['cached']['alphaSHA256']==j['fresh']['alphaSHA256']==alpha
  audits+=1
 if p.name.startswith('performance-'):
  assert j['quality']=='ultra' and j['output']==j['internal']==[2474,1844] and j['nominalSteps']==384
  assert j['simulationTimeStart']==j['simulationTimeEnd']==60 and j['flowMode']=='full' and j['paused'] and not j['orbit'] and not j['skyPending']
  assert j['queuePrefix']['status']=='completed' and j['presentedCanvasFps'] is None and j['stats']['over33Ms']==0
  if 'navigation-' in p.name:assert len(j['navigationDiagnosticEnd']['witnesses'])==31
  performance+=1
assert performance==6 and audits==10,(performance,audits)
final=load(here/'source/final-manifest.json');current=0
if '--current' in sys.argv:
 for p,h in final.items():assert sha((repo/p).read_bytes())==h,p
 current=len(final)
print(json.dumps({'status':'PASS_SAVED_EVIDENCE_ONLY','payloadFiles':len(manifest['files']),'payloadBytes':manifest['payloadBytes'],'baseGitSourceFiles':len(base),'executedSources':sources,'packFiles':len(pack['files']),'nativeMetadataMatchingArchivedPNG':metadata,'wholeF32Audits':audits,'performanceWindows':performance,'currentProductFilesVerified':current,'scope':'Hashes and saved reports only. No preprocess, model build, compiler, browser, GPU replay, FPS rerun or artistic judgement.'},indent=2))
