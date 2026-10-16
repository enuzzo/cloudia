#!/usr/bin/env python3
"""Read-only integrity/measurement verifier; does not grade visual realism."""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--source-root', type=Path)
args = parser.parse_args()
here = Path(__file__).resolve().parent
manifest = json.loads((here / 'manifest.json').read_text())
for name, expected in manifest.items():
    assert Path(name).name == name, name
    assert hashlib.sha256((here / name).read_bytes()).hexdigest() == expected, name

summary = json.loads((here / 'summary.json').read_text())
raw = gzip.decompress((here / 'r5-rain-benchmark.json.gz').read_bytes())
assert len(raw) == summary['rawBenchmarkBytes']
assert hashlib.sha256(raw).hexdigest() == summary['rawBenchmarkSHA256']
report = json.loads(raw)
assert report['rendererVersion'] == summary['renderer']
assert report['output'] == report['internal'] == [2474, 1844]
assert report['quality'] == 'ultra'
assert report['volume'] == [256, 256, 256]
assert report['detailVolume'] == [128, 128, 128]
assert report['presentedCanvasFps'] is None
assert report['queuePrefix']['status'] == 'completed'
assert report['simulationTimeStart'] == report['simulationTimeEnd'] == 60
stats = report['stats']
assert math.isclose(report['submissionFps'], stats['frames'] * 1000 / stats['durationMs'], rel_tol=1e-12)
draws = report['timestampPasses']['draws']
measured = [draw for draw in draws if draw['measuredIntervalId'] is not None]
assert len(measured) == summary['timestampLedger']['measuredDraws'] == 487
assert sum(draw['render']['status'] == 'complete' for draw in measured) == 486
assert {draw['after']['renderFrameCalls'] - draw['before']['renderFrameCalls'] for draw in draws} == {4}
assert report['terrainRaster']['shadow']['receiverRadialOffsetKm'] == .03125
assert report['terrainRaster']['vertices'] == 465409
assert report['terrainRaster']['triangles'] == 929792

source_count = 0
if args.source_root:
    sources = json.loads((here / 'r5-source-manifest.json').read_text())
    for name, expected in sources.items():
        path = Path(name)
        assert not path.is_absolute() and '..' not in path.parts, name
        assert hashlib.sha256((args.source_root / path).read_bytes()).hexdigest() == expected, name
    source_count = len(sources)
print(f'PASS: {len(manifest)} payload hashes; original report; 487 measured draws / 486 complete render ledgers; {source_count} source files checked')
print('Visual realism, native framebuffer parity and compositor FPS are not certified by this verifier.')
