"""Root-only single-child launcher. Preparation does not call this file."""
from pathlib import Path
import argparse, hashlib, json, resource, subprocess, sys, time

root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--bun',required=True,help='Absolute path to existing Bun; no install or dependency lookup')
args=parser.parse_args()
bun=Path(args.bun)
if not bun.is_absolute() or not bun.is_file(): raise SystemExit('An existing absolute Bun executable is required')
freeze_raw=(root/'FREEZE.json').read_bytes();freeze=json.loads(freeze_raw)
sha=lambda b: hashlib.sha256(b).hexdigest()
for entry in freeze['files']:
    rel=Path(entry['path'])
    if rel.is_absolute() or '..' in rel.parts: raise SystemExit('Invalid frozen path')
    raw=(root/rel).read_bytes()
    if len(raw)!=entry['bytes'] or sha(raw)!=entry['sha256']: raise SystemExit(f'Input drift: {rel}')
run=root/'run'
if run.exists(): raise SystemExit('Run directory exists: no restart or overwrite is authorized')
runtime={'path':str(bun),'bytes':bun.stat().st_size,'sha256':sha(bun.read_bytes())}
run.mkdir()
protocol=json.loads((root/'PROTOCOL.json').read_text())
budget=protocol['budget']
def child_limits():
    resource.setrlimit(resource.RLIMIT_CPU,(budget['childCpuSecondsKernel'],budget['childCpuSecondsKernel']))
started=time.monotonic(); timed_out=False; spawn_error=None; process=None; code=None
with (run/'stdout.log').open('wb') as stdout,(run/'stderr.log').open('wb') as stderr:
    try:
        process=subprocess.Popen([str(bun),str(root/'runner.ts'),str(run)],cwd=root,stdout=stdout,stderr=stderr,preexec_fn=child_limits)
        try: code=process.wait(timeout=budget['childWallSeconds'])
        except subprocess.TimeoutExpired:
            timed_out=True;process.kill();code=process.wait()
    except BaseException as exc:
        spawn_error=f'{type(exc).__name__}: {exc}'
        if process is not None and process.poll() is None:
            process.kill();code=process.wait()
        stderr.write((spawn_error+'\n').encode())
elapsed=time.monotonic()-started;usage=resource.getrusage(resource.RUSAGE_CHILDREN)
peak_bytes=usage.ru_maxrss if sys.platform=='darwin' else usage.ru_maxrss*1024
cpu=usage.ru_utime+usage.ru_stime
valid=False;error=None
try: valid=json.loads((run/'result.json').read_text())['status']=='COMPLETE_CPU_SOURCE_DIAGNOSTIC_ONLY'
except Exception as exc: error=f'{type(exc).__name__}: {exc}'
runtime_unchanged=bun.stat().st_size==runtime['bytes'] and sha(bun.read_bytes())==runtime['sha256']
passed=code==0 and valid and not timed_out and runtime_unchanged and elapsed<=budget['childWallSeconds'] and cpu<=budget['childCpuSecondsKernel'] and peak_bytes<=budget['terminalPeakRssBytes']
record={'status':'PASS_BOUNDED_CPU_DIAGNOSTIC' if passed else 'FAIL_TERMINAL_NO_RETRY','terminalExitCode':code,'spawnOrControllerError':spawn_error,'wallSeconds':elapsed,'cpuUserSeconds':usage.ru_utime,'cpuSystemSeconds':usage.ru_stime,'cpuCombinedSeconds':cpu,'terminalPeakRssBytes':peak_bytes,'rssScope':'terminal getrusage maximum; not live enforcement or RLIMIT_AS','wallTimeout':timed_out,'resultValid':valid,'resultError':error,'budget':budget,'sourceFreezeSHA256':sha(freeze_raw),'runtime':runtime,'runtimeUnchangedAfterRun':runtime_unchanged,'outputs':[{'path':p.name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(run.iterdir()) if p.is_file()]}
(run/'run.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
raise SystemExit(0 if passed else 1)
