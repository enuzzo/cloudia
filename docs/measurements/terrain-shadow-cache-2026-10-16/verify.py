#!/usr/bin/env python3
"""Verify saved evidence only. Does not run the renderer, CPU witness or tests."""
from pathlib import Path
import argparse, hashlib, json, math
from PIL import Image

ROOT = Path(__file__).resolve().parent

def read(name):
    return json.loads((ROOT / name).read_text())

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def check_payload(root, manifest):
    for item in manifest['payload']:
        relative = Path(item['path'])
        assert not relative.is_absolute() and '..' not in relative.parts
        path = root / relative
        assert not path.is_symlink() and path.is_file(), path
        assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256'], path
    assert sum(item['bytes'] for item in manifest['payload']) == manifest['bytes']

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-source', type=Path)
    parser.add_argument('--dist', type=Path)
    args = parser.parse_args()
    manifest = read('MANIFEST.json')
    check_payload(ROOT, manifest)
    actual = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file()}
    assert actual == {p['path'] for p in manifest['payload']} | {'MANIFEST.json'}
    for child in ['witness', 'caster-intersection-analysis']:
        check_payload(ROOT / child, read(child + '/MANIFEST.json'))

    baseline = read('source-manifest.json')
    candidate = read('qualification/source-manifest.json')
    assert len(baseline) == len(candidate) == 124 and baseline.keys() == candidate.keys()
    changed = [p for p in baseline if baseline[p] != candidate[p]]
    assert set(changed) == {'src/cumulonimbus/TerrainShadow.ts', 'src/cumulonimbus/TerrainShadow.test.ts',
                            'src/cumulonimbus/GPUSceneEngine.ts', 'src/cumulonimbus/lifecycle.test.ts'}
    for p in changed:
        assert sha(ROOT / 'source-before' / p) == baseline[p]
        assert sha(ROOT / 'source-after' / p) == candidate[p]
    if args.runtime_source:
        for p, digest in candidate.items():
            assert sha(args.runtime_source / p) == digest, p
            before = ROOT / 'source-before' / p if p in changed else args.runtime_source / p
            assert sha(before) == baseline[p], p
    if args.dist:
        dist = read('qualification/dist-manifest.json')
        assert len(dist) == 30
        for p, digest in dist.items():
            assert sha(args.dist / p) == digest, p

    tests = read('qualification/test-results.json')
    assert tests['numPassedTests'] == 399 and tests['numFailedTests'] == 0
    assert len(tests['testResults']) == 45
    checks = read('qualification/checks.json')
    assert [c['name'] for c in checks] == ['full-tests', 'app-build', 'hero-build']
    assert all(c['exitCode'] == 0 and c['terminalObservedByPopen'] for c in checks)

    png_count = 0
    for png in sorted((ROOT / 'browser').glob('*.png')):
        metadata = json.loads(png.with_suffix('.json').read_text())
        transfer = json.loads(png.with_suffix('.transfer.json').read_text())
        data = metadata['metadata']
        assert sha(png) == metadata['png']['sha256'] == transfer['sha256']
        assert png.stat().st_size == metadata['png']['byteLength'] == transfer['bytes']
        with Image.open(png) as image:
            image.load()
            assert list(image.size) == [2474, 1844] == data['canvas'] == data['internal'] == data['output']
        assert data['quality'] == 'ultra' and data['nominalSteps'] == 384
        assert data['volume'] == [256, 256, 256] and data['detailVolume'] == [128, 128, 128]
        parts = metadata['textExport']
        assert parts['totalCharacters'] == 22 + 4 * math.ceil(png.stat().st_size / 3)
        assert parts['parts'] == len(transfer['ledger'])
        assert sum(p['characters'] for p in transfer['ledger']) == parts['totalCharacters']
        assert [p['part'] for p in transfer['ledger']] == list(range(1, parts['parts'] + 1))
        png_count += 1
    assert png_count == 5
    sun = ROOT / 'browser/v58-main-sun-terrain-native-settled.png'
    worker = ROOT / 'browser/v58-worker-sun-terrain-native.png'
    previous_sun = ROOT.parent / 'native-frame-export-2026-10-16/browser/main74-sun-terrain-native.png'
    assert sun.read_bytes() == worker.read_bytes() == previous_sun.read_bytes()
    assert (ROOT / 'browser/v57-rain-A1-native.png').read_bytes() == (ROOT / 'browser/v58-rain-B-native.png').read_bytes()
    assert read('browser/v57-rain-A2-metadata.json')['png']['sha256'] == sha(ROOT / 'browser/v57-rain-A1-native.png')

    reports = [read('browser/' + name) for name in ['v57-rain-A1-report.json', 'v58-rain-B-report.json', 'v57-rain-A2-report.json']]
    validation = read('browser/ABA-validation.json')
    for key in validation['exactlyEqualFields']:
        assert all(o[key] == reports[0][key] for o in reports), key
    for o in reports:
        s, q = o['stats'], o['queuePrefix']
        assert q['status'] == 'completed' and q['unconfirmedMeasuredFrames'] == 0
        assert q['confirmedPrefixId'] == q['measuredSubmissions'] == s['frames'] == len(o['frameIntervalsMs'])
        assert all(sample['status'] == 'completed' for sample in q['samples'])
        assert abs(sum(o['frameIntervalsMs']) - s['durationMs']) < 1e-7
        assert abs(s['fps'] - s['frames'] * 1000 / s['durationMs']) < 1e-10
        assert o['presentedCanvasFps'] is None
        assert not o['skyPending'] and o['weather']['atmosphereTransition'] == 1
        assert abs(o['weather']['rain'] - .8) < 1e-12
        assert o['clockStateStart']['forcingTime'] == o['clockStateEnd']['forcingTime'] == 0
        assert o['clockStateStart']['precipitationUniformTime'] == o['clockStateEnd']['precipitationUniformTime'] == 0
        assert o['flashCountStart'] == o['flashCountEnd'] == 0
    b = reports[1]
    start, end = b['terrainRaster']['shadow']['cache'], b['terrainRasterEnd']['shadow']['cache']
    delta = {k: end[k] - start[k] for k in ['requests', 'submissions', 'hits', 'epoch']}
    assert delta == validation['cacheDeltaIncludingWarmup'] == {'requests': 750, 'submissions': 0, 'hits': 750, 'epoch': 0}
    assert start['valid'] and end['valid']
    assert b['stats']['fps'] > max(reports[0]['stats']['fps'], reports[2]['stats']['fps'])
    assert [o['timestampPasses']['coverage']['render']['expectedCalls'] // o['stats']['frames'] for o in reports] == [4, 3, 4]
    assert all(o['timestampPasses']['coverage']['compute']['expectedCalls'] == o['stats']['frames'] for o in reports)

    witness, clip = read('witness/result.json'), read('caster-intersection-analysis/result.json')
    assert len(witness['rows']) == 6 and witness['counts'] == {'artifactMismatch': 0, 'cpuShadow': 3, 'physicalBlocker': 6}
    assert all(row['physicalSunRay']['blocker'] is not None for row in witness['rows'])
    assert clip['inputSHA256'] == sha(ROOT / 'witness/result.json')
    assert clip['counts'] == {'baselineAffineTexel': {'shadowed': 3, 'litWithPhysicalBlocker': 3},
                              'fullTriangleClamp': {'shadowed': 4, 'litWithPhysicalBlocker': 2},
                              'clippedTriangleTexel': {'shadowed': 6, 'litWithPhysicalBlocker': 0}}
    assert all(not row['lookup']['insideCasterTriangle'] for row in clip['rows'])
    assert read('witness/summary.json')['run']['budgetPASS']
    preview = read('browser/ordinary-v58-proof.json')
    assert preview['canvas'] == {'width': 2474, 'height': 1844, 'cssWidth': 1237, 'cssHeight': 922}
    assert preview['profileCaptureControls'] == 0 and preview['pauseButtonPresent'] == 1 and preview['console'] == []
    print(json.dumps({'status': 'PASS_SAVED_EVIDENCE_ONLY', 'payloadFiles': len(manifest['payload']),
                      'payloadBytes': manifest['bytes'], 'decodedNativePngs': png_count,
                      'sourceFiles': 124 if args.runtime_source else 'not requested',
                      'distFiles': 30 if args.dist else 'not requested',
                      'testsSaved': 399, 'freshGpuExecution': False}))

if __name__ == '__main__':
    main()
