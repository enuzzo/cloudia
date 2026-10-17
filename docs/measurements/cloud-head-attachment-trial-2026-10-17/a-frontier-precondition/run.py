"""Explicit A isolation repair: four sequential cases, same aggregate budget; no retry."""
import argparse,hashlib,json,os,platform,resource,signal,subprocess,sys,time,traceback
from pathlib import Path
H=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main():
 startedAll=time.monotonic()
 parser=argparse.ArgumentParser();parser.add_argument('--execute-authorized',action='store_true',required=True);parser.add_argument('--freeze-sha256',required=True);args=parser.parse_args()
 if sys.platform!='darwin' or platform.machine()!='arm64':raise RuntimeError('Darwin arm64 required')
 fp=H/'PRE-RUN-FREEZE.json';f=json.loads(fp.read_text())
 def verify():
  if sha(fp)!=args.freeze_sha256 or f['state']!='FROZEN_NOT_EXECUTED':raise RuntimeError('Freeze differs')
  for row in f['inputs']:
   p=Path(row['path'])
   if p.stat().st_size!=row['bytes'] or sha(p)!=row['sha256']:raise RuntimeError('Changed input '+str(p))
  if subprocess.check_output(['/usr/bin/xattr','-p','com.apple.fileprovider.ignore#P',f['dependencyRoot']],timeout=3).strip()!=b'1':raise RuntimeError('Dependency ignore differs')
 verify();out=H/'run';out.mkdir(exist_ok=False);records=[];cases=[];totalCPU=0
 for seed in f['seeds']:
  d=out/str(seed);d.mkdir();p=None;usage=None;code=None;killed=False;error=None;wall=None
  try:
   verify()
   if totalCPU>20 or time.monotonic()-startedAll>=40:raise RuntimeError('Same aggregate budget exhausted before next case')
   def limits():resource.setrlimit(resource.RLIMIT_CPU,(20,20))
   env=dict(os.environ,CLOUDIA_HEAD_A='cycle45-root-authorized',BUN_RUNTIME_TRANSPILER_CACHE_PATH=str(out/'transpiler-cache'),XDG_CACHE_HOME=str(out/'cache'))
   with (d/'stdout.log').open('wb') as stdout,(d/'stderr.log').open('wb') as stderr:
    began=time.monotonic();p=subprocess.Popen([f['bunPath'],'--no-install','run',str(H/'witness.ts'),str(seed),str(d)],cwd=H,env=env,stdout=stdout,stderr=stderr,preexec_fn=limits,start_new_session=True)
    while True:
     pid,status,observed=os.wait4(p.pid,os.WNOHANG)
     if pid:usage=observed;code=os.waitstatus_to_exitcode(status);p.returncode=code;break
     if time.monotonic()-startedAll>=40:
      killed=True;os.killpg(p.pid,signal.SIGKILL);_,status,usage=os.wait4(p.pid,0);code=os.waitstatus_to_exitcode(status);p.returncode=code;break
     time.sleep(.02)
   wall=time.monotonic()-began;totalCPU+=usage.ru_utime+usage.ru_stime
   if code!=0:raise RuntimeError('A case failed exit '+str(code))
   if killed or totalCPU>20 or time.monotonic()-startedAll>40 or usage.ru_maxrss>402653184:raise RuntimeError('Same aggregate CPU/wall or perPID RSS budget failed')
   result=json.loads((d/'result.json').read_text())
   if result['status']!='PASS_A_PRECONDITION_ONLY' or result['seeds']!=[seed]:raise RuntimeError('Incomplete A result')
   verify();cases+=result['cases']
  except BaseException as exc:error=type(exc).__name__+': '+str(exc);(d/'launcher-error.log').write_text(traceback.format_exc())
  finally:
   if p is not None and p.returncode is None:
    try:os.killpg(p.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    _,status,usage=os.wait4(p.pid,0);code=os.waitstatus_to_exitcode(status);p.returncode=code;wall=time.monotonic()-began
  row=dict(seed=seed,status='PASS_A_PRECONDITION_ONLY' if error is None else 'FAIL_STOP_BEFORE_B',error=error,exitCode=code,terminalObserved=usage is not None,wallKilled=killed,childCPUSeconds=usage.ru_utime+usage.ru_stime if usage else None,childWallSeconds=wall,terminalChildPeakRSSBytes=usage.ru_maxrss if usage else None,limits=dict(aggregateCPUSeconds=20,aggregateWallSeconds=40,perPIDTerminalRSSBytes=402653184))
  if (d/'result.json').exists():row['resultSHA256']=sha(d/'result.json')
  (d/'execution.json').write_text(json.dumps(row,indent=2)+'\n');records.append(row)
  if error:break
 observedWall=time.monotonic()-startedAll
 passed=len(records)==len(f['seeds']) and all(r['error'] is None for r in records) and totalCPU<=20 and observedWall<=40
 final=dict(status='PASS_A_ISOLATED_PRECONDITION_ONLY' if passed else 'FAIL_STOP_BEFORE_B',freezeSHA256=args.freeze_sha256,children=records,aggregateChildCPUSeconds=totalCPU,aggregateWallSeconds=observedWall,noRetry=True,candidateGenerations=0,noGPU=True,RSSScope='Darwin wait4 per actual PID; unchanged cap. Original batch resourceFAIL retained.')
 (out/'execution.json').write_text(json.dumps(final,indent=2)+'\n');(out/'result.json').write_text(json.dumps(dict(status=final['status'],cases=cases),indent=2)+'\n');print(json.dumps(final));return 0 if passed else 1
if __name__=='__main__':raise SystemExit(main())
