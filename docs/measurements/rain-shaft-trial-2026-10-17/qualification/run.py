from pathlib import Path
import subprocess,json,time,hashlib,sys,os,signal

q=Path(__file__).resolve().parent
source=q.parent/'rain-source'
records=[]
manifest=json.loads((q/'source-manifest.json').read_text())
assert not (q/'checks.json').exists(),'Qualification attempt already consumed'
def source_check():
 assert all(hashlib.sha256((source/n).read_bytes()).hexdigest()==h for n,h in manifest.items())
def protected():
 assert subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(source/'node_modules')],text=True).strip()=='1'
source_check();protected()
commands=[
 ('targeted-tests',['bun','run','test','--','src/cumulonimbus/rainSheetFactor.test.ts','src/cumulonimbus/cloudShader.test.ts','--reporter=json','--outputFile='+str(q/'targeted-results.json')]),
 ('full-tests',['bun','run','test','--','--reporter=json','--outputFile='+str(q/'test-results.json')]),
 ('app-build',['bun','run','build']),
 ('hero-build',['bun','run','build:hero']),
]
for name,cmd in commands:
 started=time.monotonic();timed_out=False
 with (q/(name+'.log')).open('x') as log:
  p=subprocess.Popen(cmd,cwd=source,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=p.wait(timeout=45)
  except subprocess.TimeoutExpired:
   timed_out=True;os.killpg(p.pid,signal.SIGKILL);code=p.wait()
 records.append({'name':name,'command':cmd,'exitCode':code,'timedOut':timed_out,'terminalObservedByPopen':True,'elapsedSeconds':time.monotonic()-started})
 (q/'checks.json').write_text(json.dumps(records,indent=2)+'\n')
 print(json.dumps(records[-1]),flush=True)
 if code or timed_out:sys.exit(code if code else 1)
source_check();protected()
dist={str(p.relative_to(source/'dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((source/'dist').rglob('*')) if p.is_file()}
(q/'dist-manifest.json').write_text(json.dumps(dist,indent=2)+'\n')
tests=json.loads((q/'test-results.json').read_text())
assert tests['success'] and tests['numPassedTests']==tests['numTotalTests']==439 and len(tests['testResults'])==47
print(json.dumps({'status':'PASS','testsPassed':439,'testFiles':47,'sourceCount':len(manifest),'distCount':len(dist)}),flush=True)
