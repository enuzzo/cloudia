"""Portable integrity and saved-record checks. No bake, tests, build or GPU.

Checks trace arithmetic and semantic closure, not a new volume generation.
Saved channel hashes are compared; voxel buffers are deliberately absent.
"""
from pathlib import Path
from collections import defaultdict
import gzip
import hashlib
import json
import math

BASE = Path(__file__).resolve().parent
BASE_SHA = 'a53410c45b04143710cffd098b6a33deade3242c66ecf7eecc6405a214a93b00'
CANDIDATE_SHA = '3db1246ae8741521be70d336a8ecdbee92bf33ea24f83246359faa909bad1b35'
SEEDS = [72, 73, 74, 77, 80]
SIZES = [32, 64]

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
assert observed == manifest['files'], 'Payload list, bytes or SHA differs'
assert sum(item['bytes'] for item in observed.values()) == manifest['payloadBytes']
provenance = read_json('provenance.json')
for name, expected in provenance['losslessGzipOriginals'].items():
    data = gzip.decompress((BASE / name).read_bytes())
    assert len(data) == expected['bytes'] and sha(data) == expected['sha256'], name

originals = {}
for name, mapping in provenance['originalFiles'].items():
    data = (BASE / mapping['stored']).read_bytes()
    if mapping['encoding'] == 'gzip':
        data = gzip.decompress(data)
    else:
        assert mapping['encoding'] == 'copy'
    assert len(data) == mapping['bytes'] and sha(data) == mapping['sha256'], name
    originals[name] = data

def original_json(name):
    return json.loads(originals['experiment/' + name])

previsual = original_json('evidence-manifest.json')
assert previsual['fileCount'] == len(previsual['files']) == 18
assert sum(item['bytes'] for item in previsual['files']) == previsual['totalBytes']
for item in previsual['files']:
    data = originals['experiment/' + item['path']]
    assert len(data) == item['bytes'] and sha(data) == item['sha256'], item['path']
decision = original_json('VISUAL-DECISION.json')
assert decision['decision'] == 'retired; do not promote'
assert decision['baselineCommit'] == provenance['baselineCommit'] == '10493afa7f6d90389c39e17b2cad79397dfdac01'
assert decision['candidateVolumeSha256'] == provenance['candidateVolumeSHA256'] == CANDIDATE_SHA
assert decision['conditions']['performance'] == 'not measured'
assert len(decision['views']) == 3
assert len([item for item in decision['payloads'] if item['path'].endswith('.jpg')]) == 6
for item in decision['payloads']:
    data = originals['browser/' + item['path']]
    assert len(data) == item['bytes'] and sha(data) == item['sha256'], item['path']
for name in ['baseline-console.json', 'candidate-console.json']:
    assert json.loads(originals['browser/' + name]) == []
for label, expected_sha in [('baseline', BASE_SHA), ('candidate', CANDIDATE_SHA)]:
    assert sha(originals['snapshot/' + label + '-volume.ts']) == expected_sha

inputs = original_json('verified-inputs.json')
source_maps = {}
for label, expected_bytes in [('baseline', 612911), ('candidate', 613814)]:
    files = inputs[label + 'Files']
    assert len(files) == inputs[label + 'FileCount'] == 108
    assert sum(item['bytes'] for item in files) == inputs[label + 'Bytes'] == expected_bytes
    source_maps[label] = {item['path']: item for item in files}
assert set(source_maps['baseline']) == set(source_maps['candidate'])
changed = [name for name in source_maps['baseline'] if source_maps['baseline'][name] != source_maps['candidate'][name]]
assert changed == ['src/cumulonimbus/volume.ts']
assert source_maps['baseline'][changed[0]]['sha256'] == BASE_SHA
assert source_maps['candidate'][changed[0]]['sha256'] == CANDIDATE_SHA
dist = original_json('dist-manifest.json')
assert dist['runtimeVolumeSha256'] == CANDIDATE_SHA and dist['kind'] == 'app only'
assert len(dist['files']) == dist['fileCount'] == 20
assert sum(item['bytes'] for item in dist['files']) == dist['totalBytes']
validation = original_json('validation.json')
assert validation['typecheck']['exitCode'] == validation['targetedTests']['exitCode'] == validation['appBuild']['exitCode'] == 0
assert validation['targetedTests']['testsPassed'] == 31 and validation['targetedTests']['filesPassed'] == 2

comparison = original_json('comparison-32-64.json')
assert comparison['scope']['seeds'] == SEEDS and comparison['scope']['sizes'] == SIZES
results = {(r['label'], r['size'], r['seed']): r for r in comparison['results']}
assert len(results) == len(comparison['results']) == 20
assert set(results) == {(label, size, seed) for label in ['baseline', 'candidate'] for size in SIZES for seed in SEEDS}
skipped = 0
for r in results.values():
    assert r['support']['missed'] == r['support']['maxMissed'] == 0
    skipped += r['support']['skipped']
    assert all(math.isfinite(v) and v > 0 for v in r['faceClearance'])
assert skipped == 2066839
for size in SIZES:
    for seed in SEEDS:
        a, b = results['baseline', size, seed], results['candidate', size, seed]
        check = b['comparison']
        assert a['rng'] == b['rng'] and check['rngExact']
        assert check['preGeometryExact'] and check['nonTaggedPrimitiveExact'] and check['contractionExact']
        assert a['faceClearance'] == b['faceClearance'] and check['faceClearanceDelta'] == [0] * 6
        assert a['supportBounds'] == b['supportBounds'] and check['supportBoundsExact']
        assert check['channelEqual'] == {key: a['hashes'][key] == b['hashes'][key] for key in a['hashes']}
        delta = check['density']
        assert delta['increased'] + delta['decreased'] + delta['equal'] == size ** 3
        if seed in [72, 73]:
            assert a['hashes'] == b['hashes'] and check['movedPrimitiveCount'] == 0
        else:
            assert a['hashes']['detailRGB'] == b['hashes']['detailRGB']
            assert check['movedPrimitiveCount'] == 182

traces = json.loads(gzip.decompress(originals['experiment/geometry-traces.json.gz']))
trace_map = {(r['label'], r['seed']): r['geometry'] for r in traces['traces']}
assert len(trace_map) == len(traces['traces']) == 10
closure = {r['seed']: r for r in original_json('tag-closure-verification.json')['results']}
translated_by_seed = {}
for label, expected_sha in [('baseline', BASE_SHA), ('candidate', CANDIDATE_SHA)]:
    source = comparison['sources'][label]
    assert source['runtimeSourceSha256'] == expected_sha
    assert source['instrumentedSourceSha256'] == sha(originals['diagnostics/' + label + '.ts'])
    assert source['bundleSha256'] == sha(originals['diagnostics/' + label + '.mjs'])
for seed in SEEDS:
    a, b = trace_map['baseline', seed], trace_map['candidate', seed]
    check = results['candidate', 64, seed]['comparison']
    tagged = set(b['tagged'])
    assert a['pre'] == a['post'] == b['pre']
    assert b['lobeCount'] == b['uniqueLobes'] == len(b['pre']) == len(b['post'])
    assert a['contractions'] == b['contractions']
    assert b['summits'] == a['summits'] and b['foundations'] == a['foundations'] and b['iceCores'] == a['iceCores']
    assert tagged == set(check['movedIndices'])
    assert len(tagged) == len(b['tagged']) == check['movedPrimitiveCount']
    assert {item['index']: item['count'] for item in b['applications']} == {index: 1 for index in tagged}
    assert closure[seed]['closureExact'] and closure[seed]['allApplicationsOnce']
    assert closure[seed]['taggedCount'] == len(tagged)
    children = defaultdict(list)
    for child, parent in b['parents']:
        children[parent].append(child)
    expected = set(b['taggedCores'])
    pending = list(expected)
    while pending:
        parent = pending.pop()
        for child in children[parent]:
            assert child not in expected, 'Cycle or duplicated semantic descendant'
            expected.add(child)
            pending.append(child)
    assert expected == tagged
    for index, (before, after) in enumerate(zip(b['pre'], b['post'])):
        row = list(before)
        if index in tagged:
            row[1] -= check['deltaY']
        assert row == after, f'Unexpected primitive mutation {seed}/{index}'
    if seed in [72, 73]:
        assert not tagged and not b['taggedCores'] and not closure[seed]['groups']
    else:
        assert len(b['taggedCores']) == 2 and len(tagged) == 182
        assert set(b['foundations'] + b['iceCores']).isdisjoint(tagged)
        for group in closure[seed]['groups']:
            core = group['coreIndex']
            direct = children[core]
            grandchildren = [child for parent in direct for child in children[parent]]
            indices = {core, *direct, *grandchildren}
            assert len(direct) == group['directBillows'] == 18
            assert len(grandchildren) == group['children'] == 72
            assert indices == set(group['indices']) and len(indices) == group['uniqueGroupCount'] == 91
            assert group['before'] == b['pre'][core] and group['after'] == b['post'][core]
        mature = max(b['summits'], key=lambda i: b['pre'][i][1])
        assert mature == max(b['summits'], key=lambda i: b['post'][i][1]) and mature not in tagged
    translated_by_seed[seed] = len(tagged)

shoulders = original_json('shoulder-invariance.json')
assert shoulders['derivedFromActualPostTranslationPrimitiveTrace'] is True
assert {r['seed'] for r in shoulders['results']} == {74, 77, 80}
for r in shoulders['results']:
    assert r['baselineCandidateExact'] is True
    values = []
    for label in ['baseline', 'candidate']:
        g = trace_map[label, r['seed']]
        mature_index = max(g['summits'], key=lambda i: g['post'][i][1])
        mature = g['post'][mature_index]
        foot = g['post'][g['foundations'][g['summits'].index(mature_index)]]
        cap = min((g['post'][i] for i in g['iceCores']), key=lambda c: math.hypot(c[0] - mature[0], c[2] - mature[2]))
        values.append(dict(start=[foot[i] + (mature[i] - foot[i]) * .68 for i in range(3)], end=[cap[0] + cap[3] * .28, cap[1] - cap[4] * .1, cap[2]], width=max(mature[3] * .95, foot[3] * .62), depth=max(mature[5] * .95, cap[5] * .68)))
    assert values[0] == values[1] == r['parameters']
confirmation = original_json('uninstrumented-confirmation.json')
assert confirmation['pass'] and confirmation['sourceSha256'] == CANDIDATE_SHA
assert confirmation['bundleSha256'] == sha(originals['diagnostics/candidate-uninstrumented.mjs'])
assert confirmation['hashes'] == results['candidate', 64, 74]['hashes']
assert confirmation['supportBounds'] == results['candidate', 64, 74]['supportBounds']

print(json.dumps(dict(status='PASS', scope='File/gzip integrity and saved numeric/decision consistency only; no volume generation, tests, build, render, FPS or artistic acceptance', payloads=len(observed), payloadBytes=manifest['payloadBytes'], losslessGzipOriginals=len(provenance['losslessGzipOriginals']), numericVolumeRecords=20, sizes=SIZES, skippedVoxelRecords=skipped, reportedFalseOmissions=0, translatedPrimitiveRecords=translated_by_seed, sourceManifestFilesPerSnapshot=108, visualViews=3, browserJPEGs=6, decision=decision['decision']), indent=2))
