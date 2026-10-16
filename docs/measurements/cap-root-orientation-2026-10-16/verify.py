#!/usr/bin/env python3
"""Verify saved payloads and recorded results, without regenerating volumes."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def saved_json(name):
    return json.loads(gzip.decompress((ROOT / ('originals/' + name + '.gz')).read_bytes()))


manifest = json.loads((ROOT / 'manifest.json').read_text())
for row in manifest['files']:
    path = ROOT / row['path']
    data = path.read_bytes()
    assert len(data) == row['bytes'] and digest(data) == row['sha256'], row['path']

records = json.loads((ROOT / 'lossless-provenance.json').read_text())['records']
for row in records:
    data = (ROOT / row['storedPath']).read_bytes()
    if row['storage'] == 'lossless-gzip':
        data = gzip.decompress(data)
    assert len(data) == row['originalBytes'] and digest(data) == row['originalSha256'], row['logicalPath']

source = saved_json('evidence-manifest.json')
assert len(source['files']) == 21
for row in source['files']:
    stored = ROOT / ('originals/' + row['path'] + ('' if row['path'].endswith('.gz') else '.gz'))
    data = stored.read_bytes()
    if not row['path'].endswith('.gz'):
        data = gzip.decompress(data)
    assert len(data) == row['bytes'] and digest(data) == row['sha256'], row['path']

numeric = saved_json('comparison-32-64.json')
rows = numeric['results']
assert len(rows) == 20 and numeric['sizes'] == [32, 64]
indexed = {(row['label'], row['seed'], row['size']): row for row in rows}
assert len(indexed) == 20
skipped = sum(row['support']['skipped'] for row in rows)
assert skipped == 2037238
assert sum(row['support']['missed'] for row in rows) == 0
for size in [32, 64]:
    for seed in [72, 73, 74, 77, 80]:
        a = indexed[('baseline', seed, size)]
        b = indexed[('candidate', seed, size)]
        assert a['rng'] == b['rng'], (seed, size, 'rng')
        assert b['geometrySummary']['taggedCount'] == (0 if seed in [72, 73] else 25)
        if seed in [72, 73]:
            assert a['hashes'] == b['hashes'], (seed, size, 'control channels')

revision = saved_json('type-only-equivalence.json')
assert revision['pass'] and revision['exactJavaScriptEquality']
helper = gzip.decompress((ROOT / 'sources/candidate-capRootOrientation.ts.gz').read_bytes())
assert digest(helper) == revision['afterSourceSha256']
assert digest(helper.replace(b'lobe[i]! - v', b'lobe[i] - v')) == revision['beforeSourceSha256']
decision = json.loads((ROOT / 'VISUAL-DECISION.json').read_text())
assert decision['decision'] == 'retired; do not promote'
assert len(decision['views']) == 2
for name, expected in [
    ('baseline-volume.ts', 'a53410c45b04143710cffd098b6a33deade3242c66ecf7eecc6405a214a93b00'),
    ('candidate-volume.ts', decision['candidateVolumeSha256']),
    ('candidate-capRootOrientation.ts', decision['candidateHelperSha256']),
]:
    assert digest(gzip.decompress((ROOT / ('sources/' + name + '.gz')).read_bytes())) == expected
canvas = json.loads(gzip.decompress((ROOT / 'browser/candidate-canvas.json.gz').read_bytes()))
assert canvas == dict(width=2560, height=1440, clientWidth=1280, clientHeight=720)
print(json.dumps(dict(status='PASS', payloads=len(manifest['files']), originals=len(records),
                     volumeRecords=len(rows), skippedVoxelRecords=skipped, reportedMisses=0,
                     views=2, decision=decision['decision'],
                     scope='Saved file/gzip integrity and record consistency only; no bake, test, GPU, FPS or art acceptance'), indent=2))
