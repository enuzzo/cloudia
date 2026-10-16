from pathlib import Path
import os,signal,resource,subprocess,selectors,time,json,datetime
here=Path(__file__).resolve().parent
source=here.parent/'anatomy-r3-v55-source'
output=here/'qa-approach-256.json'
logpath=here/'qa-approach-256.log'
assert not output.exists() and not logpath.exists(), 'Single run only; preserve previous evidence'
start=time.monotonic()
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(1080,1081))
with logpath.open('w',buffering=1) as log:
 def emit(s):
  print(s,flush=True);log.write(s+'\n')
 proc=subprocess.Popen(['bun',str(here/'audit-scripts/qa-approach.ts'),str(output)],cwd=source,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
 emit('START '+json.dumps({'pid':proc.pid,'wallBudgetSeconds':1200,'cpuBudgetSeconds':1080,'source':str(source),'script':str(here/'audit-scripts/qa-approach.ts'),'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
 sel=selectors.DefaultSelector();sel.register(proc.stdout,selectors.EVENT_READ)
 nextbeat=start+15;reason=None
 while True:
  for key,_ in sel.select(timeout=1):
   chunk=os.read(key.fileobj.fileno(),65536)
   if chunk:
    s=chunk.decode('utf-8',errors='replace');print(s,end='',flush=True);log.write(s)
   else:sel.unregister(key.fileobj)
  now=time.monotonic()
  if now>=nextbeat and proc.poll() is None:
   state=subprocess.run(['ps','-o','pid=,etime=,time=,rss=,pcpu=','-p',str(proc.pid)],text=True,capture_output=True).stdout.strip()
   emit('HEARTBEAT '+json.dumps({'elapsedSeconds':round(now-start,1),'psColumns':'pid elapsed cpuTime rssKiB percentCpu','process':state}))
   nextbeat=now+15
  if now-start>=1200 and proc.poll() is None:
   reason='wall budget exceeded; no automatic restart';os.killpg(proc.pid,signal.SIGTERM)
   try:proc.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
  if proc.poll() is not None and not sel.get_map():break
 code=proc.wait();usage=resource.getrusage(resource.RUSAGE_CHILDREN)
 result={'exitCode':code,'durationSeconds':time.monotonic()-start,'childUserCpuSeconds':usage.ru_utime,'childSystemCpuSeconds':usage.ru_stime,'maxRssPlatformUnits':usage.ru_maxrss,'outputExists':output.exists(),'reason':reason,'automaticRestarts':0}
 (here/'qa-run-control.json').write_text(json.dumps(result,indent=2)+'\n');emit('COMPLETE '+json.dumps(result))
 raise SystemExit(code if code>=0 else 128-code)
