from pathlib import Path
import subprocess,resource,time,json,os,signal,traceback
P=Path(__file__).resolve().parent
outpath=P/'result.json';errpath=P/'stderr.log'
def limits():resource.setrlimit(resource.RLIMIT_CPU,(20,20))
start=time.monotonic();code=None;launched=False;wallKilled=False;error=None
with outpath.open('wb') as out,errpath.open('wb') as err:
 try:
  proc=subprocess.Popen(['/Users/enuzzo/.bun/bin/bun',str(P/'witness.ts')],cwd=P,stdout=out,stderr=err,preexec_fn=limits,start_new_session=True)
  launched=True
  while proc.poll() is None:
   if time.monotonic()-start>40:
    wallKilled=True;os.killpg(proc.pid,signal.SIGKILL);break
   time.sleep(.02)
  code=proc.wait()
 except Exception as exc:
  error=f'{type(exc).__name__}: {exc}'
  (P/'launcher-error.log').write_text(traceback.format_exc())
r=resource.getrusage(resource.RUSAGE_CHILDREN)
record={'phase':'kernel' if launched else 'launcher-before-exec','launched':launched,'exitCode':code,'wallSeconds':time.monotonic()-start,'cpuSeconds':r.ru_utime+r.ru_stime,'peakRSSBytes':r.ru_maxrss,'wallKilled':wallKilled,'error':error,'CPUHardLimitSeconds':20,'wallLimitSeconds':40,'peakRSSGateBytes':2147483648,'RSSScope':'macOS terminal getrusage peak gate; no RSS setrlimit or virtual address-space limit; no ps','terminalObserved':launched}
record['budgetPASS']=launched and r.ru_utime+r.ru_stime<=20 and r.ru_maxrss<=2147483648 and not wallKilled
record['pass']=code==0 and record['budgetPASS']
if record['pass']:
 try:
  result=json.loads(outpath.read_text());assert len(result['rows'])==6 and result['raycasts']==18
  record['resultStatus']=result['status'];record['rows']=6
 except Exception as exc:
  record['pass']=False;record['resultValidationError']=str(exc)
(P/'run.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record))
raise SystemExit(0 if record['pass'] else 1)
