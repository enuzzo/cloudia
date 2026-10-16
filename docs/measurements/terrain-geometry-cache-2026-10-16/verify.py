"""Read-only archive verification. No renderer, GPU, external paths or writes.

The archived GPU reports contain hashes and compact statistics, not raw GPU
buffers. Checks below validate report invariants and recorded sample bits;
they cannot recompute full-buffer GPU metrics from a SHA256 digest.
"""
from pathlib import Path, PurePosixPath
import gzip
import hashlib
import io
import json
import math
import struct
import tarfile

ROOT = Path(__file__).resolve().parent
BASE = '10493afa7f6d90389c39e17b2cad79397dfdac01'
DEFAULT = '59523937da9df384aa57345fb99c758cee70bc83c5ada8d3084038dfa416f546'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def close(left, right):
    return math.isclose(left, right, rel_tol=1e-12, abs_tol=1e-20)


def safe_name(name):
    path = PurePosixPath(name)
    require(name and not path.is_absolute() and '..' not in path.parts, 'Unsafe archive path')
    return name


def raw(relative):
    return gzip.decompress((ROOT / safe_name(relative)).read_bytes())


def gzjson(relative):
    return json.loads(raw(relative))


def verify_storage():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    require(manifest['schemaVersion'] == 1 and manifest['status'] == 'retired-not-promoted', 'Archive decision/schema')
    require(manifest['baselineCommit'] == BASE, 'Archive baseline')
    entries = manifest['files']
    require(len(entries) == manifest['payloadCount'] and len(entries) <= 256, 'Payload count')
    index = {safe_name(entry['path']): entry for entry in entries}
    require(len(index) == len(entries) and 'manifest.json' not in index and 'verify.py' in index, 'Duplicate/self/missing verifier entry')
    actual = set()
    for path in ROOT.rglob('*'):
        require(not path.is_symlink(), 'Symlink in archive')
        if path.is_file() and path.name != 'manifest.json':
            actual.add(path.relative_to(ROOT).as_posix())
    require(actual == set(index), 'Archive file set differs from manifest')
    require(sum(e['bytes'] for e in entries) == manifest['totalPayloadBytes'], 'Payload byte total')
    members = {}
    for name, entry in index.items():
        data = (ROOT / name).read_bytes()
        require(len(data) == entry['bytes'] and sha(data) == entry['sha256'], 'Stored payload differs: ' + name)
        encoding = entry['encoding']
        require(encoding in ('identity', 'gzip', 'tar.gz'), 'Unknown encoding: ' + name)
        if encoding != 'identity':
            decoded = gzip.decompress(data)
            if 'originalBytes' in entry:
                require(len(decoded) == entry['originalBytes'] and sha(decoded) == entry['originalSha256'], 'Original gzip bytes differ: ' + name)
            if encoding == 'tar.gz':
                expected = {safe_name(item['path']): item for item in entry['members']}
                with tarfile.open(fileobj=io.BytesIO(decoded), mode='r:') as archive:
                    items = archive.getmembers()
                    require(all(item.isfile() for item in items), 'Non-file tar member')
                    require(len(items) == len(expected) and {safe_name(item.name) for item in items} == set(expected), 'Tar member set differs')
                    for item in items:
                        content = archive.extractfile(item).read()
                        record = expected[item.name]
                        require(len(content) == record['bytes'] and sha(content) == record['sha256'], 'Original tar member differs: ' + item.name)
                        members[item.name] = content
    provenance = json.loads((ROOT / 'storage-provenance.json').read_text())
    for original in provenance['originals']:
        entry = index[original['path']]
        for key, value in original.items():
            if key != 'externalOriginal':
                require(entry[key] == value, 'Provenance differs: ' + original['path'])
    return members


def verify_sources(members):
    manifests = {tag: gzjson('source/' + filename) for tag, filename in (
        ('baseline', 'baseline-manifest.json.gz'), ('r1', 'r1-source-manifest.json.gz'), ('r2', 'r2-source-manifest.json.gz'))}
    files = {tag: {item['path']: item for item in manifest['files']} for tag, manifest in manifests.items()}
    require([len(files[tag]) for tag in ('baseline', 'r1', 'r2')] == [108, 116, 116], 'Source counts')
    changed = {name for name in files['r1'] if files['r1'][name] != files['r2'][name]}
    helpers = {'src/cumulonimbus/terrainCacheWitness.ts', 'src/cumulonimbus/terrainCacheWitness.test.ts'}
    require(set(files['r1']) == set(files['r2']) and changed == helpers, 'R2 changed more than witness and tests')
    original_changes = {name for name in files['r1'] if name not in files['baseline'] or files['r1'][name] != files['baseline'][name]}
    require(original_changes == set(manifests['r1']['changedOrAddedPaths']) and len(original_changes) == 11, 'R1 change scope')
    expected = {'baseline/' + name for name in original_changes if name in files['baseline']}
    expected |= {'r1/' + name for name in original_changes} | {'r2/' + name for name in helpers}
    require(set(members) == expected and len(members) == 16, 'Changed source tar coverage')
    for path, content in members.items():
        tag, name = path.split('/', 1)
        entry = files[tag][name]
        require(len(content) == entry['bytes'] and sha(content) == entry['sha256'], 'Source manifest/member mismatch: ' + path)
    original_shader = members['baseline/src/cumulonimbus/cloudShader.ts']
    require(sha(original_shader) == '652c9514b7dfcee1456d15e9966087b3ff9c6a6ce9741970208cfca3750a248c', 'Baseline shader provenance')
    for name in ('GPUSceneEngine.ts', 'cloudShader.ts', 'terrainGeometry.ts'):
        path = 'src/cumulonimbus/' + name
        require(files['r1'][path] == files['r2'][path], 'Engine/shader/geometry changed in R2')
    first = gzjson('source/r1-template-witnesses.json.gz')
    second = gzjson('source/r2-template-witnesses.json.gz')
    require(first == second, 'R1/R2 emitted contracts differ')
    rows = first['rows']
    require(len(rows) == 24 and {(r['mode'], r['narrow'], r['r8']) for r in rows} == {(m, n, r) for m in range(6) for n in (False, True) for r in (False, True)}, 'WGSL variant coverage')
    for row in rows:
        require(row['baselineSha256'] == row['directSha256'] == row['restoredCachedSha256'], 'Direct/restored WGSL differs')
        require(len(row['baselineLibrarySha256']) == 6 and row['baselineLibrarySha256'] == row['directLibrarySha256'] == row['cachedLibrarySha256'][:6], 'WGSL original include libraries differ')
        require(row['cachedLibrarySha256'][6:] == [first['cachedColorSha256']], 'Cached include scope')
    default = next(row for row in rows if row['mode'] == 0 and not row['narrow'] and not row['r8'])
    require(default['directSha256'] == DEFAULT, 'Original direct default golden SHA')
    load = 'textureLoad(terrainGeometry,vec2<i32>(floor(uv*resolution)),0)'
    for narrow in (False, True):
        for r8 in (False, True):
            suffix = f'-n{int(narrow)}-r{int(r8)}.wgsl.gz'
            codes = {tag: raw('source/emitted/' + tag + suffix).decode() for tag in ('baseline', 'direct', 'cached')}
            row = next(row for row in rows if row['mode'] == 0 and row['narrow'] == narrow and row['r8'] == r8)
            for tag in codes:
                require(sha(codes[tag].encode()) == row[tag + 'Sha256'], 'Archived emitted WGSL hash')
            require(codes['direct'] == codes['baseline'], 'Archived direct WGSL bytes')
            restored = codes['cached']
            for old, new in (
                ('inspection:f32, ground:f32, terrainGeometry:texture_2d<f32>,', 'inspection:f32, ground:f32,'),
                ('let geometry=' + load + ';\n  var groundDistance=geometry.x;', 'var groundDistance=earthDistance(origin,ray);'),
                ('if(groundDistance>=0.0 && groundAmount>0.001){', 'if(groundDistance>0.0 && groundAmount>0.001){\n    groundDistance=landscapeDistance(origin,ray,groundDistance);'),
                ('landscapeColorCached(origin+ray*groundDistance,groundDistance,sun,solarColor,ambientColor,sky,weather.x,geometry.yzw)', 'landscapeColor(origin+ray*groundDistance,groundDistance,sun,solarColor,ambientColor,sky,weather.x)')):
                require(restored.count(old) == 1, 'Cached source contract occurrence')
                restored = restored.replace(old, new)
            require(restored == codes['baseline'], 'Cached inverse changes more than geometry cache')
    for revision, expected_tests in (('r1', 115), ('r2', 127)):
        validation = gzjson(f'source/{revision}-validation.json.gz')
        require(validation['finalFocused']['passed'] == expected_tests and validation['finalFocused']['failed'] == 0, 'Recorded focused tests')
        for kind in ('finalFocused', 'typecheck', 'build'):
            completion = validation[kind]['completion']
            while 'value' in completion:
                completion = completion['value']
            require(completion['exit_code'] == 0, 'Recorded validation failed')


def verify_fps():
    missing = (2, 4, 2, 6, 12, 4)
    names = ['terrain-fps-' + label for label in ('A1', 'B', 'A2')] + ['terrain-sun-fps-' + label for label in ('A1', 'B', 'A2')]
    rates, camera = [], None
    for index, name in enumerate(names):
        report = gzjson('browser/' + name + '.json.gz')
        require(report['internal'] == report['output'] == [2112, 1844] and report['quality'] == 'ultra' and report['nominalSteps'] == 384, 'FPS raster/quality')
        require(report['seed'] == 72 and report['executionThread'] == 'main' and report['paused'] and not report['orbit'], 'FPS scenario')
        require(report['volume'] == [256] * 3 and report['detailVolume'] == [128] * 3 and report['outputMode'] == 'screen', 'FPS volumes/native output')
        if camera is None:
            camera = report['camera']
        require(report['camera'] == camera and camera['ground'] == 1, 'FPS exact fixed camera')
        require(report['flowMode'] == report['ablation'] == 'full' and report['simulationTimeStart'] == report['simulationTimeEnd'] == 60, 'FPS work/time')
        require(report['flashCountStart'] == report['flashCountEnd'] == report['skippedFrames'] == 0, 'FPS flashes/skips')
        require(report['sun'] == 'left' and report['sunsetAmount'] == 0, 'FPS solar endpoint')
        require(report['presentedCanvasFps'] is None, 'Unmeasured presentation changed')
        require(report['weather']['sky'] == ('rain' if index < 3 else 'clear') and not report['skyPending'], 'FPS settled sky')
        require(report['weather']['atmosphereTransition'] == 1 and report['weather']['wind'] == .55 and report['weather']['dispersion'] == 0 and not report['weather']['autoLightning'], 'FPS settled weather/forcing')
        require(abs(report['weather']['rain'] - .8) < 1e-6 if index < 3 else report['weather']['rain'] < .001, 'FPS rain gate')
        expected_variant = 'rain' if index < 3 else 'dry'
        expected_density = 'r8unorm-extracted-r' if index < 3 else 'macro-rgba8-r'
        require(report['narrowCloudSkip']['specialization'] == report['narrowCloudSpecializationEnd'] == expected_variant, 'FPS specialization start/end')
        require(report['narrowCloudSkip']['boundInIntegrator'] == (index < 3), 'FPS narrow binding')
        require(report['densitySamplingStart']['path'] == report['densitySamplingEnd']['path'] == expected_density, 'FPS density path start/end')
        for clock in ('clockStateStart', 'clockStateEnd'):
            require(report[clock]['forcingTime'] == report[clock]['precipitationUniformTime'] == 0, 'Paused precipitation clock')
        intervals, stats = report['frameIntervalsMs'], report['stats']
        require(len(intervals) == stats['frames'] and all(math.isfinite(t) and t > 0 for t in intervals), 'FPS interval count/domain')
        require(math.isclose(sum(intervals), stats['durationMs'], abs_tol=1e-6), 'FPS interval sum')
        rate = 1000 * len(intervals) / sum(intervals)
        require(close(rate, stats['fps']) and close(rate, report['submissionFps']), 'FPS recomputation')
        require(stats['over18Ms'] == sum(t > 18 for t in intervals) and stats['over33Ms'] == sum(t > 33 for t in intervals), 'FPS tail counts')
        prefix = report['queuePrefix']
        require(prefix['status'] == 'completed' and prefix['unconfirmedMeasuredFrames'] == 0 and prefix['confirmedPrefixId'] == prefix['measuredSubmissions'] == stats['frames'], 'Incomplete FPS prefix')
        end = [sample for sample in prefix['samples'] if sample['kind'] == 'end']
        require(len(end) == 1 and end[0]['status'] == 'completed' and end[0]['prefixId'] == stats['frames'], 'FPS end prefix')
        require(close(end[0]['latencyMs'], prefix['endDrainMs']) and close(1000 * stats['frames'] / (end[0]['resolvedAtMs'] - prefix['windowStartedAtMs']), prefix['completionBoundedSubmissionFps']), 'FPS completion-bound rate')
        timestamps = report['timestampPasses']
        require(timestamps['status'] == 'closed', 'Timestamp collector not closed')
        for kind, passes in (('render', 2), ('compute', 1)):
            coverage = timestamps['coverage'][kind]
            require(coverage['measuredDraws'] == stats['frames'] and coverage['expectedCalls'] == passes * stats['frames'], 'Timestamp draw scope')
            require(coverage['missingDraws'] == missing[index] and coverage['completeDraws'] + coverage['missingDraws'] == stats['frames'], 'Timestamp missing coverage')
            require(coverage['matchedFreshCalls'] == coverage['completeDraws'] * passes, 'Timestamp pass coverage')
            require(all(coverage[key] == 0 for key in ('partialDraws', 'invalidLedgerDraws', 'conflictDraws')), 'Timestamp incomplete/invalid ledger')
        for key in ('invalidPassRows', 'ambiguousPassRows', 'duplicateUidRows', 'duplicateCallSlots'):
            require(timestamps['diagnostics'][key] == 0, 'Timestamp diagnostic: ' + key)
        if index >= 3:
            require(stats['frames'] == 1800 and stats['over18Ms'] == 0, 'Sun run count/tail')
        if index in (1, 4):
            start, finish = report['terrainGeometryCache'], report['terrainGeometryCacheEnd']
            require(start['state']['phase'] == finish['state']['phase'] == 'valid', 'Candidate cache not hot at start/end')
            require(start['state']['key'] == finish['state']['key'] and start['bytes'] == finish['bytes'] == 2112 * 1844 * 16, 'Candidate cache key/raster changed')
            for counter in ('prepasses', 'directFrames', 'allocations', 'disposals'):
                require(start[counter] == finish[counter], 'Candidate cache rebuilt/fell back during measurement')
            require(start['state']['failures'] == finish['state']['failures'] == 0, 'Candidate cache failure')
            require(finish['cachedFrames'] - start['cachedFrames'] >= stats['frames'], 'Candidate cached-frame coverage, including warmup')
        rates.append(rate)
    require(0 < 100 * (rates[1] / rates[2] - 1) < 5, 'Rain trial decision gate')
    print('FPS: six complete prefixes; rain B/A2 improvement %.7f%%, below 5%% gate.' % (100 * (rates[1] / rates[2] - 1)))


def ordered(bits):
    return 0x80000000 - (bits - 0x80000000) if bits >= 0x80000000 else 0x80000000 + bits


def verify_position(position, width, channels):
    index = position['index']
    require(0 <= index < channels and position['channel'] == index % 4 and position['pixelIndex'] == index // 4, 'Raw record index')
    require(position['x'] == index // 4 % width and position['y'] == index // 4 // width, 'Raw record raster position')
    values, bit_values = [], []
    for variant in ('reference', 'candidate'):
        item = position[variant]
        bits = int(item['uintHex'], 16)
        value = struct.unpack('>f', struct.pack('>I', bits))[0]
        require(math.isfinite(value) and value == item['float'], 'Recorded sample bits/value')
        values.append(value)
        bit_values.append(bits)
    if 'absoluteError' in position:
        require(close(abs(values[0] - values[1]), position['absoluteError']), 'Maximum sample absolute error')
        require(abs(ordered(bit_values[0]) - ordered(bit_values[1])) == position['ulpDistance'], 'Maximum sample ULP')


def verify_numeric(stage):
    numeric = stage['numeric']
    for scope, channels in (('rgba', range(4)), ('rgb', range(3))):
        total = numeric[scope]
        parts = [numeric['perChannel'][channel] for channel in channels]
        require(total['finitePairs'] == sum(part['finitePairs'] for part in parts), 'Numeric finite denominator')
        require(total['bitMismatches'] == sum(part['bitMismatches'] for part in parts), 'Numeric bit mismatch sum')
        require(close(total['rmse'], math.sqrt(sum(part['rmse'] ** 2 * part['finitePairs'] for part in parts) / total['finitePairs'])), 'Numeric RMSE channel invariant')
        require(total['maxAbsoluteError'] == max(part['maxAbsoluteError'] for part in parts) and total['maxUlpDistance'] == max(part['maxUlpDistance'] for part in parts), 'Numeric maxima channel invariant')
    require(numeric['rgba']['bitMismatches'] == stage['mismatchedChannels'], 'Full-buffer bit mismatch count')
    for item in [numeric['rgba'], numeric['rgb']] + numeric['perChannel']:
        require(item['nonFinitePairs'] == 0 and sum(bin['count'] for bin in item['ulpHistogram']) == item['finitePairs'], 'Numeric histogram denominator')
        for key in ('maxAbsoluteAt', 'maxUlpAt'):
            if item[key] is not None:
                verify_position(item[key], stage['width'], stage['channelCount'])
    quant = stage['quantization']
    if quant is None:
        return
    pixels = stage['pixelCount']
    require(quant['eligiblePixels'] + quant['excludedPixels'] == pixels and quant['excludedChannels'] == quant['excludedPixels'] * 3 and quant['alphaChannelsExcluded'] == pixels, 'Quantization scope/exclusion')
    require(quant['invalidChannels'] == quant['excludedChannels'] == 0 and quant['rgbChannels'] == pixels * 3, 'Quantization invalid data')
    for name in ('linear8', 'srgb8'):
        item = quant[name]
        require(item['comparedChannels'] == pixels * 3 == sum(bin['count'] for bin in item['deltaHistogram']), 'Quantization histogram denominator')
        require(item['mismatchedChannels'] == sum(bin['count'] for bin in item['deltaHistogram'] if bin['delta']) == sum(part['mismatchedChannels'] for part in item['perChannel']), 'Quantization mismatch counts')
        require(item['mismatchedPixels'] <= item['mismatchedChannels'] <= 3 * item['mismatchedPixels'], 'Quantization pixel counts')
        require(item['maxDelta'] == max(part['maxDelta'] for part in item['perChannel']) == max(bin['delta'] for bin in item['deltaHistogram']), 'Quantization max delta')


def verify_witnesses():
    reports = [gzjson('browser/' + name + '.json.gz') for name in ('terrain-witness-r1-main', 'terrain-witness-r2-main', 'terrain-witness-r2-sun-main')]
    for index, report in enumerate(reports):
        require(report['status'] == 'FAIL' and report['validationError'] is None and report['internal'] == [2112, 1844], 'Witness decision/raster')
        require(report['cacheSource'] == 'existing valid cache preserved' and report['before']['state']['phase'] == 'valid' and report['before']['state']['key'] == report['key'], 'Witness cache provenance')
        for stage_name in ('geometry', 'render'):
            stage = report[stage_name]
            require(stage['channelCount'] == stage['pixelCount'] * 4 == stage['width'] * stage['height'] * 4 == 15578112, 'Witness full-grid count')
            for variant in ('reference', 'candidate'):
                stats = stage[variant]
                require(stats['finiteChannels'] == stage['channelCount'] and stats['nanChannels'] == stats['infiniteChannels'] == stats['sentinelChannels'] == 0, 'Witness invalid/raw coverage')
            for position in stage['firstDiffs']:
                verify_position(position, stage['width'], stage['channelCount'])
            if index:
                verify_numeric(stage)
        geometry = report['geometry']
        require(geometry['bitEqual'] and geometry['mismatchedChannels'] == geometry['mismatchedPixels'] == 0 and geometry['reference']['sha256'] == geometry['candidate']['sha256'], 'Geometry cache preservation')
        counts = geometry['reference']['geometry']
        require(counts == geometry['candidate']['geometry'] and counts['hitPixels'] + counts['missPixels'] == geometry['pixelCount'] and counts['tZeroPixels'] == counts['invalidDistancePixels'] == 0, 'Geometry hit/miss/t0 scope')
        require(not report['render']['bitEqual'] and report['render']['status'] == 'fail', 'Raw render parity must remain FAIL')
        for priming in report['priming'].values():
            if priming is not None:
                require(priming['channels'] == priming['matched'] == 15578112, 'Witness sentinel priming')
        require(all(value == 15578112 for value in report['written'].values()), 'Witness written-channel counts')
    for stage in ('geometry', 'render'):
        for variant in ('reference', 'candidate'):
            require(reports[0][stage][variant]['sha256'] == reports[1][stage][variant]['sha256'], 'R1/R2 rain raw SHA differs')
    for report, ulp, channels, pixels, linear, srgb in ((reports[1], 14, 95690, 69186, 0, 0), (reports[2], 18, 165543, 114092, 2, 1)):
        render = report['render']
        require(render['mismatchedChannels'] == channels and render['mismatchedPixels'] == pixels and render['numeric']['rgba']['maxUlpDistance'] == ulp, 'Recorded R2 render maxima/counts')
        require(render['numeric']['rgba']['maxAbsoluteError'] == 1.7881393432617188e-7, 'Recorded R2 maximum absolute error')
        require(render['quantization']['linear8']['mismatchedChannels'] == linear and render['quantization']['srgb8']['mismatchedChannels'] == srgb, 'Recorded derived RGB8 differences')
        require(report['geometry']['referenceRole'] == 'fresh prepass output' and report['geometry']['candidateRole'] == 'stored prepass via textureLoad' and 'Does not compare' in report['geometry']['scopeLimit'], 'Geometry witness exactness limitation')


def verify():
    members = verify_storage()
    verify_sources(members)
    verify_fps()
    verify_witnesses()
    print('PASS: stored payloads, lossless gzip/tar bytes, source contracts, six FPS reports and three captured witness invariants.')
    print('Trial retired, not promoted. No raw GPU buffers stored: full-buffer metrics cannot be recomputed from their SHA256. No GPU rerun or compositor/presentation proof; t=0 remains unqualified.')


if __name__ == '__main__':
    verify()
