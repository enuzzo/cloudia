"""Portable file and captured-f32 verifier. No GPU, browser, render or bake.

Run after concurrent FPS measurements. Reconstructs captured output bytes;
does not independently execute either shader or certify the full renderer.
"""
from pathlib import Path
from collections import Counter
import hashlib
import json
import math
import re
import struct
import tarfile

BASE = Path(__file__).resolve().parent
EXPECTED_OUTPUT_SHA = '02fda484196d60c13cb86cdcebcd6574e356e28478f7a6f514c1c98038248987'
SENTINEL = 0x7fc00001

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read_json(relative):
    return json.loads((BASE / relative).read_text())

manifest = read_json('manifest.json')
observed = {}
for path in sorted(BASE.rglob('*')):
    assert not path.is_symlink(), f'Unexpected symlink: {path}'
    if path.is_file() and path != BASE / 'manifest.json':
        data = path.read_bytes()
        observed[str(path.relative_to(BASE))] = dict(bytes=len(data), sha256=sha(data))
assert observed == manifest['files'], 'Package payload, bytes or SHA256 differs'
assert sum(v['bytes'] for v in observed.values()) == manifest['payloadBytes']

app_files = {}
with tarfile.open(BASE / 'app-original.tar.gz', 'r:gz') as archive:
    for member in archive.getmembers():
        assert member.isfile(), f'Non-regular archive member: {member.name}'
        assert member.name.startswith('app/') and '..' not in Path(member.name).parts
        name = member.name[4:]
        assert name and name not in app_files, f'Duplicate or empty archive path: {member.name}'
        app_files[name] = archive.extractfile(member).read()
historical_bytes = app_files['manifest.json']
assert sha(historical_bytes) == '42ace1caa855700419cd549deeabf39ffbe8f53b9c380be8f7c356845c132f27'
app_manifest = json.loads(historical_bytes)
assert set(app_files) == set(app_manifest['files']) | {'manifest.json'}
for name, expected in app_manifest['files'].items():
    data = app_files[name]
    assert len(data) == expected['bytes'], f'Original size differs: {name}'
    assert sha(data) == expected['sha256'], f'Original SHA differs: {name}'
assert sum(item['bytes'] for item in app_manifest['files'].values()) == app_manifest['payloadBytes']
cases = json.loads(app_files['cases.json'])
provenance = json.loads(app_files['provenance.json'])
summary = read_json('browser/shared-aerial-gpu-result.json')
records = read_json('browser/shared-aerial-gpu-records.json')
console = read_json('browser/shared-aerial-gpu-console.json')
assert console == [], 'Captured console is not empty'
assert cases['count'] == len(cases['cases']) == len(records) == 216
assert cases['strideFloats'] == 32
assert summary['tuples'] == 216 and summary['comparedChannels'] == 864
assert summary['baselineCommit'] == provenance['baselineCommit'] == app_manifest['baselineCommit']
assert summary['status'] == 'PASS' and summary['gpuExecuted'] is True
assert summary['validationErrors'] == []
assert summary['mismatchExamples'] == []
resources = ['cases.json', 'old.wgsl', 'new.wgsl', 'provenance.json']
assert summary['frozenResources'] == {name: app_manifest['files'][name]['sha256'] for name in resources}

raw = {variant: bytearray() for variant in ['old', 'new']}
decoded = {variant: [] for variant in ['old', 'new']}
bit_mismatches = 0
mismatch_tuples = 0
nonfinite = 0
unwritten = 0
scenario_count = Counter()
scenario_mismatches = Counter()
for index, (record, case) in enumerate(zip(records, cases['cases'])):
    assert record['index'] == case['index'] == index
    assert record['id'] == case['id']
    scenario_count[case['scenario']] += 1
    parsed = {}
    for variant in ['old', 'new']:
        words = record[variant + 'Bits']
        rgba = record[variant + 'RGBA']
        assert len(words) == len(rgba) == 4
        assert all(isinstance(word, str) and re.fullmatch(r'0x[0-9a-f]{8}', word) for word in words)
        parsed[variant] = [int(word, 16) for word in words]
        row = []
        for channel, word in enumerate(parsed[variant]):
            # Apple/Metal capture used little-endian Uint32Array/Float32Array.
            data = struct.pack('<I', word)
            value = struct.unpack('<f', data)[0]
            raw[variant].extend(data)
            nonfinite += not math.isfinite(value)
            unwritten += word == SENTINEL
            recorded_value = rgba[channel]
            assert isinstance(recorded_value, (int, float)) and not isinstance(recorded_value, bool)
            assert math.isfinite(recorded_value)
            assert struct.pack('<f', recorded_value) == data, f'RGBA decimal differs from captured bits: {index}/{variant}/{channel}'
            assert recorded_value == value, f'RGBA is not exact decoded f32: {index}/{variant}/{channel}'
            row.append(value)
        decoded[variant].append(row)
    differences = sum(a != b for a, b in zip(parsed['old'], parsed['new']))
    bit_mismatches += differences
    mismatch_tuples += differences > 0
    scenario_mismatches[case['scenario']] += differences > 0
    assert record['equalBits'] is (differences == 0)

assert bit_mismatches == summary['bitMismatches'] == 0
assert mismatch_tuples == summary['mismatchTuples'] == 0
assert nonfinite == summary['nonFiniteLanes'] == 0
assert unwritten == summary['unwrittenLanes'] == 0
assert summary['byScenario'] == {name: dict(tuples=count, mismatchTuples=scenario_mismatches[name]) for name, count in scenario_count.items()}
hashes = {}
for variant in ['old', 'new']:
    assert len(raw[variant]) == 864 * 4
    hashes[variant] = sha(raw[variant])
    assert hashes[variant] == summary[variant + 'OutputSHA256'] == EXPECTED_OUTPUT_SHA
    ranges = dict(min=[min(row[c] for row in decoded[variant]) for c in range(4)], max=[max(row[c] for row in decoded[variant]) for c in range(4)])
    assert ranges == summary['ranges'][variant]

print(json.dumps(dict(status='PASS', scope='File integrity, lossless original-app archive and reconstruction of captured output bytes only; no extraction, GPU rerun, full-shader or FPS proof', payloads=len(observed), payloadBytes=manifest['payloadBytes'], originalAppPayloads=len(app_manifest['files']), archivedAppFiles=len(app_files), originalAppManifestSHA256=sha(historical_bytes), tuples=216, channelsPerVariant=864, reconstructedBytesPerVariant=len(raw['old']), outputSHA256=hashes, bitMismatches=bit_mismatches, nonFiniteLanes=nonfinite, unwrittenLanes=unwritten), indent=2))
