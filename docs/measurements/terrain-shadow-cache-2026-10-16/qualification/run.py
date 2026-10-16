from pathlib import Path
import subprocess,json,time,hashlib,sys
q=Path(__file__).resolve().parent;b=q.parent;source=b/'cache-source';records=[]
assert subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(source/'node_modules')],text=True).strip()=='1'
for name,cmd in [('full-tests',['bun','run','test','--','--reporter=json','--outputFile='+str(q/'test-results.json')]),('app-build',['bun','run','build']),('hero-build',['bun','run','build:hero'])]:
 started=time.monotonic()
 with (q/(name+'.log')).open('w') as log:
  p=subprocess.Popen(cmd,cwd=source,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);code=p.wait(timeout=60)
 records.append({'name':name,'command':cmd,'exitCode':code,'terminalObservedByPopen':True,'elapsedSeconds':time.monotonic()-started});(q/'checks.json').write_text(json.dumps(records,indent=2)+'\n')
 if code:sys.exit(code)
m=json.loads((q/'source-manifest.json').read_text());assert all(hashlib.sha256((source/n).read_bytes()).hexdigest()==h for n,h in m.items())
d={str(p.relative_to(source/'dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((source/'dist').rglob('*')) if p.is_file()};(q/'dist-manifest.json').write_text(json.dumps(d,indent=2)+'\n')
t=json.loads((q/'test-results.json').read_text());assert t['success'] and t['numPassedTests']==t['numTotalTests']==399
print(json.dumps({'commands':records,'testsPassed':t['numPassedTests'],'testFiles':len(t['testResults']),'sourceCount':len(m),'distCount':len(d)}))
