from pathlib import Path
import hashlib,json,datetime,subprocess
here=Path(__file__).resolve().parent;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=here/'candidate-source';m=json.loads((here/'candidate-source-manifest.json').read_text());assert len(m)==119
assert all(sha(source/r)==v for r,v in m.items())
checks=json.loads((here/'checks.json').read_text());assert len(checks)==5 and all(x['exitCode']==0 for x in checks)
test=json.loads((here/'targeted-test-results.json').read_text());assert test['numPassedTests']==31 and test['numFailedTests']==0
for dirname,manifest in [('dist','dist-manifest.json'),('hero-dist','hero-dist-manifest.json')]:
 entries={str(p.relative_to(here/dirname)):sha(p) for p in sorted((here/dirname).rglob('*')) if p.is_file()};assert entries
 (here/manifest).write_text(json.dumps(entries,indent=2)+'\n')
ignore=subprocess.run(['xattr','-p','com.apple.fileprovider.ignore#P',str(source/'node_modules')],capture_output=True,text=True);assert ignore.returncode==0 and ignore.stdout.strip()=='1'
summary={'status':'EXTERNAL R5 R1 FROZEN, NOT ADOPTED','sourceFiles':119,'sourceManifestSHA256':sha(here/'candidate-source-manifest.json'),'volumeSHA256':m['src/cumulonimbus/volume.ts'],'distManifestSHA256':sha(here/'dist-manifest.json'),'heroDistManifestSHA256':sha(here/'hero-dist-manifest.json'),'nodeModulesIgnoredBeforeAndAfter':True,'tests':31,'typecheck':'PASS','appBuild':'PASS','heroBuild':'PASS','namedPrefixes':9,'layout':'full X/Z recenter only; body always A','limitation':'superseded experimental alternative R2 will remove only inward component; R1 preserved unchanged; no browser/GPU/image/FPS acceptance'}
(here/'freeze-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
entries={p.name:{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(here.iterdir()) if p.is_file() and p.name!='MANIFEST.json'}
(here/'MANIFEST.json').write_text(json.dumps({'schema':'R5-R1-external-archive-v1','frozenUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':entries},indent=2)+'\n')
print(json.dumps(summary,indent=2));print('MANIFEST SHA '+sha(here/'MANIFEST.json'))
