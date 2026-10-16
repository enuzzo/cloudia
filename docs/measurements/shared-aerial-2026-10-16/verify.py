"""Verify the retired trial archive and captured records; no GPU or renderer."""
from pathlib import Path
import gzip
import hashlib
import json
import math
import runpy

ROOT = Path(__file__).resolve().parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_json(relative):
    return json.loads((ROOT / relative).read_text())


def read_gzip_json(relative):
    return json.loads(gzip.decompress((ROOT / relative).read_bytes()))


def verify():
    manifest = read_json('manifest.json')
    observed = {}
    for path in sorted(ROOT.rglob('*')):
        assert not path.is_symlink(), path
        if path.is_file() and path != ROOT / 'manifest.json':
            data = path.read_bytes()
            observed[str(path.relative_to(ROOT))] = dict(bytes=len(data), sha256=sha(data))
    assert observed == manifest['files'], 'Archive payload differs'
    assert sum(entry['bytes'] for entry in observed.values()) == manifest['payloadBytes']
    document = ROOT.parent.parent / manifest['document']['path']
    data = document.read_bytes()
    assert dict(bytes=len(data), sha256=sha(data)) == {
        key: manifest['document'][key] for key in ['bytes', 'sha256']
    }, 'Narrative differs'
    for relative, expected in read_json('lossless-provenance.json').items():
        raw = gzip.decompress((ROOT / relative).read_bytes())
        assert len(raw) == expected['uncompressedBytes']
        assert sha(raw) == expected['uncompressedSha256']

    summary = read_json('measurements/summary.json')
    qualification = read_json('browser/qualified-comparison.json')
    qualified = {row['run']: row for row in qualification['runs']}
    rates = {}
    for label, run in summary['runs'].items():
        report = read_gzip_json(run['rawReport'])
        for key, expected in summary['common'].items():
            assert report[key] == expected, (label, key)
        assert {key: value for key, value in report['weather'].items() if key != 'rain'} == summary['commonWeatherExceptRain']
        assert abs(report['weather']['rain'] - .8) < 1e-6
        assert report['quality'] == 'ultra' and report['nominalSteps'] == 384
        assert report['output'] == report['internal'] == [2560, 1440]
        assert report['volume'] == [256] * 3 and report['detailVolume'] == [128] * 3
        assert report['executionThread'] == 'main' and report['ablation'] == report['flowMode'] == 'full'
        assert report['simulationTimeStart'] == report['simulationTimeEnd'] == 60
        assert report['paused'] and not report['orbit'] and not report['skyPending']
        assert report['weather']['atmosphereTransition'] == 1 and report['weather']['sky'] == 'rain'
        assert report['camera']['target'] == [0, 0, 0] and report['camera']['approach'] == 0
        assert math.isclose(math.dist(report['camera']['origin'], report['camera']['target']), 16)
        for clock in ['clockStateStart', 'clockStateEnd']:
            assert report[clock]['forcingTime'] == report[clock]['precipitationUniformTime'] == 0
        assert report['densitySamplingStart'] == report['densitySamplingEnd']
        assert report['densitySamplingStart']['path'] == 'r8unorm-extracted-r'
        assert report['warmupMs'] == 2000 and report['targetDurationMs'] == 30000
        assert report['stats'] == run['stats']
        assert len(report['frameIntervalsMs']) == report['stats']['frames']
        assert math.isclose(sum(report['frameIntervalsMs']), report['stats']['durationMs'], abs_tol=1e-6)
        rate = 1000 * report['stats']['frames'] / report['stats']['durationMs']
        assert math.isclose(rate, run['submissionFps'], abs_tol=1e-12)
        assert rate == report['submissionFps'] == qualified[label]['fps']
        rates[label] = rate
        prefix = report['queuePrefix']
        assert prefix['status'] == 'completed' and prefix['unconfirmedMeasuredFrames'] == 0
        assert prefix['confirmedPrefixId'] == prefix['measuredSubmissions'] == report['stats']['frames']
        assert report['presentedCanvasFps'] is None
        timestamps = report['timestampPasses']
        assert timestamps['status'] == 'closed'
        assert timestamps['coverage'] == run['timestampCoverage'] == qualified[label]['timestampCoverage']
        assert timestamps['diagnostics'] == run['timestampDiagnostics'] == qualified[label]['timestampDiagnostics']
        diagnostics = timestamps['diagnostics']
        for key in ['invalidPassRows', 'ambiguousPassRows', 'duplicateUidRows', 'duplicateCallSlots']:
            assert diagnostics[key] == 0
        assert diagnostics['duplicateLedgerIds'] == diagnostics['duplicateMeasuredIntervalIds'] == []
        jpeg = (ROOT / f'browser/shared-aerial-{label}.jpg').read_bytes()
        assert sha(jpeg) == qualified[label]['jpegSha256']
        assert qualified[label]['jpegSize'] == [1280, 720]
        assert qualified[label]['rgbDifferenceVsA1'] == dict(bbox=None, max=0, meanAbsoluteChannel255=0.0)
        assert jpeg == (ROOT / 'browser/shared-aerial-A1.jpg').read_bytes()
        print(f'{label}: {rate:.6f} invii/s, prefisso completo')
    assert rates['A3'] < rates['B2'] < rates['A2']
    assert summary['repeatBWithinControls'] is True and summary['decision'] == 'retired-not-promoted'
    pairs = {'firstBlock': {'A2vsA1': ('A2', 'A1'), 'BvsA1': ('B', 'A1'), 'BvsA2': ('B', 'A2')},
             'repeatBlock': {'A3vsA2': ('A3', 'A2'), 'B2vsA2': ('B2', 'A2'), 'B2vsA3': ('B2', 'A3')}}
    for block, comparisons in pairs.items():
        for key, (left, right) in comparisons.items():
            assert math.isclose(summary['comparisonsPercent'][block][key], 100 * (rates[left] / rates[right] - 1), abs_tol=1e-12)

    source = read_json('source-changes/provenance.json')
    for relative, variants in source['snapshots'].items():
        for variant, entry in variants.items():
            raw = gzip.decompress((ROOT / entry['archived']).read_bytes())
            assert len(raw) == entry['bytes'] and sha(raw) == entry['sha256'], (variant, relative)
    def snapshot(variant, name):
        entry = source['snapshots']['src/cumulonimbus/' + name][variant]
        return gzip.decompress((ROOT / entry['archived']).read_bytes()).decode()
    for name in ['GPUSceneEngine.ts', 'lifecycle.test.ts']:
        assert snapshot('candidate', name).replace('observatory-v50-trial', 'observatory-v50-quality-checkpoint') == snapshot('baseline', name)
    insertion = """  if(useNarrow||useDensityR8)source=source
    .replace('rainSource=mix(sky,rainLight,aerialTransmittance(t,weather.x));','rainSource=rainLight;')
    .replace('let aerial=aerialTransmittance(t,weather.x);',
      'let aerial=aerialTransmittance(t,weather.x);\\n    if(rainExtinction>0.0){rainSource=mix(sky,rainSource,aerial);}');
"""
    candidate = snapshot('candidate', 'cloudShader.ts')
    assert candidate.count(insertion) == 1
    assert candidate.replace(insertion, '') == snapshot('baseline', 'cloudShader.ts')
    witnesses = read_json('gpu/candidate-template-witnesses.json')['witnesses']
    assert len(witnesses) == 24
    assert len({(row['mode'], row['useNarrow'], row['useDensityR8']) for row in witnesses}) == 24
    for row in witnesses:
        assert row['baselineSha256'] == row['restoredSha256']
        assert row['librarySha256'] == witnesses[0]['librarySha256']
        if not row['useNarrow'] and not row['useDensityR8']:
            assert row['candidateSha256'] == row['baselineSha256']
    assert witnesses[0]['candidateSha256'] == '59523937da9df384aa57345fb99c758cee70bc83c5ada8d3084038dfa416f546'
    validation = read_gzip_json('source-changes/validation.json.gz')
    assert validation['finalFocusedCompletion']['value']['exit_code'] == 0
    assert '40 passed (40)' in validation['finalFocusedCompletion']['value']['output']
    assert validation['typecheckCompletion']['value']['exit_code'] == validation['appBuildCompletion']['exit_code'] == 0
    assert validation['initialFailure']['result']['value']['exit_code'] == 1

    # Reconstructs only previously captured f32 bytes; does not rerun the GPU.
    runpy.run_path(str(ROOT / 'gpu/verify.py'), run_name='__main__')
    print('PASS: archivio, gzip lossless, invarianti dei 5 report, snapshot e record GPU catturati. Trial ritirato; nessuna prova FPS presentati o accettazione artistica.')


if __name__ == '__main__':
    verify()
