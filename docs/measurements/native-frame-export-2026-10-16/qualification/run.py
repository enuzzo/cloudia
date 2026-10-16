import pathlib,json,subprocess,time,hashlib,os
qa=pathlib.Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle24');root=qa/'native-export-source';out=qa/'qualification'
m=json.loads((out/'source-manifest.json').read_text());live=pathlib.Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
for f,s in m.items():
 assert hashlib.sha256((root/f).read_bytes()).hexdigest()==s,f
 assert hashlib.sha256((live/f).read_bytes()).hexdigest()==s,f
assert subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(root/'node_modules')]).decode().strip()=='1'
checks=[]
commands=[('typecheck',['bun','run','typecheck'],120),('full-tests',['bun','run','test','--','--reporter=json','--outputFile='+str(out/'test-results.json')],600),('app-build',['bun','run','build'],180),('hero-build',['bun','run','build:hero'],180)]
for name,cmd,limit in commands:
 start=time.monotonic();last=start
 with (out/(name+'.log')).open('wb') as log:
  child=subprocess.Popen(cmd,cwd=root,stdout=log,stderr=subprocess.STDOUT)
  print(json.dumps({'event':'START','name':name,'pid':child.pid}),flush=True)
  while child.poll() is None:
   now=time.monotonic()
   if now-start>limit:
    child.terminate()
    try:child.wait(timeout=5)
    except subprocess.TimeoutExpired:child.kill();child.wait()
    break
   if now-last>=15:print(json.dumps({'event':'LIVE','name':name,'elapsedSeconds':now-start}),flush=True);last=now
   time.sleep(.1)
  result={'name':name,'command':cmd,'exitCode':child.returncode,'terminalObservedByPopen':True,'elapsedSeconds':time.monotonic()-start,'wallTimedOut':time.monotonic()-start>limit}
 checks.append(result);(out/'checks.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(result),flush=True)
 if child.returncode!=0:raise SystemExit('STOP after failed '+name)
for f,s in m.items():
 assert hashlib.sha256((root/f).read_bytes()).hexdigest()==s,f
 assert hashlib.sha256((live/f).read_bytes()).hexdigest()==s,f
dist={str(f.relative_to(root/'dist')):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted((root/'dist').rglob('*')) if f.is_file()}
(out/'dist-manifest.json').write_text(json.dumps(dist,indent=2)+'\n')
r=json.loads((out/'test-results.json').read_text());print(json.dumps({'event':'PASS','sourceFiles':len(m),'tests':r['numPassedTests'],'testFiles':len(r['testResults']),'success':r['success'],'distFiles':len(dist),'dependencyIgnoreAttribute':subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(root/'node_modules')]).decode().strip()}),flush=True)
