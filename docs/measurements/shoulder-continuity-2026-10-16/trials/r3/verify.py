#!/usr/bin/env python3
"""Verify saved evidence only: no JS, fields, model, bake, GPU or subprocesses."""
from pathlib import Path
import hashlib
import json
import math
import os

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'anatomy-r3-v55-source'


def read(name):
    return json.loads((HERE / name).read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def same(a, b):
    assert math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-10), (a, b)


manifest = read('MANIFEST.json')
rows = manifest['evidence']['files']
assert len(rows) == manifest['evidence']['fileCount']
assert sum(row['bytes'] for row in rows) == manifest['evidence']['payloadBytes']
expected = {row['path'] for row in rows}
assert len(expected) == len(rows) and 'MANIFEST.json' not in expected
actual = set()
for base, directories, filenames in os.walk(HERE, followlinks=False):
    directories[:] = [d for d in directories if not (Path(base) / d).is_symlink()]
    for name in filenames:
        path = Path(base) / name
        if not path.is_symlink() and path != HERE / 'MANIFEST.json':
            actual.add(path.relative_to(HERE).as_posix())
assert expected == actual, (expected - actual, actual - expected)
for row in rows:
    path = Path(row['path'])
    assert not path.is_absolute() and '..' not in path.parts
    file = HERE / path
    assert file.stat().st_size == row['bytes'] and digest(file) == row['sha256'], path

baseline = read('baseline-source-manifest.json')
candidate = read('candidate-source-manifest.json')
freeze = read('source-freeze.json')
protocol = read('PROTOCOL.json')
assert len(baseline) == len(candidate) == freeze['fileCount'] == 119
assert candidate == freeze['files']
assert digest(HERE / 'PROTOCOL.json') == freeze['protocolSha256']
assert digest(HERE / 'candidate.patch') == freeze['patchSha256']
assert digest(HERE / 'source-freeze.json') == manifest['source']['freezeSha256']
assert digest(HERE / 'candidate-source-manifest.json') == manifest['source']['manifestSha256']
assert digest(HERE / 'baseline-source-manifest.json') == '30c5448e87fb60c3bd3fdc8ca133993c49e54503a9950f9da1815fd59883171f'
changed = [p for p in baseline if baseline[p] != candidate[p]]
assert changed == protocol['changedPaths'] == [
    'src/cumulonimbus/GPUSceneEngine.ts',
    'src/cumulonimbus/lifecycle.test.ts',
    'src/cumulonimbus/volume.ts',
]
source_bytes = 0
for path, sha in candidate.items():
    p = Path(path)
    assert not p.is_absolute() and '..' not in p.parts
    file = SOURCE / p
    assert digest(file) == sha, p
    source_bytes += file.stat().st_size
assert source_bytes == freeze['payloadBytes'] == manifest['source']['payloadBytes']
assert candidate['src/cumulonimbus/volume.ts'] == 'ebacc5ad2bca3515f34bfa4d2a4fe028ef4d20c09bcbe446104cfc794569a190'
for path in changed[:2]:
    text = (SOURCE / path).read_text()
    assert text.count('observatory-v56-joint-r3-trial') == 1
    reversed_bytes = text.replace('observatory-v56-joint-r3-trial', 'observatory-v55-s2-chromaticity').encode()
    assert hashlib.sha256(reversed_bytes).hexdigest() == baseline[path]
assert digest(HERE / 'audit-scripts/qa-approach.ts') == protocol['qaScript']['sha256'] == freeze['qaScriptSha256']
assert protocol['qaScript']['sha256'] == '7e80d5e44aa047467f87b891476e2158e3156a122d370557ed1f145f0786c986'

dist = read('dist-manifest.json')
assert len(dist) == manifest['dist']['fileCount'] == 30
assert sum(row['bytes'] for row in dist.values()) == manifest['dist']['payloadBytes']
for path, row in dist.items():
    file = SOURCE / 'dist' / path
    assert file.stat().st_size == row['bytes'] and digest(file) == row['sha256'], path

checks = read('checks.json')
assert [step['name'] for step in checks] == ['typecheck', 'targeted-tests', 'app-build', 'hero-build']
assert all(step['exitCode'] == 0 for step in checks)
tests = read('targeted-test-results.json')
assert tests['success'] and tests['numPassedTests'] == tests['numTotalTests'] == 31
assert tests['numFailedTests'] == 0 and len(tests['testResults']) == 2
assert {Path(t['name']).name for t in tests['testResults']} == {'volume.test.ts', 'inclinedShoulder.test.ts'}

raw = read('qa-approach-256.json')
control = read('qa-run-control.json')
assert control['status'] == 'WRAPPERFAIL' and control['childExitCode'] is None
assert control['automaticRestarts'] == 0
assert digest(HERE / 'qa-approach-256.json') == control['resultSha256']
assert (raw['seed'], raw['time'], raw['volume'], raw['detail'], raw['flowField']) == (1571198069, 60, 256, 128, 16)
assert raw['wind'] == [.3, .1] and raw['drift'] == [.2, 0, 0]
cases = raw['cases']
assert len(cases) == raw['summary']['cases'] == 18
poses = {(case['aspect'], case['yaw'], case['pitch']) for case in cases}
assert poses == {(aspect, yaw, pitch) for aspect in (16 / 9, 390 / 844) for yaw in (-.8, 0, .8) for pitch in (-.35, 0, .35)}
for case in cases:
    assert case['probe']['found'] and case['dense']['found'] and case['old']['found'] and case['analyticDense']['found']
    assert 0 < case['probe']['spacingKm'] <= .0125
    same(case['errorMetres'], 1000 * abs(case['probe']['distance'] - case['dense']['distance']))
    same(case['oldErrorMetres'], 1000 * abs(case['old']['distance'] - case['dense']['distance']))
    same(case['analyticBoundaryShiftMetres'], 1000 * (case['dense']['distance'] - case['analyticDense']['distance']))
    for key in ('cpuMs', 'fieldFillCpuMs', 'fieldAndProbeCpuMs'):
        assert len(case[key]) == 5 and all(math.isfinite(v) and v >= 0 for v in case[key])
summary = raw['summary']
same(summary['maxErrorMetres'], max(c['errorMetres'] for c in cases))
same(summary['maxOldErrorMetres'], max(c['oldErrorMetres'] for c in cases))
same(summary['maxAnalyticBoundaryShiftMetres'], max(abs(c['analyticBoundaryShiftMetres']) for c in cases))
assert summary['maxSamples'] == max(c['probe']['samples'] for c in cases)
for key, suffix in [('cpuMs', 'CpuMs'), ('fieldFillCpuMs', 'FieldFillCpuMs'), ('fieldAndProbeCpuMs', 'FieldAndProbeCpuMs')]:
    values = sorted(v for c in cases for v in c[key])
    same(summary['median' + suffix], values[len(values) // 2])
    same(summary['p95' + suffix], values[math.floor(len(values) * .95)])
    same(summary['max' + suffix], values[-1])
post = read('post-checks.json')
assert post['all119RuntimeFilesMatchPreExecutionFreeze']
assert post['dependencyXattrBefore'] == post['dependencyXattrAfter'] == '1'
assert not post['dependencyCopiedOrInstalled'] and not post['qaRerun'] and not post['psRepeated']
assert post['oldR3ManifestSha256'] == 'f6d08465b8d250b37fcd01576b3f1d6552eb432f7c95a0293886af6fe84a6576'
print(json.dumps({
    'offlineVerification': 'PASS',
    'sourceFiles': 119,
    'distFiles': len(dist),
    'testsPassed': 31,
    'qaCommandStatus': 'WRAPPERFAIL',
    'qaChildExitCode': None,
    'qaArtifact': '18 complete saved CPU poses, arithmetic verified',
    'qaMaxErrorMetres': summary['maxErrorMetres'],
    'newFieldEvaluations': 0,
    'gpuBrowserRuns': 0,
}))
