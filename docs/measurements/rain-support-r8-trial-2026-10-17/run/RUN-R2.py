import sys,os,json,hashlib,subprocess,time,signal
from pathlib import Path
H=Path(__file__).resolve().parent;R=H.parent/'candidate-source'
F=H/'SOURCE-FREEZE-R2.json';EXPECTED='428da0e97ab2635df4e5fa17594c44daff93b2d05fee2b35abcd3335d687c079'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def verify():
 assert sha(F)==EXPECTED
 for name,digest in json.loads(F.read_text()).items():assert sha(R/name)==digest,'Changed source '+name
 assert subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(R/'node_modules')],timeout=4).strip()==b'1'
step=sys.argv[1];commands={
 'typecheck':['/Users/enuzzo/.bun/bin/bun','run','typecheck'],
 'tests':['/Users/enuzzo/.bun/bin/bun','run','test','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+str(H/'tests-r2-result.json')],
 'app':['/Users/enuzzo/.bun/bin/bun','run','build'],
 'hero':['/Users/enuzzo/.bun/bin/bun','run','build:hero']}
assert step in commands;verify();receipt=H/(step+'-r2-execution.json');assert not receipt.exists(),'No automatic repeat'
started=time.monotonic();killed=False;error=None
with (H/(step+'-r2.log')).open('xb') as output:
 env=dict(os.environ,BUN_RUNTIME_TRANSPILER_CACHE_PATH=str(H/'transpiler-cache'),XDG_CACHE_HOME=str(H/'cache'))
 p=subprocess.Popen(commands[step],cwd=R,env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
 while True:
  pid,status,usage=os.wait4(p.pid,os.WNOHANG)
  if pid:p.returncode=os.waitstatus_to_exitcode(status);break
  if time.monotonic()-started>180:
   killed=True;os.killpg(p.pid,signal.SIGKILL);_,status,usage=os.wait4(p.pid,0);p.returncode=os.waitstatus_to_exitcode(status);break
  time.sleep(.05)
try:verify()
except BaseException as e:error=str(e)
r={'status':'PASS' if p.returncode==0 and not killed and error is None else 'FAIL','step':step,'command':commands[step],'exitCode':p.returncode,'wallSeconds':time.monotonic()-started,'wallLimitSeconds':180,'wallKilled':killed,'terminalObserved':True,'terminalProcessCPUSeconds':usage.ru_utime+usage.ru_stime,'terminalProcessPeakRSSBytes':usage.ru_maxrss,'resourceScope':'Darwin wait4 launched process, not simultaneous process-tree peak; no arbitrary per-model memory cutoff','sourceFreezeSHA256':EXPECTED,'runnerSHA256':sha(Path(__file__)),'logSHA256':sha(H/(step+'-r2.log')),'error':error}
receipt.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));raise SystemExit(0 if r['status']=='PASS' else 1)
