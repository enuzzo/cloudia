"""UNEXECUTED single-attempt launcher. Root must review this freeze before running.

Usage (future, not executed during preparation):
    python3 run.py --execute-reviewed-r2

20s child CPU hard limit; 40s wall watchdog includes input verification; macOS
terminal getrusage RSS gate 2GiB. RSS is a terminal acceptance gate, not an OS
memory reservation/limit. No ps, install, retry or second child.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import platform
import resource
import signal
import subprocess
import sys
import time
import traceback

HERE = Path(__file__).resolve().parent
MAX_CPU = 20
MAX_WALL = 40
MAX_RSS = 2 * 1024**3
EXPECTED_SOURCE = '21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def cpu(usage):
    return usage.ru_utime + usage.ru_stime


def limits():
    resource.setrlimit(resource.RLIMIT_CPU, (MAX_CPU, MAX_CPU))


def main():
    if sys.argv[1:] != ['--execute-reviewed-r2']:
        raise SystemExit('Not launched: use --execute-reviewed-r2 only after root reviews this frozen program.')
    started = time.monotonic()
    own_start = resource.getrusage(resource.RUSAGE_SELF)
    child_start = resource.getrusage(resource.RUSAGE_CHILDREN)
    # Exclusive fixed directory consumes this one attempt even if preflight fails.
    out = HERE / 'run'
    out.mkdir(exist_ok=False)
    proc = None
    terminal = None
    error = None
    killed = False
    verified = 0
    preflight = {}

    def within_wall():
        if time.monotonic() - started >= MAX_WALL:
            raise TimeoutError('40s total wall budget exhausted')

    try:
        if sys.platform != 'darwin' or platform.machine() != 'arm64':
            raise RuntimeError('Frozen runtime requires macOS arm64; RSS units must be bytes')
        freeze = json.loads((HERE / 'PRE-RUN-FREEZE.json').read_text())
        if freeze['state'] != 'PREPARED_UNEXECUTED_REQUIRES_ROOT_REVIEW':
            raise RuntimeError('Wrong freeze state')
        for row in freeze['inputs']:
            within_wall()
            path = (HERE / row['path']).resolve()
            if path.stat().st_size != row['bytes'] or digest(path) != row['sha256']:
                raise RuntimeError(f'Frozen input mismatch: {row["path"]}')
            verified += 1
        source = (HERE / freeze['sourceRoot']).resolve()
        manifest_path = (HERE / freeze['sourceManifest']).resolve()
        if digest(manifest_path) != EXPECTED_SOURCE:
            raise RuntimeError('Wrong v58 source manifest')
        manifest = json.loads(manifest_path.read_text())
        if not isinstance(manifest, dict) or len(manifest) != 124:
            raise RuntimeError('Frozen source must have 124 manifest entries')
        for relative, expected in manifest.items():
            within_wall()
            parts = PurePosixPath(relative)
            if parts.is_absolute() or '..' in parts.parts or not isinstance(expected, str):
                raise RuntimeError('Unsafe or unsupported source manifest entry')
            path = source / relative
            if not path.is_file() or digest(path) != expected:
                raise RuntimeError(f'Frozen source mismatch: {relative}')
        deps = (source / 'node_modules').resolve(strict=True)
        if os.getxattr(deps, 'com.apple.fileprovider.ignore#P') != b'1':
            raise RuntimeError('Existing Dropbox dependencies are not protected by ignore#P=1')
        package = json.loads((deps / 'three/package.json').read_text())
        if package['version'] != '0.186.0':
            raise RuntimeError('Pinned Three version mismatch')
        bun = (HERE / freeze['bun']).resolve()
        within_wall()
        preflight = {'inputFilesVerified': verified, 'sourceFilesVerified': len(manifest),
                     'sourceManifestSHA256': EXPECTED_SOURCE,
                     'freezeSHA256': digest(HERE / 'PRE-RUN-FREEZE.json'),
                     'dependencyIgnoreValue': '1', 'threeVersion': package['version'],
                     'bunPath': str(bun), 'preflightSeconds': time.monotonic() - started}
        env = dict(os.environ)
        env['CLOUDIA_GEOMETRY_PREFLIGHT_APPROVED'] = 'cycle28-r2'
        with (out / 'stdout.log').open('xb') as stdout, (out / 'stderr.log').open('xb') as stderr:
            proc = subprocess.Popen([str(bun), str(HERE / 'witness.ts'), str(out)],
                                    cwd=HERE, env=env, stdout=stdout, stderr=stderr,
                                    preexec_fn=limits, start_new_session=True)
            print(json.dumps({'phase': 'launched', 'pid': proc.pid,
                              'CPUHardLimitSeconds': MAX_CPU, 'wallLimitSeconds': MAX_WALL,
                              'terminalRSSGateBytes': MAX_RSS}), flush=True)
            next_heartbeat = time.monotonic() + 5
            while proc.poll() is None:
                if time.monotonic() - started >= MAX_WALL:
                    killed = True
                    os.killpg(proc.pid, signal.SIGKILL)
                    break
                if time.monotonic() >= next_heartbeat:
                    print(json.dumps({'phase': 'heartbeat', 'pid': proc.pid,
                                      'wallSeconds': time.monotonic() - started,
                                      'state': 'running', 'outputDirectory': str(out)}), flush=True)
                    next_heartbeat += 5
                time.sleep(.05)
            terminal = proc.wait()
        if terminal != 0:
            raise RuntimeError(f'Child terminated with exit code {terminal}; no retry')
        within_wall()
        result = json.loads((out / 'result.json').read_text())
        if result['status'] != 'COMPLETE_CORE_GEOMETRY_REFERENCE_NOT_ART_OR_GPU_PROOF':
            raise RuntimeError('Unexpected result status')
        if result['measurementQueries'] != 591361 or result['errorStream']['bytes'] != 591361 * 8:
            raise RuntimeError('Incomplete frozen node stream')
        if result['plan']['queryCap'] != 600000 or result['baselineIdentity']['savedFaces'] != freeze['savedFaces']:
            raise RuntimeError('Result scope/identity mismatch')
        groups = [result['aggregate'], *result['rings']]
        for group in groups:
            if group['all']['count'] != group['landMask']['count'] + group['seaMask']['count']:
                raise RuntimeError('Result mask counts do not partition')
            for category in ('all', 'landMask', 'seaMask'):
                if sum(group[category]['histogramCounts']) != group[category]['count']:
                    raise RuntimeError('Result histogram count mismatch')
        if sum(r['all']['count'] for r in result['rings']) != 591361:
            raise RuntimeError('Result ring counts do not partition')
        if result['runtime']['bun'] != '1.3.11' or result['runtime']['architecture'] != 'arm64':
            raise RuntimeError('Result runtime mismatch')
        if os.getxattr(deps, 'com.apple.fileprovider.ignore#P') != b'1':
            raise RuntimeError('Dependency ignore attribute changed')
        preflight['dependencyIgnoreValueAfter'] = '1'
        within_wall()
    except BaseException as exc:
        error = f'{type(exc).__name__}: {exc}'
        (out / 'launcher-error.log').write_text(traceback.format_exc())
    finally:
        if proc is not None and proc.poll() is None:
            os.killpg(proc.pid, signal.SIGKILL)
            terminal = proc.wait()

    own = resource.getrusage(resource.RUSAGE_SELF)
    child = resource.getrusage(resource.RUSAGE_CHILDREN)
    wall = time.monotonic() - started
    own_cpu = cpu(own) - cpu(own_start)
    child_cpu = cpu(child) - cpu(child_start)
    # ru_maxrss is process peak, not subtractable. This fresh launcher has one child.
    combined_peak_bound = own.ru_maxrss + child.ru_maxrss
    budget = {'combinedCPUSeconds': own_cpu + child_cpu, 'childCPUSeconds': child_cpu,
              'wrapperCPUSeconds': own_cpu, 'wallSeconds': wall,
              'childPeakRSSBytes': child.ru_maxrss, 'wrapperPeakRSSBytes': own.ru_maxrss,
              'conservativeSumOfPeakRSSBytes': combined_peak_bound,
              'CPUHardLimitSeconds': MAX_CPU, 'wallLimitSeconds': MAX_WALL,
              'RSSGateBytes': MAX_RSS,
              'RSSScope': 'macOS terminal getrusage byte peaks; sum of peaks is conservative, not concurrent RSS; no RLIMIT_AS/RSS and no ps'}
    budget_pass = (proc is not None and own_cpu + child_cpu <= MAX_CPU
                   and wall <= MAX_WALL and combined_peak_bound <= MAX_RSS and not killed)
    record = {'status': 'PASS' if error is None and terminal == 0 and budget_pass else 'FAIL',
              'scope': 'One full-core geometry reference; no GPU/art/performance acceptance',
              'launched': proc is not None, 'pid': proc.pid if proc else None,
              'terminalObserved': proc is not None and terminal is not None,
              'exitCode': terminal, 'wallKilled': killed, 'error': error,
              'budgetPASS': budget_pass, 'budget': budget, 'preflight': preflight}
    if (out / 'result.json').is_file():
        record['resultSHA256'] = digest(out / 'result.json')
        record['resultBytes'] = (out / 'result.json').stat().st_size
    (out / 'run.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record), flush=True)
    return 0 if record['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
