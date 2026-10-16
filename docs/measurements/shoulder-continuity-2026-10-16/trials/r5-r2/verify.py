from pathlib import Path
import hashlib,json,sys
here=Path(__file__).resolve().parent;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((here/'MANIFEST.json').read_text());count=0
for rel,info in manifest['files'].items():
 p=here/rel;assert p.stat().st_size==info['bytes'] and sha(p)==info['sha256'],rel;count+=1
source=json.loads((here/'candidate-source-manifest.json').read_text());assert len(source)==119
assert all(sha(here/'candidate-source'/r)==digest for r,digest in source.items())
for dirname,name in [('dist','dist-manifest.json'),('hero-dist','hero-dist-manifest.json')]:
 m=json.loads((here/name).read_text());actual={str(p.relative_to(here/dirname)):sha(p) for p in (here/dirname).rglob('*') if p.is_file()};assert m==actual,name
checks=json.loads((here/'checks.json').read_text());assert len(checks)==5 and all(c['exitCode']==0 for c in checks)
tests=json.loads((here/'targeted-test-results.json').read_text());assert tests['numPassedTests']==31 and tests['numFailedTests']==0
report=json.loads((here/'expected-report.json').read_text());extra=json.loads((here/'expected-926.json').read_text());assert report['status']==extra['status']=='PASS';assert len(report['rows'])==7 and len(extra['rows'])==1
assert all(row['body91ExactA'] and row['rngExactA'] for row in report['rows']+extra['rows'])
r1=here.parent/'anatomy-r5-recenter';assert sha(r1/'MANIFEST.json')==json.loads((here/'PROTOCOL.json').read_text())['parentR1ManifestSHA256']
for rel,info in json.loads((r1/'MANIFEST.json').read_text())['files'].items():assert sha(r1/rel)==info['sha256'] and (r1/rel).stat().st_size==info['bytes'],rel
result={'status':'PASS','payloadFiles':count,'sourceFiles':119,'checks':'31 focused + tsc + app/hero recorded PASS; all119source and both dist manifests rehashed; R1 archive preserved','scope':'archive/data verification only; no generator, new scanner, browser or GPU executed'}
print(json.dumps(result,indent=2))
