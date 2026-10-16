#!/usr/bin/env python3
"""Read saved evidence only. Does not run a prefix, model, bake, JS or GPU."""
from pathlib import Path
import hashlib,json,math,os
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'anatomy-r4-v55-source'
def read(name):return json.loads((HERE/name).read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
m=read('MANIFEST.json')
rows=m['evidence']['files']
assert len(rows)==m['evidence']['fileCount']
assert sum(row['bytes'] for row in rows)==m['evidence']['payloadBytes']
for row in rows:
 p=Path(row['path']);assert not p.is_absolute() and '..' not in p.parts
 f=HERE/p;assert f.stat().st_size==row['bytes'] and sha(f)==row['sha256'],p
actual=set()
for base,dirs,files in os.walk(HERE,followlinks=False):
 dirs[:]=[d for d in dirs if not (Path(base)/d).is_symlink()]
 for filename in files:
  p=Path(base)/filename
  if not p.is_symlink() and p!=HERE/'MANIFEST.json':actual.add(p.relative_to(HERE).as_posix())
assert actual=={row['path'] for row in rows}
freeze=read('source-freeze.json');source=read('source-manifest.json');baseline=read('baseline-source-manifest.json');protocol=read('PROTOCOL.json')
assert len(source)==freeze['fileCount']==122 and len(baseline)==119 and source==freeze['files']
assert sha(HERE/'source-freeze.json')==m['source']['freezeSHA256']
assert sha(HERE/'PROTOCOL.json')==freeze['protocolSHA256']
assert sha(HERE/'candidate.patch')==freeze['candidatePatchSHA256']
assert sha(HERE/'mutation-check.ts')==freeze['mutationRunnerSHA256']
assert [p for p in baseline if baseline[p]!=source[p]]==protocol['existingChangedPaths']
assert sorted(set(source)-set(baseline))==sorted(protocol['addedPaths'])
assert source['src/cumulonimbus/volume.ts']=='52078334f68a827c5d4673483ffa5e53de394d894716985199613b5b3d8e81f1'
for p,h in source.items():assert sha(SOURCE/p)==h,p
assert sum((SOURCE/p).stat().st_size for p in source)==freeze['payloadBytes']==m['source']['payloadBytes']
for p in ['src/cumulonimbus/GPUSceneEngine.ts','src/cumulonimbus/lifecycle.test.ts']:
 text=(SOURCE/p).read_text();assert text.count('observatory-v56-inward-joint')==1
 assert hashlib.sha256(text.replace('observatory-v56-inward-joint','observatory-v55-s2-chromaticity').encode()).hexdigest()==baseline[p]
for p,h in freeze['referencePrefixSHA256'].items():assert sha(HERE/p)==h
checks=read('checks.json')
assert len(checks)==7 and all(c['exitCode']==0 and not c['wallTimedOut'] for c in checks)
assert checks[0]['name']=='scanner' and checks[0]['kernelCpuSeconds']==5
for filename,count,files in [('seven-test-results.json',7,1),('full-test-results.json',348,44)]:
 result=read(filename);assert result['success'] and result['numTotalTests']==result['numPassedTests']==count and result['numFailedTests']==0 and len(result['testResults'])==files
r=read('layout1024.json');assert r['status']=='PASS_LAYOUT_CONTRACTS' and r['checked']==len(r['rows'])==1024 and r['cpuUs']<5_000_000
assert r['sourceSHA256']==source['src/cumulonimbus/volume.ts']
assert [row['seed'] for row in r['rows']]==list(range(1024))
c=r['counts'];assert (c['inwardR3Exact'],c['outwardBaselineExact'],c['nonShearedBaselineExact'],c['baselineBeforeJointExact'],c['inwardAlreadyCovered'])==(323,18,683,1024,197)
inward=[];outward=[];other=[]
for row in r['rows']:
 if row['mode']=='inward-joint':
  assert row['r3Exact'] and row['layoutSHA256']==row['r3SHA256'];inward.append(row)
  assert math.isclose(row['recenterKm'],math.hypot(*row['recenterDeltaXZ']),rel_tol=1e-12,abs_tol=1e-12)
 elif row['mode']=='outward-unchanged':
  assert row['baselineExact'] and row['layoutSHA256']==row['baselineSHA256'] and row['scale']==1 and row['recenterKm']==0;outward.append(row)
 else:
  assert row['mode']=='unmodified-family' and row['baselineExact'] and row['layoutSHA256']==row['baselineSHA256'];other.append(row)
assert (len(inward),len(outward),len(other))==(323,18,683)
assert [row['seed'] for row in sorted(inward,key=lambda row:(-row['scale'],row['seed']))[:5]]==[row['seed'] for row in r['topFiveInwardBodyYScale']]
assert [row['seed'] for row in sorted(inward,key=lambda row:(-row['recenterKm'],row['seed']))[:5]]==[row['seed'] for row in r['topFiveInwardRecenterKm']]
for summary,metric in [('topFiveInwardBodyYScale','scale'),('topFiveInwardRecenterKm','recenterKm')]:
 for item in r[summary]:assert item[metric]==r['rows'][item['seed']][metric]
w=read('named-witnesses.json')
for seed,row in w.items():assert row==r['rows'][int(seed)]
assert all(w[str(seed)]['r3Exact'] for seed in [74,77,80]) and w['617']['baselineExact']
mutation=read('mutation-result.json');assert mutation['status']=='REJECTED_REAL_COVERED_INWARD_BRANCH_MUTANT' and mutation['seed']==2 and 'feeding axis' in mutation['error']
assert sha(HERE/'wrong-recenter-requires-lift.volume.ts')==mutation['mutantSHA256']
dist=read('dist-manifest.json');assert len(dist)==m['dist']['fileCount']==30
for p,row in dist.items():assert (SOURCE/'dist'/p).stat().st_size==row['bytes'] and sha(SOURCE/'dist'/p)==row['sha256']
assert sum(row['bytes'] for row in dist.values())==m['dist']['payloadBytes']
post=read('post-checks.json');assert post['adoption']=='NOT_ADOPTED' and post['scannerExecutions']==1 and post['source122AfterExactPreExecutionFreeze']
assert post['dependencyXattrBefore']==post['dependencyXattrAfter']=='1' and post['dedicated617FullBakes']==post['gpuBrowserRuns']==0
print(json.dumps({'offlineVerification':'PASS','adoption':'NOT_ADOPTED','sourceFiles':122,'tests':348,'testFiles':44,'scannerExecutions':1,'layouts':1024,'inwardR3Exact':323,'outwardBaselineExact':18,'otherBaselineExact':683,'worstBodyScale':r['topFiveInwardBodyYScale'][0],'worstRecenterKm':r['topFiveInwardRecenterKm'][0],'newFieldEvaluations':0}))
