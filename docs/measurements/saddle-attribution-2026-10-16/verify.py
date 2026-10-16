#!/usr/bin/env python3
"""Verify archived saved data/algebra only; never import JS or sample a field."""
import gzip
import hashlib
import json
import math
import struct
import tarfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
f32 = lambda value: struct.unpack('<f', struct.pack('<f', value))[0]
clamp = lambda value: max(0, min(1, value))


def close(a, b):
    assert math.isclose(a, b, rel_tol=2e-13, abs_tol=2e-14), (a, b)


def load_tar(path):
    with tarfile.open(path, 'r:gz') as tar:
        members = tar.getmembers()
        names = [m.name for m in members]
        assert len(names) == len(set(names))
        for member in members:
            name = PurePosixPath(member.name)
            assert member.isfile() and not name.is_absolute() and '..' not in name.parts
        return {m.name:tar.extractfile(m).read() for m in members}


outer = json.loads((ROOT / 'manifest.json').read_text())
for row in outer['files']:
    name = PurePosixPath(row['path'])
    assert not name.is_absolute() and '..' not in name.parts
    data = (ROOT / row['path']).read_bytes()
    assert len(data) == row['bytes'] and sha(data) == row['sha256'], row['path']
doc = outer['relatedDocument']
doc_path = ROOT.parents[1] / doc['name']
if doc_path.exists():
    data = doc_path.read_bytes()
    assert len(data) == doc['bytes'] and sha(data) == doc['sha256']
prov = json.loads((ROOT / 'provenance.json').read_text())
archive = ROOT / 'original-minimal.tar.gz'
assert archive.stat().st_size == prov['minimalArchiveBytes']
assert sha(archive.read_bytes()) == prov['minimalArchiveSHA256']
files = load_tar(archive)
assert len(files) == prov['minimalArchiveMembers'] == 15
required = prov['dependency']
dep_path = ROOT / required['relativePath']
assert dep_path.is_file(), 'Required portable repository dependency is missing: '+str(dep_path)
assert dep_path.stat().st_size == required['bytes']
assert sha(dep_path.read_bytes()) == required['sha256'] == 'f4c39be94a349fdbf976a255242f2e5913b2dd9ea822f994e9dccb12eeb6d791'
dep = load_tar(dep_path)
assert len(required['members']) == 16
for row in required['members']:
    assert row['originalPath'] not in files
    data = dep[row['dependencyMember']]
    assert len(data) == row['bytes'] and sha(data) == row['sha256']
    files[row['originalPath']] = data
assert sha(files['evidence-manifest.json']) == prov['sourceManifestSHA256']
original = json.loads(files['evidence-manifest.json'])
assert set(files) == {r['path'] for r in original['files']} | {'evidence-manifest.json'}
assert len(original['files']) == original['fileCount'] == prov['sourceFileCount'] == 30
assert sum(r['bytes'] for r in original['files']) == original['payloadBytes'] == prov['sourcePayloadBytes'] == 660571
for row in original['files']:
    data = files[row['path']]
    assert len(data) == row['bytes'] and sha(data) == row['sha256'], row['path']
freeze = json.loads(files['freeze-manifest.json'])
assert sha(files['frozen-protocol.json']) == freeze['protocolSHA256']
assert sha(files['audit.mjs']) == freeze['scriptSHA256']
assert sha(files['inputs-manifest.json']) == freeze['inputsManifestSHA256']
for row in json.loads(files['inputs-manifest.json'])['inputs']:
    assert len(files[row['path']]) == row['bytes'] and sha(files[row['path']]) == row['sha256']
read = lambda name: json.loads(gzip.decompress(files[name])) if name.endswith('.gz') else json.loads(files[name])
protocol = read('frozen-protocol.json')
actual = read('attribution.json.gz')
first = read('baseline-reproduction.json.gz')
previous = read('input/previous-r1-results.json.gz')
layout = read('input/actual74-layout-and-old-stencils.json.gz')['layout']
ray = next(c for c in previous['comparisons'] if c['ray']['name'] == 'sella')
assert protocol['ray'] == actual['ray'] == ray['ray']
assert [p['savedSampleIndex'] for p in protocol['points']] == [144,145,148,151,152]
assert len(protocol['points']) == len(actual['points']) == len(first['points']) == 5
assert first['allFiveOriginalFineRawSigmaIceExact']
roles = dict(layout['roles'])
parents = dict(layout['parents'])


def group(index):
    if index == 'shoulder':
        return index
    while index in parents:
        index = parents[index]
    return index


r8 = []
body_weights = []
positive_fields = 0
zero_macro_slots = 0
for point, result, gate in zip(protocol['points'], actual['points'], first['points']):
    assert result['point'] == gate['point'] == point
    saved = ray['baseline']['samples'][point['savedSampleIndex']]
    assert saved == point['expectedSavedScalars']
    assert point['world'] == [o+d*point['t'] for o,d in zip(protocol['ray']['origin'],protocol['ray']['ray'])]
    value = result['actual']
    for key in ['density','sigma','raw','ice']:
        assert value[key] == gate['actual'][key] == saved[key]
    assert value['world'] == point['world']
    assert len(value['neighbors']) == len(gate['corners']) == 8
    filtered = 0
    weighted_groups = {}
    for cell, cached in zip(value['neighbors'], gate['corners']):
        assert cell['index'] == cached['index']
        assert cell['field'] == cached['field']
        assert cell['value'] == cached['value']
        assert cell['byte'] == cached['byte']
        assert cell['trilinearWeight'] == cached['trilinearWeight']
        assert cell['value'] == cell['byte']/255
        assert cell['point'] == [b+(i+.5)/256*e for b,e,i in zip([-5,-.5,-3.5],[10,8.5,7],cell['index'])]
        r8.append(cell['byte'])
        field, weights = -10, {}
        for step in cell['fullPrefix']:
            assert step['before'] == field
            sd, blend = step['sd'], step['blend']
            h = clamp(.5+.5*(field-sd)/blend)
            assert h == step['h']
            continuous = sd+(field-sd)*h+blend*h*(1-h)
            assert continuous == step['continuousAfter']
            field = f32(continuous)
            assert field == step['after']
            assert step['float32RoundingDelta'] == field-continuous
            assert step['group'] == group(step['id'])
            if step['group'] != 'shoulder':
                assert step['role'] == roles.get(step['group'], 'streak-or-other-'+str(step['group']))
            if h < 1:
                weights = {k:v*h for k,v in weights.items() if v*h >= 1e-12}
                weights[step['id']] = weights.get(step['id'],0)+1-h
        assert field == cell['field'] and field > 0
        positive_fields += 1
        assert weights == {w['id']:w['weight'] for w in cell['weights']}
        ct = cell['carvingTrace']
        assert not ct['fieldSkipped'] and ct['ice'] == 0
        close(ct['erosion'], min(0,(ct['n1']-.5)*.2-(1-ct['c1'])*.52-(1-ct['c2'])*.2+(ct['n3']-.5)*.1))
        carve = ct['erosion']*ct['heightScale']*ct['interior']*(1-ct['ice'])-(.012+(1-ct['fibers'])*.045+(1-ct['n1'])*.07+(1-ct['n2'])*.025)*ct['ice']
        assert carve == cell['carving'] == ct['carving']
        decoded = clamp((field+carve-ct['threshold'])*ct['densityScale'])*ct['noiseGain']*ct['iceGain']*ct['baseFade']
        assert decoded == ct['beforeFloat32']
        assert f32(decoded) == ct['float32Density']
        byte = math.floor(f32(decoded)*255+.5)
        assert byte == ct['byte'] == cell['byte']
        zero_macro_slots += byte == 0
        filtered += cell['value']*cell['trilinearWeight']
        for identity,weight in weights.items():
            g = group(identity)
            weighted_groups[g] = weighted_groups.get(g,0)+weight*cell['value']*cell['trilinearWeight']
    assert filtered == value['raw']
    fine = value['fineTrace']['fineDetail']
    erosion = min(.92,(1-fine[0])*.38+(1-fine[2])*.08+value['flow'][3])
    assert value['ice'] == 0 and value['material'] == 1
    assert erosion == value['erosion']
    density = clamp((filtered-erosion)/(1-erosion)) if filtered >= .002 else 0
    if density < .002:
        density = 0
    assert density == value['density']
    assert value['local'] == [v-flow for v,flow in zip(value['reference'],value['flow'][:3])]
    assert value['warpedPoint'] == [v+(n-.5)*c for v,n,c in zip(value['local'],[fine[1],fine[2],fine[0]],[.16,.12,.16])]
    total = sum(weighted_groups.values())
    ranking = result['rawSignalPrefixRanking']
    for row in ranking:
        close(row['weight'],weighted_groups[row['group']])
        close(row['normalized'],row['weight']/total)
    winner = max(ranking,key=lambda row:row['weight'])
    assert winner['role'] == 'shared.body' and roles[winner['group']] == 'shared.body'
    body_weights.append(winner['normalized'])
assert len(r8) == positive_fields == 40
assert sha(bytes(r8)) == first['firstRecordedDiscreteR8SHA256'] == actual['reproduction']['firstRecordedDiscreteR8SHA256'] == '16966c949c1f052fac4e00cc966bb0327203c86191aa498ec5c557e495225abc'
close(min(body_weights),.9470233505230377)
close(max(body_weights),.9920690184442051)
assert zero_macro_slots == 12
assert actual['work']['worldPositions'] == 5 and actual['work']['distinctMacroTexels'] == 30
print(json.dumps(dict(status='PASS', originalPayloads=30, identicalOriginalScalarsAtPositions=5,
                     discreteR8CornerSlots=40, discreteR8PreviouslyArchived=False,
                     discreteR8Identity='First phase versus trace at same40 slots',
                     positiveFieldCornerSlots=positive_fields, macroZeroCornerSlots=zero_macro_slots,
                     sharedBodyPrefixPercent=[100*min(body_weights),100*max(body_weights)],
                     dependencyArchiveSHA256=required['sha256'],
                     scope='Saved-data integrity and arithmetic only; no field/JS/generator/volume/bake/GPU or global U/artistic proof'),indent=2))
