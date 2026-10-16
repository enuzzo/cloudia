#!/usr/bin/env python3
"""Verify saved evidence only: no JS, geometry generator, field sampling or bake."""
import gzip
import hashlib
import json
import math
import struct
import tarfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
SHA = lambda data: hashlib.sha256(data).hexdigest()


def close(a, b, tolerance=2e-12):
    assert math.isclose(a, b, rel_tol=tolerance, abs_tol=tolerance), (a, b)


def vector_close(a, b):
    assert len(a) == len(b)
    for x, y in zip(a, b):
        close(x, y)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    n = math.hypot(*a)
    assert n > 0
    return [x / n for x in a]


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def raw_array(raw, marker):
    """Read exact original JSON numeric spelling, without JS serialization."""
    start = raw.index(marker) + len(marker)
    value, length = json.JSONDecoder().raw_decode(raw[start:])
    assert isinstance(value, list)
    return value, raw[start:start+length].encode()


outer = json.loads((ROOT / 'manifest.json').read_text())
for row in outer['files']:
    name = PurePosixPath(row['path'])
    assert not name.is_absolute() and '..' not in name.parts
    data = (ROOT / row['path']).read_bytes()
    assert len(data) == row['bytes'] and SHA(data) == row['sha256'], row['path']
doc = outer['relatedDocument']
related_path = ROOT.parents[1] / doc['name']
related_checked = related_path.is_file()
if related_checked:
    data = related_path.read_bytes()
    assert len(data) == doc['bytes'] and SHA(data) == doc['sha256']
# The four-payload measurement folder is self-contained. The sibling prose
# document is checked when present, so copying this folder alone stays portable.
provenance = json.loads((ROOT / 'provenance.json').read_text())
archive = ROOT / 'original-preflight.tar.gz'
assert SHA(archive.read_bytes()) == provenance['archiveSHA256']
assert archive.stat().st_size == provenance['archiveBytes']
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    names = [m.name for m in members]
    assert len(names) == len(set(names)) == provenance['archiveMembers'] == 31
    for member in members:
        name = PurePosixPath(member.name)
        assert member.isfile() and not name.is_absolute() and '..' not in name.parts
    files = {m.name: tar.extractfile(m).read() for m in members}

original_raw = files['evidence-manifest.json']
assert SHA(original_raw) == provenance['sourceManifestSHA256']
original = json.loads(original_raw)
assert len(original['files']) == provenance['sourcePayloadFiles'] == 30
assert sum(r['bytes'] for r in original['files']) == original['totalPayloadBytes'] == 3374859
assert set(files) == {r['path'] for r in original['files']} | {'evidence-manifest.json'}
for row in original['files']:
    data = files[row['path']]
    assert len(data) == row['bytes'] and SHA(data) == row['sha256'], row['path']
inputs = json.loads(files['inputs-manifest.json'])
for row in inputs['sources']:
    data = files[row['path']]
    assert len(data) == row['bytes'] and SHA(data) == row['sha256']
freeze = json.loads(files['freeze-manifest.json'])
assert SHA(files['frozen-model.json']) == freeze['modelSHA256'] == provenance['frozenModelSHA256']
assert SHA(files['preflight.mjs']) == freeze['scriptSHA256']
assert SHA(files['inputs-manifest.json']) == freeze['inputsManifestSHA256']
assert SHA(files['input/frozen-source/volume.ts']) == 'a53410c45b04143710cffd098b6a33deade3242c66ecf7eecc6405a214a93b00'
model = json.loads(files['frozen-model.json'])
report = json.loads(gzip.decompress(files['probe-results.json.gz']))
summary = json.loads(files['result-summary.json'])
reproduction = json.loads(files['baseline-reproduction.json'])
old_raw = gzip.decompress(files['input/layout-and-stencils.json.gz']).decode()
old = json.loads(old_raw)
previous = json.loads(files['input/pixel-attribution.json'])
traces_raw = gzip.decompress(files['input/geometry-traces.json.gz']).decode()
traces = json.loads(traces_raw)
semantics = json.loads(files['input/semantic-portability.json'])
assert report['modelSHA256'] == freeze['modelSHA256'] == original['modelSHA256']
assert report['sourceSHA256'] == model['inputSourceSHA256']
assert report['reproduction'] == reproduction
assert report['gate'] == summary['gate']

# Verify exact stored original stencil JSON digest and its 48 macro R8 bytes.
stencils, raw_stencils = raw_array(old_raw, ',"attributions":')
assert stencils == old['attributions']
assert SHA(raw_stencils) == reproduction['fullStencilJSONSHA256'] == reproduction['originalStencilJSONSHA256']
r8 = []
for item in stencils:
    stencil = item['stencil']
    assert len(stencil['neighbors']) == 8
    raw = 0
    for cell in stencil['neighbors']:
        byte = int(math.floor(cell['value']*255 + .5))
        assert cell['value'] == byte / 255
        assert struct.unpack('<f', struct.pack('<f', cell['field']))[0] == cell['field']
        r8.append(byte)
        raw += cell['value'] * cell['trilinearWeight']
    close(raw, stencil['raw'])
assert len(r8) == reproduction['macroR8Bytes'] == 48
assert SHA(bytes(r8)) == reproduction['macroR8SHA256']
assert reproduction['exactAllThreeRays'] and reproduction['exactAllSixStencils']

# The complete-window baselines retain each original ray's exact numeric prefix.
# No second reconstructed baseline full-stencil object was saved: its full
# equality is the frozen execution assertion/digest above, not a field rerun here.
comparisons = report['comparisons']
assert len(comparisons) == 4
old_prefix_samples = 0
for ray in previous['rays']:
    saved = next(c for c in comparisons if c['ray']['name'] == ray['name'])
    for key in ['pixel', 'uv', 'screen', 'origin', 'ray', 'near', 'far', 'jitter', 'step']:
        assert saved['ray'][key] == ray[key]
    for current, prior in zip(saved['baseline']['samples'], ray['samples']):
        for key in ['t', 'density', 'sigma', 'tau']:
            assert current[key] == prior[key], (ray['name'], key)
        assert prior['world'] == [o+d*prior['t'] for o, d in zip(ray['origin'], ray['ray'])]
        old_prefix_samples += 1
assert old_prefix_samples == sum(len(r['samples']) for r in previous['rays']) == 465
saddle = next(c for c in comparisons if c['ray']['name'] == 'sella')
assert saddle['ray']['pixel'] == [1408, 490]
assert saddle['ray']['uv'] == model['saddle']['uv'] == [1408.5/2560, 490.5/1440]
assert model['camera']['origin'] == [0, 2.7, 16]
assert report['runtimeState']['box'] == previous['supportBounds']

# Gate arithmetic from saved samples, never re-evaluate a cloud density.
for comparison in comparisons:
    ray = comparison['ray']
    assert len(comparison['baseline']['samples']) == len(comparison['candidate']['samples'])
    assert [s['t'] for s in comparison['baseline']['samples']] == [s['t'] for s in comparison['candidate']['samples']]
    for side in ['baseline', 'candidate']:
        saved = comparison[side]
        tau = fine = support = 0.0
        for sample in saved['samples']:
            ds = min(ray['step'], ray['far'] - sample['t'])
            assert ds > 0 and 0 <= sample['density'] <= 1
            close(sample['sigma'], (18+(6.5-18)*sample['ice'])*sample['density'])
            fine += sample['density'] * ds
            tau += sample['sigma'] * ds
            if sample['density'] >= .002:
                support += ds
            assert tau == sample['tau']
        assert tau == saved['tau'] and fine == saved['densityIntegral'] and support == saved['positiveSupportLength']
    for key in ['tau', 'densityIntegral', 'positiveSupportLength']:
        assert comparison['delta'][key] == comparison['candidate'][key]-comparison['baseline'][key]

for item in report['stencils']:
    prior = next(s for s in stencils if s['name'] == item['name'] and s['targetTau'] == item['targetTau'])
    assert item['baselineDensity'] == prior['stencil']['density']
    assert item['baselineRaw'] == prior['stencil']['raw']
    assert item['world'] == prior['stencil']['world']
    now = item['candidateStencil']
    assert item['candidateDensity'] == now['density'] and item['candidateRaw'] == now['raw']
    assert item['deltaDensity'] == item['candidateDensity']-item['baselineDensity']
    close(sum(n['value']*n['trilinearWeight'] for n in now['neighbors']), now['raw'])
beak = [s for s in report['stencils'] if s['name'] == 'becco']
gate = dict(bothBeakStencilDensitiesDecrease=all(s['deltaDensity'] < 0 for s in beak),
            saddleFineDensityIntegralIncreases=saddle['delta']['densityIntegral'] > 0,
            saddleTauIncreases=saddle['delta']['tau'] > 0,
            saddlePositiveSupportLengthDelta=saddle['delta']['positiveSupportLength'])
gate['pass'] = all(gate[k] for k in ['bothBeakStencilDensitiesDecrease', 'saddleFineDensityIntegralIncreases', 'saddleTauIncreases'])
assert gate == report['gate'] and not gate['pass']
assert gate['bothBeakStencilDensitiesDecrease']
assert not gate['saddleTauIncreases'] and not gate['saddleFineDensityIntegralIncreases']

# Semantic selection and analytic transformed bounds, from original saved arrays.
BMIN, EXTENT, SIZE = [-5, -.5, -3.5], [10, 8.5, 7], 256

def bounds(lo, hi):
    return dict(start=[max(1, math.floor((v-BMIN[a])/EXTENT[a]*SIZE-.5)) for a,v in enumerate(lo)],
                end=[min(SIZE-2, math.ceil((v-BMIN[a])/EXTENT[a]*SIZE-.5)) for a,v in enumerate(hi)])


def count(box):
    return math.prod(max(0, b-a+1) for a,b in zip(box['start'], box['end']))


def old_bounds(lobe):
    return bounds([lobe[a]-lobe[a+3]-.35 for a in range(3)], [lobe[a]+lobe[a+3]+.35 for a in range(3)])


def margins(lo, hi):
    return [lo[0]+5, 5-hi[0], lo[1]+.5, 8-hi[1], lo[2]+3.5, 3.5-hi[2]]


checked_seeds = []
for entry in model['models']:
    seed = entry['seed']
    geo = next(t['geometry'] for t in traces['traces'] if t['label'] == 'baseline' and t['seed'] == seed)
    lobes = geo['post']
    trace_start = traces_raw.index('"label":"baseline","seed":'+str(seed)+',')
    exact_lobes, exact_array = raw_array(traces_raw[trace_start:], ',"post":')
    assert exact_lobes == lobes and SHA(exact_array) == entry['baselineLayoutSHA256']
    assert entry['rngCalls'] == 0 and entry['lobeCount'] == len(lobes)
    meta = next(s for s in semantics['results'] if s['seed'] == seed)
    if not entry['applies']:
        assert not meta['mainShoulders'] and entry['selectedCount'] == 0
        assert entry['candidateLayoutSHA256'] == entry['baselineLayoutSHA256']
        checked_seeds.append(dict(seed=seed, identity=True))
        continue
    parents, pos = [], geo['liquidCount']+len(geo['iceCores'])
    for core in range(pos):
        liquid = core < geo['liquidCount']
        for unused in range(18 if liquid else 10):
            billow = pos
            pos += 1
            parents.append([billow, core])
            if liquid:
                for unused_child in range(4):
                    parents.append([pos, billow])
                    pos += 1
    for core in geo['iceCores']:
        for unused in range(14):
            parents.append([pos, core])
            pos += 1
    assert pos+48 == len(lobes)  # Three sheared seeds; unparented ice streaks.
    if seed == 74:
        assert parents == old['layout']['parents'] and lobes == old['layout']['lobes']
    parent = dict(parents)
    def root(index):
        seen = set()
        while index in parent:
            assert index not in seen
            seen.add(index)
            index = parent[index]
        return index
    mature = max(geo['summits'], key=lambda i: lobes[i][1])
    foot = geo['foundations'][geo['summits'].index(mature)]
    young = next(i for i in geo['foundations'] if i != foot)
    assert (mature,foot,young) == (entry['matureSummitIndex'],entry['matureFoundationIndex'],entry['youngFoundationIndex'])
    m, f, y = lobes[mature], lobes[foot], lobes[young]
    inner = norm([y[0]-f[0],0,y[2]-f[2]])
    scores = []
    for info in meta['mainShoulders']:
        core = lobes[info['index']]
        t = (core[1]-f[1])/(m[1]-f[1])
        pivot = [f[a]+(m[a]-f[a])*t for a in range(3)]
        offset = [core[a]-pivot[a] for a in range(3)]
        scores.append((dot(offset,inner),info,pivot,offset))
    projection, info, pivot, offset = max(scores, key=lambda s: s[0])
    assert projection > 0 and info['index'] == entry['selection']['index']
    assert info['j'] == entry['selection']['authoredOrdinal']
    vector_close(pivot, entry['pivot'])
    ids = [i for i in range(len(lobes)) if root(i) == info['index']]
    assert ids == entry['selectedIds'] and len(ids) == len(set(ids)) == entry['selectedCount'] == 91
    prepared = {p['index']:p for p in entry['prepared']}
    assert set(prepared) == set(ids)
    R = entry['rotation']['matrix']
    for a in range(3):
        for b in range(3):
            close(dot(R[a],R[b]), int(a == b))
    close(dot(R[0],cross(R[1],R[2])),1)
    cap = lobes[min(geo['iceCores'],key=lambda i: math.hypot(lobes[i][0]-m[0],lobes[i][2]-m[2]))]
    start = [f[a]+(m[a]-f[a])*.68 for a in range(3)]
    end = [cap[0]+cap[3]*.28,cap[1]-cap[4]*.1,cap[2]]
    vector_close(start,entry['shoulderAnchors']['start'])
    vector_close(end,entry['shoulderAnchors']['end'])
    initial, tangent = norm(offset), norm([end[a]-start[a] for a in range(3)])
    vector_close([dot(row,initial) for row in R],tangent)
    v, cosine = cross(initial,tangent), dot(initial,tangent)
    K = [[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]
    for a in range(3):
        vector_close(R[a], [int(a == b)+K[a][b]+sum(K[a][k]*K[k][b] for k in range(3))/(1+cosine) for b in range(3)])
    close(math.acos(max(-1,min(1,cosine))),entry['rotation']['angleRadians'])
    for index in ids:
        p, l = prepared[index], lobes[index]
        center = [pivot[a]+dot(R[a],[l[b]-pivot[b] for b in range(3)]) for a in range(3)]
        radius = [math.hypot(*(R[a][b]*l[b+3] for b in range(3))) for a in range(3)]
        halo = [v*(1+.35/min(l[3:6])) for v in radius]
        vector_close(center,p['center'])
        assert p['localRadii'] == l[3:6] and p['blend'] == (l[6] if len(l)>6 else .2)
        for label, reach in [('positiveBounds',radius),('fieldMinus035Bounds',halo)]:
            vector_close([center[a]-reach[a] for a in range(3)],p[label]['min'])
            vector_close([center[a]+reach[a] for a in range(3)],p[label]['max'])
        assert p['raster'] == bounds(p['fieldMinus035Bounds']['min'],p['fieldMinus035Bounds']['max'])
    for label, saved in [('positiveBounds','selectedPositiveMargins'),('fieldMinus035Bounds','selectedFieldMinus035Margins')]:
        lo = [min(p[label]['min'][a] for p in prepared.values()) for a in range(3)]
        hi = [max(p[label]['max'][a] for p in prepared.values()) for a in range(3)]
        vector_close(margins(lo,hi),entry['bounds'][saved])
        assert min(margins(lo,hi)) > 0
    remaining = [l for i,l in enumerate(lobes) if i not in prepared]
    lo = [min([p['positiveBounds']['min'][a] for p in prepared.values()]+[l[a]-l[a+3] for l in remaining]) for a in range(3)]
    hi = [max([p['positiveBounds']['max'][a] for p in prepared.values()]+[l[a]+l[a+3] for l in remaining]) for a in range(3)]
    vector_close(margins(lo,hi),entry['bounds']['allPrimitivePositiveMargins'])
    # Rebuild the untouched-metadata digest with the original numeric spelling.
    array_text = exact_array.decode()
    cursor, chunks = 1, []
    decoder = json.JSONDecoder()
    for i in range(len(lobes)):
        value, length = decoder.raw_decode(array_text[cursor:])
        chunks.append('null' if i in prepared else array_text[cursor:cursor+length])
        cursor += length
        if i+1 < len(lobes):
            assert array_text[cursor] == ','
            cursor += 1
    assert SHA(('['+','.join(chunks)+']').encode()) == entry['preservation']['otherMetadataSHA256']
    costs = entry['theoreticalRaster']
    before = sum(count(old_bounds(l)) for l in lobes)
    after = sum(count(prepared[i]['raster'] if i in prepared else old_bounds(l)) for i,l in enumerate(lobes))
    group_before = sum(count(old_bounds(lobes[i])) for i in ids)
    group_after = sum(count(p['raster']) for p in prepared.values())
    assert (before,after,group_before,group_after) == (costs['baselineAllLobes'],costs['candidateAllLobes'],costs['baselineGroup'],costs['candidateGroup'])
    assert after-before == costs['delta']
    close(after/before,costs['ratio'])
    close(group_after/group_before,costs['ratioGroup'])
    assert not entry['preservation']['globalRecontraction'] and not entry['preservation']['shoulderMutated']
    checked_seeds.append(dict(seed=seed, selectedOrdinal=info['j'], uniqueParentClosure=len(ids), boundsAndBoxArithmetic=True))

print(json.dumps(dict(status='PASS', experimentDecision='FAIL; retired',
                     originalPayloads=30, originalBytes=3374859, archiveBytes=archive.stat().st_size,
                     relatedDocumentChecked=related_checked,
                     exactBaselineRayPrefixSamples=old_prefix_samples, originalR8Bytes=len(r8),
                     gate=gate, savedLayoutChecks=checked_seeds,
                     scope='Saved-data integrity/consistency and analytic layout algebra only; no field, volume, bake, JS, GPU, RGB or artistic proof'),indent=2))
