"""One canonical A64 precondition child; four frozen seeds, no retry or candidate model."""
import argparse, hashlib, json, os, platform, resource, signal, subprocess, sys, time, traceback
from pathlib import Path
HERE=Path(__file__).resolve().parent
def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''): h.update(block)
    return h.hexdigest()
def main():
    own=resource.getrusage(resource.RUSAGE_SELF); own_started=time.monotonic()
    parser=argparse.ArgumentParser(); parser.add_argument('--execute-authorized',action='store_true',required=True); parser.add_argument('--freeze-sha256',required=True); args=parser.parse_args()
    if sys.platform!='darwin' or platform.machine()!='arm64': raise RuntimeError('Darwin arm64 RSS byte units required')
    freeze_path=HERE/'PRE-RUN-FREEZE.json'
    if sha(freeze_path)!=args.freeze_sha256: raise RuntimeError('Freeze mismatch')
    f=json.loads(freeze_path.read_text())
    if f['state']!='FROZEN_NOT_EXECUTED': raise RuntimeError('Unexpected freeze state')
    def verify():
        if sha(freeze_path)!=args.freeze_sha256: raise RuntimeError('Freeze changed')
        for row in f['inputs']:
            p=Path(row['path'])
            if p.stat().st_size!=row['bytes'] or sha(p)!=row['sha256']: raise RuntimeError('Changed input: '+str(p))
        result=subprocess.run(['/usr/bin/xattr','-p','com.apple.fileprovider.ignore#P',f['dependencyRoot']],capture_output=True,check=True,timeout=3)
        if result.stdout.strip()!=b'1': raise RuntimeError('Dependency Dropbox ignore differs')
    verify(); out=HERE/'run'; out.mkdir(exist_ok=False)
    proc=None; usage=None; terminal=None; killed=False; error=None; wall=None; gate=False
    try:
        def limits(): resource.setrlimit(resource.RLIMIT_CPU,(20,20))
        env=dict(os.environ,CLOUDIA_HEAD_A='cycle45-root-authorized',BUN_RUNTIME_TRANSPILER_CACHE_PATH=str(out/'transpiler-cache'),XDG_CACHE_HOME=str(out/'cache'))
        with (out/'stdout.log').open('wb') as stdout,(out/'stderr.log').open('wb') as stderr:
            started=time.monotonic(); proc=subprocess.Popen([f['bunPath'],'--no-install','run',str(HERE/'witness.ts'),str(out)],cwd=HERE,env=env,stdout=stdout,stderr=stderr,preexec_fn=limits,start_new_session=True)
            while True:
                pid,status,observed=os.wait4(proc.pid,os.WNOHANG)
                if pid: terminal=os.waitstatus_to_exitcode(status); usage=observed; proc.returncode=terminal; break
                if time.monotonic()-started>=40:
                    killed=True; os.killpg(proc.pid,signal.SIGKILL); _,status,usage=os.wait4(proc.pid,0); terminal=os.waitstatus_to_exitcode(status); proc.returncode=terminal; break
                time.sleep(.02)
        wall=time.monotonic()-started
        if terminal not in (0,2): raise RuntimeError('A precondition child failed: '+str(terminal))
        if killed or usage.ru_utime+usage.ru_stime>20 or wall>40 or usage.ru_maxrss>384*1024**2: raise RuntimeError('Terminal resource gate failed')
        rp=out/'result.json'
        if rp.stat().st_size>128*1024: raise RuntimeError('Oversized result')
        result=json.loads(rp.read_text())
        if result['status'] not in ('PASS_A_PRECONDITION_ONLY','FAIL_STOP_BEFORE_B') or [r['seed'] for r in result['cases']]!=f['seeds']: raise RuntimeError('Incomplete A precondition result')
        verify(); gate=result['status']=='PASS_A_PRECONDITION_ONLY'
        if (terminal==0)!=gate: raise RuntimeError('Inconsistent child exit and precondition verdict')
    except BaseException as exc:
        error=type(exc).__name__+': '+str(exc); (out/'launcher-error.log').write_text(traceback.format_exc())
    finally:
        if proc is not None and proc.returncode is None:
            try: os.killpg(proc.pid,signal.SIGKILL)
            except ProcessLookupError: pass
            _,status,usage=os.wait4(proc.pid,0); terminal=os.waitstatus_to_exitcode(status); proc.returncode=terminal; wall=time.monotonic()-started
    done=resource.getrusage(resource.RUSAGE_SELF)
    record={'status':'FAIL_EXECUTION' if error else 'PASS_A_PRECONDITION_ONLY' if gate else 'FAIL_A_PRECONDITION_STOP_BEFORE_B',
            'error':error,'freezeSHA256':args.freeze_sha256,'launched':proc is not None,'terminalObserved':usage is not None,'exitCode':terminal,'wallKilled':killed,
            'childCPUSeconds':usage.ru_utime+usage.ru_stime if usage else None,'childWallSeconds':wall,'terminalChildPeakRSSBytes':usage.ru_maxrss if usage else None,
            'limits':{'cpuSeconds':20,'wallSeconds':40,'terminalRSSBytes':402653184},'RSSScope':'Darwin wait4 bytes for this PID; terminal gate, not reservation. No AS/ps.',
            'executionPass':error is None,'necessaryFrontierPass':gate if error is None else None,'noRetry':True,'canonicalGenerations':4,'size':64,'candidateGenerations':0,'noGPU':True,
            'launcherCPUSeconds':done.ru_utime+done.ru_stime-own.ru_utime-own.ru_stime,'launcherWallSeconds':time.monotonic()-own_started,'launcherPeakRSSBytes':done.ru_maxrss}
    if (out/'result.json').is_file(): record['resultSHA256']=sha(out/'result.json')
    (out/'execution.json').write_text(json.dumps(record,indent=2)+'\n'); print(json.dumps(record),flush=True)
    return 0 if error is None and gate else 1
if __name__=='__main__': raise SystemExit(main())
