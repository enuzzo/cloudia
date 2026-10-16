#!/usr/bin/env python3
"""Read-only portable checks of the curated payloads and fixed R2 colour formula.

No raw satellite replay, historical script execution or writes. Source-tree access
is opt-in only via --verify-runtime; the default checks the curated archive.
"""
import argparse
from datetime import datetime
from decimal import Decimal, localcontext
import gzip
import hashlib
import itertools
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parent
Y_TEXT = ('.2126', '.7152', '.0722')
ENDPOINTS = (
    ('denseForestLo', 10, '.019,.042,.027'),
    ('denseForestHi', 10, '.039,.075,.035'),
    ('openForestLo', 10, '.054,.062,.032'),
    ('openForestHi', 10, '.075,.083,.039'),
    ('grassLo', 30, '.063,.085,.037'),
    ('grassHi', 30, '.105,.120,.061'),
)
COMMENT = ' // S2 class-wise chromaticity correction retains endpoint authored Y and relative hue contrasts.\n'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(rel, **kwargs):
    return json.loads((ROOT / rel).read_text(), **kwargs)


def load_gzip(rel):
    return json.loads(gzip.decompress((ROOT / rel).read_bytes()))


def original_bytes(rel):
    path = ROOT / rel
    if path.exists():
        return path.read_bytes()
    return gzip.decompress((ROOT / (rel + '.gz')).read_bytes())


def f32(value):
    return struct.unpack('<f', struct.pack('<f', float(value)))[0]


def bits32(value):
    return struct.unpack('<I', struct.pack('<f', float(value)))[0]


def near(a, b, absolute=1e-15):
    return math.isclose(float(a), float(b), rel_tol=0, abs_tol=absolute)


def inventory():
    provenance = load('SOURCE-PROVENANCE.json')
    entries = provenance['copies']
    paths = set()
    for row in entries:
        rel = row['path']
        require(rel not in paths and '..' not in Path(rel).parts and not Path(rel).is_absolute(), 'Invalid/duplicate payload path: ' + rel)
        paths.add(rel)
        data = (ROOT / rel).read_bytes()
        require(len(data) == row['storedBytes'] and sha(data) == row['storedSha256'], 'Stored payload mismatch: ' + rel)
        if row['storage'] == 'gzip-lossless-mtime0':
            original = gzip.decompress(data)
        else:
            require(row['storage'] == 'byte-identical', 'Unsupported storage: ' + rel)
            original = data
        require(len(original) == row['originalBytes'] and sha(original) == row['originalSha256'], 'Original payload mismatch: ' + rel)
    generated = {'README.md', 'SOURCE-PROVENANCE.json', 'verify.py'}
    if (ROOT / 'checks/cpu-quality-summary.json').exists():
        generated.add('checks/cpu-quality-summary.json')
    actual = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file()}
    manifest_path = ROOT / 'MANIFEST.json'
    if manifest_path.exists():
        manifest = load('MANIFEST.json')
        rows = manifest['files']
        require({e['path'] for e in rows} == actual - {'MANIFEST.json'}, 'Final manifest inventory mismatch')
        require(len(rows) == manifest['fileCount'] and sum(e['bytes'] for e in rows) == manifest['payloadBytes'], 'Final manifest counts mismatch')
        original_by_path = {e['path']: e for e in entries}
        for row in rows:
            data = (ROOT / row['path']).read_bytes()
            require(len(data) == row['bytes'] and sha(data) == row['sha256'], 'Final manifest SHA mismatch: ' + row['path'])
            original = original_by_path.get(row['path'])
            if original and original['storage'] == 'gzip-lossless-mtime0':
                require(row['originalBytes'] == original['originalBytes'] and row['originalSha256'] == original['originalSha256'], 'Final manifest raw-gzip provenance mismatch')
        generated.add('MANIFEST.json')
    require(actual == paths | generated, 'Unlisted payloads or missing generated files')
    selection = load('satellite/curation-selection.original.json')
    expected = {e['path']: e for e in selection['selectedFiles'] if not e['path'].endswith('.pdf')}
    require(len(selection['selectedFiles']) == 34 and len(expected) == 33, 'S2 selected-file count mismatch')
    for rel, row in expected.items():
        stored = 'reference-verifier.py' if rel == 'verify-offline.py' else rel
        data = original_bytes('satellite/' + stored)
        require(sha(data) == row['sha256'] and len(data) == row['bytes'], 'Selected S2 payload mismatch: ' + rel)
    require(not (ROOT / 'satellite/sentinel2-scientific-view.pdf').exists(), 'Duplicate PDF unexpectedly copied')
    require(sha((ROOT / 'satellite/artifact-manifest.json').read_bytes()) == selection['fullArchiveManifestSha256'], 'Historical full archive manifest mismatch')
    for name in ['r1', 'r2']:
        require(not (ROOT / name / 'candidate-source').exists() and not (ROOT / name / 'candidate-dist').exists(), 'Candidate trees must stay external')
    freeze = load('r2/trial-freeze.json')
    for rel, expected_sha in freeze['payloadSha256'].items():
        require(sha(original_bytes('r2/' + rel)) == expected_sha, 'R2 freeze payload mismatch: ' + rel)
    return len(entries), sum(r['storedBytes'] for r in entries), manifest_path.exists()


def r2_formula():
    q = load('r2/comparison.json')
    palette = {e['classCode']: e for e in load('satellite/palette-and-diagnostics.json', parse_float=Decimal)['palette']}
    manifest = load('r2/trial-source-manifest.json')
    require(sha((ROOT / 'satellite/palette-and-diagnostics.json').read_bytes()) == manifest['paletteInputSha256'], 'R2 palette input mismatch')
    require([(e['name'], e['classCode'], e['oldLiteral']) for e in q['endpoints']] == list(ENDPOINTS), 'R2 fixed endpoint fixture changed')
    require(q['YWeights'] == [float(w) for w in Y_TEXT], 'Y weights mismatch')
    before_text = (ROOT / 'r2/terrainSurface.before.ts').read_text()
    after_text = (ROOT / 'r2/terrainSurface.after.ts').read_text()
    expected = before_text
    max_y32 = 0.0
    max_log32 = 0.0
    contrast_count = 0
    component_count = 0
    class_records = []
    all_pair_keys = []
    with localcontext() as ctx:
        ctx.prec = 50
        weights = [Decimal(w) for w in Y_TEXT]
        dot = lambda a: sum(v * w for v, w in zip(a, weights))
        max_y_ideal = Decimal(0)
        max_log_ideal = Decimal(0)
        for code in [10, 30]:
            rows = [e for e in q['endpoints'] if e['classCode'] == code]
            original = [[Decimal(s) for s in e['oldLiteral'].split(',')] for e in rows]
            centroid = [sum(a[i] for a in original) / len(rows) for i in range(3)]
            ref_y1 = [v / dot(centroid) for v in centroid]
            target = palette[code]['chromaticityY1median']
            target_y1 = [v / dot(target) for v in target]
            factor = [a / b for a, b in zip(target_y1, ref_y1)]
            quantized = []
            ideals = []
            require(q['classes'][str(code)]['sampleCount'] == palette[code]['acceptedSamples'], 'Class sample count mismatch')
            require(all(near(a, b) for a, b in zip(factor, q['classes'][str(code)]['factorRGB'])), 'Class common factor mismatch')
            for row, old in zip(rows, original):
                raw = [v * f for v, f in zip(old, factor)]
                ideal = [v * dot(old) / dot(raw) for v in raw]
                literal = [Decimal(s) for s in row['newLiteral'].split(',')]
                require([bits32(v) for v in ideal] == [bits32(v) for v in literal], 'Decimal50 formula did not reproduce endpoint f32: ' + row['name'])
                quant = [f32(v) for v in literal]
                require(quant == row['binary32RGB'], 'Recorded binary32 endpoint mismatch: ' + row['name'])
                component_count += 3
                max_y_ideal = max(max_y_ideal, abs(dot(ideal) - dot(old)))
                y_old32 = sum(float(w) * f32(v) for w, v in zip(weights, old))
                y_new32 = sum(float(w) * v for w, v in zip(weights, quant))
                delta_y32 = y_new32 - y_old32
                require(near(delta_y32, row['binary32YDelta']), 'Recorded endpoint Y delta mismatch')
                max_y32 = max(max_y32, abs(delta_y32))
                needle = 'vec3<f32>(' + row['oldLiteral'] + ')'
                require(expected.count(needle) == 1, 'Original endpoint source occurrence mismatch')
                expected = expected.replace(needle, 'vec3<f32>(' + row['newLiteral'] + ')')
                quantized.append(quant)
                ideals.append(ideal)
            for i, j in itertools.combinations(range(len(rows)), 2):
                pair_key = (code, rows[i]['name'], rows[j]['name'])
                all_pair_keys.append(pair_key)
                pair_report = next((e for e in q['pairwiseLogContrasts'] if (e['classCode'], *e['pair']) == pair_key), None)
                require(pair_report is not None, 'Missing pairwise comparison')
                for channel, label in [(0, 'R/G'), (2, 'B/G')]:
                    c_old = (original[i][channel] / original[i][1]).ln() - (original[j][channel] / original[j][1]).ln()
                    c_new = (ideals[i][channel] / ideals[i][1]).ln() - (ideals[j][channel] / ideals[j][1]).ln()
                    max_log_ideal = max(max_log_ideal, abs(c_new - c_old))
                    a, b = [list(map(f32, original[k])) for k in [i, j]]
                    old32 = math.log(a[channel] / a[1]) - math.log(b[channel] / b[1])
                    a, b = quantized[i], quantized[j]
                    new32 = math.log(a[channel] / a[1]) - math.log(b[channel] / b[1])
                    delta32 = new32 - old32
                    require(near(delta32, pair_report[label]['binary32Delta']), 'Recorded f32 channel contrast mismatch')
                    max_log32 = max(max_log32, abs(delta32))
                    contrast_count += 1
            class_records.append({'code': code, 'endpoints': len(rows), 'DecimalPrecision': 50})
        require(max_y_ideal < Decimal('1e-45') and max_log_ideal < Decimal('1e-45'), 'Decimal50 ideal invariants failed')
    require(component_count == 18 and contrast_count == 14 and len(all_pair_keys) == len(q['pairwiseLogContrasts']) == 7, 'Component/contrast fixture count mismatch')
    require(expected.count(' let denseForest=') == 1, 'Comment insertion location mismatch')
    expected = expected.replace(' let denseForest=', COMMENT + ' let denseForest=', 1)
    require(after_text.count(COMMENT) == 1 and expected == after_text, 'Source differs beyond one comment and six constants')
    no_comment = after_text.replace(COMMENT, '', 1)
    require(len(before_text.splitlines()) == len(no_comment.splitlines()), 'Unexpected material source line count')
    changed_lines = [i + 1 for i, (a, b) in enumerate(zip(before_text.splitlines(), no_comment.splitlines())) if a != b]
    require(len(changed_lines) == 3 and changed_lines == q['colourSourceLinesChanged'], 'Expected exactly three colour source lines')
    hashes_before = manifest['sourceHashesBefore']
    hashes_after = manifest['sourceHashesAfter']
    require(len(hashes_before) == len(hashes_after) == 119 and hashes_before.keys() == hashes_after.keys(), 'Frozen source-manifest scope mismatch')
    changed = sorted(k for k in hashes_before if hashes_before[k] != hashes_after[k])
    require(changed == ['src/cumulonimbus/GPUSceneEngine.ts', 'src/cumulonimbus/terrainSurface.ts'], 'Unexpected manifest source changes')
    material_path = 'src/cumulonimbus/terrainSurface.ts'
    require(sha(before_text.encode()) == hashes_before[material_path] and sha(after_text.encode()) == hashes_after[material_path], 'Before/after material provenance mismatch')
    require(sha((ROOT / 'r1/terrainSurface.before.ts').read_bytes()) == hashes_before[material_path], 'R1/R2 baselines differ')
    historical = load('r2/verification.json')
    require(historical['pairwiseIndependentLogContrasts'] == contrast_count, 'Historical contrast count mismatch')
    require(near(max_y32, historical['maxF32IntrinsicYAbsDelta']) and near(max_log32, historical['maxF32LogContrastDelta']), 'Historical numeric summary mismatch')
    require(near(max_y32, q['maxBinary32YAbsDelta']) and near(max_log32, q['maxBinary32LogContrastDelta']), 'Comparison numeric summary mismatch')
    return {'classes': class_records, 'matchingBinary32Components': component_count, 'pairwiseChannelContrasts': contrast_count, 'maxDecimal50YAbsResidual': str(max_y_ideal), 'maxDecimal50LogContrastResidual': str(max_log_ideal), 'maxF32IntrinsicYAbsDelta': max_y32, 'maxF32LogContrastDelta': max_log32, 'changedColourSourceLines': changed_lines, 'sourceManifestEntriesCompared': 119, 'sourceTreeFilesRead': 0}


def approved_checks(compare_summary=True):
    if not (ROOT / 'checks').exists():
        return None
    source_sha = '30c5448e87fb60c3bd3fdc8ca133993c49e54503a9950f9da1815fd59883171f'
    dist_sha = '79d07ae7119d9085a61083fdc32f9125218d0d59ad1c39c16eb9fae6a4ee2f86'
    require(sha((ROOT / 'checks/approved-source-119.json').read_bytes()) == source_sha, 'Root-approved source manifest SHA mismatch')
    require(sha((ROOT / 'checks/approved-dist-30.json').read_bytes()) == dist_sha, 'Root-approved dist manifest SHA mismatch')
    source = load('checks/approved-source-119.json')
    dist = load('checks/approved-dist-30.json')
    trial = load('r2/trial-source-manifest.json')['sourceHashesAfter']
    require(len(source) == 119 and len(dist) == 30 and source.keys() == trial.keys(), 'Approved manifest scope mismatch')
    require(source['src/cumulonimbus/terrainSurface.ts'] == sha((ROOT / 'r2/terrainSurface.after.ts').read_bytes()), 'Approved material differs from R2')
    approved_diff = sorted(k for k in source if source[k] != trial[k])
    require(approved_diff == ['public/terrain-data-notice.txt', 'src/cumulonimbus/GPUSceneEngine.ts', 'src/cumulonimbus/lifecycle.test.ts', 'src/cumulonimbus/scene.css'], 'Unexpected approved-vs-trial metadata changes')
    tests = load_gzip('checks/test-results.json.gz')
    require(tests['success'] is True and tests['numTotalTests'] == tests['numPassedTests'] == 341 and tests['numFailedTests'] == 0, 'Final test counts mismatch')
    require(len(tests['testResults']) == 43, 'Final test file count mismatch')
    assertions = [a for suite in tests['testResults'] for a in suite['assertionResults']]
    require(len(assertions) == 341 and all(a['status'] == 'passed' for a in assertions), 'Final assertion records mismatch')
    initial = load_gzip('checks/initial-test-results.json.gz')
    require(initial['success'] is False and initial['numPassedTests'] == 337 and initial['numFailedTests'] == 4, 'Initial failure counts mismatch')
    failure_note = load('checks/initial-test-failure.json')
    require(failure_note['previousPassed'] == 337 and failure_note['previousFailed'] == 4, 'Initial failure note mismatch')
    failed_records = [a['fullName'] for suite in initial['testResults'] for a in suite['assertionResults'] if a['status'] == 'failed']
    require(len(failed_records) == 4, 'Initial failed assertion record count mismatch')
    for name in ['app-build.log.gz', 'hero-build.log.gz']:
        require(b'built in' in gzip.decompress((ROOT / 'checks' / name).read_bytes()), 'Approved successful build log missing')
    require(b'tsc --noEmit' in gzip.decompress((ROOT / 'checks/typecheck.log.gz').read_bytes()), 'Approved typecheck log missing')
    runs = {}
    cameras = []
    for name in ['sun', 'rain']:
        raw_bytes = gzip.decompress((ROOT / ('checks/' + name + '-native.raw.json.gz')).read_bytes())
        raw = json.loads(raw_bytes)
        root_summary = load('checks/performance-summary.json')['runs'][name]
        require(root_summary['rawBytes'] == len(raw_bytes) and root_summary['rawSha256'] == sha(raw_bytes), 'Compact Root summary raw provenance mismatch')
        intervals = raw['frameIntervalsMs']
        require(intervals and all(math.isfinite(x) and x > 0 for x in intervals), 'Invalid frame intervals')
        ordered = sorted(intervals)
        count = len(intervals)
        duration = sum(intervals)
        percentile = lambda p: ordered[min(count - 1, math.floor(count * p))]
        calculated = {'frames': count, 'durationMs': duration, 'fps': count * 1000 / duration, 'medianMs': percentile(.5), 'p95Ms': percentile(.95), 'p99Ms': percentile(.99), 'maxMs': ordered[-1], 'over18Ms': sum(x > 18 for x in intervals), 'over33Ms': sum(x > 33.34 for x in intervals)}
        for key, value in calculated.items():
            require(near(value, raw['stats'][key], 1e-6), 'Raw pacing arithmetic mismatch: ' + name + '/' + key)
            require(near(value, raw['submissionPacing'][key], 1e-6), 'Submission pacing arithmetic mismatch')
        require(near(calculated['fps'], raw['submissionFps']), 'Submission FPS mismatch')
        queue = raw['queuePrefix']
        require(queue['status'] == 'completed' and queue['reason'] is None, 'Queue prefix incomplete')
        require(queue['measuredSubmissions'] == queue['confirmedPrefixId'] == count and queue['unconfirmedMeasuredFrames'] == 0, 'Measured prefix count mismatch')
        samples = queue['samples']
        require(all(s['status'] == 'completed' and s['error'] is None for s in samples), 'Queue sample failure')
        require(all(0 <= s['prefixId'] <= count for s in samples), 'Queue sample prefix out of range')
        require([s['prefixId'] for s in samples] == sorted(s['prefixId'] for s in samples), 'Queue sample prefixes not monotonic')
        end = samples[-1]
        require(end['kind'] == 'end' and end['prefixId'] == count, 'Final queue sample missing')
        require(near(end['latencyMs'], end['resolvedAtMs'] - end['requestedAtMs'], 1e-6) and near(queue['endDrainMs'], end['latencyMs']), 'Final queue drain mismatch')
        bounded = count * 1000 / (end['resolvedAtMs'] - queue['windowStartedAtMs'])
        require(near(bounded, queue['completionBoundedSubmissionFps']), 'Completion-bounded rate mismatch')
        require(raw['quality'] == 'ultra' and raw['nominalSteps'] == 384, 'Quality or step count mismatch')
        require(raw['output'] == raw['internal'] == [2474, 1844], 'Native output grid mismatch')
        require(raw['volume'] == [256] * 3 and raw['detailVolume'] == [128] * 3, 'Volume grid mismatch')
        require(raw['ablation'] == raw['flowMode'] == 'full' and raw['skyPending'] is False, 'Ablation/flow/sky state mismatch')
        require(raw['rendererVersion'] == 'observatory-v55-s2-chromaticity' and raw['executionThread'] == 'main', 'Approved runtime identity mismatch')
        require(raw['seed'] == 74 and raw['paused'] is True and raw['simulationTimeStart'] == raw['simulationTimeEnd'] == 60, 'Frozen simulation state mismatch')
        require(raw['weather']['wind'] == .55 and raw['weather']['dispersion'] == 0 and raw['weather']['atmosphereTransition'] == 1, 'Weather comparison state mismatch')
        require(raw['camera']['target'] == raw['camera']['comparisonTargetKm'] == [0, 2.7, 0] and raw['camera']['ground'] == 1, 'Comparison target/ground mismatch')
        require(raw['clockStateStart']['forcingTime'] == raw['clockStateEnd']['forcingTime'] == 0 and raw['clockStateStart']['precipitationUniformTime'] == raw['clockStateEnd']['precipitationUniformTime'] == 0, 'Frozen forcing/precipitation clock mismatch')
        require(raw['densitySamplingStart'] == raw['densitySamplingEnd'], 'Density path changed during window')
        expected_mode = 'dry' if name == 'sun' else 'rain'
        require(raw['narrowCloudSkip']['specialization'] == raw['narrowCloudSpecializationEnd'] == expected_mode, 'Weather specialization changed')
        if name == 'sun':
            require(raw['weather']['rain'] == 0 and raw['densitySamplingStart']['path'] == 'macro-rgba8-r', 'Sun path mismatch')
        else:
            require(abs(raw['weather']['rain'] - .8) < 1e-5 and raw['densitySamplingStart']['path'] == 'r8unorm-extracted-r', 'Rain/R8 path mismatch')
        require(raw['presentedCanvasFps'] is None, 'Unexpected compositor presentation claim')
        require(root_summary['stats'] == raw['stats'], 'Compact Root pacing summary mismatch')
        require(root_summary['queue'] == {k: queue[k] for k in root_summary['queue']}, 'Compact Root prefix summary mismatch')
        require(root_summary['timestampCoverage'] == raw['timestampPasses']['coverage'], 'Compact Root timestamp coverage mismatch')
        for key in ['rendererVersion', 'camera', 'weather', 'quality', 'output', 'internal', 'volume', 'detailVolume', 'nominalSteps', 'presentedCanvasFps']:
            require(root_summary[key] == raw[key], 'Compact Root quality/state summary mismatch: ' + key)
        require(root_summary['densityPath'] == raw['densitySamplingStart']['path'], 'Compact Root density-path summary mismatch')
        cameras.append(raw['camera'])
        runs[name] = {'stats': calculated, 'queueStatus': queue['status'], 'confirmedSubmissions': count, 'endDrainMs': queue['endDrainMs'], 'completionBoundedSubmissionFps': bounded, 'queueSamplesCompleted': len(samples), 'densityPath': raw['densitySamplingStart']['path'], 'rainUniformAtStart': raw['weather']['rain'], 'nativeOutput': raw['output'], 'nominalSteps': raw['nominalSteps'], 'volume': raw['volume'], 'detailVolume': raw['detailVolume'], 'timestampCoverage': raw['timestampPasses']['coverage'], 'renderPassSumUsedAsExclusiveCost': False}
    require(cameras[0] == cameras[1], 'Sun/rain camera mismatch')
    console = load('checks/main-console.json')
    require(console['newEntries'] == [], 'New console entries present after approved navigation')
    require(len(console['allReturned']) == 1 and console['allReturned'][0]['level'] == 'error', 'Historical console observation changed')
    historical_error = console['allReturned'][0]
    require(historical_error['timestamp'] == '2026-10-16T15:55:05.403Z', 'Historical error timestamp changed')
    require(datetime.fromisoformat(historical_error['timestamp'].replace('Z', '+00:00')) < datetime.fromisoformat(console['since'].replace('Z', '+00:00')), 'Historical console chronology mismatch')
    for rel in ['r1/browser/r1-console.json', 'r2/browser/r2-console.json']:
        require(load(rel)['newEntries'] == [], 'New trial console entries present')
    functional = {}
    for name in ['worker', 'preview']:
        record = load('checks/' + name + '-functional.json')
        require(record['canvas'] == {'cssHeight': 922, 'cssWidth': 1237, 'height': 1844, 'width': 2474}, 'Functional canvas dimensions mismatch')
        require(record['newErrorsSinceApprovedNavigation'] == [], 'Functional new errors present')
        for token in ['Output 2474×1844 · interno 2474×1844', '384 passi nominali', 'Volume 256³ + dettaglio 128³', 'seme: 74']:
            require(token in record['performanceLive'], 'Functional DOM quality marker missing: ' + token)
        if name == 'worker':
            require(record['performanceLive'].startswith('Worker WebGPU') and 'Tempo della nube: 60.0 s' in record['performanceLive'], 'Worker DOM identity mismatch')
            require('worker=1' in record['route'] and 'profile=1' in record['route'], 'Worker diagnostic route mismatch')
        else:
            require(record['route'] == 'http://localhost:4196/?seed=74' and record['mode'] == 'main, Sole, ordinary animated preview', 'Ordinary preview route/mode mismatch')
            require(record['performanceLive'].startswith('WebGPU') and 'Tempo della nube: 97.2 s' in record['performanceLive'], 'Ordinary preview DOM identity mismatch')
        functional[name] = {'route': record['route'], 'canvas': record['canvas'], 'newErrorsSinceApprovedNavigation': 0, 'scope': record['scope']}
    result = {'status': 'PASS_RECORDED_APPROVED_METADATA_TESTS_PACING_PREFIX_AND_FUNCTIONAL_DOM', 'approvedRendererVersion': 'observatory-v55-s2-chromaticity', 'approvedSourceManifestSha256': source_sha, 'approvedDistManifestSha256': dist_sha, 'sourceCount': 119, 'distCount': 30, 'approvedVsR2TrialChangedPaths': approved_diff, 'rootSourceTreeFilesRead': 0, 'finalTests': {'passed': 341, 'failed': 0, 'files': 43}, 'initialTests': {'passed': 337, 'failed': 4, 'failedAssertions': failed_records, 'explanationSource': 'Root note checks/initial-test-failure.json; not a new causal experiment'}, 'camera': cameras[0], 'runs': runs, 'functional': functional, 'console': {'newEntriesSince': console['since'], 'newEntries': 0, 'historicalErrorTimestamp': historical_error['timestamp'], 'originAttributed': False}, 'limits': ['Recorded submission pacing and completed queue prefix, not compositor presentation or 60 stable.', 'over33Ms field uses the existing strict threshold >33.34ms.', 'No causal speedup/regression comparison: earlier v54 used a different camera target.', 'Timestamp render-pass endpoints may overlap; sums are not exclusive GPU cost.', 'Functional worker/preview records are DOM and CSS screenshot evidence, not main/worker native-pixel identity or a worker benchmark.', 'No global zero-console claim; the earlier unattributed MutationObserver error is preserved.', 'Source/dist manifests are Root-approved frozen metadata; default does not read their trees.', 'No GPU/browser/build/product-test rerun by this verifier.']}
    if compare_summary:
        require(load('checks/cpu-quality-summary.json') == result, 'Curated CPU summary mismatch')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-runtime', type=Path, help='Optional explicit approved source directory: check the 119 named files only, without a recursive scan')
    args = parser.parse_args()
    count, size, final = inventory()
    formula = r2_formula()
    approved = approved_checks()
    runtime_checked = 0
    if args.verify_runtime:
        require(approved is not None, 'Approved source manifest missing')
        for rel, expected in load('checks/approved-source-119.json').items():
            require(sha((args.verify_runtime / rel).read_bytes()) == expected, 'Explicit runtime source SHA mismatch: ' + rel)
            runtime_checked += 1
    compact_approved = None if approved is None else {'status': approved['status'], 'tests': approved['finalTests'], 'rates': {k: v['stats']['fps'] for k, v in approved['runs'].items()}, 'sourceCount': approved['sourceCount'], 'distCount': approved['distCount']}
    print(json.dumps({'status': 'PASS_CURATED_PAYLOAD_SHA_AND_R2_FORMULA', 'copiedOriginalPayloads': count, 'copiedStoredBytes': size, 'finalManifestPresent': final, 'formula': formula, 'approvedRecordedChecks': compact_approved, 'writes': False, 'rawSatelliteReplay': False, 'historicalScriptsExecuted': False, 'explicitRuntimeFilesChecked': runtime_checked, 'defaultSourceTreeAccess': False, 'gpuBrowserBuildProductTestsRun': False, 'qualification': 'R1 rejected; R2 Root-approved colour checkpoint with scoped recorded main/worker/preview evidence, not global photo/FPS acceptance'}, indent=2))


if __name__ == '__main__':
    main()
