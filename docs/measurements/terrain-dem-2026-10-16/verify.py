#!/usr/bin/env python3
"""Independent portable offline evidence checks. Stdlib only; never runs GPU or preprocessing."""
import argparse
from array import array
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ASSET_SHA = '92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d'
ASSET_PATH = 'src/cumulonimbus/assets/liguria-apuane-dem.bin'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load(path):
    return json.loads(path.read_text())


def bounded_path(root, relative):
    p = root / relative
    assert not p.is_symlink() and p.resolve().is_relative_to(root.resolve()), relative
    return p


def check_file(root, item):
    data = bounded_path(root, item['path']).read_bytes()
    assert len(data) == item['bytes'] and digest(data) == item['sha256'], item['path']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=HERE / '../../..',
                        help='Repo root; default fits docs/measurements/terrain-dem-2026-10-16')
    parser.add_argument('--verify-runtime-sources', action='store_true',
                        help='Check all 113 explicitly listed R2 source files; no directory scan')
    parser.add_argument('--dist', type=Path, help='Optionally check 28 explicit external dist files')
    args = parser.parse_args()
    repo = args.repo.resolve()
    manifest_path = HERE / 'MANIFEST.json'
    if manifest_path.exists():
        manifest = load(manifest_path)
        assert len(manifest['files']) == manifest['fileCount']
        assert len({i['path'] for i in manifest['files']}) == manifest['fileCount']
        for item in manifest['files']:
            check_file(HERE, item)
        assert sum(i['bytes'] for i in manifest['files']) == manifest['payloadBytes']
        actual = {str(p.relative_to(HERE)) for p in HERE.rglob('*') if p.is_file()}
        assert actual == {'MANIFEST.json'} | {i['path'] for i in manifest['files']}, 'Unlisted package file'

    origins = load(HERE / 'origins.json')
    for item in origins['copiedOriginals']:
        data = bounded_path(HERE, item['path']).read_bytes()
        if item['path'].endswith('.gz'):
            data = gzip.decompress(data)
            assert len(data) == item['uncompressedBytes']
            assert digest(data) == item['uncompressedSha256']
        else:
            assert len(data) == item['bytes'] and digest(data) == item['sha256'], item['path']

    report = load(HERE / 'preprocess/preprocess-result.json')
    for filename, key in [('PREPROCESS-PROTOCOL.md', 'protocolSha256'),
                          ('preprocess-dem.py', 'scriptSha256'),
                          ('tiles-manifest.json', 'inputManifestSha256')]:
        assert digest((HERE / 'preprocess' / filename).read_bytes()) == report[key]
    assert all(value is True for value in report['hardGates'].values())
    assert report['asset']['sha256'] == ASSET_SHA

    data = bounded_path(repo, ASSET_PATH).read_bytes()
    assert len(data) == 4202532 and digest(data) == ASSET_SHA
    magic, side, spacing, xmin, zmin = struct.unpack('<4sIddd', data[:32])
    assert (magic, side, spacing, xmin, zmin) == (b'CDM1', 1025, .125, -64., -64.)
    n = side * side
    assert len(data) == 32 + n * 4
    heights, coast = array('H'), array('h')
    heights.frombytes(data[32:32 + n * 2])
    coast.frombytes(data[32 + n * 2:])
    if sys.byteorder != 'little':
        heights.byteswap()
        coast.byteswap()
    assert len(heights) == len(coast) == n == 1050625
    assert min(heights) == 0 and max(heights) == 17174
    assert min(coast) == -7681 and max(coast) == 10551
    ocean = sum(1 for value in coast if value < 0)
    assert ocean == 434561 and n - ocean == 616064
    assert all(h == 0 for h, c in zip(heights, coast) if c < 0)
    assert all(-32768 < c < 32767 for c in coast), 'Coast saturation'
    mean_height_m = sum(heights) * .125 / n
    assert math.isclose(mean_height_m, 323.88545722784056, abs_tol=1e-11)
    for ix, iz, h, c in [(0, 0, 910, 4008), (1024, 0, 0, -6883),
                          (0, 1024, 724, 10551), (1024, 1024, 10714, 3179),
                          (512, 512, 0, -538)]:
        assert heights[iz * side + ix] == h and coast[iz * side + ix] == c
    assert max(heights) * .125 < 3310
    assert report['heightMetres']['max'] == max(heights) * .125
    assert report['mask']['borderConnectedOceanNodes'] == ocean
    assert report['coastMetres']['min'] == min(coast) * 8
    assert report['coastMetres']['max'] == max(coast) * 8
    # This independently checks the delivered asset, not source TIFF resampling,
    # seam continuity, ocean flood, EDT or source-to-quantized error bounds.

    source_manifest = load(HERE / 'source/dem-r2-source-manifest.json')
    assert len(source_manifest) == 113 and source_manifest[ASSET_PATH] == ASSET_SHA
    if args.verify_runtime_sources:
        for name, sha in source_manifest.items():
            assert digest(bounded_path(repo, name).read_bytes()) == sha, name
    dist_manifest = load(HERE / 'source/dem-r2-dist-manifest.json')
    assert len(dist_manifest['files']) == dist_manifest['fileCount'] == 28
    assert sum(i['bytes'] for i in dist_manifest['files']) == dist_manifest['bytes'] == 26633495
    assert any(i['sha256'] == ASSET_SHA and i['bytes'] == 4202532 for i in dist_manifest['files'])
    if args.dist:
        for item in dist_manifest['files']:
            check_file(args.dist.resolve(), item)
    suite = gzip.decompress((HERE / 'source/dem-r2-suite.log.gz').read_bytes()).decode()
    assert 'Test Files  41 passed (41)' in suite and 'Tests  328 passed (328)' in suite

    summary = load(HERE / 'benchmark/summary.json')
    raw = gzip.decompress((HERE / 'benchmark/dem-r2-rain-benchmark.json.gz').read_bytes())
    assert len(raw) == summary['raw']['uncompressedBytes']
    assert digest(raw) == summary['raw']['uncompressedSha256'] == origins['benchmarkRaw']['uncompressedSha256']
    x = json.loads(raw)
    intervals = x['frameIntervalsMs']
    assert len(intervals) == 436 and all(math.isfinite(v) and v > 0 for v in intervals)
    total = sum(intervals)
    assert total == x['stats']['durationMs'] == summary['intervalSumMs']
    assert len(intervals) * 1000 / total == x['stats']['fps'] == x['submissionFps'] == summary['submissionFps']
    ordered = sorted(intervals)
    for key, p in [('medianMs', .5), ('p95Ms', .95), ('p99Ms', .99)]:
        assert ordered[math.floor(len(ordered) * p)] == x['stats'][key]
    assert ordered[-1] == x['stats']['maxMs']
    assert sum(t > 18 for t in intervals) == x['stats']['over18Ms']
    assert sum(t > 33.34 for t in intervals) == x['stats']['over33Ms']
    assert x['stats'] == x['submissionPacing'] == summary['submissionPacing']
    assert x['rendererVersion'] == summary['rendererVersion'] == 'observatory-v53-measured-terrain'
    assert summary['state'] == {k: x[k] for k in summary['state']}
    assert x['output'] == x['internal'] == [2474, 1844] and x['quality'] == 'ultra'
    assert x['volume'] == [256, 256, 256] and x['detailVolume'] == [128, 128, 128]
    assert x['nominalSteps'] == 384 and x['flowMode'] == x['ablation'] == 'full'
    assert x['seed'] == 74 and x['paused'] and x['simulationTimeStart'] == x['simulationTimeEnd'] == 60
    assert not x['skyPending'] and x['weather']['sky'] == 'rain'
    assert x['weather']['atmosphereTransition'] == 1 and x['camera']['ground'] == 1
    assert x['executionThread'] == 'main' and x['threeRevision'] == '186'
    assert x['weather']['rain'] == .799986927810866
    assert x['clockStateStart']['forcingTime'] == x['clockStateEnd']['forcingTime'] == 0
    assert x['clockStateStart']['precipitationUniformTime'] == x['clockStateEnd']['precipitationUniformTime'] == 0
    assert x['densitySamplingStart'] == x['densitySamplingEnd']
    assert x['densitySamplingStart']['path'] == 'r8unorm-extracted-r'
    assert x['densitySamplingStart']['dimensions'] == [256, 256, 256]
    assert x['densitySamplingStart']['fallback'] is None
    q = x['queuePrefix']
    assert q['status'] == 'completed' and q['reason'] is None
    assert q['measuredSubmissions'] == q['confirmedPrefixId'] == 436 and q['unconfirmedMeasuredFrames'] == 0
    assert q['maxUnconfirmedMeasuredFrames'] == 21
    assert summary['queuePrefix'] == {k: v for k, v in q.items() if k != 'samples'}
    assert x['presentedCanvasFps'] is summary['presentedCanvasFps'] is None
    coverage = x['timestampPasses']['coverage']
    assert coverage == summary['timestampCoverage']
    for kind, calls in [('render', 4), ('compute', 1)]:
        v = coverage[kind]
        assert v['measuredDraws'] == 436 and v['completeDraws'] == 431 and v['missingDraws'] == 5
        assert v['expectedCalls'] == 436 * calls and v['matchedFreshCalls'] == 431 * calls
        assert v['partialDraws'] == v['invalidLedgerDraws'] == v['conflictDraws'] == v['notRequestedDraws'] == 0
    assert x['gpuRenderPassSumMs'] == summary['returnedIntervalStatistics']['legacySparseRenderPassSumMs']
    assert x['timestampPasses']['statistics'] == summary['returnedIntervalStatistics']['completeLedgerPassSumsMs']
    assert x['timestampPasses']['diagnostics'] == summary['timestampDiagnostics']
    assert load(HERE / 'browser/dem-r2-main-console.json') == load(HERE / 'browser/dem-r2-worker-console.json') == []
    audit = subprocess.run([sys.executable, str(HERE / 'timestamp-audit/verify.py')],
                           text=True, capture_output=True, check=True)
    audit_result = json.loads(audit.stdout)
    assert audit_result['status'] == 'PASS' and audit_result['overlapDraws'] == 12
    print(json.dumps({'status': 'PASS_OFFLINE_ARCHIVE_AND_ASSET',
        'asset': {'sha256': ASSET_SHA, 'bytes': len(data), 'nodes': n, 'maxHeightM': max(heights) * .125,
                  'meanHeightM': mean_height_m, 'oceanNodesAllZero': ocean},
        'submissionFps': x['submissionFps'], 'intervals': len(intervals), 'intervalSumMs': total,
        'queuePrefix': 'completed 436/436; presentation unmeasured',
        'timestampCompleteMissing': [431, 5], 'timestampDiagnosticOverlaps': 12,
        'runtimeSourcesChecked': len(source_manifest) if args.verify_runtime_sources else 0,
        'distFilesChecked': 28 if args.dist else 0,
        'sourceTIFFsReprocessed': False, 'gpuExecuted': False}, indent=2))


if __name__ == '__main__':
    main()
