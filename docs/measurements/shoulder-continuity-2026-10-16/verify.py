#!/usr/bin/env python3
from pathlib import Path,PurePosixPath
import json,hashlib,gzip,sys,subprocess,math
root=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def safe(rel):
 p=PurePosixPath(rel);assert not p.is_absolute() and '..' not in p.parts
 return root/str(p)
m=json.loads((root/'MANIFEST.json').read_text());entries=m['files']
assert len(entries)==m['payloadFiles'] and sum(x['bytes'] for x in entries)==m['payloadBytes']
for row in entries:
 p=safe(row['path']);assert p.is_file() and not p.is_symlink()
 b=p.read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p!=root/'MANIFEST.json'}
assert actual=={x['path'] for x in entries}
copies=json.loads((root/'copy-record.json').read_text());originals={}
for row in copies:
 b=safe(row['path']).read_bytes()
 if row['compression']=='gzip':b=gzip.decompress(b)
 else:assert row['compression']=='identity'
 assert len(b)==row['originalBytes'] and sha(b)==row['originalSHA256'],row['path']
 originals[row['originalPath']]=b
def data(rel):return json.loads(originals[rel])
tests=data('qualification/full-test-results.json');assert tests['success'] and tests['numPassedTests']==tests['numTotalTests']==350 and tests['numFailedTests']==0 and len(tests['testResults'])==44
layout=data('qualification/layout1024.json');assert layout['checked']==1024 and layout['counts']['wholeBaselineExact']==701 and layout['counts']['inwardProjectionR3Matched']==323 and layout['counts']['shearedBodyBaselineExact']==341 and layout['counts']['outsideSelectedBaselineExact']==1024
for name in ['sun','rain']:
 j=data('browser/'+name+'-native.raw.json');s=j['stats'];a=j['frameIntervalsMs'];q=j['queuePrefix']
 assert j['rendererVersion']=='observatory-v56-inward-shoulder' and j['quality']=='ultra'
 assert j['output']==j['internal']==[2474,1844] and j['volume']==[256]*3 and j['detailVolume']==[128]*3 and j['nominalSteps']==384
 assert j['simulationTimeStart']==j['simulationTimeEnd']==60 and j['flowMode']==j['ablation']=='full' and j['weather']['atmosphereTransition']==1
 assert len(a)==s['frames'] and abs(sum(a)-s['durationMs'])<1e-6 and abs(1000*len(a)/sum(a)-s['fps'])<1e-8
 assert q['status']=='completed' and q['measuredSubmissions']==q['confirmedPrefixId']==s['frames'] and q['unconfirmedMeasuredFrames']==0
 assert j['presentedCanvasFps'] is None
summary=data('browser/performance-summary.json');assert len(json.dumps(summary))<20000
cam=data('visual/camera617-preservation.json');assert all(cam['equalFields'].values())
console=data('browser/console-main-worker.json');assert console==[]
nested=subprocess.run([sys.executable,str(root/'trials/verify_curated.py')],capture_output=True,text=True)
assert nested.returncode==0,nested.stderr
runtime=0
if '--verify-runtime' in sys.argv:
 base=Path(sys.argv[sys.argv.index('--verify-runtime')+1]);sources=data('qualification/source-manifest.json')
 assert len(sources)==122
 for name,digest in sources.items():assert sha((base/name).read_bytes())==digest,name
 runtime=len(sources)
print(json.dumps({'status':'PASS','payloadFiles':len(entries),'losslessOriginals':len(copies),'tests':350,'testFiles':44,'layouts':1024,'nativeWindows':2,'queuePrefixesComplete':True,'compositorPresentation':'unmeasured','runtimeFilesVerified':runtime,'newModelOrGpuRuns':0}))
