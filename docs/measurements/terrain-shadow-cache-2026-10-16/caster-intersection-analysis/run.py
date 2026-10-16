from pathlib import Path
import subprocess,resource,time,json,os,signal,traceback,sys
P=Path(__file__).resolve().parent
start=time.monotonic();code=None;launched=False;wallKilled=False;error=None
def limit():resource.setrlimit(resource.RLIMIT_CPU,(1,1))
with (P/'result.json').open('wb') as out,(P/'stderr.log').open('wb') as err:
 try:
  proc=subprocess.Popen([sys.executable,str(P/'analyse.py')],cwd=P,stdout=out,stderr=err,preexec_fn=limit,start_new_session=True);launched=True
  while proc.poll() is None:
   if time.monotonic()-start>5:wallKilled=True;os.killpg(proc.pid,signal.SIGKILL);break
   time.sleep(.005)
  code=proc.wait()
 except Exception as exc:
  error=f'{type(exc).__name__}: {exc}';(P/'launcher-error.log').write_text(traceback.format_exc())
r=resource.getrusage(resource.RUSAGE_CHILDREN)
summary={'exitCode':code,'phase':'kernel' if launched else 'launcher-before-exec','launched':launched,'CPUSeconds':r.ru_utime+r.ru_stime,'wallSeconds':time.monotonic()-start,'peakRSSBytes':r.ru_maxrss,'CPUHardSeconds':1,'wallBudgetSeconds':5,'RSSGateBytes':2147483648,'wallKilled':wallKilled,'error':error,'RSSScope':'Terminal getrusage; no RSS/AS setrlimit; no ps'}
summary['budgetPASS']=launched and summary['CPUSeconds']<1 and not wallKilled and r.ru_maxrss<=2147483648
summary['pass']=code==0 and summary['budgetPASS']
if summary['pass']:
 try:assert len(json.loads((P/'result.json').read_text())['rows'])==6
 except Exception as exc:summary['pass']=False;summary['outputValidationError']=str(exc)
(P/'run.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary));raise SystemExit(0 if summary['pass'] else 1)
