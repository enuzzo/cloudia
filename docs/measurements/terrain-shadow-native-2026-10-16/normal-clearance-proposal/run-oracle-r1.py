from pathlib import Path
import subprocess,resource,time,json,hashlib,os,signal
P=Path(__file__).resolve().parent
BUN=Path('/Users/enuzzo/.bun/bin/bun')
# Hard CPU limit; wall supervision kills the whole new process group if needed.
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(5,5))
 resource.setrlimit(resource.RLIMIT_RSS,(2*1024**3,2*1024**3))
start=time.monotonic()
with (P/'cpu.stdout.json').open('wb') as out,(P/'cpu.stderr.log').open('wb') as err:
 proc=subprocess.Popen([str(BUN),str(P/'cpu-oracle.ts')],cwd=P,stdout=out,stderr=err,preexec_fn=limits,start_new_session=True)
 wallKilled=False
 while proc.poll() is None:
  if time.monotonic()-start>15:
   wallKilled=True;os.killpg(proc.pid,signal.SIGKILL);break
  time.sleep(.02)
 code=proc.wait()
r=resource.getrusage(resource.RUSAGE_CHILDREN)
# macOS reports ru_maxrss in bytes; RLIMIT_RSS is advisory, so report observed peak too.
summary={'exitCode':code,'wallSeconds':time.monotonic()-start,'cpuSeconds':r.ru_utime+r.ru_stime,'peakRSSBytes':r.ru_maxrss,'rssLimitBytes':2*1024**3,'rssEnforcement':'OS RLIMIT_RSS requested (advisory on macOS); observed terminal rusage checked','wallKilled':wallKilled}
summary['budgetPASS']=summary['cpuSeconds']<=5 and r.ru_maxrss<=2*1024**3 and not wallKilled
summary['pass']=code==0 and summary['budgetPASS']
(P/'cpu-run.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary))
raise SystemExit(0 if summary['pass'] else 1)
