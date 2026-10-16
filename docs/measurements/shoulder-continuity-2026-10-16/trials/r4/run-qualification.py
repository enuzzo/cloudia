from pathlib import Path
import subprocess,selectors,os,resource,signal,time,json
here=Path(__file__).resolve().parent
source=here.parent/'anatomy-r4-v55-source'
steps=[
 ('scanner',['bun','scripts/qa-layout.ts',str(here/'layout1024.json'),str(here/'references/baseline-layout.mjs'),str(here/'references/r3-layout.mjs')],60),
 ('typecheck',['bun','run','typecheck'],120),
 ('seven-tests',['bun','run','test','--','src/cumulonimbus/volume.layout-regression.test.ts','--reporter=json','--outputFile='+str(here/'seven-test-results.json')],180),
 ('branch-mutation',['bun',str(here/'mutation-check.ts')],60),
 ('full-tests',['bun','run','test','--','--reporter=json','--outputFile='+str(here/'full-test-results.json')],600),
 ('app-build',['bun','run','build'],180),
 ('hero-build',['bun','run','build:hero'],180),
]
results=[]
def scanner_limits():resource.setrlimit(resource.RLIMIT_CPU,(5,5))
for name,args,wall in steps:
 logpath=here/(name+'.log');assert not logpath.exists(),'Preserve existing execution evidence'
 started=time.monotonic()
 with logpath.open('w',buffering=1) as log:
  def emit(line):print(line,flush=True);log.write(line+'\n')
  proc=subprocess.Popen(args,cwd=source,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=scanner_limits if name=='scanner' else None)
  emit('START '+json.dumps({'name':name,'pid':proc.pid,'command':args,'kernelCpuSeconds':5 if name=='scanner' else None,'wallLimitSeconds':wall}))
  sel=selectors.DefaultSelector();sel.register(proc.stdout,selectors.EVENT_READ);nextbeat=started+15;timedout=False
  while True:
   for key,_ in sel.select(timeout=1):
    chunk=os.read(key.fileobj.fileno(),65536)
    if chunk:
     text=chunk.decode('utf-8',errors='replace');print(text,end='',flush=True);log.write(text)
    else:sel.unregister(key.fileobj)
   now=time.monotonic()
   if now>=nextbeat and proc.poll() is None:emit('HEARTBEAT '+json.dumps({'name':name,'pid':proc.pid,'elapsedSeconds':round(now-started,1)}));nextbeat=now+15
   if now-started>=wall and proc.poll() is None:
    timedout=True;os.killpg(proc.pid,signal.SIGTERM)
    try:proc.wait(timeout=3)
    except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
   if proc.poll() is not None and not sel.get_map():break
  code=proc.wait()
  item={'name':name,'command':args,'exitCode':code,'durationSeconds':time.monotonic()-started,'wallTimedOut':timedout,'kernelCpuSeconds':5 if name=='scanner' else None}
  if code==0:
   try:
    if name=='scanner':
     r=json.loads((here/'layout1024.json').read_text());assert r['status']=='PASS_LAYOUT_CONTRACTS' and r['checked']==1024
     c=r['counts'];assert (c['inwardR3Exact'],c['outwardBaselineExact'],c['nonShearedBaselineExact'],c['baselineBeforeJointExact'])==(323,18,683,1024)
    if name in ['seven-tests','full-tests']:
     r=json.loads((here/('seven-test-results.json' if name=='seven-tests' else 'full-test-results.json')).read_text());expected=(7,1) if name=='seven-tests' else (348,44)
     assert r['success'] and r['numPassedTests']==r['numTotalTests']==expected[0] and r['numFailedTests']==0 and len(r['testResults'])==expected[1]
   except Exception as error:item['validationFailure']=str(error) or type(error).__name__;code=1
  results.append(item);(here/'checks.json').write_text(json.dumps(results,indent=2)+'\n');emit('COMPLETE '+json.dumps(item))
  if code:raise SystemExit(code if code>0 else 128-code)
