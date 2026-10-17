"""PREPARED ONLY. Two sequential, independently budgeted children; no retry."""
import argparse, hashlib, json, os, platform, resource, signal, subprocess, sys, time, traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()

def main():
    own_cpu = resource.getrusage(resource.RUSAGE_SELF); own_started = time.monotonic()
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute-authorized', action='store_true', required=True)
    parser.add_argument('--freeze-sha256', required=True)
    args = parser.parse_args()
    if sys.platform != 'darwin' or platform.machine() != 'arm64': raise RuntimeError('Darwin arm64 required for RSS byte units')
    freeze_path = HERE / 'PRE-RUN-FREEZE.json'
    if sha(freeze_path) != args.freeze_sha256: raise RuntimeError('Freeze digest mismatch')
    freeze = json.loads(freeze_path.read_text())
    if freeze['state'] != 'FROZEN_NOT_EXECUTED': raise RuntimeError('Unexpected pre-run state')
    deps = Path(freeze['dependencyRoot'])
    def verify_inputs():
        if sha(freeze_path) != args.freeze_sha256: raise RuntimeError('Freeze changed')
        for row in freeze['inputs']:
            path = Path(row['path'])
            if path.stat().st_size != row['bytes'] or sha(path) != row['sha256']: raise RuntimeError('Input changed: ' + str(path))
        ignored = subprocess.run(['/usr/bin/xattr', '-p', 'com.apple.fileprovider.ignore#P', str(deps)], capture_output=True, timeout=3, check=True)
        if ignored.stdout.strip() != b'1': raise RuntimeError('Dropbox dependency ignore is not 1')
    verify_inputs()
    output = HERE / 'run'; output.mkdir(exist_ok=False)
    records = []
    for mode in ['A', 'B']:
        child_dir = output / mode; child_dir.mkdir(exist_ok=False)
        proc = None; usage = None; terminal = None; killed = False; error = None; started = None; terminal_wall = None
        try:
            verify_inputs()
            def child_limits(): resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
            env = dict(os.environ, CLOUDIA_GRID_AUDIT='cycle44-mesh-root-authorized',
                       BUN_RUNTIME_TRANSPILER_CACHE_PATH=str(output / 'transpiler-cache'), XDG_CACHE_HOME=str(output / 'cache'))
            with (child_dir / 'stdout.log').open('wb') as stdout, (child_dir / 'stderr.log').open('wb') as stderr:
                started = time.monotonic()
                proc = subprocess.Popen([freeze['bunPath'], '--no-install', 'run', str(HERE / 'witness.ts'), mode, str(child_dir)],
                                        cwd=HERE, env=env, stdout=stdout, stderr=stderr, preexec_fn=child_limits, start_new_session=True)
                while True:
                    pid, status, observed = os.wait4(proc.pid, os.WNOHANG)
                    if pid:
                        terminal = os.waitstatus_to_exitcode(status); usage = observed; proc.returncode = terminal; break
                    if time.monotonic() - started >= 30:
                        killed = True; os.killpg(proc.pid, signal.SIGKILL)
                        _, status, usage = os.wait4(proc.pid, 0)
                        terminal = os.waitstatus_to_exitcode(status); proc.returncode = terminal; break
                    time.sleep(.02)
            terminal_wall = time.monotonic() - started
            if terminal != 0: raise RuntimeError('Child failed, exit ' + str(terminal))
            if killed or usage.ru_utime + usage.ru_stime > 20 or terminal_wall > 30 or usage.ru_maxrss > 1.5 * 1024**3:
                raise RuntimeError('Child terminal resource gate failed')
            result_path = child_dir / 'result.json'
            if result_path.stat().st_size > 128 * 1024: raise RuntimeError('Oversized result')
            result = json.loads(result_path.read_text())
            if result['status'] != 'COMPLETE_CPU_ONLY' or result['mode'] != mode: raise RuntimeError('Incomplete child result')
            if mode == 'A' and not result['historicalAAuthenticated']: raise RuntimeError('A parity incomplete')
            stream = child_dir / 'errors.f64le.gz'; expected = result['errorStream']
            if stream.stat().st_size != expected['gzipBytes'] or sha(stream) != expected['gzipSHA256']: raise RuntimeError('Saved stream digest mismatch')
            verify_inputs()
            if mode == 'B':
                baseline = json.loads((output / 'A' / 'result.json').read_text())
                if result['outerIdentity'] != baseline['outerIdentity']: raise RuntimeError('Preserved outer XYZ/surface triangles differ')
                if result['outerProbes'] != baseline['outerProbes']: raise RuntimeError('Preserved outer lookup heights differ')
                if result['innerIdentity'] != baseline['innerIdentity']: raise RuntimeError('Preserved inner XYZ/surface triangles differ')
                if result['innerProbes'] != baseline['innerProbes']: raise RuntimeError('Preserved inner lookup heights differ')
        except BaseException as exc:
            error = type(exc).__name__ + ': ' + str(exc)
            (child_dir / 'launcher-error.log').write_text(traceback.format_exc())
        finally:
            if proc is not None and proc.returncode is None:
                try: os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError: pass
                _, status, usage = os.wait4(proc.pid, 0); terminal = os.waitstatus_to_exitcode(status); proc.returncode = terminal
                terminal_wall = time.monotonic() - started
        record = {'mode': mode, 'status': 'PASS_EXECUTION_AND_PARITY_ONLY' if error is None else 'FAIL', 'error': error,
                  'launched': proc is not None, 'terminalObserved': usage is not None, 'exitCode': terminal, 'wallKilled': killed,
                  'childCPUSeconds': usage.ru_utime + usage.ru_stime if usage else None, 'childWallSeconds': terminal_wall,
                  'terminalChildPeakRSSBytes': usage.ru_maxrss if usage else None,
                  'limits': {'cpuSeconds': 20, 'wallSeconds': 30, 'terminalRSSBytes': 1610612736},
                  'RSSScope': 'Darwin wait4 bytes for this child; terminal gate, not allocation limit. No AS/ps.',
                  'scope': 'Execution, source stability, invariants and A parity only; independent saved-stream analysis decides geometry benefit.'}
        if (child_dir / 'result.json').is_file(): record['resultSHA256'] = sha(child_dir / 'result.json')
        (child_dir / 'run.json').write_text(json.dumps(record, indent=2) + '\n'); records.append(record)
        if error is not None: break
    own_done = resource.getrusage(resource.RUSAGE_SELF)
    final = {'status': 'COMPLETE_CPU_A_B_NOT_VISUAL_ACCEPTANCE' if len(records) == 2 and all(r['error'] is None for r in records) else 'FAIL_STOPPED',
             'freezeSHA256': args.freeze_sha256, 'children': records,
             'launcherCPUSeconds': own_done.ru_utime + own_done.ru_stime - own_cpu.ru_utime - own_cpu.ru_stime,
             'launcherWallSeconds': time.monotonic() - own_started, 'launcherPeakRSSBytes': own_done.ru_maxrss,
             'noRetry': True, 'noConcurrentMeshes': True, 'noGPU': True}
    (output / 'execution.json').write_text(json.dumps(final, indent=2) + '\n'); print(json.dumps(final), flush=True)
    return 0 if final['status'] == 'COMPLETE_CPU_A_B_NOT_VISUAL_ACCEPTANCE' else 1

if __name__ == '__main__': raise SystemExit(main())
