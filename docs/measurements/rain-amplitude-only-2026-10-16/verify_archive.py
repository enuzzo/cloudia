#!/usr/bin/env python3
"""Offline integrity + recorded per-ray statistics; NEVER imports/runs the renderer or model."""
from pathlib import Path
import argparse
import difflib
import gzip
import hashlib
import json
import math
import struct
import sys

ROOT = Path(__file__).resolve().parent
checks = []
COMPRESSED = json.loads((ROOT / 'compression-record.json').read_text())['files']

def require(ok, label):
    if not ok:
        raise AssertionError(label)
    checks.append(label)

def read_payload(name):
    # Historical manifests retain logical JSON names and original SHA/size.
    # Current inventory hashes stored .gz bytes; only a logical name is decoded.
    name = str(name)
    item = COMPRESSED.get(name)
    return gzip.decompress((ROOT / item['storedPath']).read_bytes()) if item else (ROOT / name).read_bytes()

def load(name):
    return json.loads(read_payload(name).decode('utf-8'))

def digest(data):
    return hashlib.sha256(data).hexdigest()

def near(a, b):
    return isinstance(a, (int, float)) and isinstance(b, (int, float)) and math.isfinite(a) and math.isfinite(b) and math.isclose(a, b, rel_tol=2e-12, abs_tol=1e-12)

def f32(v):
    return struct.unpack('<f', struct.pack('<f', v))[0]

def check_inventory(entries, label):
    for name, entry in entries.items():
        part = Path(name)
        require(not part.is_absolute() and '..' not in part.parts, label + ': safe path ' + name)
        data = read_payload(str(part))
        require(len(data) == entry['bytes'] and digest(data) == entry['sha256'], label + ': SHA/bytes ' + name)

def metric(values, recorded, label):
    require(bool(values), label + ': nonempty')
    require(all(math.isfinite(v) and v >= 0 for v in values), label + ': finite nonnegative')
    ordered = sorted(values)
    total = total2 = 0.0
    for v in values:
        total += v
        total2 += v * v
    n = len(values)
    result = {'n': n, 'mean': total / n, 'rms': math.sqrt(total2 / n),
              'max': max(values)}
    for key, q in [('p50', .5), ('p95', .95), ('p99', .99)]:
        result[key] = ordered[min(n - 1, math.ceil(n * q) - 1)]
    require(recorded['n'] == n and all(near(result[k], recorded[k]) for k in result if k != 'n'), label + ': recomputed n/mean/RMS/quantiles/max')
    return result

def verify(frozen_root=None):
    manifest = load('archive-manifest.json')
    check_inventory(manifest['files'], 'archive')
    compression = load('compression-record.json')
    require(len(COMPRESSED) == 3, 'exactly three compressed original JSON')
    if frozen_root is not None:
        require(digest((frozen_root / 'freeze-manifest.json').read_bytes()) == compression['R1FreezeManifestSha256'], 'frozen R1 identity manifest SHA')
        frozen_archive_manifest = frozen_root / 'docs/measurements/rain-amplitude-only-2026-10-16/archive-manifest.json'
        require(digest(frozen_archive_manifest.read_bytes()) == compression['R1ArchiveManifestSha256'], 'frozen R1 archive manifest SHA')
    for logical, item in COMPRESSED.items():
        stored = (ROOT / item['storedPath']).read_bytes()
        decoded = read_payload(logical)
        require(len(stored) == item['compressedBytes'] and digest(stored) == item['compressedSha256'], 'compressed SHA/bytes: ' + logical)
        require(stored[:3] == b'\x1f\x8b\x08' and stored[3] == 0 and stored[4:8] == bytes(4) and item['gzipMtime'] == 0, 'gzip mtime0/no original filename: ' + logical)
        require(len(decoded) == item['originalBytes'] and digest(decoded) == item['originalSha256'], 'decompressed original SHA/bytes: ' + logical)
        require(not (ROOT / logical).exists(), 'only compressed original retained in repo: ' + logical)
        if frozen_root is not None:
            require(decoded == (frozen_root / item['R1OriginalRelativePath']).read_bytes(), 'decompressed bytes exactly equal frozen R1 original: ' + logical)
    if 'summaryDocument' in manifest:
        item = manifest['summaryDocument']
        summary = ROOT.parent.parent / item['name']
        require(digest(summary.read_bytes()) == item['sha256'], 'summary document SHA')
    copies = load('archive-copy-record.json')
    check_inventory(copies['files'], 'lossless copies')
    before = load('pre-run-manifest.json')
    check_inventory({v['path']: v for v in before['files']}, 'pre-run freeze')
    after = load('after-run-manifest.json')
    check_inventory({v['path']: v for v in after['files']}, 'after-run inventory')
    report = load('result.json')
    baseline = load('historical-replay.json')
    old = load('inputs/baseline-control-replay.json')
    inputs = load('inputs/data-manifest.json')
    preparation = load('preparation.json')
    require(after['executionCount'] == 1 and after['processExitCode'] == 0 and after['bakesPerformed'] == 0 and not after['gpuExecuted'], 'recorded single CPU run/no bake/GPU')
    require(report['status'] == 'completed' and all(report['checks'].values()), 'recorded audit checks passed')
    require(after['resultSha256'] == digest(read_payload('result.json')), 'result matches original after-run SHA')
    require(report['payloadHashes']['preRunManifest'] == digest((ROOT / 'pre-run-manifest.json').read_bytes()), 'pre-run manifest digest chain')
    for key, path in [('protocol', 'PROTOCOL.md'), ('protocolUVAddendum', 'PROTOCOL-UV-ADDENDUM.md'), ('replay', 'replay.ts'), ('auditCore', 'audit-core.ts'), ('oracleCore', 'oracle-core.ts'), ('preparation', 'preparation.json')]:
        require(report['payloadHashes'][key] == digest((ROOT / path).read_bytes()), 'run payload SHA: ' + key)
    for item, name in zip(preparation['controlInputs'], ['data-manifest.json', 'input-control.json', 'baseline-control-replay.json']):
        require(digest(read_payload('inputs/' + name)) == item['sha256'], 'lossless control input: ' + name)

    expected = inputs['sourceHashesAfter']
    require(len(expected) == 10, 'ten bake source hashes')
    for item in preparation['sources']:
        name = item['name']
        raw = (ROOT / 'source-original/src/cumulonimbus' / (name + '.ts')).read_bytes()
        runtime = (ROOT / 'source-runtime/src/cumulonimbus' / (name + '.ts')).read_bytes()
        require(digest(raw) == item['originalSha256'] and digest(runtime) == item['runtimeSha256'], 'source snapshot/runtime SHA: ' + name)
        if name in expected:
            require(digest(raw) == expected[name], 'source matches bake manifest: ' + name)
        if name == 'motionField':
            replacement = ("from '" + str(Path(preparation['dependencies'][0]['path']).parent / 'build/three.webgpu.js') + "'").encode()
            require(raw.count(b"from 'three/webgpu'") == 1 and runtime == raw.replace(b"from 'three/webgpu'", replacement), 'motionField only declared dependency path changed')
        else:
            require(raw == runtime, 'unmodified runtime source: ' + name)
    for original_name, changed_name in [('replay.ts', 'replay.ts'), ('audit-core.ts', 'oracle-core.ts')]:
        original = (ROOT / 'inputs' / (original_name + '.phase2-original')).read_text()
        changed = (ROOT / changed_name).read_text()
        patch = ''.join(difflib.unified_diff(original.splitlines(True), changed.splitlines(True), fromfile='phase2/' + changed_name, tofile='amplitude-only/' + changed_name))
        require(patch == (ROOT / (changed_name + '.transform.patch')).read_text(), 'stored transform reconstructs diff: ' + changed_name)

    expected_sequence = 'a0c2dfd79e1900dce9a677fceecbd5bfcfc138a2e94cd430938f4c4c7bf3ca7a'
    require(report['baselineSequenceSha256'] == baseline['sequenceSha256'] == old['sequenceSha256'] == expected_sequence, 'recorded baseline sequence digests agree; NOT recomputed point sequence')
    require(baseline['counts'] == old['counts'] and baseline['semanticTextureSampleCalls'] == old['semanticTextureSampleCalls'], 'complete historical counters/lookup counters equal')
    require(len(baseline['rays']) == 576, '576 baseline ray records')
    for group, field in [('counts', 'counts'), ('semanticTextureSampleCalls', 'lookups')]:
        totals = {key: 0 for key in baseline[group]}
        for ray in baseline['rays']:
            for key, value in ray[field].items():
                totals[key] += value
        require(all(near(value, baseline[group][key]) for key, value in totals.items()), 'recomputed baseline per-ray ' + group)
    require(sum(ray['iterations'] for ray in baseline['rays']) == 246399 and baseline['counts']['rainRegion'] == 206466 and baseline['counts']['rainPositive'] == 91572, 'baseline principal counters')
    require(report['mappingChecks'] == report['rainPoints'] == 206466 and report['mappingFailures'] == 0 and report['originalMappingSha256'] == report['candidateMappingSha256'], 'recorded mapping count/hash consistency; NOT rehashed coordinates')
    require(report['uvInvalidPoints'] == 0, 'recorded UV-false branch not exercised')

    summaries = []
    for grid in report['grids']:
        size = grid['size']
        rays = grid['rays']
        require(len(rays) == 576 and [r['ray'] for r in rays] == list(range(576)), str(size) + ': complete unique ray IDs')
        for r, b in zip(rays, baseline['rays']):
            require(near(r['candidateTotalTau'] - r['baselineTotalTau'], r['deltaTau']) and near(r['candidateTFixedPath'] - r['baselineT'], r['deltaT']), str(size) + ': signed deltas ray ' + str(r['ray']))
            require(r['exit'] == b['exit'] and near(r['baselineT'], b['transmittance']) and near(r['lastTKm'], b['lastTKm']), str(size) + ': unchanged baseline endpoint ray ' + str(r['ray']))
            require(r['maximumPointwiseTError'] + 1e-12 >= abs(r['deltaT']), str(size) + ': prefix maximum includes final T ray ' + str(r['ray']))
            censored = r['exit'] == 'opacity' and r['candidateTFixedPath'] >= f32(.006)
            require(censored == r['candidateWouldContinueBeyondBaseline'], str(size) + ': cutoff censor classification ray ' + str(r['ray']))
        m = grid['metrics']
        tau = metric([abs(r['deltaTau']) for r in rays], m['absoluteRayTau'], str(size) + ': tau')
        final_t = metric([abs(r['deltaT']) for r in rays], m['absoluteRayT'], str(size) + ': final T')
        prefix_t = metric([r['maximumPointwiseTError'] for r in rays], m['maximumRayPointwiseTError'], str(size) + ': recorded per-ray prefix T maxima')
        rainy = [r for r in rays if r['baselineRainTau'] > 0]
        require(len(rainy) == grid['rainPositiveRayCount'] == 247 and near(sum(abs(r['deltaTau']) for r in rainy) / len(rainy), grid['absoluteRayTauMeanRainPositiveRays']), str(size) + ': rainy-ray denominator and mean')
        censored = sum(r['candidateWouldContinueBeyondBaseline'] for r in rays)
        require(censored == grid['censoredContinuationCount'] == {128: 4, 256: 1}[size], str(size) + ': censored continuation count')
        s = grid['support']
        require(m['mappingMContributorUnion']['n'] == m['mappingMOriginalContributors']['n'] + s['effectiveOriginalAZeroCandidatePositive'], str(size) + ': recorded support/union counters consistent')
        for name in ['mappingMOriginalContributors', 'mappingMContributorUnion', 'mappingMAllRainRegion']:
            require(all(m[name][key] == 0 for key in ['mean', 'rms', 'p50', 'p95', 'p99', 'max']), str(size) + ': recorded zero mapping metric ' + name)
        gates = {'mappingP99': m['mappingMOriginalContributors']['p99'] <= .75,
                 'mappingMax': m['mappingMOriginalContributors']['max'] <= 1.5,
                 'mappingUnionP99': m['mappingMContributorUnion']['p99'] <= .75,
                 'mappingUnionMax': m['mappingMContributorUnion']['max'] <= 1.5,
                 'tauMax': tau['max'] <= .01, 'tauMean': tau['mean'] <= .002}
        require(gates == grid['gates'] and all(gates.values()) == grid['engineeringGatePass'], str(size) + ': recomputed frozen gates (mapping from recorded metrics)')
        for name in ['worstMapping', 'worstEffectiveA', 'worstSigma']:
            w = grid[name]
            reconstructed_a = weight_sum = 0.0
            for corner in w['corners']:
                decoded_a = struct.unpack('<e', struct.pack('<H', corner['packed'] & 65535))[0]
                require(decoded_a == corner['A'], str(size) + ': witness binary16 A decode')
                reconstructed_a += decoded_a * corner['weight']
                weight_sum += corner['weight']
            require(near(weight_sum, 1) and f32(reconstructed_a) == w['candidate']['rawA'], str(size) + ': witness interpolation from SAVED corners ' + name)
            valid = all(0 < v < 1 for v in w['original']['uv'])
            effective_a = w['candidate']['rawA'] if valid else 0
            require(valid == w['validUV'] and effective_a == w['candidate']['effectiveA'], str(size) + ': witness raw/effective A UV gate ' + name)
        summaries.append({'size': size, 'gates': gates, 'engineeringGatePass': all(gates.values()), 'tauMaxRecomputed': tau['max'], 'tauMeanRecomputed': tau['mean'], 'finalTMaxFromPerRay': final_t['max'], 'prefixTMaxFromRecordedPerRayMaxima': prefix_t['max'], 'censoredContinuationCount': censored})
    return {'kind': 'offline-archive-and-recorded-statistics-verification', 'status': 'PASS', 'checksPassed': len(checks), 'archiveFilesHashed': len(manifest['files']), 'compressedOriginalsVerified': len(COMPRESSED), 'frozenOriginalsByteCompared': len(COMPRESSED) if frozen_root is not None else 0, 'newModelReplay': False, 'newGpuExecution': False, 'mappingCoordinatesRehashed': False, 'baselinePointSequenceRehashed': False, 'originalBinaryArraysRead': False, 'pointwiseAmplitudeSigmaDistributionsRecomputed': False, 'scope': 'Stored/decompressed original hashes, optional exact frozen R1 comparison, transforms; counters from 576 saved baseline rays; tau/final-T summaries from saved per-ray deltas; maximum-T summary from saved per-ray maxima; gates with recorded mapping summaries; half A interpolation from saved witness corners only. Not a full replay or native/GPU qualification.', 'limits': ['Full 206466 point coordinates are not serialized, so equal recorded digests are checked but NOT recalculated.', 'Per-ray maximum T values are inputs to the summary; within-ray T trajectories are not serialized.', 'Per-point support changes, A/sigma distribution and sigma grouping residual remain recorded diagnostics, not independently replayed.', 'UV outside domain has zero recorded samples; false branch unexercised. Binary cloud arrays/dependency bundles absent.'], 'grids': summaries}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frozen-root', type=Path, help='Optional external R1 identity root for exact comparison of all three decompressed originals.')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.frozen_root), indent=2))
    except (AssertionError, KeyError, ValueError, OSError) as exc:
        print(json.dumps({'kind': 'offline-archive-and-recorded-statistics-verification', 'status': 'FAIL', 'error': str(exc), 'checksPassedBeforeFailure': len(checks)}, indent=2))
        sys.exit(1)
