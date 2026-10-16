"""PREPARED, NOT EXECUTED. One exclusive attempt per mode, after root freeze.

Future commands: python3 run.py --execute-reviewed off / on
One Bun child, hard20s CPU; combined wrapper+child CPU20s, wall40s, terminal
sum-of-peaks RSS2GiB. No install, second mesh, retry, GPU, test or browser.
"""
from pathlib import Path, PurePosixPath
import ctypes
import hashlib
import json
import math
import os
import platform
import resource
import signal
import subprocess
import sys
import time
import traceback

HERE = Path(__file__).resolve().parent
SOURCE = (HERE / '../refine-source').resolve()
SOURCE_MANIFEST = (HERE / '../refine-qualification-r1/source-manifest.json').resolve()
BASELINE = (HERE / '../geometry-preflight/run/result.json').resolve()
DECISION = (HERE / '../refine-decision-protocol.json').resolve()
EXPECTED_SOURCE = '83469d62c552db7bad9cbc175bf549f7b7c0bd8c0b113c137e484e1b4f315e00'
EXPECTED_BASELINE = '5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27'
EXPECTED_OFF_STREAM = '6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a'
MAX_CPU, MAX_WALL, MAX_RSS = 20, 40, 2 * 1024**3
NODES, STREAM_BYTES, MAX_JSON = 591361, 591361 * 8, 4 * 1024**2


def cpu(usage):
    return usage.ru_utime + usage.ru_stime


def child_limits():
    resource.setrlimit(resource.RLIMIT_CPU, (MAX_CPU, MAX_CPU))


def ignore_value(path):
    # Darwin exposes six arguments; no extra child pollutes getrusage.
    native = ctypes.CDLL('/usr/lib/libSystem.B.dylib', use_errno=True)
    getxattr = native.getxattr
    getxattr.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p,
                        ctypes.c_size_t, ctypes.c_uint32, ctypes.c_int]
    getxattr.restype = ctypes.c_ssize_t
    value = ctypes.create_string_buffer(64)
    size = getxattr(os.fsencode(path), b'com.apple.fileprovider.ignore#P',
                    value, len(value), 0, 0)
    if size < 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error), str(path))
    return value.raw[:size]


def main():
    if len(sys.argv) != 3 or sys.argv[1] != '--execute-reviewed' or sys.argv[2] not in ('off', 'on'):
        raise SystemExit('Not launched: root must approve/freeze, then use --execute-reviewed off|on.')
    mode = sys.argv[2]
    started = time.monotonic()
    own_start = resource.getrusage(resource.RUSAGE_SELF)
    child_start = resource.getrusage(resource.RUSAGE_CHILDREN)
    # This mkdir consumes a mode attempt even if its following preflight fails.
    out = HERE / ('run-' + mode)
    out.mkdir(exist_ok=False)
    proc = None
    terminal = None
    error = None
    killed = False
    preflight = {}
    validated = {}
    selection_fit_gate = None

    def within_wall():
        if time.monotonic() - started >= MAX_WALL:
            raise TimeoutError('40s total wall budget exhausted')

    def digest(path):
        h = hashlib.sha256()
        with path.open('rb') as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b''):
                within_wall()
                h.update(chunk)
        return h.hexdigest()

    def read_json(path, maximum=MAX_JSON):
        within_wall()
        if not path.is_file() or path.stat().st_size > maximum:
            raise RuntimeError(f'Missing or oversized JSON: {path}')
        return json.loads(path.read_text())

    def verify_sources(manifest):
        for relative, expected in manifest.items():
            within_wall()
            parts = PurePosixPath(relative)
            if parts.is_absolute() or '..' in parts.parts or not isinstance(expected, str):
                raise RuntimeError('Unsafe source manifest entry')
            path = SOURCE / relative
            if not path.is_file() or digest(path) != expected:
                raise RuntimeError(f'Candidate source mismatch: {relative}')

    def verified_off():
        record_path = HERE / 'run-off/run.json'
        record = read_json(record_path)
        if (record['status'] != 'PASS' or record['mode'] != 'off'
                or not record['budgetPASS'] or not record['terminalObserved']
                or record['exitCode'] != 0 or record['selectionFitGatePASS'] is not True):
            raise RuntimeError('ON requires OFF complete historical parity and terminal budget PASS')
        result_path = HERE / 'run-off/result.json'
        if digest(result_path) != record['resultSHA256']:
            raise RuntimeError('OFF result differs from its terminal record')
        result = read_json(result_path)
        if result['sourceManifestSHA256'] != EXPECTED_SOURCE or result['status'] != 'OFF_PARITY_PASS_NODES_ONLY':
            raise RuntimeError('OFF result provenance/status mismatch')
        stream = HERE / 'run-off/errors.f64le'
        if stream.stat().st_size != STREAM_BYTES or digest(stream) != EXPECTED_OFF_STREAM:
            raise RuntimeError('Authenticated OFF reproduction stream mismatch')
        return {'runSHA256': digest(record_path), 'resultSHA256': record['resultSHA256'],
                'streamSHA256': EXPECTED_OFF_STREAM, 'bytes': STREAM_BYTES}

    try:
        if sys.platform != 'darwin' or platform.machine() != 'arm64':
            raise RuntimeError('Protocol requires macOS arm64 and Darwin RSS byte units')
        freeze_path = HERE / 'PRE-RUN-FREEZE.json'
        freeze = read_json(freeze_path)
        if freeze['state'] != 'ROOT_APPROVED_UNEXECUTED':
            raise RuntimeError('Root-approved pre-run freeze is absent')
        if ((HERE / freeze['sourceRoot']).resolve() != SOURCE
                or (HERE / freeze['sourceManifest']).resolve() != SOURCE_MANIFEST
                or freeze['sourceManifestSHA256'] != EXPECTED_SOURCE):
            raise RuntimeError('Freeze candidate identity differs from fixed protocol')
        frozen_paths = {}
        for row in freeze['inputs']:
            within_wall()
            path = (HERE / row['path']).resolve()
            if path in frozen_paths:
                raise RuntimeError('Duplicate frozen input')
            if not path.is_file() or path.stat().st_size != row['bytes'] or digest(path) != row['sha256']:
                raise RuntimeError(f'Frozen input mismatch: {row["path"]}')
            frozen_paths[path] = row
        bun = (HERE / freeze['bun']).resolve(strict=True)
        deps_link = SOURCE / 'node_modules'
        if not deps_link.is_symlink():
            raise RuntimeError('Expected pre-existing dependency symlink')
        deps = deps_link.resolve(strict=True)
        required = {HERE / 'witness.ts', HERE / 'run.py', HERE / 'PROTOCOL.json', HERE / 'README.md',
                    SOURCE_MANIFEST, BASELINE, DECISION, bun,
                    SOURCE / 'src/cumulonimbus/assets/liguria-apuane-dem.bin',
                    deps / 'three/package.json', deps / 'three/build/three.webgpu.js',
                    deps / 'three/build/three.tsl.js', deps / 'three/build/three.core.js'}
        if not {p.resolve() for p in required}.issubset(frozen_paths):
            raise RuntimeError('Freeze omits a required program/input/dependency payload')
        if digest(SOURCE_MANIFEST) != EXPECTED_SOURCE or digest(BASELINE) != EXPECTED_BASELINE:
            raise RuntimeError('Fixed candidate or historical result hash mismatch')
        manifest = read_json(SOURCE_MANIFEST)
        if not isinstance(manifest, dict) or len(manifest) != 126:
            raise RuntimeError('Candidate must have exactly 126 source manifest entries')
        verify_sources(manifest)
        if ignore_value(deps) != b'1':
            raise RuntimeError('Existing Dropbox dependency directory lacks ignore#P=1')
        package = read_json(deps / 'three/package.json')
        if package['version'] != '0.186.0':
            raise RuntimeError('Pinned Three version differs')
        baseline = read_json(BASELINE)
        decision = read_json(DECISION)
        if decision['candidateSourceManifestSHA256'] != EXPECTED_SOURCE:
            raise RuntimeError('Predeclared numerical decision protocol targets another candidate')
        off_dependency = verified_off() if mode == 'on' else None
        preflight = {'sourceFilesVerified': len(manifest), 'inputFilesVerified': len(frozen_paths),
                     'sourceManifestSHA256': EXPECTED_SOURCE, 'historicalResultSHA256': EXPECTED_BASELINE,
                     'freezeSHA256': digest(freeze_path), 'decisionProtocolSHA256': digest(DECISION),
                     'dependencyIgnoreValue': '1', 'threeVersion': package['version'],
                     'bunPath': str(bun), 'offDependency': off_dependency,
                     'preflightSeconds': time.monotonic() - started}
        env = dict(os.environ)
        env['CLOUDIA_REFINE_WITNESS_APPROVED'] = 'cycle28-prepared-r1'
        with (out / 'stdout.log').open('xb') as stdout, (out / 'stderr.log').open('xb') as stderr:
            within_wall()
            proc = subprocess.Popen([str(bun), str(HERE / 'witness.ts'), mode, str(out)],
                                    cwd=HERE, env=env, stdout=stdout, stderr=stderr,
                                    preexec_fn=child_limits, start_new_session=True)
            print(json.dumps({'phase': 'launched', 'mode': mode, 'pid': proc.pid,
                              'childCPUHardLimitSeconds': MAX_CPU,
                              'combinedCPUTerminalGateSeconds': MAX_CPU,
                              'totalWallLimitSeconds': MAX_WALL, 'terminalRSSGateBytes': MAX_RSS}), flush=True)
            heartbeat = time.monotonic() + 5
            while proc.poll() is None:
                now = time.monotonic()
                if now - started >= MAX_WALL:
                    killed = True
                    os.killpg(proc.pid, signal.SIGKILL)
                    break
                if now >= heartbeat:
                    print(json.dumps({'phase': 'heartbeat', 'mode': mode, 'pid': proc.pid,
                                      'wallSeconds': now - started, 'state': 'running'}), flush=True)
                    heartbeat += 5
                time.sleep(.05)
            terminal = proc.wait()
        if terminal != 0:
            raise RuntimeError(f'Child terminal exit {terminal}; attempt consumed, no retry')
        result_path, stream_path = out / 'result.json', out / 'errors.f64le'
        result = read_json(result_path)
        status = 'OFF_PARITY_PASS_NODES_ONLY' if mode == 'off' else 'ON_FIT_COMPLETE_NODES_ONLY'
        if result['status'] != status or result['mode'] != mode or result['sourceManifestSHA256'] != EXPECTED_SOURCE:
            raise RuntimeError('Result mode/status/source mismatch')
        if result['historicalResultSHA256'] != EXPECTED_BASELINE or result['measurementQueries'] != NODES:
            raise RuntimeError('Result historical identity/query count mismatch')
        if result['runtime'] != {'bun': '1.3.11', 'architecture': 'arm64', 'platform': 'darwin'}:
            raise RuntimeError('Frozen Bun/runtime mismatch')
        if result['plan']['queryCap'] != 600000 or result['plan']['nodes'] != NODES:
            raise RuntimeError('Result scope changed')
        stream_sha = digest(stream_path)
        if (stream_path.stat().st_size != STREAM_BYTES or result['errorStream']['bytes'] != STREAM_BYTES
                or result['errorStream']['sha256'] != stream_sha or result['errorStream']['retained'] is not True):
            raise RuntimeError('Retained stream length/hash mismatch')
        groups = [result['aggregate'], *result['rings']]
        for group in groups:
            if group['all']['count'] != group['landMask']['count'] + group['seaMask']['count']:
                raise RuntimeError('Mask counts do not partition')
            for category in ('all', 'landMask', 'seaMask'):
                row = group[category]
                if sum(row['histogramCounts']) != row['count']:
                    raise RuntimeError('Histogram counts differ')
                if row['count'] and not all(math.isfinite(row[k]) for k in ('sumErrorMetres', 'sumSquaredErrorMetres2', 'rmsMetres')):
                    raise RuntimeError('Nonfinite aggregate arithmetic')
        if result['aggregate']['all']['count'] != NODES or sum(r['all']['count'] for r in result['rings']) != NODES:
            raise RuntimeError('Ring/global scope incomplete')
        if mode == 'off':
            if (stream_sha != EXPECTED_OFF_STREAM or result['identity']['meshHashes'] != baseline['baselineIdentity']['meshHashes']
                    or result['meshStats'] != baseline['meshStats'] or result['aggregate'] != baseline['aggregate']
                    or result['rings'] != baseline['rings']):
                raise RuntimeError('OFF full historical parity failed')
            selection_fit_gate = True
            validated['offParity'] = 'All five buffer hashes, exact mesh stats, aggregates/rings and complete node error digest match saved historical result'
        else:
            if result['identity']['prefixHashes'] != {key: baseline['baselineIdentity']['meshHashes'][key] for key in ('positions', 'surface')}:
                raise RuntimeError('ON original prefixes changed')
            pairs = result['pairedComparison']
            if pairs['offProvenance']['runSHA256'] != off_dependency['runSHA256'] or pairs['offProvenance']['resultSHA256'] != off_dependency['resultSHA256']:
                raise RuntimeError('ON paired comparison used another OFF record')
            for group in [pairs['aggregate'], *pairs['rings']]:
                for category in ('all', 'landMask', 'seaMask'):
                    row = group[category]
                    if row['improved'] + row['worsened'] + row['equalAbsoluteError'] != row['count']:
                        raise RuntimeError('Paired comparison does not partition')
            if pairs['aggregate']['all']['count'] != NODES:
                raise RuntimeError('Incomplete paired comparison')
            stats = result['meshStats']
            if stats['vertices'] > 1000000 or stats['triangles'] > 2000000 or stats['geometryBytes'] > 64 * 1024**2:
                raise RuntimeError('ON exact engine geometry budget exceeded')
            tests = {
                'globalRMSStrictlyLower': result['aggregate']['all']['rmsMetres'] < baseline['aggregate']['all']['rmsMetres'],
                'landRMSStrictlyLower': result['aggregate']['landMask']['rmsMetres'] < baseline['aggregate']['landMask']['rmsMetres'],
                'globalMaxAbsNoMoreThanBaselinePlus1mm': abs(result['aggregate']['all']['maximumAbs']['errorMetres']) <= abs(baseline['aggregate']['all']['maximumAbs']['errorMetres']) + .001,
            }
            for ring in (2, 3, 4):
                tests[f'landRing{ring}RMSStrictlyLower'] = result['rings'][ring]['landMask']['rmsMetres'] < baseline['rings'][ring]['landMask']['rmsMetres']
            selection_fit_gate = all(tests.values())
            validated['predeclaredNumericalGate'] = tests
        # Recheck fixed inputs/candidate after the child; no second Bun/model build.
        for path, row in frozen_paths.items():
            if path.stat().st_size != row['bytes'] or digest(path) != row['sha256']:
                raise RuntimeError('Frozen input changed during run')
        verify_sources(manifest)
        if mode == 'on' and verified_off() != off_dependency:
            raise RuntimeError('Authenticated OFF dependency changed during ON')
        if ignore_value(deps) != b'1':
            raise RuntimeError('Dependency ignore attribute changed')
        preflight['sourceFilesReverifiedAfter'] = len(manifest)
        preflight['dependencyIgnoreValueAfter'] = '1'
        validated.update({'retainedStreamSHA256': stream_sha, 'retainedStreamBytes': STREAM_BYTES,
                          'resultSHA256': digest(result_path), 'resultBytes': result_path.stat().st_size})
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
    own_cpu, child_cpu = cpu(own) - cpu(own_start), cpu(child) - cpu(child_start)
    wall = time.monotonic() - started
    sum_peaks = own.ru_maxrss + child.ru_maxrss
    budget = {'combinedCPUSeconds': own_cpu + child_cpu, 'wrapperCPUSeconds': own_cpu,
              'childCPUSeconds': child_cpu, 'wallSeconds': wall,
              'wrapperPeakRSSBytes': own.ru_maxrss, 'childPeakRSSBytes': child.ru_maxrss,
              'conservativeSumOfPeakRSSBytes': sum_peaks,
              'childCPUHardLimitSeconds': MAX_CPU, 'combinedCPUTerminalGateSeconds': MAX_CPU,
              'totalWallLimitSeconds': MAX_WALL, 'sumOfPeakRSSGateBytes': MAX_RSS,
              'RSSScope': 'Darwin getrusage terminal byte peaks; conservative sum, not simultaneous RSS. No OS memory reservation or hard RSS/AS limit.'}
    budget_pass = bool(proc is not None and own_cpu + child_cpu <= MAX_CPU and wall <= MAX_WALL
                       and sum_peaks <= MAX_RSS and not killed)
    record = {'status': 'PASS' if error is None and terminal == 0 and budget_pass else 'FAIL',
              'mode': mode, 'scope': 'Execution/parity/fit evidence only; not native art, GPU parity, continuous bound or FPS acceptance',
              'launched': proc is not None, 'pid': proc.pid if proc else None,
              'terminalObserved': proc is not None and terminal is not None, 'exitCode': terminal,
              'wallKilled': killed, 'error': error, 'budgetPASS': budget_pass, 'budget': budget,
              'selectionFitGatePASS': selection_fit_gate, 'preflight': preflight, 'validation': validated}
    if 'resultSHA256' in validated:
        record['resultSHA256'] = validated['resultSHA256']
        record['resultBytes'] = validated['resultBytes']
    (out / 'run.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record), flush=True)
    return 0 if record['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
