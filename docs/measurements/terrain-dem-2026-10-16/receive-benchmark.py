#!/usr/bin/env python3
"""Explicit offline receiver for one completed R2 report; no watch, GPU or rerun."""
import argparse
import gzip
import hashlib
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent


def receive(report, screenshot, worker_console):
    if (HERE / 'MANIFEST.json').exists():
        raise SystemExit('Frozen package: MANIFEST.json exists; no files were changed.')
    raw = report.read_bytes()
    x = json.loads(raw)
    assert x['rendererVersion'] == 'observatory-v53-measured-terrain'
    assert x['output'] == x['internal'] == [2474, 1844]
    assert x['stats']['frames'] == len(x['frameIntervalsMs']) == 436
    assert x['queuePrefix']['status'] == 'completed'
    assert x['queuePrefix']['confirmedPrefixId'] == 436
    assert x['presentedCanvasFps'] is None
    console = json.loads(worker_console.read_bytes())
    assert console == [], 'Expected the recorded empty Worker console, not a filtered console.'
    assert screenshot.is_file()
    folder = HERE / 'benchmark'
    folder.mkdir(exist_ok=True)
    target = folder / 'dem-r2-rain-benchmark.json.gz'
    target.write_bytes(gzip.compress(raw, mtime=0))
    image_target = HERE / 'browser' / screenshot.name
    shutil.copyfile(screenshot, image_target)
    console_target = HERE / 'browser' / worker_console.name
    shutil.copyfile(worker_console, console_target)
    summary = {
        'scope': 'One completed main-thread R2 Rain submission window; no presentation or causal speedup claim',
        'rendererVersion': x['rendererVersion'],
        'raw': {'source': str(report), 'storage': str(target.relative_to(HERE)),
                'uncompressedBytes': len(raw), 'uncompressedSha256': hashlib.sha256(raw).hexdigest(),
                'gzip': 'lossless mtime0'},
        'state': {k: x[k] for k in ['date', 'backend', 'adapter', 'threeRevision', 'quality',
                  'output', 'internal', 'nominalSteps', 'volume', 'detailVolume', 'seed',
                  'paused', 'simulationTimeStart', 'simulationTimeEnd', 'executionThread',
                  'flowMode', 'ablation', 'skyPending', 'camera', 'weather', 'terrainSurfaceId',
                  'terrainGeography', 'terrainRaster', 'densitySamplingStart', 'densitySamplingEnd',
                  'clockStateStart', 'clockStateEnd', 'maxFramesInFlight', 'timingMode']},
        'submissionFps': x['submissionFps'],
        'submissionPacing': x['submissionPacing'],
        'intervalSumMs': sum(x['frameIntervalsMs']),
        'queuePrefix': {k: v for k, v in x['queuePrefix'].items() if k != 'samples'},
        'timestampCoverage': x['timestampPasses']['coverage'],
        'timestampDiagnostics': x['timestampPasses']['diagnostics'],
        'returnedIntervalStatistics': {
            'legacySparseRenderPassSumMs': x['gpuRenderPassSumMs'],
            'completeLedgerPassSumsMs': x['timestampPasses']['statistics'],
            'limit': 'NONADDITIVE returned intervals: no exclusive terrain/cloud cost, GPU busy time, FPS or hardware-cause inference'},
        'presentedCanvasFps': x['presentedCanvasFps'],
        'limits': [
            '436 accepted submission intervals, not 436 compositor-presented images',
            'Final fence confirms the measured submitted prefix; includes inherited backlog and JS delivery',
            'Single window without matched controls; v52 geography differed, so no causal percentage comparison',
            'Rain UI target 80%; recorded weather.rain is preserved without rounding or claiming exact 0.8',
            'Simulation is paused at t60, but the weather clock advanced; no entire-state-constant claim',
            'No 60 stable FPS or whole-product artistic PASS']
    }
    (folder / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    origins_path = HERE / 'origins.json'
    origins = json.loads(origins_path.read_text())
    for source, dest in [(screenshot, image_target), (worker_console, console_target)]:
        data = source.read_bytes()
        origins['copiedOriginals'].append({'path': str(dest.relative_to(HERE)), 'source': str(source),
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    origins['benchmarkRaw'] = summary['raw']
    origins_path.write_text(json.dumps(origins, indent=2) + '\n')
    print(json.dumps({'received': str(target), 'rawSha256': summary['raw']['uncompressedSha256'],
                      'submissionFps': x['submissionFps'], 'frames': 436}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    parser.add_argument('screenshot', type=Path)
    parser.add_argument('worker_console', type=Path)
    args = parser.parse_args()
    receive(args.report.resolve(), args.screenshot.resolve(), args.worker_console.resolve())
