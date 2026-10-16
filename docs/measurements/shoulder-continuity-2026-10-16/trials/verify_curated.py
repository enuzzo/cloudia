#!/usr/bin/env python3
"""Stdlib only. Verify saved archive bytes and states; never import/run a model."""
from pathlib import Path,PurePosixPath
import hashlib,json,gzip,sys
args=[s for s in sys.argv[1:] if s!='--compare-external']
root=Path(args[0]).resolve() if args else Path(__file__).resolve().parent
external='--compare-external' in sys.argv
sha=lambda data:hashlib.sha256(data).hexdigest()
def safe(rel):
 p=PurePosixPath(rel);assert not p.is_absolute() and '..' not in p.parts
 return root/str(p)
def read(rel):return json.loads(safe(rel).read_text())
manifest=read('MANIFEST.json');entries=manifest['files'];assert len(entries)==manifest['payloadFiles']
assert sum(x['bytes'] for x in entries)==manifest['payloadBytes']
for item in entries:
 p=safe(item['path']);assert p.is_file() and not p.is_symlink();raw=p.read_bytes();assert len(raw)==item['bytes'] and sha(raw)==item['sha256'],item['path']
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and p not in [root/'MANIFEST.json',root/'offline-verification.json']}
assert actual=={item['path'] for item in entries},'unmanifested/missing file'
copy=read('copy-record.json');records=copy['records'];lookup={};externalCount=0
for row in records:
 assert row['storedPath'].startswith(row['group']+'/');data=safe(row['storedPath']).read_bytes()
 assert len(data)==row['storedBytes'] and sha(data)==row['storedSHA256']
 if row['compression']=='gzip-mtime0':assert data[4:8]==b'\x00'*4;original=gzip.decompress(data)
 else:assert row['compression']=='identity';original=data
 assert len(original)==row['originalBytes'] and sha(original)==row['originalSHA256'],row['storedPath']
 key=(row['group'],row['originalPath']);assert key not in lookup;lookup[key]=(row,original)
 if external:assert Path(row['externalOriginal']).read_bytes()==original;externalCount+=1
 assert not set(PurePosixPath(row['storedPath']).parts)&{'node_modules','candidate-source','dist','hero-dist'}
def original(group,rel):return lookup[(group,rel)][1]
def saved(group,rel):return json.loads(original(group,rel))
for group in copy['groups']:
 g=group['group'];raw=original(g,group['originalManifest']);assert sha(raw)==group['originalManifestSHA256'];m=json.loads(raw)
 if group['manifestSchema']=='evidence':payload=m['evidence']['files']
 elif group['manifestSchema']=='dict':payload=[{'path':p,**info} for p,info in m['files'].items()]
 else:payload=m['files']
 assert len(payload)==group['originalPayloadFiles']
 for item in payload:
  row,data=lookup[(g,item['path'])];assert len(data)==item['bytes'] and sha(data)==item['sha256']
 assert sum(row['group']==g for row in records)==group['selectedFiles']
 assert sum(row['originalBytes'] for row in records if row['group']==g)==group['selectedOriginalBytes']
# Retain terminal failures and scopes rather than infer a new execution PASS.
control=saved('r3','qa-run-control.json');assert control['status']=='WRAPPERFAIL' and control['childExitCode'] is None
r1=saved('morphology617-r1','TERMINAL-R1.json');assert 'FAIL' in json.dumps(r1).upper()
assert len(json.loads(original('morphology617-r2','MANIFEST.json'))['files'])==37
for name in ['A-baseline-control.json','B-candidate-control.json']:assert saved('morphology617-r2',name)['exitCode']==0
layout=saved('r4','layout1024.json');assert layout['status']=='PASS_LAYOUT_CONTRACTS' and layout['checked']==1024
assert (layout['counts']['inwardR3Exact'],layout['counts']['outwardBaselineExact'],layout['counts']['nonShearedBaselineExact'])==(323,18,683)
for g,count in [('r5-r1',9),('r5-r2',7)]:
 r=saved(g,'expected-report.json');assert r['status']=='PASS' and len(r['rows'])==count
 assert saved(g,'targeted-test-results.json')['numPassedTests']==31
assert saved('r5-r2','expected-926.json')['rows'][0]['seed']==926
r4verify=read('r4-offline-verifier.stdout.json');assert r4verify['offlineVerification']=='PASS' and r4verify['newFieldEvaluations']==0
r4control=read('r4-offline-verifier-control.json');assert r4control['exitCode']==0
assert sha(safe('r4-offline-verifier.stdout.json').read_bytes())==r4control['stdoutSHA256']
assert sha(safe('r4-offline-verifier.stderr.txt').read_bytes())==r4control['stderrSHA256']
summary=read('curation-summary.json');assert summary['copiedOriginalFiles']==len(records)==165
assert summary['copiedOriginalBytes']==sum(r['originalBytes'] for r in records)
assert summary['storedCopiedBytes']==sum(r['storedBytes'] for r in records)
print(json.dumps({'status':'PASS_CURATED_HASHES_GZIP_ORIGINAL_BYTES_AND_SAVED_STATES','payloadFilesVerified':len(entries),'copiedOriginalsVerified':len(records),'gzipOriginalsVerified':sum(r['compression']=='gzip-mtime0' for r in records),'externalByteComparisons':externalCount,'originalBytes':summary['copiedOriginalBytes'],'storedCopiedBytes':summary['storedCopiedBytes'],'r4EvidencePayloads':28,'morphologyR2Payloads':37,'r3WrapperFailurePreserved':True,'morphologyR1RSSFailurePreserved':True,'newModelScannerTestBuildExecutions':0,'limits':'Saved bytes/state verification only; no raw-volume replay, new layout scanner, GPU, FPS or visual acceptance.'},indent=2))
