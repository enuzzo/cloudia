#!/usr/bin/env python3
"""Verify only retained evidence, with Python's standard library.

No archived Python/TypeScript is imported or executed; no mesh, DEM height
sampling, ray, model, shader, test, build, browser or GPU is replayed.

Usage: python3 verify_saved.py [ARCHIVE] [--base-source BASE124]
                             [--runtime-source REPOSITORY]
The optional BASE124 is read only for exact in-memory patch reconstruction.
REPOSITORY supplies pinned references and integer DEM coast labels; without it,
land/sea partitions are checked for saved arithmetic consistency, not reclassified.
All output is stdout/stderr. The archive and optional inputs are never written.
"""
from array import array
from pathlib import Path, PurePosixPath
import argparse
import gzip
import hashlib
import heapq
import io
import json
import math
import os
import re
import struct
import sys
import time

BASE_SHA = '21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2'
CANDIDATE_SHA = '83469d62c552db7bad9cbc175bf549f7b7c0bd8c0b113c137e484e1b4f315e00'
OLD_RESULT_SHA = '5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27'
DEM_PATH = 'src/cumulonimbus/assets/liguria-apuane-dem.bin'
DEM_SHA = '92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d'
STREAM_SHA = {'off': '6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a',
              'on': '58ca7139fc88f4f087854cb80a4901a8645536b23c7d504dc1c7bfecb7186093'}
RESULT_SHA = {'off': 'fada06fe4d91b632da9488edb43c227dbd9475f9e1668c19f95a758f1f2873fb',
              'on': 'dcea70f1bdfd076c0b482fec87f31659e49a473d25f6f9458915c3bf5b4a2835'}
CHANGED = {'src/cumulonimbus/' + n for n in (
    'GPUSceneEngine.ts', 'lifecycle.test.ts', 'terrainMesh.ts',
    'terrainMesh.test.ts', 'terrainSplitTriangle.ts', 'terrainSplitTriangle.test.ts')}
NEW = {'src/cumulonimbus/terrainSplitTriangle.ts', 'src/cumulonimbus/terrainSplitTriangle.test.ts'}
NODES = 591361
STREAM_BYTES = NODES * 8
JSON_CAP = 4 * 1024**2
RAW_CAP = 16 * 1024**2
CHECKS = 0


def need(value, message):
    global CHECKS
    CHECKS += 1
    if not value:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def finite_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def close(a, b, label, rel=2e-12, absolute=1e-8):
    need(finite_number(a) and finite_number(b) and
         math.isclose(a, b, rel_tol=rel, abs_tol=absolute), label)


def same_numbers(a, b, label, tolerance=1e-12):
    if isinstance(a, list) and isinstance(b, list):
        need(len(a) == len(b), label + ' length')
        for x, y in zip(a, b):
            same_numbers(x, y, label, tolerance)
    else:
        close(a, b, label, rel=0, absolute=tolerance)


def safe_relative(value):
    need(isinstance(value, str) and value and '\\' not in value, 'Invalid relative path')
    p = PurePosixPath(value)
    need(not p.is_absolute() and all(x not in ('', '.', '..') for x in p.parts)
         and str(p) == value, 'Unsafe/noncanonical relative path: ' + value)
    return value


def read_local(root, relative, maximum=RAW_CAP):
    relative = safe_relative(relative)
    current = root
    for part in PurePosixPath(relative).parts:
        current = current / part
        need(not current.is_symlink(), 'Symlink input refused: ' + relative)
    need(current.is_file() and current.stat().st_size <= maximum, 'Missing/oversize file: ' + relative)
    return current.read_bytes()


def parse_json(raw, label):
    need(len(raw) <= JSON_CAP, 'JSON cap exceeded: ' + label)
    def reject(value):
        raise ValueError('Nonfinite JSON literal: ' + value)
    return json.loads(raw.decode('utf-8'), parse_constant=reject)


class Archive:
    def __init__(self, root):
        self.root = root.resolve()
        self.manifest_raw = read_local(self.root, 'MANIFEST.json', JSON_CAP)
        self.manifest = parse_json(self.manifest_raw, 'MANIFEST.json')
        need(self.manifest['schema'] == 'cloudia-curated-evidence-v1', 'Manifest schema')
        self.records = {}
        self.raw_cache = {}
        for rec in self.manifest['files']:
            name = safe_relative(rec['path'])
            need(name != 'MANIFEST.json' and name not in self.records, 'Duplicate/self manifest entry')
            need(rec['encoding'] in ('identity', 'gzip'), 'Unknown payload encoding')
            need(isinstance(rec['bytes'], int) and 0 <= rec['bytes'] <= RAW_CAP,
                 'Stored file size outside bounded verifier contract')
            origin = rec['origin']
            need(isinstance(origin['path'], str) and isinstance(origin['bytes'], int)
                 and 0 <= origin['bytes'] <= RAW_CAP, 'Origin size/path')
            need(re.fullmatch('[0-9a-f]{64}', rec['sha256']) is not None and
                 re.fullmatch('[0-9a-f]{64}', origin['sha256']) is not None, 'SHA syntax')
            self.records[name] = rec
        inventory = set()
        for directory, dirs, files in os.walk(self.root, followlinks=False):
            for name in dirs:
                need(not (Path(directory) / name).is_symlink(), 'Symlink directory in archive')
            for name in files:
                path = Path(directory) / name
                need(not path.is_symlink(), 'Symlink payload in archive')
                relative = path.relative_to(self.root).as_posix()
                if relative != 'MANIFEST.json':
                    inventory.add(relative)
        need(inventory == set(self.records), 'Exact payload inventory mismatch: ' +
             repr({'extra': sorted(inventory-set(self.records)), 'missing': sorted(set(self.records)-inventory)}))
        for name in self.records:
            self.raw(name)
        for rec in self.manifest.get('deduplicated', []):
            raw = self.raw(rec['storedPath'])
            need(len(raw) == rec['origin']['bytes'] and sha(raw) == rec['origin']['sha256'],
                 'Deduplicated origin not identical to stored raw payload')
            if 'logicalAlias' in rec:
                safe_relative(rec['logicalAlias'])

    def name(self, logical):
        logical = safe_relative(logical)
        if logical in self.records:
            return logical
        if logical + '.gz' in self.records:
            return logical + '.gz'
        raise ValueError('Missing archived logical payload: ' + logical)

    def raw(self, logical):
        name = self.name(logical)
        if name in self.raw_cache:
            return self.raw_cache[name]
        rec = self.records[name]
        stored = read_local(self.root, name)
        need(len(stored) == rec['bytes'] and sha(stored) == rec['sha256'], 'Stored bytes/SHA: ' + name)
        expected = rec['origin']['bytes']
        if rec['encoding'] == 'gzip':
            need(stored[:3] == b'\x1f\x8b\x08' and len(stored) >= 18 and
                 struct.unpack_from('<I', stored, 4)[0] == 0, 'gzip mtime0/header: ' + name)
            with gzip.GzipFile(fileobj=io.BytesIO(stored), mode='rb') as stream:
                raw = stream.read(expected + 1)
                need(len(raw) <= expected and stream.read(1) == b'', 'gzip decoded-size cap: ' + name)
        else:
            raw = stored
        need(len(raw) == expected and sha(raw) == rec['origin']['sha256'], 'Original raw bytes/SHA: ' + name)
        self.raw_cache[name] = raw
        return raw

    def json(self, logical):
        return parse_json(self.raw(logical), logical)


def read_references(a, runtime):
    refs = a.json('REFERENCES.json')['references']
    mapping, resolved = {}, {}
    for rec in refs:
        name = safe_relative(rec['path'])
        need(name not in mapping and rec['copied'] is False, 'Pinned reference inventory')
        mapping[name] = rec
        if runtime is not None:
            raw = read_local(runtime, name)
            need(len(raw) == rec['bytes'] and sha(raw) == rec['sha256'], 'Pinned repository reference: ' + name)
            resolved[name] = raw
    need(DEM_PATH in mapping and mapping[DEM_PATH]['sha256'] == DEM_SHA, 'DEM reference identity')
    old = 'docs/measurements/terrain-geometry-error-2026-10-16/preflight/run/result.json'
    need(old in mapping and mapping[old]['sha256'] == OLD_RESULT_SHA, 'Historical result reference identity')
    return mapping, resolved, (parse_json(resolved[old], old) if old in resolved else None)


def apply_patch_in_memory(base, patch):
    """Strict standard unified patch: exact bytes/context, no fuzzy offsets."""
    lines = patch.splitlines(keepends=True)
    i, touched, output = 0, set(), dict(base)
    hunk_re = re.compile(rb'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:[^\r\n]*)\r?\n$')
    while i < len(lines):
        need(lines[i].startswith(b'--- ') and i+1 < len(lines) and lines[i+1].startswith(b'+++ '), 'Unified file header')
        old_name = lines[i][4:].rstrip(b'\r\n').decode('utf-8')
        new_name = lines[i+1][4:].rstrip(b'\r\n').decode('utf-8')
        need(new_name.startswith('b/'), 'Candidate patch prefix')
        path = safe_relative(new_name[2:])
        need(path in CHANGED and path not in touched, 'Unexpected/duplicate patched source')
        if old_name == '/dev/null':
            need(path in NEW and path not in base, 'New-file precondition')
            before = []
        else:
            need(old_name == 'a/'+path and path in base and path not in NEW, 'Existing-file precondition')
            before = base[path].splitlines(keepends=True)
        i += 2
        cursor, built, hunks = 0, [], 0
        while i < len(lines) and not lines[i].startswith(b'--- '):
            match = hunk_re.fullmatch(lines[i])
            need(match is not None, 'Unified hunk header')
            old_start, old_count, new_start, new_count = [int(x) if x is not None else 1 for x in match.groups()]
            start = old_start-1 if old_count else old_start
            new_pos = new_start-1 if new_count else new_start
            need(cursor <= start <= len(before), 'Overlapping/out-of-range hunk')
            built.extend(before[cursor:start]); cursor = start
            need(len(built) == new_pos, 'New hunk line offset')
            used_old = used_new = 0
            i += 1; hunks += 1
            while used_old < old_count or used_new < new_count:
                need(i < len(lines) and lines[i][:1] in (b' ', b'-', b'+'), 'Hunk content/premature EOF')
                marker, value = lines[i][:1], lines[i][1:]
                if marker in (b' ', b'-'):
                    need(cursor < len(before) and before[cursor] == value, 'Exact patch context/removal')
                    cursor += 1; used_old += 1
                if marker in (b' ', b'+'):
                    built.append(value); used_new += 1
                need(used_old <= old_count and used_new <= new_count, 'Hunk count overflow')
                i += 1
            need(used_old == old_count and used_new == new_count, 'Hunk counts')
        need(hunks > 0, 'File with no hunks')
        built.extend(before[cursor:]); output[path] = b''.join(built); touched.add(path)
    need(touched == CHANGED, 'Patch changed-set completeness')
    return output


def verify_sources(a, base_root):
    base_raw, candidate_raw = a.raw('source/base-manifest.json'), a.raw('source/candidate-manifest.json')
    need(sha(base_raw) == BASE_SHA and sha(candidate_raw) == CANDIDATE_SHA, 'Pinned base/candidate manifests')
    base, candidate = parse_json(base_raw, 'base manifest'), parse_json(candidate_raw, 'candidate manifest')
    need(len(base) == 124 and len(candidate) == 126 and set(base) <= set(candidate), 'Source counts/no removals')
    for path, digest in list(base.items()) + list(candidate.items()):
        safe_relative(path); need(re.fullmatch('[0-9a-f]{64}', digest) is not None, 'Source SHA syntax')
    changed = {p for p in candidate if p not in base or candidate[p] != base[p]}
    need(changed == CHANGED and set(candidate)-set(base) == NEW, 'Exact six source differences')
    for path in changed:
        need(sha(a.raw('source/changed/'+path)) == candidate[path], 'Changed source payload')
    reconstruction = a.json('source/patch-reconstruction.json')
    patch = a.raw('source/candidate-vs-v58.patch')
    need(reconstruction['status'] == 'EXACT_IN_MEMORY_RECONSTRUCTION_PASS' and
         reconstruction['baseFiles'] == 124 and reconstruction['candidateFiles'] == 126 and
         reconstruction['changedFiles'] == 6 and reconstruction['unchangedCommonFiles'] == 120 and
         reconstruction['baseManifestSHA256'] == BASE_SHA and reconstruction['candidateManifestSHA256'] == CANDIDATE_SHA and
         reconstruction['patchRawBytes'] == len(patch) and reconstruction['patchRawSHA256'] == sha(patch), 'Saved patch reconstruction binding')
    for rec in reconstruction['files']:
        path = rec['path']
        need(path in changed and rec['beforeSHA256'] == base.get(path) and rec['afterSHA256'] == candidate[path] and
             rec['afterBytes'] == len(a.raw('source/changed/'+path)), 'Patch per-file before/after records')
    need({r['path'] for r in reconstruction['files']} == changed, 'Patch provenance completeness')
    if base_root is not None:
        contents = {p: read_local(base_root, p) for p in base}
        for path, raw in contents.items():
            need(sha(raw) == base[path], 'Optional base source hash: '+path)
        reconstructed = apply_patch_in_memory(contents, patch)
        need(set(reconstructed) == set(candidate), 'Reconstructed126 source inventory')
        for path, raw in reconstructed.items():
            need(sha(raw) == candidate[path], 'Reconstructed candidate hash: '+path)
    assembly = a.json('source/assembly/assembly-r1-error.json')
    need(assembly['phase'] == 'source-copy-only' and assembly['runtimeInvoked'] is False and
         assembly['engineIntegrationStarted'] is False, 'Preserved assembly failure scope')
    return {'baseFiles': 124, 'candidateFiles': 126, 'changedFiles': 6,
            'unchangedFiles': 120, 'patchReconstructedNow': base_root is not None,
            'candidateManifestSHA256': CANDIDATE_SHA}


def saved_group(j, group):
    keys = ['all', 'landMask', 'seaMask']
    return j['aggregate'][keys[group]] if group < 3 else j['rings'][(group-3)//3][keys[(group-3)%3]]


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def verify_streams(a, resolved, old):
    decision = a.json('protocols/refine-decision-protocol.json')
    need(decision['candidateSourceManifestSHA256'] == CANDIDATE_SHA, 'Decision-source binding')
    freeze_raw = a.raw('witness/PRE-RUN-FREEZE.json'); freeze = parse_json(freeze_raw, 'freeze')
    need(sha(freeze_raw) == 'b557333cf30cbce1887d4e11b4b47d423d18bb991c955ca3fd26f2c31509f387' and
         freeze['state'] == 'ROOT_APPROVED_UNEXECUTED' and freeze['sourceFiles'] == 126 and
         freeze['sourceManifestSHA256'] == CANDIDATE_SHA, 'Approved pre-run freeze')
    # Match retained inputs by their raw byte identity, not obsolete absolute paths.
    for rec in freeze['inputs']:
        matches = [r for r in a.records.values() if r['origin']['sha256'] == rec['sha256'] and r['origin']['bytes'] == rec['bytes']]
        external = [r for r in a.json('REFERENCES.json')['references'] if r['sha256'] == rec['sha256'] and r['bytes'] == rec['bytes']]
        dependency = rec['path'] in {
            '../refine-source/node_modules/three/package.json',
            '../refine-source/node_modules/three/build/three.webgpu.js',
            '../refine-source/node_modules/three/build/three.tsl.js',
            '../refine-source/node_modules/three/build/three.core.js',
            '/Users/enuzzo/.bun/bin/bun'}
        need(bool(matches or external or dependency), 'Frozen input not retained/pinned or declared dependency: '+rec['path'])
    results, runs, streams = {}, {}, {}
    for mode in ('off', 'on'):
        raw, run = a.raw('witness/'+mode+'/result.json'), a.json('witness/'+mode+'/run.json')
        result = parse_json(raw, mode+' result'); stream_raw = a.raw('witness/'+mode+'/errors.f64le')
        need(sha(raw) == RESULT_SHA[mode] == run['resultSHA256'] == run['validation']['resultSHA256'] and
             len(raw) == run['resultBytes'] == run['validation']['resultBytes'], 'Result identity '+mode)
        need(len(stream_raw) == STREAM_BYTES == result['errorStream']['bytes'] == run['validation']['retainedStreamBytes'] and
             sha(stream_raw) == STREAM_SHA[mode] == result['errorStream']['sha256'] == run['validation']['retainedStreamSHA256'], 'Retained stream identity '+mode)
        need(result['status'] == ('OFF_PARITY_PASS_NODES_ONLY' if mode == 'off' else 'ON_FIT_COMPLETE_NODES_ONLY') and result['mode'] == mode and run['status'] == 'PASS' and run['mode'] == mode and
             run['terminalObserved'] is True and run['launched'] is True and run['exitCode'] == 0 and
             run['budgetPASS'] is True and run['wallKilled'] is False and run['error'] is None, 'Terminal/budget status '+mode)
        b, pre = run['budget'], run['preflight']
        close(b['combinedCPUSeconds'], b['wrapperCPUSeconds']+b['childCPUSeconds'], 'Combined CPU accounting')
        need(b['combinedCPUSeconds'] <= 20 and b['wallSeconds'] <= 40 and
             b['conservativeSumOfPeakRSSBytes'] == b['wrapperPeakRSSBytes']+b['childPeakRSSBytes'] <= 2**31 and
             b['childCPUHardLimitSeconds'] == 20 and b['combinedCPUTerminalGateSeconds'] == 20 and
             b['totalWallLimitSeconds'] == 40 and b['sumOfPeakRSSGateBytes'] == 2**31, 'Declared run resource gates')
        need(pre['sourceFilesVerified'] == pre['sourceFilesReverifiedAfter'] == 126 and
             pre['dependencyIgnoreValue'] == pre['dependencyIgnoreValueAfter'] == '1' and
             pre['sourceManifestSHA256'] == result['sourceManifestSHA256'] == CANDIDATE_SHA and
             pre['freezeSHA256'] == sha(freeze_raw) and pre['decisionProtocolSHA256'] == sha(a.raw('protocols/refine-decision-protocol.json')) and
             pre['historicalResultSHA256'] == result['historicalResultSHA256'] == OLD_RESULT_SHA, 'Saved preflight/freeze binding')
        need(result['measurementQueries'] == result['plan']['nodes'] == NODES and result['plan']['side'] == 769 and
             result['plan']['firstSourceIndex'] == 128 and result['plan']['lastSourceIndex'] == 896, 'Exact measurement grid')
        data = array('d'); data.frombytes(stream_raw)
        if sys.byteorder != 'little': data.byteswap()
        need(len(data) == NODES and all(math.isfinite(x) for x in data), 'Finite complete Float64LE stream')
        results[mode], runs[mode], streams[mode] = result, run, data
        need(run['selectionFitGatePASS'] is True, 'Saved fit selection status')
        progress = [parse_json(line, 'Witness stderr progress')
                    for line in a.raw('witness/'+mode+'/stderr.log').splitlines()]
        need(len(progress) == 3 and [x.get('phase') for x in progress] ==
             ['mesh-build-start', 'mesh-invariants-pass', 'complete'] and
             progress[0]['mode'] == mode and progress[-1]['mode'] == mode,
             'Exactly three expected structured witness progress records; no error lines')
        need(progress[1]['vertices'] == result['meshStats']['vertices'] and
             progress[1]['triangles'] == result['meshStats']['triangles'] and
             progress[-1]['queries'] == NODES and progress[-1]['streamBytes'] == STREAM_BYTES and
             progress[-1]['errorStreamSHA256'] == STREAM_SHA[mode],
             'Structured witness progress matches retained result and stream')
    off, on = results['off'], results['on']
    need(off['identity']['historicalFiveBufferHashesExact'] is True and off['identity']['historicalAllMeshStatsExact'] is True and
         on['identity']['prefixHashes'] == {k: off['identity']['meshHashes'][k] for k in ('positions', 'surface')}, 'OFF parity/ON original prefixes declarations')
    if old is not None:
        need(off['identity']['meshHashes'] == old['baselineIdentity']['meshHashes'] and off['meshStats'] == old['meshStats'] and
             off['aggregate'] == old['aggregate'] and off['rings'] == old['rings'] and
             off['errorStream']['sha256'] == old['errorStream']['sha256'], 'OFF exact saved historical parity')
    for dep in (runs['on']['preflight']['offDependency'], on['pairedComparison']['offProvenance']):
        need(dep['runSHA256'] == sha(a.raw('witness/off/run.json')) and dep['resultSHA256'] == RESULT_SHA['off'] and
             dep.get('errorStreamSHA256', dep.get('streamSHA256')) == STREAM_SHA['off'] and dep['bytes'] == STREAM_BYTES, 'ON authenticated paired OFF dependency')
    stats, ref = on['meshStats'], on['meshStats']['refinement']
    need(stats['vertices'] <= 1000000 and stats['triangles'] <= 2000000 and
         stats['geometryBytes'] == 32*stats['vertices']+12*stats['triangles'] <= 64*1024**2, 'ON geometry limits')
    need(ref['addedVertices'] == ref['splitEdgeCount'] == stats['vertices']-off['meshStats']['vertices'] and
         ref['addedTriangles'] == stats['triangles']-off['meshStats']['triangles'] and
         ref['probeSampleCalls'] == NODES and ref['totalSampleCalls'] == ref['vertexSampleCalls']+NODES == stats['sampleCalls'], 'Added geometry/sample accounting')
    ident = on['identity']
    need(ref['maximumCellTriangles'] <= 20 and ident['cellRanges']['completeContiguous'] is True and
         ident['cellRanges']['indexCount'] == 3*stats['triangles'] and ident['indicesInRange'] is True and
         ident['maximumVertexIndex'] < stats['vertices'] and ident['attributesFinite'] is True, 'Saved topology/finite declarations')
    masks, rings = array('B'), array('B')
    groups = {0: []}; groups.update({3+3*k: [] for k in range(5)})
    dem = resolved.get(DEM_PATH)
    if dem is not None:
        need(len(dem) == 4202532 and sha(dem) == DEM_SHA and dem[:4] == b'CDM1' and
             struct.unpack_from('<Iddd', dem, 4) == (1025, .125, -64, -64), 'CDM1 exact integer label layout')
        for k in range(18): groups.setdefault(k, [])
    for order in range(NODES):
        iz, ix = divmod(order, 769); iz += 128; ix += 128
        radius = max(abs(ix-512), abs(iz-512))*.125
        ring = next(k for k in range(5) if radius <= f32(128*.032*2**k))
        rings.append(ring); groups[0].append(order); groups[3+3*ring].append(order)
        if dem is not None:
            coast = struct.unpack_from('<h', dem, 32+2*1025**2+2*(iz*1025+ix))[0]
            mask = 1 if coast >= 0 else 2; masks.append(mask)
            groups[mask].append(order); groups[3+3*ring+mask].append(order)

    def point(p, order, mode=None):
        iz, ix = divmod(order, 769); iz += 128; ix += 128
        need(p['order'] == order and p['grid'] == [ix, iz] and p['xzKm'] == [-64+ix*.125, -64+iz*.125] and
             p['ring'] == rings[order] and p['category'] in ('coast>=0', 'coast<0'), 'Saved witness address')
        if dem is not None:
            need(p['category'] == ('coast>=0' if masks[order] == 1 else 'coast<0'), 'Independent integer coast category')
        if mode is not None: need(p['errorMetres'] == streams[mode][order], 'Saved witness error versus stream')

    def arithmetic(saved):
        count = saved['count']; need(isinstance(count, int) and count > 0, 'Nonempty saved group')
        close(saved['signedMeanMetres'], saved['sumErrorMetres']/count, 'Saved mean arithmetic')
        close(saved['rmsMetres'], math.sqrt(saved['sumSquaredErrorMetres2']/count), 'Saved RMS arithmetic')
        need(len(saved['histogramCounts']) == 10002 and sum(saved['histogramCounts']) == count and
             all(isinstance(x, int) and x >= 0 for x in saved['histogramCounts']), 'Saved histogram/count')

    for mode in ('off', 'on'):
        j, values = results[mode], streams[mode]
        for g in range(18): arithmetic(saved_group(j, g))
        # These validate declared material partitions even without the DEM input.
        for g in (0, 3, 6, 9, 12, 15):
            allv, land, sea = [saved_group(j, g+k) for k in range(3)]
            need(allv['count'] == land['count']+sea['count'] and
                 allv['histogramCounts'] == [x+y for x,y in zip(land['histogramCounts'],sea['histogramCounts'])], 'Saved land/sea partition')
            for field in ('sumErrorMetres', 'sumSquaredErrorMetres2'):
                close(allv[field], land[field]+sea[field], 'Saved partition '+field)
        for g, ids in groups.items():
            saved = saved_group(j, g)
            need(saved['count'] == len(ids), 'Independent stream group count')
            total = math.fsum(values[i] for i in ids); squares = math.fsum(values[i]*values[i] for i in ids)
            close(total, saved['sumErrorMetres'], 'Stream sum versus compensated saved sum')
            close(squares, saved['sumSquaredErrorMetres2'], 'Stream squared sum')
            close(total/len(ids), saved['signedMeanMetres'], 'Stream signed mean')
            close(math.sqrt(squares/len(ids)), saved['rmsMetres'], 'Stream RMS')
            hist = [0]*10002
            for i in ids:
                e = values[i]; hist[0 if e < -5000 else 10001 if e >= 5000 else math.floor(e+5000)+1] += 1
            need(hist == saved['histogramCounts'], 'Complete stream histogram')
            for field, key in [('minimum', lambda i:(values[i],i)), ('maximum', lambda i:(-values[i],i)), ('maximumAbs', lambda i:(-abs(values[i]),i))]:
                index = min(ids, key=key); point(saved[field], index, mode)
                ties = sum(abs(values[i]) == abs(values[index]) if field == 'maximumAbs' else values[i] == values[index] for i in ids)
                need(ties == saved[field+'Ties'], 'Independent extremum ties')
            selections = {'top8Absolute': heapq.nsmallest(8, ids, key=lambda i:(-abs(values[i]),i)),
                          'top8Positive': heapq.nsmallest(8, (i for i in ids if values[i]>0), key=lambda i:(-values[i],i)),
                          'top8Negative': heapq.nsmallest(8, (i for i in ids if values[i]<0), key=lambda i:(values[i],i))}
            for field, expected in selections.items():
                need([p['order'] for p in saved[field]] == expected, 'Independent top8 ordering')
                for p, index in zip(saved[field], expected): point(p, index, mode)
    O, N, paired = streams['off'], streams['on'], on['pairedComparison']
    for g, ids in groups.items():
        saved = saved_group(paired, g)
        counts = {k:0 for k in ('improved','worsened','equalAbsoluteError','signFlips','offAbove5m','onAbove5m','enteredAbove5m','leftAbove5m')}
        for i in ids:
            x, y = O[i], N[i]; a0, b0 = abs(x), abs(y)
            counts['improved' if b0<a0 else 'worsened' if b0>a0 else 'equalAbsoluteError'] += 1
            counts['signFlips'] += x<0<y or y<0<x
            counts['offAbove5m'] += a0>5; counts['onAbove5m'] += b0>5
            counts['enteredAbove5m'] += a0<=5<b0; counts['leftAbove5m'] += b0<=5<a0
        need(saved['count'] == len(ids) and all(saved[k] == v for k,v in counts.items()), 'Independent paired counts')
        offsq = math.fsum(O[i]*O[i] for i in ids); onsq = math.fsum(N[i]*N[i] for i in ids)
        for value, field in ((offsq,'sumOffSquaredErrorMetres2'),(onsq,'sumOnSquaredErrorMetres2'),
                             (math.fsum(abs(N[i])-abs(O[i]) for i in ids),'sumAbsoluteErrorDeltaMetres'),
                             (math.sqrt(offsq/len(ids)),'offRMSMetres'),(math.sqrt(onsq/len(ids)),'onRMSMetres')):
            close(value,saved[field],'Paired '+field)
        for field, sign in (('top8Regressions',1),('top8Improvements',-1)):
            expected = heapq.nsmallest(8,(i for i in ids if sign*(abs(N[i])-abs(O[i]))>0),key=lambda i:(-sign*(abs(N[i])-abs(O[i])),i))
            need([p['order'] for p in saved[field]] == expected, 'Paired top8 ordering')
            for p, index in zip(saved[field],expected):
                point(p,index)
                need(p['offErrorMetres'] == O[index] and p['onErrorMetres'] == N[index] and
                     p['absoluteErrorDeltaMetres'] == abs(N[index])-abs(O[index]), 'Paired witness stream values')
    for g in range(18):
        p = saved_group(paired,g)
        need(p['count'] == p['improved']+p['worsened']+p['equalAbsoluteError'] and
             p['onAbove5m'] == p['offAbove5m']+p['enteredAbove5m']-p['leftAbove5m'], 'Paired saved category arithmetic')
    gates = {'globalRMSStrictlyLower':on['aggregate']['all']['rmsMetres']<off['aggregate']['all']['rmsMetres'],
             'landRMSStrictlyLower':on['aggregate']['landMask']['rmsMetres']<off['aggregate']['landMask']['rmsMetres'],
             'globalMaxAbsNoMoreThanBaselinePlus1mm':abs(on['aggregate']['all']['maximumAbs']['errorMetres'])<=abs(off['aggregate']['all']['maximumAbs']['errorMetres'])+.001}
    for k in (2,3,4): gates['landRing%dRMSStrictlyLower'%k] = on['rings'][k]['landMask']['rmsMetres']<off['rings'][k]['landMask']['rmsMetres']
    need(gates == runs['on']['validation']['predeclaredNumericalGate'] and all(gates.values()), 'Frozen numerical fit gates')
    saved_check = a.json('saved-stream-verification/result.json'); saved_run = a.json('saved-stream-verification/run.json')
    need(saved_check['status'] == 'SAVED_STREAM_EVIDENCE_PASS' and saved_check['streamNodesPerMode'] == NODES and
         saved_check['fitGates'] == gates and saved_run['pass'] is True and saved_run['exitCode'] == 0 and
         saved_run['terminalObserved'] is True and saved_run['wallKilled'] is False and
         saved_run['stdoutSHA256'] == sha(a.raw('saved-stream-verification/result.json')) and
         saved_run['stderrSHA256'] == sha(a.raw('saved-stream-verification/stderr.log')), 'Previous independent verifier record binding')
    need(saved_run['CPUSeconds']<=20 and saved_run['wallSeconds']<=40 and saved_run['peakRSSBytes']<=2**31, 'Previous verifier terminal resource gates')
    return {'nodesPerMode':NODES,'groupsRecomputedPerMode':len(groups),'pairedGroupsRecomputed':len(groups),
            'landSeaReclassifiedFromDEM':dem is not None,'historicalResultComparedNow':old is not None,
            'fitGates':gates,'geometry':{'off':off['meshStats'],'on':on['meshStats']}}


def verify_qualification(a):
    p = a.json('qualification/PROTOCOL.json')
    need(p['sourceCount'] == 126 and p['sourceManifestSHA256'] == CANDIDATE_SHA and
         p['expectedTests'] == 435 and p['expectedTestFiles'] == 46, 'Qualification protocol binding')
    checks = a.json('qualification/checks.json')
    need({c['name'] for c in checks} == {'targeted-tests','full-tests','app-build','hero-build'} and len(checks)==4, 'Four qualification commands')
    for c in checks:
        need(c['exitCode']==0 and c['timedOut'] is False and c['terminalObservedByPopen'] is True and
             0<=c['elapsedSeconds']<=45, 'Saved command terminal status')
    for filename, tests, files in (('targeted-results.json',72,2),('test-results.json',435,46)):
        j = a.json('qualification/'+filename)
        need(j['success'] is True and j['numTotalTests']==j['numPassedTests']==tests and
             j['numFailedTests']==j['numPendingTests']==j['numTodoTests']==0 and len(j['testResults'])==files, 'Saved test totals')
        assertions = [x for f in j['testResults'] for x in f['assertionResults']]
        need(len(assertions)==tests and all(x['status']=='passed' and not x['failureMessages'] for x in assertions) and
             all(f['status']=='passed' for f in j['testResults']), 'Saved individual assertions')
    return {'targetedTests':72,'targetedFiles':2,'fullTests':435,'fullFiles':46,'savedCommands':4,
            'execution':'Not rerun; retained command/test records only'}


def png_header(raw):
    need(raw[:8]==b'\x89PNG\r\n\x1a\n' and raw[12:16]==b'IHDR' and struct.unpack_from('>I',raw,8)[0]==13, 'PNG signature/IHDR')
    width,height,depth,colour,compression,filtering,interlace=struct.unpack_from('>IIBBBBB',raw,16)
    need(width>0 and height>0 and depth in (8,16) and colour in (0,2,3,4,6) and
         compression==filtering==0 and interlace in (0,1), 'PNG IHDR fields')
    return [width,height]


def verify_native(a):
    captures = {}
    names = ('refine-main-sun-native','refine-main-rain-native','refine-main-sunset-native',
             'refine-worker-sun-native','stable-main-sunset-native')
    pose = a.json('cost/refinement-cost-protocol.json')['pose']
    for name in names:
        packet = a.json('browser/'+name+'.json'); meta, png = packet['metadata'], packet['png']
        png_name = 'refine-main-sun-native' if name=='refine-worker-sun-native' else name
        raw = a.raw('browser/'+png_name+'.png'); dims = png_header(raw)
        need(packet['schema']=='cloudia-native-frame-v1' and packet['state']=='ready' and
             png['sha256']==sha(raw) and png['byteLength']==len(raw) and png['mime']=='image/png' and
             dims==[png['width'],png['height']]==[2474,1844], 'Native PNG owner identity '+name)
        need(meta['canvas']==meta['output']==meta['internal']==dims and meta['volume']==[256]*3 and
             meta['detailVolume']==[128]*3 and meta['nominalSteps']==384 and meta['quality']=='ultra' and
             meta['flowMode']==meta['ablation']=='full' and meta['paused'] is True and meta['orbit'] is False and
             meta['ready'] is True and meta['regenerating'] is False and meta['seed']==74 and
             meta['clocks']['simulationTime']==60, 'Native full-quality settled scope')
        close(meta['stepSizeKm'],7/384,'Applied native step uniform')
        camera = meta['camera']
        for field,key in (('comparisonSurfaceKm','surface'),('comparisonTargetKm','target'),('target','target'),('yaw','yaw'),('pitch','pitch')):
            same_numbers(camera[field],pose[key],'Native pose '+field)
        need(camera['approach']==0 and camera['ground']==1 and camera['probeSkipped'] is True, 'Native fixed pose')
        need(meta['executionThread']==('worker' if 'worker' in name else 'main'), 'Native owner thread')
        need(meta['rendererVersion']==('observatory-v58-terrain-shadow-cache' if name.startswith('stable-') else 'experiment-v58-source-node-refinement'), 'Native source variant')
        transfer = a.json('browser/'+name+'-transfer.json'); text = packet['textExport']
        need(transfer['sha256']==sha(raw) and transfer['bytes']==len(raw) and text['partCharacters']==65536 and
             text['totalCharacters']==22+4*((len(raw)+2)//3), 'Native transfer PNG/dataURL binding')
        parts = transfer['parts']; total = text['totalCharacters']
        need(len(parts)==text['parts']==math.ceil(total/65536) and
             [p['index'] for p in parts]==list(range(1,len(parts)+1)) and
             sum(p['characters'] for p in parts)==total and
             all(p['characters']==min(65536,total-(p['index']-1)*65536) for p in parts), 'Complete ordered bounded text ledger')
        if 'sunset' in name:
            need(meta['weather']['skyIntent']=='sunset' and meta['lighting']['sunsetAmount']==1 and
                 meta['weather']['skyPending'] is False, 'Sunset settled state')
        elif 'rain' in name:
            need(meta['weather']['skyIntent']=='rain' and abs(meta['weather']['rain']-.8)<1e-9 and
                 meta['weather']['skyPending'] is False, 'Rain settled state')
        else:
            need(meta['weather']['skyIntent']=='clear' and meta['weather']['rain']==0 and
                 meta['weather']['skyPending'] is False, 'Sun settled state')
        captures[name]={'sha256':sha(raw),'bytes':len(raw),'dimensions':dims,'thread':meta['executionThread']}
    need(captures['refine-main-sun-native']['sha256']==captures['refine-worker-sun-native']['sha256'], 'Worker Sun same retained owner PNG alias')
    return captures


def verify_cost(a):
    p = a.json('cost/refinement-cost-protocol.json'); q = p['quality']; pose = p['pose']; policy=p['decision']
    need(p['sourceCandidateSHA256']==CANDIDATE_SHA and p['stable124SHA256']==BASE_SHA and
         policy['maxBaselineDriftFraction']==.15 and policy['minimumBOverBracketMean']==.9, 'Frozen local cost protocol')
    validation = a.json('cost/cost-validation.json'); rejected=a.json('cost/cost-validation-r1-rejected.json')
    need(validation['status']=='PASS' and validation['revision']==2 and all(validation['checks'].values()), 'Saved cost validation R2')
    need(rejected['status']=='FAIL' and [k for k,v in rejected['checks'].items() if not v]==['A1-cache'], 'Preserved rejected validator R1')
    for field in ('submissionFps','bracketMean','baselineDriftFraction','BOverBracketMean','rainResidualMaximum','records'):
        need(rejected[field]==validation[field], 'Validator correction retains original measurements')
    fps, queues, residuals = {}, {}, []
    for name in ('A1','B','A2'):
        raw=a.raw('cost/cost-'+name+'-report.json'); j=parse_json(raw,name+' cost')
        record=validation['records'][name]
        need(record['bytes']==len(raw) and record['sha256']==sha(raw), 'Cost report identity '+name)
        need(j['output']==q['output'] and j['internal']==q['internal'] and j['volume']==q['volume'] and
             j['detailVolume']==q['detail'] and j['nominalSteps']==q['steps'] and j['quality']=='ultra' and
             j['ablation']==q['ablation'] and j['flowMode']==q['flow'], 'Cost full quality '+name)
        need(j['executionThread']==p['measurement']['thread']=='main' and j['timingMode']==p['measurement']['timing']=='queue' and
             j['warmupMs']==p['measurement']['warmupMs'] and j['targetDurationMs']==p['measurement']['targetDurationMs'] and
             j['simulationTimeStart']==j['simulationTimeEnd']==pose['simulationTime'] and j['paused'] is True and
             j['orbit'] is False and j['seed']==pose['seed'] and j['skyPending'] is False, 'Cost measurement/state '+name)
        need(j['rendererVersion']==('experiment-v58-source-node-refinement' if name=='B' else 'observatory-v58-terrain-shadow-cache'), 'Cost source variant')
        c=j['camera']
        for field,key in (('comparisonSurfaceKm','surface'),('comparisonTargetKm','target'),('target','target'),('yaw','yaw'),('pitch','pitch')):
            same_numbers(c[field],pose[key],'Cost same pose '+field)
        need(c['approach']==0 and c['ground']==1 and c['probeSkipped'] is True and
             j['weather']['sky']==pose['weather'] and j['weather']['wind']==pose['wind'] and
             j['weather']['dispersion']==pose['dispersion'], 'Cost camera/weather contract')
        residuals.append(abs(j['weather']['rain']-pose['rain']))
        intervals=j['frameIntervalsMs']; st=j['stats']; need(st['frames']==len(intervals)>0 and all(finite_number(x) and x>0 for x in intervals), 'Positive complete frame interval ledger')
        close(st['durationMs'],math.fsum(intervals),'Frame intervals sum')
        close(st['fps'],1000*len(intervals)/math.fsum(intervals),'Submitted-rate arithmetic')
        close(j['submissionFps'],st['fps'],'Submission metric alias')
        close(st['maxMs'],max(intervals),'Maximum submitted interval')
        sorted_intervals=sorted(intervals)
        for key,quantile in (('medianMs',.5),('p95Ms',.95),('p99Ms',.99)):
            close(st[key],sorted_intervals[min(len(intervals)-1,math.floor(len(intervals)*quantile))], 'Saved submission interval percentile')
        need(st['over18Ms']==sum(x>18 for x in intervals) and st['over33Ms']==sum(x>33.34 for x in intervals), 'Interval threshold counts')
        need(j['presentedCanvasFps'] is None, 'No compositor presentation metric inferred')
        prefix=j['queuePrefix']; samples=prefix['samples']
        need(prefix['status']=='completed' and prefix['reason'] is None and
             prefix['measuredSubmissions']==prefix['confirmedPrefixId']==st['frames'] and
             prefix['unconfirmedMeasuredFrames']==0 and samples[0]['kind']=='start' and
             samples[0]['prefixId']==0 and samples[-1]['kind']=='end' and samples[-1]['prefixId']==st['frames'], 'Final completed queue prefix')
        for sample in samples:
            need(sample['status']=='completed' and sample['error'] is None and
                 0<=sample['prefixId']<=st['frames'], 'Queue sample terminal scope')
            close(sample['latencyMs'],sample['resolvedAtMs']-sample['requestedAtMs'],'Queue latency arithmetic')
        need(all(x['prefixId']<=y['prefixId'] for x,y in zip(samples,samples[1:])), 'Queue prefix ordering')
        close(prefix['endDrainMs'],samples[-1]['latencyMs'],'Final drain latency')
        close(prefix['completionBoundedSubmissionFps'],1000*st['frames']/(samples[-1]['resolvedAtMs']-prefix['windowStartedAtMs']), 'Queue completion-bounded submitted rate')
        start,end=j['terrainRaster']['shadow']['cache'],j['terrainRasterEnd']['shadow']['cache']
        need(start['valid'] is True and end['valid'] is True and start['epoch']==end['epoch'] and
             start['submissions']==end['submissions'] and end['requests']>=start['requests'] and
             end['hits']-start['hits']==end['requests']-start['requests'], 'No shadow draw inside cost window')
        need(validation['shadowSubmissionCounts'][name]==[start['submissions'],end['submissions']], 'Saved lifetime shadow counts')
        need(a.json('cost/cost-'+name+'-console.json')==[], 'Ordinary cost console empty')
        fps[name]=st['fps']; queues[name]=prefix['completionBoundedSubmissionFps']
        close(fps[name],validation['submissionFps'][name],'Validation submitted rate')
    mean=(fps['A1']+fps['A2'])/2; drift=abs(fps['A1']-fps['A2'])/fps['A1']; ratio=fps['B']/mean
    for actual,key in ((mean,'bracketMean'),(drift,'baselineDriftFraction'),(ratio,'BOverBracketMean'),(max(residuals),'rainResidualMaximum')):
        close(actual,validation[key],'Frozen local cost '+key)
    need(drift<=policy['maxBaselineDriftFraction'] and ratio>=policy['minimumBOverBracketMean'] and
         max(residuals)<=3.18e-7, 'Local cost and disclosed weather-residual gates')
    return {'submissionFps':fps,'completionBoundedSubmissionFps':queues,'baselineDriftFraction':drift,
            'BOverBracketMean':ratio,'validatorR1PreservedFAIL':True,'validatorR2SavedPASS':True,
            'scope':'Single paused Rain A1/B/A2 submitted-rate gate; no presented FPS or speedup conclusion. Timestamp pass sums are not added.'}


def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('archive',nargs='?',type=Path,default=Path(__file__).resolve().parent)
    parser.add_argument('--base-source',type=Path,help='Read exact124 base files and reconstruct126 candidate bytes in memory')
    parser.add_argument('--runtime-source',type=Path,help='Read pinned repository references and DEM integer coast labels; never execute source')
    args=parser.parse_args(); start=time.monotonic(); a=Archive(args.archive)
    references,resolved,old=read_references(a,args.runtime_source)
    source=verify_sources(a,args.base_source)
    stream=verify_streams(a,resolved,old)
    qualification=verify_qualification(a)
    native=verify_native(a)
    cost=verify_cost(a)
    # Recheck the exact payload inventory bytes against the initially read manifest.
    for name,rec in a.records.items():
        raw=read_local(a.root,name); need(len(raw)==rec['bytes'] and sha(raw)==rec['sha256'],'Post-verification payload drift')
    need(read_local(a.root,'MANIFEST.json',JSON_CAP)==a.manifest_raw,'Root manifest changed during verification')
    print(json.dumps({'status':'SAVED_EVIDENCE_PASS','checks':CHECKS,'manifestSHA256':sha(a.manifest_raw),
        'payloadFiles':len(a.records),'storedPayloadBytes':sum(r['bytes'] for r in a.records.values()),
        'originalPayloadBytes':sum(r['origin']['bytes'] for r in a.records.values()),
        'referencesDeclared':len(references),'referencesReadAndVerified':len(resolved),
        'source':source,'streams':stream,'qualification':qualification,'native':native,'cost':cost,
        'elapsedSeconds':time.monotonic()-start,
        'limits':['Only retained bytes and arithmetic are verified. No mesh, sampler, shader, model, ray, build, test, browser or GPU replay.',
                  'Buffer hashes, topology and run timings are authenticated saved declarations; missing arrays are not regenerated. Five Three/Bun dependency hashes are retained declarations, not reread dependency binaries.',
                  'Without --runtime-source, land/sea labels and historical OFF equality beyond pinned digests are not independently rederived.',
                  'With the pinned DEM, only integer node coast codes are decoded; no DEM height/interpolation queries are performed.',
                  'Selection-node fit is not holdout, continuous terrain accuracy, shadow-cause proof or artistic acceptance.',
                  'PNG headers, byte hashes and owner metadata are checked; image pixels are not rendered or artistically judged.',
                  'Recorded submitted-rate/queue evidence is not compositor presentation, global60FPS, causal speedup or hardware diagnosis.',
                  'The self-excluded MANIFEST is an inventory, not a digital signature or protection against coordinated replacement.']},indent=2))


if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'status':'SAVED_EVIDENCE_FAIL','checks':CHECKS,'errorType':type(exc).__name__,'error':str(exc)},indent=2),file=sys.stderr)
        sys.exit(1)
