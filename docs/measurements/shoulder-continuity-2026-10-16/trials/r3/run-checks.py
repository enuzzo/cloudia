from pathlib import Path
import subprocess,json,time,datetime
here=Path(__file__).resolve().parent
source=here.parent/'anatomy-r3-v55-source'
steps=[('typecheck',['bun','run','typecheck']),('targeted-tests',['bun','run','test','--','src/cumulonimbus/volume.test.ts','src/cumulonimbus/inclinedShoulder.test.ts','--reporter=json','--outputFile='+str(here/'targeted-test-results.json')]),('app-build',['bun','run','build']),('hero-build',['bun','run','build:hero'])]
results=[]
for name,args in steps:
 logpath=here/(name+'.log')
 assert not logpath.exists(),'Do not overwrite prior execution log: '+str(logpath)
 print('START '+name+' '+json.dumps(args),flush=True);start=time.monotonic()
 with logpath.open('w',buffering=1) as log:
  proc=subprocess.Popen(args,cwd=source,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
  for line in proc.stdout:
   log.write(line);print(line,end='',flush=True)
  code=proc.wait()
 item={'name':name,'command':args,'exitCode':code,'durationSeconds':time.monotonic()-start,'log':logpath.name};results.append(item)
 (here/'checks.json').write_text(json.dumps(results,indent=2)+'\n');print('COMPLETE '+json.dumps(item),flush=True)
 if code:raise SystemExit(code)
