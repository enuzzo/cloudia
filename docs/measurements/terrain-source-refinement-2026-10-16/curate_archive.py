"""Curate saved bytes only. No model imports, tests, build, browser or GPU.

Originals are immutable inputs. This script copies/compresses explicit paths and
checks a six-file unified patch in memory; it never executes the saved witness.
The independent verify_saved.py is prepared separately and is not invoked here.
"""
from pathlib import Path
import difflib
import gzip
import hashlib
import io
import json
import re

OUT = Path(__file__).resolve().parent
CYCLE = OUT.parent
BASE = CYCLE.parent / 'Cloudia-QA-2026-10-16-cycle27/source'
CANDIDATE = CYCLE / 'refine-source'
REPO = Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
ROWS = []
DEDUP = []


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(raw, encoding):
    if encoding == 'identity':
        return raw
    out = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', compresslevel=6, mtime=0, fileobj=out) as stream:
        stream.write(raw)
    packed = out.getvalue()
    if gzip.decompress(packed) != raw:
        raise RuntimeError('Lossless gzip roundtrip failed')
    return packed


def store(destination, raw, origin, encoding='identity', **extra):
    target = OUT / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    data = encoded(raw, encoding)
    target.write_bytes(data)
    row = {'path': destination, 'bytes': len(data), 'sha256': sha(data),
           'origin': {'path': str(origin), 'bytes': len(raw), 'sha256': sha(raw)},
           'encoding': encoding}
    row.update(extra)
    ROWS.append(row)


def copy(relative, destination=None, compress=False):
    origin = CYCLE / relative
    store(destination or relative, origin.read_bytes(), origin,
          'gzip' if compress else 'identity')


def generated(destination, raw, method, **extra):
    store(destination, raw, 'generated:' + method, generated=True, **extra)


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def apply_one_patch(old, diff):
    # Independent application of the produced diff; no candidate bytes used.
    lines = diff.splitlines(keepends=True)
    if not (len(lines) >= 3 and lines[0].startswith('--- ') and lines[1].startswith('+++ ')):
        raise RuntimeError('Invalid generated unified patch header')
    source = old.decode('utf8').splitlines(keepends=True)
    output, cursor, row = [], 0, 2
    while row < len(lines):
        match = re.fullmatch(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@\n', lines[row])
        if not match:
            raise RuntimeError('Unsupported unified hunk header')
        first, count = int(match[1]), int(match[2] or 1)
        start = first - 1 if count else first
        if start < cursor or start > len(source):
            raise RuntimeError('Overlapping/out-of-range hunk')
        output.extend(source[cursor:start])
        cursor, row = start, row + 1
        consumed = produced = 0
        while row < len(lines) and not lines[row].startswith('@@ '):
            operation, payload = lines[row][0], lines[row][1:]
            if operation in (' ', '-'):
                if cursor >= len(source) or source[cursor] != payload:
                    raise RuntimeError('Patch context/removal bytes mismatch')
                cursor += 1
                consumed += 1
            if operation in (' ', '+'):
                output.append(payload)
                produced += 1
            if operation not in (' ', '-', '+'):
                raise RuntimeError('Unsupported unified patch operation')
            row += 1
        if consumed != count or produced != int(match[4] or 1):
            raise RuntimeError('Unified patch hunk length mismatch')
    output.extend(source[cursor:])
    return ''.join(output).encode('utf8')


def main():
    base_manifest_path = CYCLE.parent / 'Cloudia-QA-2026-10-16-cycle27/source-manifest.json'
    candidate_manifest_path = CYCLE / 'refine-qualification-r1/source-manifest.json'
    base_raw, candidate_raw = base_manifest_path.read_bytes(), candidate_manifest_path.read_bytes()
    if sha(base_raw) != '21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2':
        raise RuntimeError('Base manifest pin mismatch')
    if sha(candidate_raw) != '83469d62c552db7bad9cbc175bf549f7b7c0bd8c0b113c137e484e1b4f315e00':
        raise RuntimeError('Candidate manifest pin mismatch')
    base_manifest, candidate_manifest = json.loads(base_raw), json.loads(candidate_raw)
    if len(base_manifest) != 124 or len(candidate_manifest) != 126 or set(base_manifest) - set(candidate_manifest):
        raise RuntimeError('Unexpected source inventory')
    before = {path: (BASE / path).read_bytes() for path in base_manifest}
    after = {path: (CANDIDATE / path).read_bytes() for path in candidate_manifest}
    if {path: sha(raw) for path, raw in before.items()} != base_manifest:
        raise RuntimeError('Base source byte hash mismatch')
    if {path: sha(raw) for path, raw in after.items()} != candidate_manifest:
        raise RuntimeError('Candidate source byte hash mismatch')
    changed = sorted(path for path in after if before.get(path) != after[path])
    expected = ['src/cumulonimbus/' + name for name in (
        'GPUSceneEngine.ts', 'lifecycle.test.ts', 'terrainMesh.test.ts',
        'terrainMesh.ts', 'terrainSplitTriangle.test.ts', 'terrainSplitTriangle.ts')]
    if changed != sorted(expected):
        raise RuntimeError('Unexpected candidate source changes')
    reconstructed, chunks, patch_rows = dict(before), [], []
    for path in changed:
        old, new = before.get(path, b''), after[path]
        if (old and not old.endswith(b'\n')) or not new.endswith(b'\n'):
            raise RuntimeError('Source requires explicit no-newline patch handling')
        diff = ''.join(difflib.unified_diff(old.decode().splitlines(keepends=True),
                                         new.decode().splitlines(keepends=True),
                                         fromfile='a/' + path if path in before else '/dev/null',
                                         tofile='b/' + path, n=3))
        reconstructed[path] = apply_one_patch(old, diff)
        if reconstructed[path] != new:
            raise RuntimeError('Generated patch failed exact in-memory reconstruction')
        chunks.append(diff)
        patch_rows.append({'path': path, 'beforeSHA256': sha(old) if path in before else None,
                           'afterSHA256': sha(new), 'afterBytes': len(new)})
        store('source/changed/' + path + '.gz', new, CANDIDATE / path, 'gzip')
    if {path: sha(raw) for path, raw in reconstructed.items()} != candidate_manifest:
        raise RuntimeError('Reconstructed126 source manifest differs')
    patch = ''.join(chunks).encode()
    store('source/candidate-vs-v58.patch.gz', patch,
          'generated:unified-diff-base124-to-candidate126', 'gzip', generated=True)
    generated('source/patch-reconstruction.json', json_bytes({
        'status': 'EXACT_IN_MEMORY_RECONSTRUCTION_PASS',
        'scope': 'Saved source bytes only; no source executed, no tests/build/model/GPU',
        'baseFiles': 124, 'candidateFiles': 126, 'changedFiles': 6,
        'modifiedExisting': 4, 'addedFiles': 2, 'removedFiles': 0,
        'unchangedCommonFiles': 120, 'allBaseAndCandidateFilesSHA256Verified': True,
        'all126ReconstructedFileHashesMatch': True,
        'baseManifestSHA256': sha(base_raw), 'candidateManifestSHA256': sha(candidate_raw),
        'patchRawBytes': len(patch), 'patchRawSHA256': sha(patch), 'files': patch_rows,
    }), 'source-byte-patch-check')
    store('source/base-manifest.json', base_raw, base_manifest_path)
    store('source/candidate-manifest.json', candidate_raw, candidate_manifest_path)
    copy('refine-proposal/terrain-refinement.patch', 'source/proposal-original.patch.gz', True)
    for name in ('MANIFEST.json', 'PROTOCOL.json', 'README.md', 'STATIC-REVIEW.md', 'static-review-solar.md'):
        copy('refine-proposal/' + name, 'proposal/' + name)
    copy('assemble-engine.py', 'source/assembly/assemble-engine.py')
    copy('assembly-r1-error.json', 'source/assembly/assembly-r1-error.json')
    copy('refine-decision-protocol.json', 'protocols/refine-decision-protocol.json')
    copy('refine-witness-independent-review.md', 'reviews/refine-witness-independent-review.md')
    for name in ('witness.ts', 'run.py', 'PROTOCOL.json', 'README.md', 'REVIEW-FREEZE.json', 'PRE-RUN-FREEZE.json', 'root-pre-run-review.md'):
        compress = name.endswith('.ts')
        copy('refine-witness/' + name, 'witness/' + name + ('.gz' if compress else ''), compress)
    for mode in ('off', 'on'):
        for name in ('errors.f64le', 'result.json', 'run.json', 'stdout.log', 'stderr.log'):
            compress = name != 'run.json'
            copy('refine-witness/run-' + mode + '/' + name,
                 'witness/' + mode + '/' + name + ('.gz' if compress else ''), compress)
    for name in ('verify.py', 'run.py', 'PROTOCOL.json', 'PRE-RUN-FREEZE.json', 'MANIFEST.json', 'README.md', 'result.json', 'run.json', 'stderr.log'):
        compress = name.endswith('.log')
        copy('refine-evidence-verification/' + name,
             'saved-stream-verification/' + name + ('.gz' if compress else ''), compress)
    for name in ('PROTOCOL.json', 'run.py', 'checks.json', 'dist-manifest.json', 'targeted-results.json', 'test-results.json', 'targeted-tests.log', 'full-tests.log', 'app-build.log', 'hero-build.log'):
        compress = name.endswith('.log') or name in ('targeted-results.json', 'test-results.json')
        copy('refine-qualification-r1/' + name, 'qualification/' + name + ('.gz' if compress else ''), compress)
    DEDUP.append({'origin': {'path': str(candidate_manifest_path), 'bytes': len(candidate_raw), 'sha256': sha(candidate_raw)},
                  'storedPath': 'source/candidate-manifest.json', 'logicalAlias': 'qualification/source-manifest.json'})
    for stem in ('refine-main-sun-native', 'refine-main-rain-native', 'refine-main-sunset-native', 'stable-main-sunset-native'):
        for suffix in ('.png', '.json', '-transfer.json'):
            copy('browser/' + stem + suffix)
    for suffix in ('.json', '-transfer.json'):
        copy('browser/refine-worker-sun-native' + suffix)
    worker = CYCLE / 'browser/refine-worker-sun-native.png'
    main = CYCLE / 'browser/refine-main-sun-native.png'
    worker_raw, main_raw = worker.read_bytes(), main.read_bytes()
    if worker_raw != main_raw:
        raise RuntimeError('Worker PNG is not byte-identical; cannot deduplicate')
    DEDUP.append({'origin': {'path': str(worker), 'bytes': len(worker_raw), 'sha256': sha(worker_raw)},
                  'storedPath': 'browser/refine-main-sun-native.png',
                  'logicalAlias': 'browser/refine-worker-sun-native.png',
                  'scope': 'Observed single saved PNG only; not universal main/worker parity'})
    for name in ('nativeSave28.js', 'saveStableNative28.js', 'root-sun-metadata-check.json',
                 'root-sun-metadata-differences.json', 'root-sun-review.md', 'independent-sun-review.md',
                 'independent-weather-compatibility.json', 'independent-weather-review.md', 'sunset-ab-review.md'):
        copy('browser/' + name)
    for name in ('refinement-cost-protocol.json', 'cost-validation-r1-rejected.json', 'cost-validation.json'):
        copy('browser/' + name, 'cost/' + name)
    for tag in ('A1', 'B', 'A2'):
        copy('browser/cost-' + tag + '-report.json', 'cost/cost-' + tag + '-report.json.gz', True)
        copy('browser/cost-' + tag + '-console.json', 'cost/cost-' + tag + '-console.json')
    reference_paths = [
        'docs/measurements/terrain-geometry-error-2026-10-16/MANIFEST.json',
        'docs/measurements/terrain-geometry-error-2026-10-16/preflight/run/result.json',
        'docs/measurements/triangle-shadow-trial-2026-10-16/MANIFEST.json',
        'docs/measurements/terrain-shadow-cache-2026-10-16/MANIFEST.json',
        'docs/measurements/terrain-shadow-cache-2026-10-16/browser/v58-main-sun-terrain-native-settled.png',
        'docs/measurements/terrain-shadow-cache-2026-10-16/browser/v58-main-sun-terrain-native-settled.json',
        'docs/measurements/terrain-shadow-cache-2026-10-16/browser/v58-rain-B-native.png',
        'docs/measurements/terrain-shadow-cache-2026-10-16/browser/v58-rain-B-native.json',
        'src/cumulonimbus/assets/liguria-apuane-dem.bin',
    ]
    references = []
    for relative in reference_paths:
        raw = (REPO / relative).read_bytes()
        references.append({'path': relative, 'bytes': len(raw), 'sha256': sha(raw), 'copied': False})
    generated('REFERENCES.json', json_bytes({'scope': 'Pinned existing repository payloads, not duplicated',
        'productAtCandidateQualification': '4047ace823ac0c8598e68c032d491a2a94b83a55',
        'references': references}), 'pinned-reference-inventory')
    # Own source is a payload too; never invoke verify_saved.py here.
    own = Path(__file__).resolve()
    store(own.name, own.read_bytes(), own)
    manifest = {'schema': 'cloudia-curated-evidence-v1', 'state': 'CURATION_IN_PROGRESS_VERIFIER_PENDING',
        'scope': 'Immutable external candidate evidence; no final adoption/version payload',
        'candidateSourceManifestSHA256': sha(candidate_raw),
        'files': sorted(ROWS, key=lambda row: row['path']), 'deduplicated': DEDUP,
        'selfPolicy': 'Manifest excludes itself; finalized after verifier and generated report/README are present.'}
    (OUT / 'MANIFEST.json').write_bytes(json_bytes(manifest))
    print(json.dumps({'status': 'CURATED_SAVED_BYTES_ONLY', 'payloads': len(ROWS),
                      'storedBytes': sum(row['bytes'] for row in ROWS),
                      'patchRawBytes': len(patch), 'patchRawSHA256': sha(patch),
                      'reconstructedCandidateFiles': 126, 'independentVerifierExecuted': False}))


if __name__ == '__main__':
    main()
