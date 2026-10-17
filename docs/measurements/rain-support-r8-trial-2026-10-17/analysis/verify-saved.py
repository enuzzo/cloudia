"""Saved evidence and source preservation only; never runs Cloudia."""
from pathlib import Path
import argparse, hashlib, json
p=argparse.ArgumentParser();p.add_argument('--manifest-sha256',required=True);p.add_argument('--output',required=True);args=p.parse_args()
arc=Path(__file__).resolve().parent.parent;root=arc.parents[2]
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(arc/'MANIFEST.json')==args.manifest_sha256
m=json.loads((arc/'MANIFEST.json').read_text());total=0
for name,row in m['payload'].items():
 f=arc/name;assert f.resolve().is_relative_to(arc.resolve()) and f.is_file() and not f.is_symlink(),name
 assert f.stat().st_size==row['bytes'] and sha(f)==row['sha256'],name;total+=row['bytes']
base=json.loads((arc/'run/source-baseline141.json').read_text());r1=json.loads((arc/'run/SOURCE-FREEZE-R1.json').read_text());r2=json.loads((arc/'run/SOURCE-FREEZE-R2.json').read_text())
assert len(base)==141 and len(r1)==len(r2)==143
assert [n for n in r1 if r1[n]!=r2[n]]==['src/cumulonimbus/narrowCloud.test.ts']
for name,digest in base.items():assert sha(root/name)==digest,name
for candidate in [r1,r2]:
 for name,digest in candidate.items():
  overlay=arc/'source-overlay'/name
  f=overlay if overlay.exists() else root/name
  if candidate is r1 and name=='src/cumulonimbus/narrowCloud.test.ts':f=root/name
  assert sha(f)==digest,name
failed=json.loads((arc/'run/tests-result.json').read_text());passed=json.loads((arc/'run/tests-r2-result.json').read_text())
assert failed['numPassedTests']==579 and failed['numFailedTests']==1
assert passed['numPassedTests']==580 and passed['numFailedTests']==0 and len(passed['testResults'])==54
micro=json.loads((arc/'browser/support-sampling-preflight.json').read_text())
assert micro['pass'] and micro['deviceDestroyed'] and micro['pointCount']==7833 and len(micro['cases'])==2
native=json.loads((arc/'browser/native-parameter-comparison.json').read_text());assert native['status']=='PASS_FIXED_NATIVE_PNG_AND_INPUTS' and native['differenceCount']==16
assert sha(arc/'browser/native-a-rain.png')=='6ea5e9a22052c40ebdbd223594a1a9ec2761e321410e6a009086ea8ca5972fd1'
comparison=json.loads((arc/'browser/performance-comparison.json').read_text());assert comparison['status']=='FAIL_ADOPTION_GATE_NO_ADOPTION'
assert comparison['gates']=={'submissionFpsAtLeast5Percent':False,'completionBoundedAtLeast5Percent':False,'p95NoWorse':True,'p99NoWorse':True}
for row in comparison['rows']:
 assert row['status']=='PASS_WINDOW_INPUTS_AND_ARITHMETIC' and all(row['checks'].values())
 assert sha(arc/'browser'/(row['name']+'.json'))==row['reportSHA256']
before=json.loads((arc/'browser/performance-a2-validity-before-reduction-fix.json').read_text());assert before['status']=='FAIL_WINDOW_QUALIFICATION' and not before['checks']['statisticsRecompute']
out={'status':'PASS_CONSERVATION_ONLY','manifestSHA256':args.manifest_sha256,'payloadFiles':len(m['payload']),'payloadBytes':total,'canonicalSourcesExact':141,'candidateR1SourcesReconstructedExact':143,'candidateR2SourcesReconstructedExact':143,'overlayFiles':9,'candidateAdopted':False,'trialVerdict':'FAIL_ADOPTION_GATE_NO_ADOPTION','retainedFirstSuite':'579PASS/1FAIL','qualifiedSuite':'580PASS/54files','firstArithmeticFailPreserved':True,'global60':'NOT_REACHED','wholeGoal':'active','modelReplays':0,'testReplays':0,'GPUReplays':0,'scope':'Integrity and preserved verdicts only; no new source/sample/native/performance/artistic or whole-goal qualification.'}
Path(args.output).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
