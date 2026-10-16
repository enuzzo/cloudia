from pathlib import Path
import subprocess,selectors,os,signal,time,json,hashlib
here=Path(__file__).resolve().parent
source=here.parent/'interior05-source'
expected=json.loads((here/'source-manifest.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for rel,h in expected.items():assert sha(source/rel)==h,rel
steps=[
 ('typecheck',['bun','run','typecheck'],120),
 ('targeted-tests',['bun','run','test','--','src/cumulonimbus/volume.test.ts','src/cumulonimbus/inclinedShoulder.test.ts','--reporter=json','--outputFile='+str(here/'targeted-test-results.json')],600),
 ('app-build',['bun','run','build'],180),
 ('hero-build',['bun','run','build:hero'],180),
]
results=[]
for name,args,limit in steps:
 logfile=here/(name+'.log');assert not logfile.exists(),'Preserve original execution evidence'
 started=time.monotonic()
 with logfile.open('w',buffering=1) as log:
  def emit(value):print(value,flush=True);log.write(value+'\n')
  proc=subprocess.Popen(args,cwd=source,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
  emit('START '+json.dumps({'name':name,'pid':proc.pid,'command':args,'wallLimitSeconds':limit}))
  sel=selectors.DefaultSelector();sel.register(proc.stdout,selectors.EVENT_READ);nextbeat=started+15;timedout=False
  while True:
   for key,_ in sel.select(timeout=1):
    chunk=os.read(key.fileobj.fileno(),65536)
    if chunk:
     value=chunk.decode('utf-8',errors='replace');print(value,end='',flush=True);log.write(value)
    else:sel.unregister(key.fileobj)
   now=time.monotonic()
   if now>=nextbeat and proc.poll() is None:
    emit('HEARTBEAT '+json.dumps({'name':name,'pid':proc.pid,'elapsedSeconds':round(now-started,1)}));nextbeat=now+15
   if now-started>=limit and proc.poll() is None:
    timedout=True;os.killpg(proc.pid,signal.SIGTERM)
    try:proc.wait(timeout=3)
    except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
   if proc.poll() is not None and not sel.get_map():break
  item={'name':name,'command':args,'exitCode':proc.wait(),'elapsedSeconds':time.monotonic()-started,'wallTimedOut':timedout}
  if name=='targeted-tests' and (here/'targeted-test-results.json').exists():
   data=json.loads((here/'targeted-test-results.json').read_text())
   item['tests']={k:data[k] for k in ['numTotalTests','numPassedTests','numFailedTests','success']};item['tests']['testFiles']=len(data['testResults'])
   item['failures']=[{'file':x['name'],'fullName':a['fullName'],'failureMessages':a['failureMessages']} for x in data['testResults'] for a in x['assertionResults'] if a['status']=='failed']
  results.append(item);(here/'checks.json').write_text(json.dumps(results,indent=2)+'\n');emit('COMPLETE '+json.dumps(item))
  # Preserve failed test evidence without altering the model; application output may still be reviewed.
  if item['exitCode'] and name!='targeted-tests':raise SystemExit(1)
for rel,h in expected.items():assert sha(source/rel)==h,rel
print('SOURCE_FREEZE_VERIFIED',flush=True)
raise SystemExit(1 if any(x['exitCode'] for x in results) else 0)
