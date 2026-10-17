import os,sys,json,hashlib,subprocess,time,signal,resource
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent/'candidate-source'
FREEZE=HERE/'SOURCE-FREEZE-R1.json'
EXPECTED='ae6369636efc203ced8d0ad4afed74d95b805e77abff5619ca46cc59b2295ecb'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def verify():
 assert digest(FREEZE)==EXPECTED,'Changed source freeze'
 for name,sha in json.loads(FREEZE.read_text()).items():assert digest(ROOT/name)==sha,'Changed source '+name
 assert subprocess.check_output(['/usr/bin/xattr','-p','com.apple.fileprovider.ignore#P',str(ROOT/'node_modules')],timeout=4).strip()==b'1','Dropbox ignore missing'
step=sys.argv[1]
commands={
 'tests':['/Users/enuzzo/.bun/bin/bun','run','test','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+str(HERE/'tests-result.json')],
 'build-app':['/Users/enuzzo/.bun/bin/bun','run','build'],
 'build-hero':['/Users/enuzzo/.bun/bin/bun','run','build:hero'],
 'prefix':['/Users/enuzzo/.bun/bin/bun','--no-install','run',str(HERE.parent/'review/attachment-prefix-witness.ts')]
}
assert step in commands
verify();start=time.monotonic();code=None;usage=None;killed=False;error=None
log=HERE/(step+'.log');receipt=HERE/(step+'-execution.json')
assert not receipt.exists(),'No automatic repeat'
env=dict(os.environ,BUN_RUNTIME_TRANSPILER_CACHE_PATH=str(HERE/'transpiler-cache'),XDG_CACHE_HOME=str(HERE/'cache'))
wallLimit=30 if step=='prefix' else 180
def limits():
 if step=='prefix':resource.setrlimit(resource.RLIMIT_CPU,(20,20))
with log.open('xb') as stream:
 p=subprocess.Popen(commands[step],cwd=ROOT,env=env,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
 while True:
  pid,status,ru=os.wait4(p.pid,os.WNOHANG)
  if pid:usage=ru;code=os.waitstatus_to_exitcode(status);p.returncode=code;break
  if time.monotonic()-start>wallLimit:
   killed=True;os.killpg(p.pid,signal.SIGKILL);_,status,usage=os.wait4(p.pid,0);code=os.waitstatus_to_exitcode(status);p.returncode=code;break
  time.sleep(.05)
try:
 verify()
 if step=='prefix' and (usage.ru_utime+usage.ru_stime>20 or usage.ru_maxrss>402653184):raise RuntimeError('Prefix CPU/RSS budget exceeded')
except BaseException as exc:error=str(exc)
row=dict(step=step,status='PASS' if code==0 and not killed and error is None else 'FAIL',command=commands[step],sourceFreezeSHA256=EXPECTED,exitCode=code,wallKilled=killed,wallLimitSeconds=wallLimit,wallSeconds=time.monotonic()-start,error=error,terminalObserved=usage is not None,terminalProcessCPUSeconds=usage.ru_utime+usage.ru_stime,terminalProcessPeakRSSBytes=usage.ru_maxrss,resourceScope='Darwin wait4 actual launched process, no claim of simultaneous process-tree peak',logSHA256=digest(log))
receipt.write_text(json.dumps(row,indent=2)+'\n');print(json.dumps(row));raise SystemExit(0 if row['status']=='PASS' else 1)
