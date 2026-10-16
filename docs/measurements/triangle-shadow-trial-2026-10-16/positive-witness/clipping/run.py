from pathlib import Path
import subprocess,resource,time,json,os,signal,sys,hashlib
P=Path(__file__).resolve().parent
assert not (P/'result.json').exists() and not (P/'run.json').exists(),'Unique offline calculation already has output'
freeze=json.loads((P/'PRE-RUN-FREEZE.json').read_text())
for row in freeze['inputs']:
 raw=Path(row['path']).read_bytes();assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'],row['path']
def limits():resource.setrlimit(resource.RLIMIT_CPU,(1,1))
start=time.monotonic();code=None;launched=False;killed=False;error=None
with (P/'result.json').open('wb') as out,(P/'stderr.log').open('wb') as err:
 try:
  proc=subprocess.Popen([sys.executable,str(P/'analyse.py')],cwd=P,stdout=out,stderr=err,preexec_fn=limits,start_new_session=True);launched=True
  while proc.poll() is None:
   if time.monotonic()-start>5:killed=True;os.killpg(proc.pid,signal.SIGKILL);break
   time.sleep(.01)
  code=proc.wait()
 except Exception as exc:error=f'{type(exc).__name__}: {exc}'
r=resource.getrusage(resource.RUSAGE_CHILDREN)
record={'launched':launched,'exitCode':code,'wallSeconds':time.monotonic()-start,'cpuSeconds':r.ru_utime+r.ru_stime,'peakRSSBytes':r.ru_maxrss,'wallKilled':killed,'error':error,'CPUHardLimitSeconds':1,'wallLimitSeconds':5,'peakRSSGateBytes':2147483648,'RSSScope':'macOS terminal getrusage; no AS/RSS setrlimit or ps'}
record['pass']=launched and code==0 and not killed and record['cpuSeconds']<=1 and r.ru_maxrss<=2147483648
if record['pass']:
 try:assert len(json.loads((P/'result.json').read_text())['rows'])==12
 except Exception as exc:record['pass']=False;record['resultValidationError']=str(exc)
(P/'run.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));raise SystemExit(0 if record['pass'] else 1)
