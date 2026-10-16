from pathlib import Path
import subprocess,json,time,sys
base=Path(__file__).resolve().parent;source=base/'normal-clearance-source';results=[]
for name,cmd in [('typecheck',['bun','run','typecheck']),('app-build',['bun','run','build']),('hero-build',['bun','run','build:hero'])]:
 started=time.monotonic()
 with (base/('normal-'+name+'.log')).open('w') as log:
  process=subprocess.Popen(cmd,cwd=source,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);status=process.wait(timeout=60)
 results.append({'name':name,'command':cmd,'exitCode':status,'terminalObservedByPopen':True,'elapsedSeconds':time.monotonic()-started})
 (base/'normal-checks.json').write_text(json.dumps(results,indent=2)+'\n')
 if status:sys.exit(status)
print(json.dumps({'commands':results,'noTestRun':True}))
