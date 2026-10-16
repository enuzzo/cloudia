#!/usr/bin/env python3
"""Saved-artifact verification only. No JS/model/prefix/bake/GPU execution."""
from pathlib import Path
import hashlib,json,math,os
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'anatomy-r5-v55-source'
def read(name):return json.loads((HERE/name).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def close(a,b):assert math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-12),(a,b)
m=read('MANIFEST.json');files=m['evidence']['files']
assert len(files)==m['evidence']['fileCount'] and sum(f['bytes'] for f in files)==m['evidence']['payloadBytes']
for row in files:
 p=Path(row['path']);assert not p.is_absolute() and '..' not in p.parts
 assert (HERE/p).stat().st_size==row['bytes'] and sha(HERE/p)==row['sha256'],p
actual=set()
for base,dirs,names in os.walk(HERE,followlinks=False):
 dirs[:]=[d for d in dirs if not (Path(base)/d).is_symlink()]
 for name in names:
  p=Path(base)/name
  if not p.is_symlink() and p!=HERE/'MANIFEST.json':actual.add(p.relative_to(HERE).as_posix())
assert actual=={f['path'] for f in files}
source=read('source-manifest.json');base=read('baseline-source-manifest.json');rain=read('rain-source-manifest.json');freeze=read('source-freeze.json');protocol=read('PROTOCOL.json')
assert len(source)==freeze['fileCount']==122 and len(base)==len(rain)==119 and source==freeze['files']
assert sha(HERE/'source-freeze.json')==m['source']['freezeSHA256']
assert sha(HERE/'PROTOCOL.json')==freeze['protocolSHA256']
assert sha(HERE/'candidate.patch')==freeze['candidatePatchSHA256']
assert sha(HERE/'mutation-check.ts')==freeze['mutationRunnerSHA256']
assert [p for p in base if base[p]!=source[p]]==protocol['existingChangedPaths']
assert sorted(set(source)-set(base))==sorted(protocol['addedPaths'])
assert source['src/cumulonimbus/volume.ts']=='c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d'
for p,h in source.items():assert sha(SOURCE/p)==h,p
assert sum((SOURCE/p).stat().st_size for p in source)==freeze['payloadBytes']==m['source']['payloadBytes']
for p,h in rain.items():
 if p in ['src/cumulonimbus/GPUSceneEngine.ts','src/cumulonimbus/lifecycle.test.ts']:
  text=(SOURCE/p).read_text();assert text.count('observatory-v56-inward-shoulder')==1
  original='observatory-v56-inward-shoulder-trial' if 'GPUSceneEngine' in p else 'observatory-v56-joint-r3-trial'
  assert hashlib.sha256(text.replace('observatory-v56-inward-shoulder',original).encode()).hexdigest()==h
  assert hashlib.sha256(text.replace('observatory-v56-inward-shoulder','observatory-v55-s2-chromaticity').encode()).hexdigest()==base[p]
 else:assert source[p]==h,p
for p,h in freeze['referenceSHA256'].items():assert sha(HERE/p)==h

# Reassemble every original FAIL-R1 payload from overrides or identical reused files.
prior=read('prior-harness-run/MANIFEST.json')
assert prior['status']=='FAIL_EXTERNAL_HARNESS_MARKER_TEST'
assert len(prior['files'])==prior['fileCount'] and sum(row['bytes'] for row in prior['files'])==prior['payloadBytes']
for row in prior['files']:
 override=HERE/'prior-harness-run'/row['path'];p=override if override.is_file() else HERE/row['path']
 assert p.stat().st_size==row['bytes'] and sha(p)==row['sha256'],row['path']
oldFreeze=read('prior-harness-run/source-freeze.json')
assert oldFreeze['files']==source and sha(HERE/'prior-harness-run/source-freeze.json')==freeze['parentFreezeSHA256']
oldRunner=(HERE/'prior-harness-run/mutation-check.ts').read_text()
assert oldRunner.replace("source.replace(marker,marker+' changed')","source.replace(marker,marker.replace('Rasterize','Rasterise'))")== (HERE/'mutation-check.ts').read_text()
priorChecks=read('prior-harness-run/checks.json');checks=read('checks.json')
assert len(priorChecks)==4 and priorChecks[3]['exitCode']==1
assert len(checks)==7 and all(c['exitCode']==0 and not c['wallTimedOut'] for c in checks)
for old,new in zip(priorChecks[:3],checks[:3]):
 for key,value in old.items():assert new[key]==value
assert checks[0]['kernelCpuSeconds']==5
for filename,count,number in [('nine-test-results.json',9,1),('full-test-results.json',350,44)]:
 result=read(filename);assert result['success'] and result['numTotalTests']==result['numPassedTests']==count and result['numFailedTests']==0 and len(result['testResults'])==number

r=read('layout1024.json');assert r['status']=='PASS_PROJECTED_SHOULDER_LAYOUT_CONTRACTS' and r['checked']==len(r['rows'])==1024 and r['cpuUs']<5_000_000
assert r['sourceSHA256']==source['src/cumulonimbus/volume.ts'] and [x['seed'] for x in r['rows']]==list(range(1024))
c=r['counts'];assert (c['inwardProjectionR3Matched'],c['outwardBaselineExact'],c['otherFamilyBaselineExact'],c['wholeBaselineExact'],c['beforeJointBaselineExact'],c['shearedBodyBaselineExact'],c['allNonXZBaselineExact'],c['outsideSelectedBaselineExact'],c['r3ReferenceLayoutsEvaluated'])==(323,18,683,701,1024,341,1024,1024,323)
assert len(r['references'])==2
for ref in r['references']:assert sha(HERE/'references'/Path(ref['path']).name)==ref['sha256']
inward=[];outward=[];other=[];differences=[]
for row in r['rows']:
 if row['mode']=='inward-projected':
  inward.append(row);assert row['projection']>0 and row['bodyExact'] and row['outsideSelectedExact'] and row['allNonXZExact'] and row['scale']==1
  unit=row['inwardUnitXZ'];before=row['offsetBeforeXZ'];delta=row['recenterDeltaXZ'];after=[a+b for a,b in zip(before,delta)]
  close(math.hypot(*unit),1);close(row['recenterKm'],math.hypot(*delta));close(row['recenterKm'],row['projection'])
  signedBefore=sum(a*b for a,b in zip(before,unit));signedAfter=sum(a*b for a,b in zip(after,unit))
  close(signedBefore,row['projection']);close(signedAfter,row['signedAfter']);close(signedAfter,0)
  perpBefore=[v-u*signedBefore for v,u in zip(before,unit)];perpAfter=[v-u*signedAfter for v,u in zip(after,unit)]
  for a,b,d,e in zip(perpBefore,perpAfter,row['perpendicularBeforeXZ'],row['perpendicularAfterXZ']):close(a,b);close(a,d);close(b,e)
  projected=sum(a*b for a,b in zip(delta,unit));close(projected,row['projectedDeltaKm']);close(projected,row['r3ProjectedDeltaKm']);differences.append(abs(row['projectedDeltaKm']-row['r3ProjectedDeltaKm']))
 elif row['mode']=='outward-unchanged':
  outward.append(row);assert row['baselineExact'] and row['layoutSHA256']==row['baselineSHA256'] and row['bodyExact'] and row['recenterKm']==0
 else:
  other.append(row);assert row['mode']=='unmodified-family' and row['baselineExact'] and row['layoutSHA256']==row['baselineSHA256']
assert (len(inward),len(outward),len(other))==(323,18,683)
assert sum(row['baselineExact'] for row in r['rows'])==701
assert max(differences)==r['maxR3ProjectedDeltaDifferenceKm']
expected=sorted(inward,key=lambda row:(-row['recenterKm'],row['seed']))[:5]
assert [x['seed'] for x in expected]==[x['seed'] for x in r['topFiveInwardRecenterKm']]
for summary,row in zip(r['topFiveInwardRecenterKm'],expected):
 for key,value in summary.items():assert row[key]==value
w=read('named-witnesses.json')
for seed,row in w.items():assert row==r['rows'][int(seed)]
assert w['617']['baselineExact'] and w['917']['recenterKm']<w['917']['r3FullAxisRecenterKm']
mutation=read('mutation-results.json');assert mutation['status']=='SEVEN_ACTUAL_SOURCE_MUTANTS_REJECTED' and mutation['missingMarkerRejectedBeforeTrace'] and len(mutation['results'])==7
for row in mutation['results']:
 assert row['rejected'] and row['expected'] in row['error'];assert sha(HERE/'mutations'/(row['name']+'.volume.ts'))==row['sourceSHA256']
dist=read('dist-manifest.json');assert len(dist)==m['dist']['fileCount']==30
for p,row in dist.items():assert (SOURCE/'dist'/p).stat().st_size==row['bytes'] and sha(SOURCE/'dist'/p)==row['sha256']
assert all(p in dist for p in ['index.html','cloudia-hero.js','cloudia-hero.iife.js','cloudia-hero.js.map','cloudia-hero.iife.js.map'])
assert sum(row['bytes'] for row in dist.values())==m['dist']['payloadBytes']
post=read('post-checks.json');assert post['scannerExecutions']==1 and post['noScannerRerunAfterHarnessFix'] and post['source122AfterExactPreExecutionFreeze']
assert post['dependencyXattrBefore']==post['dependencyXattrAfter']=='1' and post['volumeExactRain'] and post['gpuBrowserRuns']==0
print(json.dumps({'offlineVerification':'PASS','sourceFiles':122,'testCount':350,'testFiles':44,'targetedTests':9,'mutantsRejected':7,'scannerExecutions':1,'layouts':1024,'wholeBaselineExact':701,'inwardProjectedComponentR3Matched':323,'bodiesBaselineExact':341,'allNonXZBaselineExact':1024,'priorHarnessFAILPreserved':True,'maxProjectedRecenter':r['topFiveInwardRecenterKm'][0],'newModelOrGpuRuns':0}))
