"""Verify archived bytes and the limited A/B/A measurement contract; no GPU."""
from pathlib import Path
import gzip
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    for relative, entry in manifest['files'].items():
        data = (ROOT / relative).read_bytes()
        assert len(data) == entry['bytes'] and digest(data) == entry['sha256'], relative
        if 'uncompressedSha256' in entry:
            raw = gzip.decompress(data)
            assert len(raw) == entry['uncompressedBytes'] and digest(raw) == entry['uncompressedSha256']

    source_root = ROOT / 'source-evidence'
    source_manifest = json.loads((source_root / 'manifest.json').read_text())
    for relative, entry in source_manifest['files'].items():
        data = (source_root / relative).read_bytes()
        assert len(data) == entry['bytes'] and digest(data) == entry['sha256']
    source_provenance = json.loads((source_root / 'provenance.json').read_text())
    for original, expected in source_provenance['candidateFiveFinalSources'].items():
        archived = source_provenance['archivedSnapshotFiles'][original]
        data = (source_root / archived['path']).read_bytes()
        if archived['encoding'] == 'gzip':
            data = gzip.decompress(data)
        assert len(data) == expected['bytes'] and digest(data) == expected['sha256']

    provenance = json.loads((ROOT / 'measurements/raw-provenance.json').read_text())
    for relative, entry in provenance.items():
        raw = gzip.decompress((ROOT / relative).read_bytes())
        assert len(raw) == entry['uncompressedBytes']
        assert digest(raw) == entry['uncompressedSha256']

    summary = json.loads((ROOT / 'measurements/summary.json').read_text())
    for label, run in summary['runs'].items():
        report = json.loads(gzip.decompress((ROOT / run['rawReport']).read_bytes()))
        for key, expected in summary['common'].items():
            assert report[key] == expected, (label, key)
        assert report['quality'] == 'ultra' and report['nominalSteps'] == 384
        assert report['output'] == report['internal'] == [2560, 1440]
        assert report['volume'] == [256] * 3 and report['detailVolume'] == [128] * 3
        assert report['executionThread'] == 'main' and report['ablation'] == 'full'
        assert report['flowMode'] == 'full' and report['paused'] and not report['orbit']
        assert report['simulationTimeStart'] == report['simulationTimeEnd'] == 60
        assert report['skyPending'] is False and report['weather']['atmosphereTransition'] == 1
        assert report['weather']['sky'] == 'rain' and abs(report['weather']['rain'] - .8) < 1e-6
        assert report['weather']['wind'] == .55 and report['weather']['dispersion'] == 0
        assert report['flashCountStart'] == report['flashCountEnd'] == 0
        for clock in ['clockStateStart', 'clockStateEnd']:
            assert report[clock]['forcingTime'] == report[clock]['precipitationUniformTime'] == 0
        assert report['densitySamplingStart'] == report['densitySamplingEnd']
        assert report['densitySamplingStart']['path'] == 'r8unorm-extracted-r'
        stats = report['stats']
        assert len(report['frameIntervalsMs']) == stats['frames']
        assert math.isclose(sum(report['frameIntervalsMs']), stats['durationMs'], abs_tol=1e-6)
        assert math.isclose(1000 * stats['frames'] / stats['durationMs'], run['submissionFps'], abs_tol=1e-12)
        prefix = report['queuePrefix']
        assert prefix['status'] == 'completed' and prefix['unconfirmedMeasuredFrames'] == 0
        assert prefix['confirmedPrefixId'] == prefix['measuredSubmissions'] == stats['frames']
        assert report['presentedCanvasFps'] is None
        timestamps = report['timestampPasses']
        assert timestamps['status'] == 'closed'
        assert timestamps['coverage'] == run['timestampCoverage']
        diagnostics = timestamps['diagnostics']
        assert diagnostics == run['timestampDiagnostics']
        for key in ['invalidPassRows', 'ambiguousPassRows', 'duplicateUidRows', 'duplicateCallSlots']:
            assert diagnostics[key] == 0
        assert diagnostics['duplicateLedgerIds'] == diagnostics['duplicateMeasuredIntervalIds'] == []
        print(f"{label}: {run['submissionFps']:.6f} invii/s, prefisso {prefix['confirmedPrefixId']} completo")

    print('Hash, gzip lossless e invarianti circoscritte verificati; nessuna accettazione artistica o FPS presentati.')


if __name__ == '__main__':
    verify()
