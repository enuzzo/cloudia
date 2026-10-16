from pathlib import Path
import subprocess,json,time,hashlib,sys,os,signal
q=Path(__file__).resolve().parent;source=q.parent/'diagnostic-source';records=[]
manifest=json.loads((q/'source-manifest.json').read_text())
assert all(hashlib.sha256((source/n).read_bytes()).hexdigest()==h for n,h in manifest.items())
assert subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(source/'node_modules')],text=True).strip()=='1'
for name,cmd in [('typecheck',['bun','x','tsc','--noEmit']),('app-build',['bun','run','build']),('hero-build',['bun','run','build:hero'])]:
 started=time.monotonic();timed_out=False
 with (q/(name+'.log')).open('w') as log:
  p=subprocess.Popen(cmd,cwd=source,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try: code=p.wait(timeout=60)
  except subprocess.TimeoutExpired:
   timed_out=True;os.killpg(p.pid,signal.SIGTERM)
   try: code=p.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);code=p.wait(timeout=5)
 records.append({'name':name,'command':cmd,'exitCode':code,'timedOut':timed_out,'terminalObservedByPopen':True,'elapsedSeconds':time.monotonic()-started})
 (q/'checks.json').write_text(json.dumps(records,indent=2)+'\n')
 if code or timed_out:sys.exit(code if code else 1)
assert all(hashlib.sha256((source/n).read_bytes()).hexdigest()==h for n,h in manifest.items())
assert subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(source/'node_modules')],text=True).strip()=='1'
dist={str(p.relative_to(source/'dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((source/'dist').rglob('*')) if p.is_file()}
(q/'dist-manifest.json').write_text(json.dumps(dist,indent=2)+'\n')
print(json.dumps({'commands':records,'sourceCount':len(manifest),'distCount':len(dist),'newFullVitestSuite':False,'shaderChangesFromR1':False}))
