import hashlib,json,subprocess,time
from pathlib import Path
root=Path(__file__).parent
source=root/'crease-source'
qualification=root/'crease-qualification'
base=json.loads((root/'base-manifest.json').read_text())
paths=sorted(set(base)|{str(p.relative_to(source)) for p in (source/'src').rglob('*') if p.is_file()})
manifest={p:hashlib.sha256((source/p).read_bytes()).hexdigest() for p in paths}
(root/'crease-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
commands=[['node_modules/.bin/vitest','run','src/cumulonimbus/terrainCreaseNormals.test.ts','src/cumulonimbus/terrainMesh.test.ts','src/cumulonimbus/lifecycle.test.ts','--reporter=dot'],['node_modules/.bin/vitest','run','--reporter=dot'],['npm','run','build'],['npm','run','build:hero']]
results=[]
for i,command in enumerate(commands,1):
 start=time.monotonic()
 with (qualification/f'{i}.log').open('wb') as log:
  result=subprocess.run(command,cwd=source,stdout=log,stderr=subprocess.STDOUT,timeout=90)
 results.append({'command':command,'exitCode':result.returncode,'wallSeconds':time.monotonic()-start,'log':str(qualification/f'{i}.log')})
 (qualification/'results.json').write_text(json.dumps(results,indent=2)+'\n')
 print(i,result.returncode,round(results[-1]['wallSeconds'],3),flush=True)
 if result.returncode:break
assert all(hashlib.sha256((source/p).read_bytes()).hexdigest()==h for p,h in manifest.items()),'Source changed during qualification'
print('sourceFiles',len(manifest),'manifestSHA256',hashlib.sha256((root/'crease-manifest.json').read_bytes()).hexdigest(),flush=True)
