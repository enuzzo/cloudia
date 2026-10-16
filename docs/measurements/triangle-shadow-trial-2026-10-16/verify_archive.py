#!/usr/bin/env python3
"""Verify saved cycle27 evidence only. Never imports TS, builds a mesh or invokes a runtime.

Usage: python3 verify_archive.py [ARCHIVE] --runtime-source /path/to/v58/repo
       [--trial-dist /path/to/trial/dist] [--diagnostic-dist /path/to/diagnostic/dist]

Without --runtime-source, unchanged base suffixes are declarations, not byte-verified
runtime files. Optional dist checks compare saved hashes; they do not rebuild assets.
All output goes to stdout/stderr. No output, cache or manifest is written.
"""
from pathlib import Path, PurePosixPath
import argparse
import hashlib
import json
import math
import os
import struct
import sys
from PIL import Image, ImageChops

BASE_SHA = '21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2'
TRIAL_SHA = 'dfa3ec97b2c606f6fa1d1cd2f6d21dad44026095228026270fc02e150cb56921'
DIAGNOSTIC_SHA = '4a5bea3762a06d9f3b1c9418d5995a879c11079aec57784c9b28a76e2dcef887'
PNG_SHA = '576b35cc44d09b7fe271bbec942dc9f9cd4d0a5105a82dafd17b43ffb766bdc6'
BASE_PNG_SHA = 'af8877ac93db6fcd50ab3ceece43ac1a40fc7d21c41151afb3a9620ca7586be5'
WITNESS_SHA = 'f416a5fc3aa706186cc2f08811d7a35192153297f91486e31e6202409ed034cc'
CLIP_SHA = '9c685934f80950b0f82c315a80b54173c88b58be8f26410887f5f59b643b0a18'
CLIP_RUNTIME_SHA = '360be4ca207e91a3e9286e879e4ce9bf6a3a033ebbbccc10426708a08f7cbdc7'
VERSION = 'experiment-v58-triangle-texel-shadow'
PREFIX = 'src/cumulonimbus/'
TRIAL_CHANGED = {PREFIX + n for n in [
    'GPUSceneEngine.ts', 'TerrainShadow.test.ts', 'TerrainShadow.ts',
    'TerrainShadowCaster.test.ts', 'TerrainShadowCaster.ts', 'lifecycle.test.ts',
    'terrainMesh.ts', 'terrainShadowClip.test.ts', 'terrainShadowClip.ts']}
TRIAL_ADDED = {PREFIX + n for n in [
    'TerrainShadowCaster.test.ts', 'TerrainShadowCaster.ts',
    'terrainShadowClip.test.ts', 'terrainShadowClip.ts']}
DIAGNOSTIC_CHANGED = {PREFIX + 'GPUSceneEngine.ts', PREFIX + 'sceneMarkup.ts'}
IDS = ['L1-artifact', 'L1-control', 'L2-artifact', 'L2-control',
       'L3-artifact', 'L3-control', 'C1-ocean', 'C2-coastal-lowland',
       'C3-plain', 'C4-ridge-L1', 'C5-ridge-L2', 'C6-ridge-L3']
ROIS = {'L1': (40, 820, 140, 910), 'L2': (390, 810, 520, 890),
        'L3': (860, 620, 970, 715), 'coast': (1700, 850, 2150, 1200)}
SCENE_FIELDS = ['camera', 'material', 'weather', 'lighting', 'quality',
                'nominalSteps', 'output', 'internal', 'paused', 'ablationCode']
CHECKS = 0


def need(condition, message):
    global CHECKS
    CHECKS += 1
    if not condition:
        raise ValueError(message)


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def read_json(path):
    with path.open('r', encoding='utf-8') as stream:
        return json.load(stream)


def safe_name(name):
    need(isinstance(name, str) and bool(name) and '\\' not in name,
         f'Invalid relative path: {name!r}')
    pure = PurePosixPath(name)
    need(not pure.is_absolute() and all(p not in ('.', '..', '') for p in pure.parts)
         and str(pure) == name, f'Unsafe relative path: {name}')
    return name


def regular(root, name):
    safe_name(name)
    path = root / name
    need(path.is_file() and not path.is_symlink(), f'Missing/nonregular file: {path}')
    parent = path.parent
    while parent != root:
        need(not parent.is_symlink(), f'Symlink parent: {parent}')
        parent = parent.parent
    return path


def inventory(root, max_files=1024, max_bytes=256 * 1024 * 1024):
    need(root.is_dir() and not root.is_symlink(), f'Not an archive directory: {root}')
    result = {}
    total = 0
    for parent, dirs, files in os.walk(root, followlinks=False):
        for name in dirs:
            need(not (Path(parent) / name).is_symlink(), 'Symlink directory in archive')
        for name in files:
            path = Path(parent) / name
            need(path.is_file() and not path.is_symlink(), f'Nonregular archive entry: {path}')
            rel = path.relative_to(root).as_posix()
            safe_name(rel)
            total += path.stat().st_size
            need(len(result) < max_files and total <= max_bytes, 'Archive bound exceeded')
            result[rel] = path
    return result


def payload_records(manifest):
    if isinstance(manifest, dict) and 'payload' in manifest:
        records = manifest['payload']
    elif isinstance(manifest, dict) and 'files' in manifest:
        records = manifest['files']
    elif isinstance(manifest, dict) and 'payloads' in manifest:
        records = manifest['payloads']
    else:
        raise ValueError('Global MANIFEST requires payload/files/payloads records with bytes+sha256')
    if isinstance(records, dict):
        records = [dict(value, path=key) for key, value in records.items()]
    need(isinstance(records, list), 'Manifest payload must be list or mapping')
    out = {}
    for row in records:
        need(isinstance(row, dict), 'Manifest payload row must be object')
        name = safe_name(row['path'])
        need(name not in out and name != 'MANIFEST.json', 'Duplicate/self manifest record')
        need(isinstance(row['bytes'], int) and row['bytes'] >= 0, 'Invalid byte length')
        need(isinstance(row['sha256'], str) and len(row['sha256']) == 64
             and all(c in '0123456789abcdef' for c in row['sha256']), 'Invalid SHA256')
        out[name] = row
    return out


def manifest_hashes(path, expected_count, expected_sha):
    need(sha(path) == expected_sha, f'Pinned source manifest drift: {path}')
    values = read_json(path)
    need(isinstance(values, dict) and len(values) == expected_count, 'Source manifest count')
    for name, value in values.items():
        safe_name(name)
        need(isinstance(value, str) and len(value) == 64, 'Source hash schema')
    return values


def overlay(root, name, expected):
    path = root / name
    files = inventory(path, max_files=32, max_bytes=8 * 1024 * 1024)
    need(set(files) == set(expected), f'{name}: unexpected/missing overlay files')
    for key, value in expected.items():
        need(sha(files[key]) == value, f'{name} SHA mismatch: {key}')
    return {key: sha(value) for key, value in files.items()}


def source_checks(root, runtime):
    base = manifest_hashes(root / 'source-manifest.json', 124, BASE_SHA)
    trial = manifest_hashes(root / 'qualification/source-manifest.json', 128, TRIAL_SHA)
    diagnostic = manifest_hashes(root / 'gpu-readback/source-manifest.json', 128, DIAGNOSTIC_SHA)
    need(set(base).issubset(trial) and set(trial) == set(diagnostic), 'Manifest source set relation')
    changed = {k for k in trial if base.get(k) != trial[k]}
    added = set(trial) - set(base)
    diag_changed = {k for k in diagnostic if trial[k] != diagnostic[k]}
    need(changed == TRIAL_CHANGED and added == TRIAL_ADDED, 'Trial mutation allowlist drift')
    need(diag_changed == DIAGNOSTIC_CHANGED, 'Diagnostic mutation allowlist drift')
    before = overlay(root, 'source-before', {k: base[k] for k in changed if k in base})
    trial_overlay = overlay(root, 'source-trial', {k: trial[k] for k in changed})
    diag_overlay = overlay(root, 'source-diagnostic', {k: diagnostic[k] for k in diag_changed})
    need(all(before[k] == base[k] for k in before), 'Source-before is not base')
    virtual_trial = dict(base)
    virtual_trial.update(trial_overlay)
    need(virtual_trial == trial, 'Virtual trial128 mismatch')
    virtual_diag = dict(virtual_trial)
    virtual_diag.update(diag_overlay)
    need(virtual_diag == diagnostic, 'Virtual diagnostic128 mismatch')
    verified = 0
    if runtime:
        for name, expected in base.items():
            need(sha(regular(runtime, name)) == expected, f'Runtime is not BASE v58: {name}')
            verified += 1
        for name in added:
            need(not (runtime / name).exists(), f'Trial-only source leaked into BASE runtime: {name}')
    for manifest, folder in [(trial, 'source-trial'), (diagnostic, 'source-diagnostic')]:
        name = PREFIX + 'GPUSceneEngine.ts'
        need(VERSION in regular(root, folder + '/' + name).read_text(), 'Trial version mismatch')
    need(trial[PREFIX + 'terrainShadowClip.ts'] == CLIP_RUNTIME_SHA, 'Clip runtime pin drift')
    return {'baseDeclarations': 124, 'runtimeBaseFilesByteVerified': verified,
            'virtualTrial': 128, 'virtualDiagnostic': 128,
            'trialOverlay': len(trial_overlay), 'diagnosticOverlay': len(diag_overlay)}


def tests_saved(path, count, files):
    j = read_json(path)
    need(j['success'] is True and j['numTotalTests'] == count and j['numPassedTests'] == count,
         f'Saved test total: {path}')
    need(j['numFailedTests'] == j['numPendingTests'] == j['numTodoTests'] == 0,
         f'Saved test failure/pending: {path}')
    need(len(j['testResults']) == files, f'Saved test file count: {path}')
    assertions = []
    for suite in j['testResults']:
        need(suite['status'] == 'passed', f'Saved test file failure: {suite.get("name")}')
        assertions.extend(suite['assertionResults'])
    need(len(assertions) == count and all(v['status'] == 'passed' and not v['failureMessages']
                                         for v in assertions), 'Saved assertion statuses')


def checks_saved(path, names):
    rows = read_json(path)
    need([r['name'] for r in rows] == names, f'Qualification command set/order: {path}')
    for row in rows:
        need(row['exitCode'] == 0 and row['timedOut'] is False
             and row['terminalObservedByPopen'] is True, f'Qualification terminal failure: {row}')
        need(math.isfinite(row['elapsedSeconds']) and row['elapsedSeconds'] >= 0, 'Command duration')


def optional_dist(root, subdir, actual):
    declared = read_json(root / subdir / 'dist-manifest.json')
    need(isinstance(declared, dict) and len(declared) > 0, 'Dist manifest schema')
    for name in declared:
        safe_name(name)
    if actual:
        files = inventory(actual)
        need(set(files) == set(declared), f'{subdir} dist file set mismatch')
        for name, expected in declared.items():
            need(sha(files[name]) == expected, f'{subdir} dist SHA: {name}')
    return {'declared': len(declared), 'byteVerified': len(declared) if actual else 0}


def full_quality(meta):
    need(meta['rendererVersion'] == VERSION and meta['executionThread'] == 'main', 'Trial/main identity')
    need(meta['quality'] == 'ultra' and meta['nominalSteps'] == 384, 'Full384 quality')
    need(meta['volume'] == [256, 256, 256] and meta['detailVolume'] == [128, 128, 128], 'Full volume/detail')
    need(meta['output'] == meta['internal'] == meta['canvas'] == [2474, 1844], 'Full native output')
    need(meta['paused'] is True and meta['seed'] == 74 and meta['clocks']['simulationTime'] == 60,
         'Fixed seed/time/paused')
    need(meta['weather']['rain'] == 0 and meta['weather']['skyIntent'] == 'clear'
         and meta['weather']['skyPending'] is False and meta['weather']['atmosphereProgress'] == 1,
         'Settled clear Sun state')


def image_checks(root):
    png = regular(root, 'browser/trial-main-sun-terrain-native.png')
    need(png.stat().st_size == 2989801 and sha(png) == PNG_SHA, 'Trial PNG SHA/bytes')
    original = read_json(root / 'browser/trial-main-sun-terrain-native.json')
    need(original['state'] == 'ready' and original['png'] == {
        'mime': 'image/png', 'width': 2474, 'height': 1844,
        'byteLength': 2989801, 'sha256': PNG_SHA}, 'Native PNG metadata')
    full_quality(original['metadata'])
    transfer = read_json(root / 'browser/trial-main-sun-terrain-native.transfer.json')
    need(transfer['status'] == 'PASS_VISIBLE_PARTS_ROUNDTRIP'
         and transfer['captureId'] == original['captureId']
         and transfer['sha256'] == PNG_SHA and transfer['bytes'] == 2989801, 'Transfer identity')
    total = len('data:image/png;base64,') + 4 * ((png.stat().st_size + 2) // 3)
    need(total == transfer['totalCharacters'] == original['textExport']['totalCharacters'] == 3986426,
         'Canonical data URL length')
    need(transfer['parts'] == original['textExport']['parts'] == 61
         and original['textExport']['partCharacters'] == 65536, 'Transfer part dimensions')
    ledger = transfer['ledger']
    need(len(ledger) == 61, 'Transfer ledger length')
    for i, part in enumerate(ledger):
        start = i * 65536 + 1
        end = min((i + 1) * 65536, total)
        need(part == {'part': i + 1, 'characters': end - start + 1,
                      'label': f'Parte {i + 1} di 61 · caratteri {start}–{end} di {total}'},
             'Transfer ledger sequence/label')
    baseline = root.parent / 'terrain-shadow-cache-2026-10-16/browser/v58-main-sun-terrain-native-settled.png'
    need(baseline.is_file() and not baseline.is_symlink() and sha(baseline) == BASE_PNG_SHA,
         'Required sibling settled baseline PNG identity')
    with Image.open(png) as trial_im, Image.open(baseline) as base_im:
        need(trial_im.format == base_im.format == 'PNG'
             and trial_im.size == base_im.size == (2474, 1844), 'PNG decode dimensions')
        trial = trial_im.convert('RGBA')
        base = base_im.convert('RGBA')
    for name, box in ROIS.items():
        for prefix, full in [('trial', trial), ('baseline', base)]:
            with Image.open(regular(root, f'browser/{prefix}-{name}.png')) as crop:
                need(crop.size == (box[2] - box[0], box[3] - box[1])
                     and crop.convert('RGBA').tobytes() == full.crop(box).tobytes(),
                     f'Derived crop is not exact fixed ROI: {prefix}-{name}')
    comparison = read_json(root / 'browser/native-comparison.json')
    need(comparison['candidateSHA256'] == PNG_SHA, 'Comparison candidate pin')
    before, after = base.convert('RGB').tobytes(), trial.convert('RGB').tobytes()
    changed = absolute = 0
    low, high = 255, -255
    for i in range(0, len(before), 3):
        d0, d1, d2 = after[i] - before[i], after[i + 1] - before[i + 1], after[i + 2] - before[i + 2]
        changed += bool(d0 or d1 or d2)
        absolute += abs(d0) + abs(d1) + abs(d2)
        low = min(low, d0, d1, d2)
        high = max(high, d0, d1, d2)
    need((changed, low, high, absolute) == (comparison['changedPixels'], comparison['minRGBDelta'],
         comparison['maxRGBDelta'], comparison['sumAbsoluteRGBDelta']), 'Saved full RGB comparison')
    need([v['id'] for v in comparison['fixedPixels']] == IDS, 'Fixed PNG comparison IDs')
    for row in comparison['fixedPixels']:
        pos = tuple(row['pixel'])
        a, b = list(base.getpixel(pos)[:3]), list(trial.getpixel(pos)[:3])
        need(row['before'] == a and row['trial'] == b
             and row['delta'] == [y - x for x, y in zip(a, b)], 'Fixed PNG comparison values')
    need(changed == 76544 and low == -57 and high == 17 and absolute == 2664205,
         'Pinned saved RGB totals')
    need(all(v['delta'] == [0, 0, 0] for v in comparison['fixedPixels']), 'Fixed12 RGB identity')
    return original, {'fullNativePNG': 1, 'derivedCrops': 8, 'transferLedgerParts': 61,
                      'changedRGBPixels': changed, 'minRGBDelta': low, 'maxRGBDelta': high}


def run_budget(row, cpu_key, wall_key, cpu, wall, rss):
    need(row['exitCode'] == 0 and not row.get('wallKilled', False), 'Saved run terminal exit')
    need(row.get('terminalObserved', row.get('launched', False)) is True, 'Terminal run observation')
    need(0 <= row[cpu_key] <= cpu and 0 <= row[wall_key] <= wall
         and 0 <= row['peakRSSBytes'] <= rss and row.get('budgetPASS', row.get('pass')) is True,
         'Saved run budget')


def saved_witness(root):
    folder = root / 'positive-witness'
    need(sha(folder / 'result.json') == WITNESS_SHA, 'Frozen12 witness pin')
    need(sha(folder / 'clipping/result.json') == CLIP_SHA, 'Frozen12 clipping pin')
    run = read_json(folder / 'run.json')
    run_budget(run, 'cpuSeconds', 'wallSeconds', 20, 40, 2 ** 31)
    need(run['pass'] is True and run['CPUHardLimitSeconds'] == 20
         and run['wallLimitSeconds'] == 40 and run['peakRSSGateBytes'] == 2 ** 31,
         'Witness kernel budget declaration')
    w, clip = read_json(folder / 'result.json'), read_json(folder / 'clipping/result.json')
    need(w['raycasts'] == 36 and len(w['rows']) == 12, 'Saved12/36 witness')
    need([v['id'] for v in w['rows']] == [v['id'] for v in clip['rows']] == IDS, 'Witness fixed IDs')
    need(w['sourceManifestSHA256'] == BASE_SHA and clip['inputSHA256'] == WITNESS_SHA, 'Witness input bindings')
    need(w['meshStats']['vertices'] == 465409 and w['meshStats']['triangles'] == 929792, 'Saved mesh stats')
    selected = read_json(folder / 'selected-pixels.json')
    root_points = read_json(root / 'PROTOCOL.json')['pixelsSelectedBeforeRun']
    need([{k: v[k] for k in ['id', 'pixelCentre', 'selectionIsArtifact']} for v in selected] == root_points,
         'Preselected coordinates')
    physical = {}
    for row in w['rows']:
        r = row['physicalSunRay']
        need(r['physicallyUnoccluded'] == (r['blocker'] is None and r['farPastEntireMeshMaximumY']),
             'Whole-mesh positive-control criterion')
        need(r['farKm'] == 20 and r['startOffsetKm'] == .00001 and r['side'] == 'DoubleSide',
             'Physical ray contract')
        need(row['receiver']['safelyInsidePlanarClip'] is True
             and row['shadow']['coverageFade'] == 0, 'Receiver/coverage qualification')
        physical[row['id']] = r
    need(sum(v['blocker'] is not None for v in physical.values()) == 6
         and sum(v['physicallyUnoccluded'] for v in physical.values()) == 6, 'Six blocked/six unoccluded')
    need(all(physical[k]['physicallyUnoccluded'] for k in IDS[6:]), 'C1-C6 physical positives')
    counts = {}
    for variant in ['baselineAffineTexel', 'fullTriangleClamp', 'clippedTriangleTexel']:
        counts[variant] = {'shadowed': 0, 'litWithPhysicalBlocker': 0,
                           'falseShadowPhysicallyUnoccluded': 0, 'physicallyUnoccludedLit': 0}
    for row, frozen in zip(w['rows'], clip['rows']):
        need(row['id'] == frozen['id'], 'Clip row association')
        vertices = frozen['intersectionPolygonUVQ']
        bounds = frozen['texelUVBounds']
        need(3 <= len(vertices) <= 7 and all(all(math.isfinite(x) for x in v) for v in vertices),
             'Saved clip polygon finite/capacity')
        need(all(bounds[0] - 1e-15 <= v[0] <= bounds[2] + 1e-15
                 and bounds[1] - 1e-15 <= v[1] <= bounds[3] + 1e-15 for v in vertices), 'Saved clip bounds')
        variants = frozen['variants']
        need(abs(variants['clippedTriangleTexel']['storedMinimumKm']
                 - (min(v[2] for v in vertices) - .001)) <= 1e-8, 'Saved polygon minimum identity')
        need(variants['baselineAffineTexel']['storedMinimumKm']
             == row['caster']['storedMinimumKm'], 'Saved baseline association')
        need(variants['fullTriangleClamp']['storedMinimumKm'] + 1e-8
             >= variants['baselineAffineTexel']['storedMinimumKm']
             and variants['clippedTriangleTexel']['storedMinimumKm'] + 1e-8
             >= variants['fullTriangleClamp']['storedMinimumKm'], 'Saved bounds monotonicity')
        for name, value in variants.items():
            lit = row['baselineLookup']['heightKm'] >= value['storedMinimumKm']
            need(value['rawVisibility'] == int(lit), 'Saved clip q comparison')
            counts[name]['shadowed'] += not lit
            counts[name]['litWithPhysicalBlocker'] += lit and physical[row['id']]['blocker'] is not None
            counts[name]['falseShadowPhysicallyUnoccluded'] += not lit and physical[row['id']]['physicallyUnoccluded']
            counts[name]['physicallyUnoccludedLit'] += lit and physical[row['id']]['physicallyUnoccluded']
    need(counts == clip['counts'], 'Saved clip count consistency')
    need([counts[k]['litWithPhysicalBlocker'] for k in counts] == [3, 2, 0]
         and all(v['falseShadowPhysicallyUnoccluded'] == 0 and v['physicallyUnoccludedLit'] == 6
                 for v in counts.values()), 'Fixed12 clip outcomes')
    clip_run = read_json(folder / 'clipping/run.json')
    run_budget(clip_run, 'cpuSeconds', 'wallSeconds', 1, 5, 2 ** 31)
    post = read_json(folder / 'POST-RUN-INPUT-VERIFICATION.json')
    need(post['state'] == 'PASS' and post['sourceFilesVerified'] == 124
         and post['sourceMismatches'] == post['freezeInputMismatches'] == []
         and post['firstSixSharedFieldsExactlyPreservedExceptTiming'] is True, 'Saved post-input verification')
    return w, {'recordedPixels': 12, 'recordedRays': 36,
               'physicalBlocked': 6, 'physicalUnoccluded': 6, 'clippedFalseShadowsInSample': 0}


def intrinsic(root):
    folder = root / 'intrinsic-counterexample'
    pre, run, result = [read_json(folder / n) for n in ['PRE-RUN.json', 'run.json', 'result.json']]
    need(pre['oneCase'] is True and pre['search'] is False, 'Intrinsic case preselection')
    need(pre['CPUHardLimitSeconds'] == 1 and pre['wallSeconds'] == 10
         and pre['peakRSSGateBytes'] == 2 ** 29, 'Intrinsic fixed budget')
    run_budget(run, 'CPUSeconds', 'wallSeconds', 1, 10, 2 ** 29)
    need(result['status'] == 'SINGLE_PREDEFINED_COPLANAR_COUNTEREXAMPLE_CONFIRMED', 'Intrinsic status')
    need(result['receiverInsideB'] is True and result['texelCentreInsideA'] is True
         and result['addressedPixel'] == [1024, 1024], 'Intrinsic fixed topology declarations')
    need(result['radiusKm'] == 64 and result['resolution'] == 2048
         and result['stepKm'] == .0625 and result['receiverRadialOffsetKm'] == .03125
         and result['biasKm'] == .001, 'Intrinsic units')
    need([c['precision'] for c in result['cases']] == ['float64', 'float32'], 'Intrinsic precision pair')
    for case in result['cases']:
        need(case['baselineLit'] is True and case['clippedLit'] is False
             and case['falseShadowMarginM'] >= 5.75, 'Saved intrinsic false shadow')
        need(abs(case['falseShadowMarginM']
                 - (case['clippedMinimumKm'] - case['qLookupKm']) * 1000) < 1e-9,
             'Intrinsic margin identity')
        need(case['baselineMinimumKm'] <= case['qLookupKm'] < case['clippedMinimumKm'],
             'Intrinsic saved compare')
    mapping = {'candidate-source/' + PREFIX + 'terrainShadowClip.ts':
               root / 'source-trial' / (PREFIX + 'terrainShadowClip.ts'),
               'intrinsic-counterexample/counterexample.ts': folder / 'counterexample.ts',
               'select-scope-and-affine-counterexample.md': root / 'select-scope-and-affine-counterexample.md'}
    need(set(pre['inputs']) == set(mapping), 'Intrinsic pre-run input set')
    for name, path in mapping.items():
        need(sha(path) == pre['inputs'][name], f'Intrinsic frozen input SHA: {name}')
    need((folder / 'README.md').is_file(), 'Intrinsic preservation caveat README missing')
    return {'fixedCases': 1, 'precisions': 2, 'minimumSavedFalseShadowMarginM':
            min(c['falseShadowMarginM'] for c in result['cases']),
            'controllerOriginalityClaim': False}


def gpu_readback(root, original, witness):
    r = read_json(root / 'gpu-readback/report.json')
    a = read_json(root / 'gpu-readback/analysis.json')
    native = read_json(root / 'gpu-readback/native-metadata.json')
    need(r['status'] == 'READBACK_COMPLETE' and r['reportKind'] == 'terrain-shadow-R32F-readback-v1',
         'GPU readback status/scope')
    need(r['sourceWitnessSHA256'] == WITNESS_SHA and len(r['rows']) == 12
         and [v['id'] for v in r['rows']] == IDS, 'Readback witness association')
    need(r['uniqueTexels'] == len({tuple(v['pixel']) for v in r['rows']}) == a['uniqueTexels'] == 11,
         'Readback unique addresses')
    before, after = r['cacheBefore'], r['cacheAfter']
    need(r['stableShadowDuringRead'] is True and a['mapStableDuringRead'] is True
         and before['valid'] is True and after['valid'] is True
         and before['submissions'] == after['submissions'] == 1
         and before['epoch'] == after['epoch'] == 0, 'Saved cache stability')
    need(after['requests'] - before['requests'] == after['hits'] - before['hits'] == 4,
         'Readback intervening cache hits')
    full_quality(r)
    need(native['png'] == original['png'] and native['png']['sha256'] == PNG_SHA,
         'Diagnostic native owner SHA differs from trial PNG')
    full_quality(native['metadata'])
    for field in SCENE_FIELDS + ['skyTextures']:
        need(r[field] == native['metadata'][field], f'Readback/native applied state: {field}')
    for field in SCENE_FIELDS:
        need(r[field] == original['metadata'][field], f'Diagnostic/trial applied state: {field}')
    need('GPU receiver q' in a['scope'] and 'not read' in a['scope']
         and 'not proof' in a['scope'] and 'Float64 CPU lookup q' in a['scope'], 'Readback scope qualifier')
    need('not a PNG' in r['scope'] and 'triangle-ID' in r['scope'], 'Readback separate measurement scope')
    need(a['recordCount'] == 12 and len(a['rows']) == 12, 'Analysis count')
    lit_blocked = false_shadow = 0
    duplicate = {}
    for row, analysis, cpu in zip(r['rows'], a['rows'], witness['rows']):
        need(all(analysis[k] == v for k, v in row.items()), 'Analysis/report record drift')
        need(row['id'] == cpu['id'] and row['pixel'] == cpu['baselineLookup']['pixel']
             and row['qLookupKm'] == cpu['baselineLookup']['heightKm'], 'CPU-addressed probe binding')
        need(row['physicallyLit'] == cpu['physicalSunRay']['physicallyUnoccluded'], 'Physical label source')
        need(row['returnedElements'] == 1 and math.isfinite(row['heightKm'])
             and struct.unpack('<I', struct.pack('<f', row['heightKm']))[0] == row['bits'],
             'R32F value/bit consistency')
        key = tuple(row['pixel'])
        if key in duplicate:
            need(duplicate[key] == (row['heightKm'], row['bits']), 'Deduplicated texel mismatch')
        duplicate[key] = (row['heightKm'], row['bits'])
        lit = row['qLookupKm'] >= row['heightKm']
        need(lit == analysis['savedCpuLookupVsGpuHeightLit'], 'CPU q vs GPU height comparison')
        need(analysis['deltaGpuVsBaselineM'] == (row['heightKm'] - row['cpuBaselineKm']) * 1000
             and analysis['deltaGpuVsClippedM'] == (row['heightKm'] - row['cpuClippedKm']) * 1000,
             'Saved GPU-minus-reference deltas')
        lit_blocked += not row['physicallyLit'] and lit
        false_shadow += row['physicallyLit'] and not lit
    need(lit_blocked == a['CPUBlockedComparisonsLit'] == 3
         and false_shadow == a['CPUUnoccludedComparisonsShadowed'] == 0, 'Readback cross-comparison counts')
    files = inventory(root / 'gpu-readback', max_files=64)
    need(not any(k.endswith('.png') or k.endswith('.transfer.json') for k in files),
         'Diagnostic archive unexpectedly contains a second PNG/transfer')
    return {'savedGPURecords': 12, 'distinctR32FTexels': 11,
            'CPUBlockedCrossComparisonsLit': 3, 'CPUUnoccludedCrossComparisonsShadowed': 0,
            'gpuReceiverQOrWinnerOrFallbackRead': False,
            'diagnosticPNGIdentityDeclaredWithoutSecondTransfer': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', nargs='?', type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument('--runtime-source', type=Path)
    parser.add_argument('--trial-dist', type=Path)
    parser.add_argument('--diagnostic-dist', type=Path)
    args = parser.parse_args()
    root = args.archive.resolve()
    files = inventory(root)
    records = payload_records(read_json(root / 'MANIFEST.json'))
    need(set(records) == set(files) - {'MANIFEST.json'},
         'Global inventory mismatch: exclude ONLY root MANIFEST.json')
    for name, row in records.items():
        need(files[name].stat().st_size == row['bytes'] and sha(files[name]) == row['sha256'],
             f'Global payload hash/bytes: {name}')
    sources = source_checks(root, args.runtime_source.resolve() if args.runtime_source else None)
    tests_saved(root / 'qualification/test-results.json', 440, 47)
    tests_saved(root / 'clipping-validation/r2/test-results.json', 33, 1)
    checks_saved(root / 'qualification/checks.json', ['full-tests', 'app-build', 'hero-build'])
    checks_saved(root / 'gpu-readback/checks.json', ['typecheck', 'app-build', 'hero-build'])
    q = read_json(root / 'qualification/PROTOCOL.json')
    need(q['sourceCount'] == 128 and q['sourceManifestSHA256'] == TRIAL_SHA
         and q['expectedTests'] == 440 and q['expectedTestFiles'] == 47, 'Qualification protocol pin')
    caster = read_json(root / 'caster-proposal/RESULT.json')
    need(caster['tests']['passed'] == 8 and caster['tests']['exitCode'] == 0
         and caster['typecheck']['exitCode'] == 0
         and caster['preservedR1']['typecheckExit'] == 2, 'Caster saved PASS and preserved R1 failure')
    clip = read_json(root / 'clipping-validation/FINAL.json')
    need(clip['runtimeSHA256'] == CLIP_RUNTIME_SHA and clip['targetedTestsPassed'] == 33
         and clip['typecheckExitCode'] == 0, 'Clip qualification identity')
    original, images = image_checks(root)
    witness, witness_summary = saved_witness(root)
    intrinsic_summary = intrinsic(root)
    readback = gpu_readback(root, original, witness)
    need(read_json(root / 'browser/ordinary-restored-console.json') == [], 'Ordinary restored console')
    ordinary = read_json(root / 'browser/ordinary-restored-proof.json')
    need(ordinary['url'] == 'http://localhost:4196/?seed=74'
         and ordinary['profileExport'] == ordinary['readbackButton'] == 0
         and ordinary['console'] == [], 'Ordinary restored proof')
    trial_dist = optional_dist(root, 'qualification', args.trial_dist.resolve() if args.trial_dist else None)
    diagnostic_dist = optional_dist(root, 'gpu-readback', args.diagnostic_dist.resolve() if args.diagnostic_dist else None)
    print(json.dumps({'status': 'SAVED_EVIDENCE_PASS', 'checks': CHECKS,
        'payloadFiles': len(records), 'payloadBytes': sum(v['bytes'] for v in records.values()),
        'manifestSHA256': sha(root / 'MANIFEST.json'), 'sources': sources,
        'savedTests': {'passed': 440, 'files': 47, 'rerun': False},
        'native': images, 'witness': witness_summary, 'intrinsic': intrinsic_summary,
        'readback': readback, 'trialDist': trial_dist, 'diagnosticDist': diagnostic_dist,
        'ordinaryConsoleEntries': 0, 'modelOrShaderOrMeshReplay': False,
        'limits': ['Saved hashes/records and Pillow PNG comparisons only; no test/build/GPU execution.',
                   'Virtual source overlay without --runtime-source does not byte-verify unchanged base suffixes.',
                   'Transfer ledger checks saved counts/labels, not original DOM text-part contents.',
                   'Intrinsic controller was inline; this verifier does not claim an original saved launcher.',
                   'GPU R32F is compared against saved CPU q; no GPU receiver q, winner or fallback ID.',
                   'Not a physical-visibility, artistic, performance, lifecycle or adoption guarantee.']}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'status': 'SAVED_EVIDENCE_FAIL', 'checksBeforeFailure': CHECKS,
                          'error': f'{type(exc).__name__}: {exc}',
                          'scope': 'No model replay or retry; input files are never modified.'}), file=sys.stderr)
        raise SystemExit(1)
