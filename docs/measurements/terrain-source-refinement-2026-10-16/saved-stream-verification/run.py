from pathlib import Path
import subprocess,sys,resource,time,signal,os,json,hashlib
P=Path(__file__).resolve().parent
assert not any((P/n).exists() for n in ['result.json','stderr.log','run.json']),'Unique verification output already exists'
def limit():resource.setrlimit(resource.RLIMIT_CPU,(20,20))
start=time.monotonic();killed=False
with (P/'result.json').open('xb') as out,(P/'stderr.log').open('xb') as err:
 proc=subprocess.Popen([sys.executable,str(P/'verify.py')],cwd=P,stdout=out,stderr=err,preexec_fn=limit,start_new_session=True)
 while proc.poll() is None:
  if time.monotonic()-start>40:killed=True;os.killpg(proc.pid,signal.SIGKILL);break
  time.sleep(.02)
 code=proc.wait()
r=resource.getrusage(resource.RUSAGE_CHILDREN)
record={'exitCode':code,'terminalObserved':True,'wallKilled':killed,'wallSeconds':time.monotonic()-start,'CPUSeconds':r.ru_utime+r.ru_stime,'peakRSSBytes':r.ru_maxrss,'CPUHardLimitSeconds':20,'wallLimitSeconds':40,'terminalPeakRSSGateBytes':2147483648,'scope':'Saved-stream Python verification only; no model/mesh/query/Bun/test/GPU','RSSScope':'Darwin terminal getrusage bytes; no AS/RSS limit'}
record['pass']=code==0 and not killed and record['CPUSeconds']<=20 and record['peakRSSBytes']<=2147483648
record['stdoutSHA256']=hashlib.sha256((P/'result.json').read_bytes()).hexdigest();record['stderrSHA256']=hashlib.sha256((P/'stderr.log').read_bytes()).hexdigest()
(P/'run.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));raise SystemExit(0 if record['pass'] else 1)
