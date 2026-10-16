#!/usr/bin/env python3
"""Portable offline WorldCover archive checks. Stdlib only; no renderer or preprocessing.

After copying to docs/measurements/terrain-cover-2026-10-16/verify.py:
  python3 docs/measurements/terrain-cover-2026-10-16/verify.py
Optional source/dist checks read only explicitly listed paths. An external copy
can instead receive --archive PATH --repo PATH. --self-test needs no archive.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re
import struct
import sys

HERE = Path(__file__).resolve().parent
ASSET_PATH = 'src/cumulonimbus/assets/liguria-apuane-cover.bin'
ASSET_SHA = 'e7fa38f2b0a8c3c469737410dc8d265e680071226e663b3cb12b23930ebda5fc'
CHANNEL_ORDER = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]
SOURCE_MANIFEST = 'source/cover-r2-source-manifest.json'
DIST_MANIFEST = 'source/cover-r2-dist-manifest.json'
RAW_FILES = {
    'sun': 'benchmark/cover-r2-main-sun-native.json.gz',
    'rain': 'benchmark/cover-r2-main-rain-native.json.gz',
}


class VerificationError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise VerificationError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result


def bad_constant(value):
    raise VerificationError('Nonfinite JSON constant: ' + value)


def parse_json(data):
    return json.loads(data, object_pairs_hook=unique_object, parse_constant=bad_constant)


def relative_name(name):
    require(isinstance(name, str) and name and '\\' not in name, 'Invalid relative path')
    path = PurePosixPath(name)
    require(not path.is_absolute() and all(p not in ('..', '.') for p in path.parts)
            and path.as_posix() == name, 'Noncanonical relative path: ' + name)
    return path


def bounded_path(root, name):
    path = relative_name(name)
    current = root
    for part in path.parts:
        current = current / part
        require(not current.is_symlink(), 'Symlink not allowed: ' + name)
    require(current.is_file() and current.resolve().is_relative_to(root.resolve()), 'Missing/escaping file: ' + name)
    return current


def read(root, name):
    return bounded_path(root, name).read_bytes()


def load(root, name):
    return parse_json(read(root, name))


def natural(value):
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def valid_sha(value):
    return isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value) is not None


def js_sum(values):
    # Python 3.12's sum(float) is compensated; JS Array.reduce is sequential.
    total = 0.0
    for value in values:
        total += value
    return total


def frame_stats(values):
    require(isinstance(values, list) and values and all(finite(v) and v > 0 for v in values), 'Invalid frame intervals')
    ordered = sorted(values)
    count, total = len(values), js_sum(values)
    return {'frames': count, 'durationMs': total, 'fps': count * 1000 / total,
            'medianMs': ordered[math.floor(count * .5)], 'p95Ms': ordered[math.floor(count * .95)],
            'p99Ms': ordered[math.floor(count * .99)], 'maxMs': ordered[-1],
            'over18Ms': sum(v > 18 for v in values), 'over33Ms': sum(v > 33.34 for v in values)}


def sample_stats(values, sorted_sum=False):
    require(isinstance(values, list) and all(finite(v) and v >= 0 for v in values), 'Invalid timing samples')
    if not values:
        return None
    ordered = sorted(values)
    return {'sampleCount': len(values), 'meanMs': js_sum(ordered if sorted_sum else values) / len(values),
            'p95Ms': ordered[math.floor(len(values) * .95)], 'maxMs': ordered[-1]}


def verify_manifest(root):
    manifest = load(root, 'MANIFEST.json')
    items = manifest['files']
    require(isinstance(items, list) and natural(manifest['fileCount']) and len(items) == manifest['fileCount'], 'Manifest fileCount')
    names = set()
    total = 0
    for item in items:
        name = item['path']
        relative_name(name)
        require(name != 'MANIFEST.json' and name not in names, 'Manifest self-cycle/duplicate: ' + name)
        require(natural(item['bytes']) and valid_sha(item['sha256']), 'Invalid manifest item: ' + name)
        data = read(root, name)
        require(len(data) == item['bytes'] and digest(data) == item['sha256'], 'Manifest bytes/SHA: ' + name)
        names.add(name)
        total += len(data)
    require(natural(manifest['payloadBytes']) and total == manifest['payloadBytes'], 'Manifest payloadBytes')
    actual = set()
    for path in root.rglob('*'):
        require(not path.is_symlink(), 'Archive contains symlink')
        if path.is_file():
            actual.add(path.relative_to(root).as_posix())
    require(actual == names | {'MANIFEST.json'}, 'Unlisted/missing archive file')
    return {'files': len(names), 'payloadBytes': total}


def hash_index(root, name, count):
    index = load(root, name)
    require(isinstance(index, dict) and len(index) == count, 'Index count: ' + name)
    for path, sha in index.items():
        relative_name(path)
        require(valid_sha(sha), 'Invalid index SHA: ' + path)
    return index


def verify_index(root, index):
    for path, sha in index.items():
        require(digest(read(root, path)) == sha, 'Indexed SHA: ' + path)
    return len(index)


def quantize_fractions(values):
    require(len(values) == 12 and all(finite(v) and v >= 0 for v in values), 'Invalid witness fractions')
    total = js_sum(values)
    require(total > 0 and abs(total - 1) < 2e-10, 'Witness fractional sum')
    scaled = [v / total * 255 for v in values]
    result = [math.floor(v) for v in scaled]
    remaining = 255 - sum(result)
    require(0 <= remaining < 12, 'Witness quantization remainder')
    order = sorted(range(12), key=lambda c: (-(scaled[c] - result[c]), c))
    for c in order[:remaining]:
        result[c] += 1
    return result


def verify_asset(repo, archive):
    data = read(repo, ASSET_PATH)
    require(digest(data) == ASSET_SHA, 'WCV1 asset SHA')
    require(len(data) >= 32, 'WCV1 short header')
    magic, side, spacing, min_x, min_z = struct.unpack_from('<4sIddd', data)
    require((magic, side, spacing, min_x, min_z) == (b'WCV1', 1024, .125, -64., -64.), 'WCV1 LE header/grid')
    require(len(data) == 32 + side * side * 12, 'WCV1 length')
    payload = memoryview(data)[32:]
    for offset in range(0, len(payload), 12):
        if sum(payload[offset:offset + 12]) != 255:
            raise VerificationError('WCV1 cell sum at ' + str(offset // 12))
    witnesses = load(archive, 'preprocess/source-witnesses.json')
    require(witnesses['channelOrder'] == CHANNEL_ORDER, 'Witness channel order')
    records = witnesses['witnesses']
    require(len(records) == 5 and [r['selectedBoundaryClass'] for r in records] == [10, 40, 50, 60, 80], 'Witness identities')
    for record in records:
        x, z = record['outputX'], record['outputZ']
        require(natural(x) and natural(z) and x < side and z < side, 'Witness cell address')
        expected = list(payload[(z * side + x) * 12:(z * side + x + 1) * 12])
        require(record['quantizedBytes'] == expected, 'Witness bytes: ' + str((x, z)))
        require(record['worldCentreKm'] == [min_x + (x + .5) * spacing, min_z + (z + .5) * spacing], 'Witness cell-centre convention')
        independent, accumulated = record['independentFractions'], record['accumulatedFractions']
        require(quantize_fractions(independent) == expected and quantize_fractions(accumulated) == expected, 'Witness largest-remainder arithmetic')
        error = max(abs(a - b) for a, b in zip(independent, accumulated))
        require(error == record['maxAbsAreaFractionError'] and error < 2e-10, 'Witness area-fraction error')
    return {'sha256': ASSET_SHA, 'bytes': len(data), 'cells': side * side, 'unitSum': 255, 'witnesses': len(records)}


def verify_queue(report, count):
    queue = report['queuePrefix']
    require(isinstance(queue, dict) and queue['status'] == 'completed' and queue['reason'] is None, 'Final queue prefix not completed')
    require(queue['measuredSubmissions'] == queue['confirmedPrefixId'] == count and queue['unconfirmedMeasuredFrames'] == 0, 'Queue prefix count')
    require(natural(queue['maxUnconfirmedMeasuredFrames']) and queue['maxUnconfirmedMeasuredFrames'] <= count, 'Queue outstanding bound')
    require(finite(queue['windowStartedAtMs']) and finite(queue['firstRafTimestamp']), 'Queue clock anchors')
    samples = queue['samples']
    require(isinstance(samples, list) and len(samples) >= 2, 'Missing queue endpoint observations')
    require(samples[0]['kind'] == 'start' and samples[0]['prefixId'] == 0 and samples[0]['status'] == 'completed', 'Queue start observation')
    require(samples[-1]['kind'] == 'end' and samples[-1]['prefixId'] == count and samples[-1]['status'] == 'completed', 'Queue end observation')
    previous_request = queue['windowStartedAtMs']
    previous_prefix = 0
    for item in samples:
        require(item['kind'] in ('start', 'periodic', 'end') and natural(item['prefixId']) and previous_prefix <= item['prefixId'] <= count, 'Queue observation identity')
        require(finite(item['requestedAtMs']) and item['requestedAtMs'] >= previous_request, 'Queue request order')
        previous_request, previous_prefix = item['requestedAtMs'], item['prefixId']
        if item['status'] in ('completed', 'failed'):
            require(finite(item['resolvedAtMs']) and item['resolvedAtMs'] >= item['requestedAtMs'], 'Queue resolution clock')
            require(item['latencyMs'] == item['resolvedAtMs'] - item['requestedAtMs'], 'Queue latency arithmetic')
            require((item['error'] is None) == (item['status'] == 'completed'), 'Queue error/status')
        else:
            require(item['status'] == 'pending' and item['resolvedAtMs'] is None and item['latencyMs'] is None and item['error'] is None, 'Queue pending fields')
    end = samples[-1]
    elapsed = end['resolvedAtMs'] - queue['windowStartedAtMs']
    require(elapsed > 0 and queue['endDrainMs'] == end['latencyMs'], 'Queue drain arithmetic')
    require(queue['completionBoundedSubmissionFps'] == count * 1000 / elapsed, 'Completion-bounded rate arithmetic')
    return queue['completionBoundedSubmissionFps']


def verify_timing_arithmetic(report):
    stats = frame_stats(report['frameIntervalsMs'])
    require(report['stats'] == stats == report['submissionPacing'], 'Frame-stat/floor-quantile arithmetic')
    require(report['submissionFps'] == stats['fps'], 'submissionFps alias')
    require('presentedCanvasFps' in report and report['presentedCanvasFps'] is None, 'Presentation must remain explicitly unmeasured')
    pairs = [('gpuSamplesMs', 'gpu'), ('cpuSamplesMs', 'cpu'), ('computeSamplesMs', 'gpuCompute'),
             ('queueSamplesMs', 'queueCompletion'), ('dispatchSamplesMs', 'rafDispatch'),
             ('cpuComputeSamplesMs', 'cpuCompute'), ('cpuRenderSamplesMs', 'cpuRender')]
    for raw_key, summary_key in pairs:
        require(sample_stats(report[raw_key]) == report[summary_key], 'Sample-stat arithmetic: ' + summary_key)
    require(report['gpuRenderPassSumMs'] == report['gpu'], 'Legacy GPU pass-sum alias')
    return stats, verify_queue(report, stats['frames'])


def verify_timestamp_summaries(report, count):
    # Checks the saved ledger's summaries, not independent query attribution.
    batch = report['timestampPasses']
    if batch is None:
        return None
    require(batch['status'] == 'closed', 'Timestamp ledger left open')
    result = {}
    for kind in ('render', 'compute'):
        samples = batch['completeSamples'][kind]
        coverage = batch['coverage'][kind]
        require(coverage['measuredDraws'] == count and coverage['completeDraws'] == len(samples), 'Timestamp coverage count: ' + kind)
        statuses = ['completeDraws', 'partialDraws', 'missingDraws', 'notRequestedDraws', 'invalidLedgerDraws', 'conflictDraws']
        require(all(natural(coverage[k]) for k in statuses) and sum(coverage[k] for k in statuses) == count, 'Timestamp coverage partition: ' + kind)
        draw_index = {d['id']: d for d in batch['draws']}
        ids = set()
        for sample in samples:
            identity = sample['intervalId']
            require(natural(identity) and 1 <= identity <= count and identity not in ids, 'Timestamp complete-sample identity')
            ids.add(identity)
            draw = draw_index[sample['drawId']]
            require(draw['measuredIntervalId'] == identity and draw[kind]['status'] == 'complete', 'Timestamp complete draw')
            require(draw[kind]['matchedFreshCalls'] == sample['passCount'] and draw[kind]['passSumMs'] == sample['passSumMs'], 'Timestamp complete-sample value')
        expected = sample_stats([s['passSumMs'] for s in samples], sorted_sum=True)
        require(batch['statistics'][kind] == expected, 'Timestamp sorted-summary arithmetic: ' + kind)
        result[kind] = {'complete': coverage['completeDraws'], 'missing': coverage['missingDraws']}
    return result


def verify_benchmark(archive, name, path):
    raw = gzip.decompress(read(archive, path))
    report = parse_json(raw)
    stats, bounded_fps = verify_timing_arithmetic(report)
    expected = {'rendererVersion': 'observatory-v54-cover-fragment', 'backend': 'WebGPU', 'executionThread': 'main',
                'threeRevision': '186', 'quality': 'ultra', 'output': [2474, 1844], 'internal': [2474, 1844],
                'nominalSteps': 384, 'volume': [256, 256, 256], 'detailVolume': [128, 128, 128],
                'seed': 74, 'paused': True, 'simulationTimeStart': 60, 'simulationTimeEnd': 60,
                'flowMode': 'full', 'ablation': 'full', 'outputMode': 'screen', 'sunsetAmount': 0,
                'metricsSchemaVersion': 3, 'measurementVersion': 'submission-queue-prefix-v2-pass-ledger',
                'warmupMs': 2000, 'targetDurationMs': 30000, 'skyPending': False}
    for key, value in expected.items():
        require(report[key] == value, name + ' benchmark state: ' + key)
    require(stats['durationMs'] >= report['targetDurationMs'], name + ' benchmark ended before duration')
    require(report['camera']['ground'] == 1 and report['weather']['atmosphereTransition'] == 1, name + ' terrain/weather not settled')
    require(report['weather']['wind'] == .55 and report['weather']['dispersion'] == 0, name + ' forcing state')
    require(report['weather']['autoLightning'] is False and report['weather']['flashPreview'] is False and report['flashCountStart'] == report['flashCountEnd'], name + ' lightning state')
    require(report['emptyStepWorld'] == report['emptyStepWorldEnd'], name + ' traversal changed')
    for key in ('forcingTime', 'precipitationUniformTime'):
        require(report['clockStateStart'][key] == report['clockStateEnd'][key] == 0, name + ' frozen clock: ' + key)
    require(report['densitySamplingStart'] == report['densitySamplingEnd'], name + ' density path changed')
    density = report['densitySamplingStart']
    require(density['dimensions'] == [256, 256, 256] and density['fallback'] is None, name + ' density payload/fallback')
    if name == 'rain':
        require(report['weather']['sky'] == 'rain' and 0 < report['weather']['rain'] <= 1, 'Rain weather absent')
        require(density['path'] == 'r8unorm-extracted-r' and density['format'] == 'r8unorm' and density['textureBytes'] == 256 ** 3, 'Rain R8 binding')
        require(report['narrowCloudSkip']['boundInIntegrator'] is True and report['narrowCloudSpecializationEnd'] == 'rain', 'Rain specialization')
    else:
        require(report['weather']['rain'] == 0 and report['weather']['sky'] not in ('rain', 'sunset'), 'Dry-sun weather')
        require(density['path'] == 'macro-rgba8-r' and density['format'] == 'rgba8unorm' and density['textureBytes'] == 4 * 256 ** 3, 'Dry RGBA binding')
        require(report['narrowCloudSkip']['boundInIntegrator'] is False and report['narrowCloudSpecializationEnd'] == 'dry', 'Dry specialization')
    cover = report['terrainCover']
    cover_expected = {'id': 'esa-worldcover-2021-area-fractions-v1', 'year': 2021, 'sourceClasses': 12, 'materialGroups': 8,
                      'gridSize': [1024, 1024], 'cellKm': .125, 'minEdgeKm': [-64, -64],
                      'rowOrder': 'south-to-north; v0=minZ', 'sourceAssetBytes': 32 + 12 * 1024 ** 2,
                      'basePayloadBytes': 8 * 1024 ** 2, 'retainedCpuPayloadBytes': 8 * 1024 ** 2,
                      'nominalMipPayloadBytes': 8 * sum((1024 // 2 ** level) ** 2 for level in range(1, 11)), 'mipLevels': 11}
    for key, value in cover_expected.items():
        require(cover[key] == value, name + ' cover metadata: ' + key)
    require(cover['totalGpuPayloadBytes'] == cover['basePayloadBytes'] + cover['nominalMipPayloadBytes'], name + ' cover GPU byte sum')
    timestamps = verify_timestamp_summaries(report, stats['frames'])
    return report, {'intervals': stats['frames'], 'intervalSumMs': stats['durationMs'], 'submissionFps': stats['fps'],
                    'completionBoundedSubmissionFps': bounded_fps, 'queueStatus': 'completed', 'presentedCanvasFps': None,
                    'timestampCoverage': timestamps, 'uncompressedBytes': len(raw), 'uncompressedSha256': digest(raw)}


def self_test():
    require(js_sum([1e16, 1, -1e16]) == 0, 'Sequential JS sum self-test')
    stats = frame_stats([1., 2., 3., 4.])
    require(stats == {'frames': 4, 'durationMs': 10., 'fps': 400., 'medianMs': 3., 'p95Ms': 4., 'p99Ms': 4., 'maxMs': 4., 'over18Ms': 0, 'over33Ms': 0}, 'Floor quantile self-test')
    require(sample_stats([]) is None and sample_stats([0., 1.]) == {'sampleCount': 2, 'meanMs': .5, 'p95Ms': 1., 'maxMs': 1.}, 'Sample/null self-test')
    require(quantize_fractions([.5, .5] + [0.] * 10) == [128, 127] + [0] * 10, 'Stable largest remainder self-test')
    for invalid in ([0.], [-1.], [float('nan')]):
        try:
            frame_stats(invalid)
        except VerificationError:
            pass
        else:
            raise VerificationError('Invalid interval self-test not rejected')
    return {'status': 'PASS_SELF_TEST', 'gpuExecuted': False, 'archiveRead': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=HERE, help='Archive directory; default is this script directory')
    parser.add_argument('--repo', type=Path, help='Repository root; default archive/../../..')
    parser.add_argument('--verify-runtime-sources', action='store_true', help='Check all 119 frozen source hashes; no source directory scan')
    parser.add_argument('--dist', type=Path, help='Check all 30 explicitly listed dist files')
    parser.add_argument('--self-test', action='store_true', help='Check only small internal arithmetic cases')
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    archive = args.archive.resolve()
    repo = (args.repo if args.repo else archive / '../../..').resolve()
    payload = verify_manifest(archive)
    sources = hash_index(archive, SOURCE_MANIFEST, 119)
    dist = hash_index(archive, DIST_MANIFEST, 30)
    require(sources[ASSET_PATH] == ASSET_SHA and list(dist.values()).count(ASSET_SHA) == 1, 'Source/dist asset identity')
    source_count = verify_index(repo, sources) if args.verify_runtime_sources else 0
    dist_count = verify_index(args.dist.resolve(), dist) if args.dist else 0
    asset = verify_asset(repo, archive)
    suite = gzip.decompress(read(archive, 'source/cover-r2-full-tests.log.gz')).decode('utf-8')
    suite = re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]', '', suite)
    require(re.search(r'Test Files\s+43 passed\s*\(43\)', suite) is not None and re.search(r'Tests\s+341 passed\s*\(341\)', suite) is not None, 'Full-suite 341/43 result')
    require(not re.search(r'(?:^|\n)\s*(?:FAIL\b|Failed Tests\b|Unhandled Errors?\b)', suite), 'Suite log includes failure')
    reports, summaries = {}, {}
    for name, path in RAW_FILES.items():
        reports[name], summaries[name] = verify_benchmark(archive, name, path)
    for key in ('origin', 'yaw', 'pitch', 'target', 'ground', 'comparisonSurfaceKm', 'comparisonTargetKm', 'approach'):
        require(reports['sun']['camera'][key] == reports['rain']['camera'][key], 'Sun/rain camera mismatch: ' + key)
    return {'status': 'PASS_OFFLINE_ARCHIVE_AND_WCV1', 'archive': payload, 'asset': asset,
            'suite': {'testFiles': 43, 'tests': 341}, 'benchmarks': summaries,
            'runtimeSourcesChecked': source_count, 'distFilesChecked': dist_count,
            'sourceRasterReprocessed': False, 'gpuExecuted': False,
            'scope': 'Saved raw arithmetic and identity; no physical canopy/albedo, compositor presentation or artistic acceptance proof.'}


if __name__ == '__main__':
    try:
        print(json.dumps(main(), separators=(',', ':'), allow_nan=False))
    except (VerificationError, OSError, ValueError, KeyError, TypeError, struct.error, EOFError) as error:
        print(json.dumps({'status': 'FAIL', 'error': str(error)}, separators=(',', ':')), file=sys.stderr)
        sys.exit(1)
