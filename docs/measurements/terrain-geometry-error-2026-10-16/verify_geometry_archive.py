#!/usr/bin/env python3
"""Read-only saved-evidence validation; Python standard library only.
No TS import, runtime invocation, DEM sampling loop, mesh/shader generation or model replay.
Optional --external-root is the original cycle28 directory; --runtime-source is base v58.
Without either option, DEM codes are declarations checked algebraically, not reread asset bytes.
"""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import math
import os
import struct
import sys

SOURCE_SHA = '21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2'
FREEZE_SHA = 'e786a324da35961ca8cc5ab83760ca9cb9989a90a7a8f5b8e04235aa168406da'
RESULT_SHA = '5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27'
DEM_SHA = '92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d'
PREVIOUS_SHA = 'f416a5fc3aa706186cc2f08811d7a35192153297f91486e31e6202409ed034cc'
STREAM_SHA = '6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a'
FACES = [249937,249939,358458,370841,370842,379379,379929,379930,385738,
         386018,386019,386020,388890,388891,389947,389948,389949]
MASKS = ['all', 'landMask', 'seaMask']
CHECKS = 0
POINTS = {}


def need(value, message):
    global CHECKS
    CHECKS += 1
    if not value:
        raise ValueError(message)


def close(a, b, message, absolute=1e-8, relative=2e-12):
    need(math.isfinite(a) and math.isfinite(b)
         and math.isclose(a, b, abs_tol=absolute, rel_tol=relative), message)


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def js(path):
    return json.loads(path.read_text())


def relative(name):
    need(isinstance(name, str) and name and '\\' not in name, 'Invalid relative path')
    p = PurePosixPath(name)
    need(not p.is_absolute() and '..' not in p.parts and str(p) == name, f'Unsafe path: {name}')
    return name


def inventory(root, maximum=256, byte_cap=32 * 1024 * 1024):
    need(root.is_dir() and not root.is_symlink(), 'Invalid archive directory')
    files = {}; total = 0
    for parent, dirs, names in os.walk(root, followlinks=False):
        for name in dirs:
            need(not (Path(parent) / name).is_symlink(), 'Archive contains symlink directory')
        for name in names:
            path = Path(parent) / name
            need(path.is_file() and not path.is_symlink(), 'Archive contains nonregular file')
            rel = relative(path.relative_to(root).as_posix())
            total += path.stat().st_size
            need(len(files) < maximum and total <= byte_cap, 'Archive bound exceeded')
            files[rel] = path
    return files


def global_manifest(root):
    files = inventory(root)
    m = js(root / 'MANIFEST.json')
    rows = m.get('payload', m.get('files', m.get('payloads')))
    if isinstance(rows, dict):
        rows = [dict(v, path=k) for k, v in rows.items()]
    need(isinstance(rows, list), 'MANIFEST requires path/bytes/sha256 records')
    records = {}
    for row in rows:
        name = relative(row['path'])
        need(name != 'MANIFEST.json' and name not in records, 'Duplicate/self manifest entry')
        records[name] = row
    need(set(records) == set(files) - {'MANIFEST.json'}, 'Exclude only root MANIFEST.json')
    for name, row in records.items():
        need(files[name].stat().st_size == row['bytes'] and sha(files[name]) == row['sha256'],
             f'Payload SHA/bytes mismatch: {name}')
    return len(rows), sum(v['bytes'] for v in rows)


def frozen_inputs(root, external, runtime):
    p = root / 'preflight'; freeze = js(p / 'PRE-RUN-FREEZE.json')
    need(sha(p / 'PRE-RUN-FREEZE.json') == FREEZE_SHA, 'Pre-run freeze pin')
    need(freeze['sourceManifestSHA256'] == SOURCE_SHA
         and freeze['sourceFilesVerifiedBeforeFreeze'] == 124, 'Frozen source declaration')
    local = [r for r in freeze['inputs'] if not r['path'].startswith('../')]
    need(len(local) == 8 and len(freeze['inputs']) == 19, 'Frozen local/external input counts')
    for row in local:
        path = p / relative(row['path'])
        need(path.is_file() and path.stat().st_size == row['bytes'] and sha(path) == row['sha256'],
             'Frozen local input drift: ' + row['path'])
    need(sum(r['bytes'] for r in local) + (p / 'PRE-RUN-FREEZE.json').stat().st_size == 55715,
         'Nine-file pre-run freeze total')
    external_count = 0
    if external:
        origin = external / 'geometry-preflight'
        for row in freeze['inputs']:
            path = (origin / row['path']).resolve()
            need(path.is_file() and path.stat().st_size == row['bytes'] and sha(path) == row['sha256'],
                 'Frozen original input drift: ' + row['path'])
            external_count += 1
        need(sha(origin / 'PRE-RUN-FREEZE.json') == FREEZE_SHA, 'External freeze mismatch')
    manifest_path = root / 'source-manifest.json'
    need(sha(manifest_path) == SOURCE_SHA, 'Local source manifest pin')
    manifest = js(manifest_path)
    need(len(manifest) == 124, 'Base source count')
    verified = 0
    if runtime:
        for name, expected in manifest.items():
            path = runtime / relative(name)
            need(path.is_file() and not path.is_symlink() and sha(path) == expected,
                 f'Runtime is not the declared base: {name}')
            verified += 1
    error = js(p / 'preparation/error.json')
    need(error['noChildLaunched'] is True and error['noBunInvoked'] is True
         and error['noMeshOrDemSamplerRun'] is True and error['noRunDirectory'] is True,
         'Preparation R1 failure scope')
    need('getxattr' in error['observedError'] and error['r1SHA256'] == sha(p / 'preparation/run-r1-getxattr.py')
         and error['r2SHA256'] == sha(p / 'run.py'), 'R1/R2 wrapper preservation')
    return {'localFrozenInputs': 8, 'originalExternalInputsByteVerified': external_count,
            'runtimeSourcesByteVerified': verified}, freeze


def f32(x):
    return struct.unpack('<f', struct.pack('<f', x))[0]


def ring_at(x, z):
    radius = max(abs(x), abs(z))
    for ring in range(9):
        if radius <= f32(128 * .032 * 2 ** ring):
            return ring
    return 9


def point_check(point, category=None, ring=None, dem=None):
    ix, iz = point['grid']; x, z = point['xzKm']
    need(isinstance(ix, int) and isinstance(iz, int) and 128 <= ix <= 896 and 128 <= iz <= 896,
         'Extremum is outside fixed DEM-node core')
    need(x == -64 + ix * .125 and z == -64 + iz * .125
         and point['order'] == (iz - 128) * 769 + ix - 128, 'Grid/axis/row-major arithmetic')
    need(point['ring'] == ring_at(x, z) and (ring is None or point['ring'] == ring), 'Ring membership')
    hc, cc = point['heightCode'], point['coastCode']
    need(isinstance(hc, int) and 0 <= hc <= 65535 and isinstance(cc, int) and -32768 <= cc <= 32767,
         'DEM code domains')
    need(point['category'] == ('coast>=0' if cc >= 0 else 'coast<0'), 'Coast-mask record membership')
    if category and category != 'all':
        need((cc >= 0) == (category == 'landMask'), 'Aggregate mask membership')
    close(point['heightKm'], hc * .000125, 'Height code unit', absolute=1e-15)
    radius = 6371 + point['heightKm']; r2 = x * x + z * z
    y = -4 + point['heightKm'] - r2 / (radius + math.sqrt(radius * radius - r2))
    close(point['demYKm'], y, 'Sparse spherical datum Y arithmetic', absolute=1e-11)
    close(point['errorMetres'], 1000 * (point['demYKm'] - point['meshYKm']),
          'Signed error arithmetic', absolute=1e-9)
    if dem:
        need(struct.unpack_from('<H', dem, 32 + 2 * (iz * 1025 + ix))[0] == hc
             and struct.unpack_from('<h', dem, 32 + 2 * 1025 ** 2 + 2 * (iz * 1025 + ix))[0] == cc,
             'Sparse recorded DEM code differs from asset')
    if point['order'] in POINTS:
        need(POINTS[point['order']] == point, 'Repeated extremum record identity')
    POINTS[point['order']] = point


def stat_check(a, category, ring, dem):
    n = a['count']; histogram = a['histogramCounts']
    need(isinstance(n, int) and n > 0 and len(histogram) == 10002,
         'Nonempty aggregate/histogram shape')
    need(all(isinstance(v, int) and v >= 0 for v in histogram) and sum(histogram) == n,
         'Histogram count sum')
    close(a['signedMeanMetres'], a['sumErrorMetres'] / n, 'Mean from weighted sum', absolute=1e-12)
    close(a['rmsMetres'], math.sqrt(a['sumSquaredErrorMetres2'] / n), 'RMS from square sum', absolute=1e-12)
    need(a['sumSquaredErrorMetres2'] >= 0, 'Nonnegative square sum')
    for key in ['minimum', 'maximum', 'maximumAbs']:
        point_check(a[key], category, ring, dem)
        need(1 <= a[key + 'Ties'] <= n, 'Extrema tie bounds')
    low, high, absolute = [a[k]['errorMetres'] for k in ['minimum', 'maximum', 'maximumAbs']]
    need(low <= high and abs(absolute) == max(abs(low), abs(high)), 'Saved extrema coherence')
    need(histogram[0] == 0 and histogram[-1] == 0, 'Expected bounded observed extrema/histogram')
    lower_sum = upper_sum = lower_sq = upper_sq = 0
    for index, count in enumerate(histogram[1:-1], 1):
        left = index - 1 - 5000; right = left + 1
        lower_sum += count * left; upper_sum += count * right
        lower_sq += count * (0 if left <= 0 <= right else min(left * left, right * right))
        upper_sq += count * max(left * left, right * right)
    need(lower_sum - 1e-7 <= a['sumErrorMetres'] <= upper_sum + 1e-7,
         'Signed sum outside histogram bin bounds')
    need(lower_sq - 1e-7 <= a['sumSquaredErrorMetres2'] <= upper_sq + 1e-7,
         'Square sum outside histogram bin bounds')
    for field, mode in [('top8Absolute', 'abs'), ('top8Positive', 'positive'), ('top8Negative', 'negative')]:
        records = a[field]
        need(0 <= len(records) <= 8 and len({v['order'] for v in records}) == len(records), 'Top8 cap/unique')
        if mode == 'abs':
            need(len(records) == min(n, 8) and records[0] == a['maximumAbs'], 'Top absolute identity')
        elif mode == 'positive':
            need(all(v['errorMetres'] > 0 for v in records)
                 and bool(records) == (high > 0) and (not records or records[0] == a['maximum']), 'Top positive identity')
        else:
            need(all(v['errorMetres'] < 0 for v in records)
                 and bool(records) == (low < 0) and (not records or records[0] == a['minimum']), 'Top negative identity')
        score = lambda p: abs(p['errorMetres']) if mode == 'abs' else p['errorMetres'] * (1 if mode == 'positive' else -1)
        need(records == sorted(records, key=lambda p: (-score(p), p['order'])), 'Top8 score/tie order')
        for record in records:
            point_check(record, category, ring, dem)
            need(low <= record['errorMetres'] <= high, 'Top8 outside saved extrema')


def partition(parent, children):
    need(parent['count'] == sum(v['count'] for v in children), 'Count partition')
    for field in ['sumErrorMetres', 'sumSquaredErrorMetres2']:
        close(parent[field], math.fsum(v[field] for v in children), 'Weighted aggregate sum partition')
    close(parent['sumSquaredErrorMetres2'], math.fsum(v['count'] * v['rmsMetres'] ** 2 for v in children),
          'Weighted RMS energy partition')
    need(all(parent['histogramCounts'][i] == sum(v['histogramCounts'][i] for v in children)
             for i in range(10002)), 'Histogram partition per bin')
    for field, score in [('top8Absolute', lambda p: abs(p['errorMetres'])),
                         ('top8Positive', lambda p: p['errorMetres']),
                         ('top8Negative', lambda p: -p['errorMetres'])]:
        merged = sorted([p for child in children for p in child[field]], key=lambda p: (-score(p), p['order']))[:8]
        need(parent[field] == merged, 'Top8 partition union consistency')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', nargs='?', type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument('--external-root', type=Path)
    parser.add_argument('--runtime-source', type=Path)
    args = parser.parse_args(); root = args.archive.resolve()
    external = args.external_root.resolve() if args.external_root else None
    runtime = args.runtime_source.resolve() if args.runtime_source else None
    count, payload_bytes = global_manifest(root)
    sources, freeze = frozen_inputs(root, external, runtime)
    p = root / 'preflight'; run = js(p / 'run/run.json'); result = js(p / 'run/result.json')
    need(sha(p / 'run/result.json') == run['resultSHA256'] == RESULT_SHA
         and (p / 'run/result.json').stat().st_size == run['resultBytes'] == 2532734,
         'Result bytes/pinned SHA')
    need(run['status'] == 'PASS' and run['launched'] is True and run['terminalObserved'] is True
         and run['exitCode'] == 0 and run['wallKilled'] is False and run['error'] is None
         and run['budgetPASS'] is True, 'Saved terminal/budget state')
    b = run['budget']
    close(b['combinedCPUSeconds'], b['childCPUSeconds'] + b['wrapperCPUSeconds'], 'Combined CPU arithmetic')
    need(b['conservativeSumOfPeakRSSBytes'] == b['childPeakRSSBytes'] + b['wrapperPeakRSSBytes'], 'Sum of terminal peak RSS')
    need(b['CPUHardLimitSeconds'] == 20 and b['wallLimitSeconds'] == 40 and b['RSSGateBytes'] == 2 ** 31
         and 0 <= b['combinedCPUSeconds'] <= 20 and 0 <= b['wallSeconds'] <= 40
         and 0 <= b['conservativeSumOfPeakRSSBytes'] <= 2 ** 31, 'Fixed terminal budget limits')
    need(run['preflight']['inputFilesVerified'] == 19 and run['preflight']['sourceFilesVerified'] == 124
         and run['preflight']['freezeSHA256'] == FREEZE_SHA
         and run['preflight']['dependencyIgnoreValue'] == run['preflight']['dependencyIgnoreValueAfter'] == '1', 'Saved preflight declaration')
    need(result['status'] == 'COMPLETE_CORE_GEOMETRY_REFERENCE_NOT_ART_OR_GPU_PROOF'
         and result['sourceManifestSHA256'] == SOURCE_SHA and result['assetSHA256'] == DEM_SHA
         and result['previousWitnessSHA256'] == PREVIOUS_SHA, 'Result provenance/scope')
    need(result['measurementQueries'] == result['plan']['nodes'] == 591361
         and result['plan']['side'] == 769 and result['plan']['firstSourceIndex'] == 128
         and result['plan']['lastSourceIndex'] == 896 and result['plan']['queryCap'] == 600000,
         'Fixed whole-core node plan')
    need(result['buildSampleCalls'] == result['meshStats']['sampleCalls'] == 465409
         and result['meshStats']['vertices'] == 465409 and result['meshStats']['triangles'] == 929792
         and result['meshStats']['stitchedCells'] == 4096 and result['meshStats']['geometryBytes'] == 26050592,
         'Saved baseline mesh statistics')
    identity = result['baselineIdentity']
    need(identity['savedFaces'] == freeze['savedFaces'] == FACES
         and identity['allSavedIndicesAndFloat32VerticesExact'] is True
         and identity['allSavedMeshStatsExact'] is True, 'Seventeen face identity declaration')
    need(len(identity['associations']) == 30 and sorted({v['faceIndex'] for v in identity['associations']}) == FACES,
         'Saved face association set')
    need(set(identity['meshHashes']) == {'positions','normals','surface','indices','cellFirstIndex'}
         and all(len(v) == 64 for v in identity['meshHashes'].values()), 'Declared mesh buffer digests')
    stream = result['errorStream']
    need(stream['sha256'] == STREAM_SHA and stream['bytes'] == 591361 * 8 == 4730888
         and 'not retained' in stream['encoding'], 'Declared omitted error-stream digest')
    stdout = js(p / 'run/stdout.log')
    need(stdout['resultBytes'] == 2532734 and stdout['measurementQueries'] == 591361
         and stdout['errorStreamSHA256'] == STREAM_SHA, 'Saved stdout summary')
    phases = [json.loads(line) for line in (p / 'run/stderr.log').read_text().splitlines() if line]
    need([r['phase'] for r in phases] == ['mesh-build-start','baseline-identity-pass','complete']
         and phases[1]['faces'] == 17 and phases[-1]['queries'] == 591361, 'Saved phase log')
    dem = None
    if runtime:
        dem_path = runtime / 'src/cumulonimbus/assets/liguria-apuane-dem.bin'
    elif external:
        dem_path = external.parent / 'Cloudia-QA-2026-10-16-cycle27/source/src/cumulonimbus/assets/liguria-apuane-dem.bin'
    else:
        dem_path = None
    if dem_path:
        need(sha(dem_path) == DEM_SHA, 'Optional sparse DEM asset pin')
        dem = dem_path.read_bytes()
        need(dem[:4] == b'CDM1' and struct.unpack_from('<I', dem, 4)[0] == 1025
             and struct.unpack_from('<ddd', dem, 8) == (.125, -64, -64)
             and len(dem) == 32 + 4 * 1025 ** 2, 'CDM1 header/size')
    need(len(result['rings']) == 5 and result['aggregate']['all']['count'] == 591361, 'Global/ring shape')
    previous_area_count = 0
    for index, ring in enumerate(result['rings']):
        need(ring['ring'] == index and ring['outerHalfExtentKm'] == f32(128 * .032 * 2 ** index), 'Float32 ring boundary')
        extent = min(48, ring['outerHalfExtentKm'])
        square_count = (2 * math.floor(extent / .125) + 1) ** 2
        need(ring['all']['count'] == square_count - previous_area_count, 'Closed-square node ring count')
        previous_area_count = square_count
        for mask in MASKS:
            stat_check(ring[mask], mask, index, dem)
        partition(ring['all'], [ring['landMask'], ring['seaMask']])
    for mask in MASKS:
        stat_check(result['aggregate'][mask], mask, None, dem)
        partition(result['aggregate'][mask], [ring[mask] for ring in result['rings']])
    partition(result['aggregate']['all'], [result['aggregate']['landMask'], result['aggregate']['seaMask']])
    post = js(root / 'post-run-hash-verification.json')
    need(post['sourceCount'] == 124 and post['sourceManifestSHA256'] == SOURCE_SHA
         and post['allSourceAndFrozenInputsUnchanged'] is True and post['inputCount'] == 19, 'Saved post-run hash declaration')
    print(json.dumps({'status': 'SAVED_GEOMETRY_EVIDENCE_PASS', 'checks': CHECKS,
        'payloadFiles': count, 'payloadBytes': payload_bytes, 'manifestSHA256': sha(root / 'MANIFEST.json'),
        'sourceChecks': sources, 'recordedQueries': 591361, 'savedFacesDeclaredExact': 17,
        'aggregateCount': 18, 'uniqueSavedExtremeNodesChecked': len(POINTS),
        'sparseDEMCodesByteVerified': len(POINTS) if dem else 0,
        'runBudget': b, 'landRMSMetresByRing': [r['landMask']['rmsMetres'] for r in result['rings']],
        'errorStreamSHA256Declared': STREAM_SHA, 'errorStreamReconstructed': False,
        'meshIdentityRecomputed': False, 'modelOrRuntimeInvoked': False,
        'futureSplitProposalValidated': False,
        'limits': ['Only saved JSON arithmetic, hashes and optional sparse DEM code reads; no global sampling or mesh replay.',
                   'Face identity and buffer hashes are recorded run declarations, not a newly reconstructed mesh.',
                   'Omitted error-stream digest is pinned but cannot reconstruct the 591361 omitted errors.',
                   'Node discrepancies are not a continuous bound, areal integration, DEM accuracy, native pixel or shadow-cause proof.',
                   'RSS is the sum of separate terminal peaks, not measured simultaneous residency.',
                   'Future unexecuted proposals are covered by archive hashes only, not validated as models.']}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'status': 'SAVED_GEOMETRY_EVIDENCE_FAIL', 'checksBeforeFailure': CHECKS,
                          'error': f'{type(exc).__name__}: {exc}', 'modelReplay': False}), file=sys.stderr)
        raise SystemExit(1)
