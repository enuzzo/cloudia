from pathlib import Path
import subprocess,json,time,hashlib,datetime
here=Path(__file__).resolve().parent;source=here/'candidate-source'
node='/Users/enuzzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
freeze={'frozenUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'node':node,'scripts':{p.name:sha(p) for p in [here/'check-layout.cjs',Path(__file__)]},'sourceManifestSHA256':sha(here/'candidate-source-manifest.json')}
assert not (here/'check-freeze.json').exists();(here/'check-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n')
steps=[('layout-prefix',[node,str(here/'check-layout.cjs')]),('typecheck',[node,'node_modules/typescript/bin/tsc','--noEmit']),('targeted-tests',[node,'node_modules/vitest/vitest.mjs','run','src/cumulonimbus/volume.test.ts','src/cumulonimbus/inclinedShoulder.test.ts','--reporter=json','--outputFile='+str(here/'targeted-test-results.json')]),('app-build',[node,'node_modules/vite/bin/vite.js','build','--outDir',str(here/'dist'),'--emptyOutDir']),('hero-build',[node,'node_modules/vite/bin/vite.js','build','--config','vite.hero.config.ts','--outDir',str(here/'hero-dist'),'--emptyOutDir'])]
results=[]
for name,args in steps:
 logpath=here/(name+'.log');assert not logpath.exists();print('START '+name,flush=True);start=time.monotonic()
 with logpath.open('w',buffering=1) as log:
  proc=subprocess.Popen(args,cwd=source,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
  for line in proc.stdout:log.write(line);print(line,end='',flush=True)
  code=proc.wait()
 item={'name':name,'command':args,'exitCode':code,'durationSeconds':time.monotonic()-start,'log':logpath.name};results.append(item)
 (here/'checks.json').write_text(json.dumps(results,indent=2)+'\n');print('COMPLETE '+json.dumps(item),flush=True)
 if code:raise SystemExit(code)
assert {r:sha(source/r) for r in json.loads((here/'candidate-source-manifest.json').read_text())}==json.loads((here/'candidate-source-manifest.json').read_text())
