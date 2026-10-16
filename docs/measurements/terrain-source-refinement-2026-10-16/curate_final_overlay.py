"""Append the separately qualified final tag to saved candidate evidence only.
No model, tests, build, browser, GPU or independent verifier is executed.
"""
from pathlib import Path
import difflib
import gzip
import hashlib
import io
import json

OUT = Path(__file__).resolve().parent
CYCLE = OUT.parent


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    path = OUT / 'MANIFEST.json'
    inventory = json.loads(path.read_text())
    rows = inventory['files']
    existing = {row['path'] for row in rows}

    def add(destination, raw, origin, compress=False, **extra):
        if destination in existing:
            raise RuntimeError('Final overlay cannot overwrite candidate payload: ' + destination)
        if compress:
            data = io.BytesIO()
            with gzip.GzipFile(filename='', mode='wb', compresslevel=6, mtime=0, fileobj=data) as stream:
                stream.write(raw)
            stored = data.getvalue()
            if gzip.decompress(stored) != raw:
                raise RuntimeError('Final gzip roundtrip failed')
        else:
            stored = raw
        q = OUT / destination
        q.parent.mkdir(parents=True, exist_ok=True)
        q.write_bytes(stored)
        row = {'path': destination, 'bytes': len(stored), 'sha256': sha(stored),
               'origin': {'path': str(origin), 'bytes': len(raw), 'sha256': sha(raw)},
               'encoding': 'gzip' if compress else 'identity'}
        row.update(extra)
        rows.append(row)
        existing.add(destination)

    candidate_path = CYCLE / 'refine-qualification-r1/source-manifest.json'
    final_path = CYCLE / 'final-source-manifest.json'
    candidate = json.loads(candidate_path.read_bytes())
    final_raw = final_path.read_bytes()
    final = json.loads(final_raw)
    if sha(final_raw) != 'fb6c231918e7a825f5b1a407efcd98aaacf5cca352c60cbdcdb9b5271a913ff2':
        raise RuntimeError('Final source manifest mismatch')
    changed = sorted(path for path in final if final[path] != candidate.get(path))
    if len(candidate) != 126 or len(final) != 126 or set(final) != set(candidate) or changed != [
            'src/cumulonimbus/GPUSceneEngine.ts', 'src/cumulonimbus/lifecycle.test.ts']:
        raise RuntimeError('Unexpected final overlay scope')
    old = b'experiment-v58-source-node-refinement'
    new = b'observatory-v59-terrain-source-refinement'
    chunks, checks = [], []
    for relative in changed:
        a = (CYCLE / 'refine-source' / relative).read_bytes()
        bpath = CYCLE / 'final-source' / relative
        b = bpath.read_bytes()
        if sha(a) != candidate[relative] or sha(b) != final[relative] or a.count(old) != 1 or a.replace(old, new) != b:
            raise RuntimeError('Final overlay is not exactly one version literal per file')
        add('final/changed/' + relative + '.gz', b, bpath, True)
        chunks.extend(difflib.unified_diff(a.decode().splitlines(keepends=True), b.decode().splitlines(keepends=True),
                                         fromfile='a/' + relative, tofile='b/' + relative, n=3))
        checks.append({'path': relative, 'candidateSHA256': sha(a), 'finalSHA256': sha(b),
                       'onlyChange': 'One renderer-version literal replacement'})
    patch = ''.join(chunks).encode()
    add('final/candidate-to-final.patch.gz', patch, 'generated:candidate-to-final-two-version-literals', True, generated=True)
    add('final/source-manifest.json', final_raw, final_path)
    add('final/adoption-source-record.json', (CYCLE / 'adoption-source-record.json').read_bytes(), CYCLE / 'adoption-source-record.json')
    add('final/overlay-byte-check.json', (json.dumps({'status': 'EXACT_TWO_LITERAL_OVERLAY_PASS',
        'candidateFiles': 126, 'finalFiles': 126, 'unchangedFileHashes': 124,
        'changed': checks, 'scope': 'Saved source byte comparison only; no runtime execution'}, indent=2) + '\n').encode(),
        'generated:final-overlay-source-byte-check', generated=True)
    for name in ('PROTOCOL.json', 'run.py', 'checks.json', 'dist-manifest.json', 'test-results.json',
                 'full-tests.log', 'app-build.log', 'hero-build.log'):
        origin = CYCLE / 'final-qualification' / name
        compress = name.endswith('.log') or name == 'test-results.json'
        add('final/qualification/' + name + ('.gz' if compress else ''), origin.read_bytes(), origin, compress)
    qmanifest = CYCLE / 'final-qualification/source-manifest.json'
    if qmanifest.read_bytes() != final_raw:
        raise RuntimeError('Final qualification source manifest differs')
    inventory['deduplicated'].append({'origin': {'path': str(qmanifest), 'bytes': len(final_raw), 'sha256': sha(final_raw)},
                                     'storedPath': 'final/source-manifest.json', 'logicalAlias': 'final/qualification/source-manifest.json'})
    for name in ('v59-main-sun-native.json', 'v59-main-sun-native-transfer.json', 'saveFinalNative28.js',
                 'ordinary-v59-preview.jpg', 'ordinary-v59-proof.json', 'ordinary-v59-state.txt'):
        origin = CYCLE / 'browser' / name
        add('browser/' + name, origin.read_bytes(), origin)
    png = CYCLE / 'browser/v59-main-sun-native.png'
    raw = png.read_bytes()
    if raw != (OUT / 'browser/refine-main-sun-native.png').read_bytes():
        raise RuntimeError('Final native PNG differs; cannot deduplicate')
    inventory['deduplicated'].append({'origin': {'path': str(png), 'bytes': len(raw), 'sha256': sha(raw)},
        'storedPath': 'browser/refine-main-sun-native.png', 'logicalAlias': 'browser/v59-main-sun-native.png',
        'scope': 'Actual final native Sun bitmap; single observed pose, not all-state/version equivalence'})
    revision = OUT / 'verifier-revisions/r1/verify_saved.py.gz'
    raw = gzip.decompress(revision.read_bytes())
    if sha(raw) != '883ebf5fe05808f4ce0afafe08fec7388e1bcad9fe5dd517f6953d0e7a9fafb5':
        raise RuntimeError('Prepared verifier R1 preservation differs')
    rows.append({'path': 'verifier-revisions/r1/verify_saved.py.gz', 'bytes': revision.stat().st_size,
                 'sha256': sha(revision.read_bytes()),
                 'origin': {'path': 'generated:prepared-verifier-r1-before-final-overlay', 'bytes': len(raw), 'sha256': sha(raw)},
                 'encoding': 'gzip', 'generated': True, 'executionState': 'PREPARED_UNEXECUTED'})
    own = Path(__file__).resolve()
    add(own.name, own.read_bytes(), own)
    inventory['state'] = 'FINAL_OVERLAY_CURATED_VERIFIER_R2_PENDING'
    inventory['scope'] = 'Immutable candidate evidence plus separately identified two-literal final v59 overlay'
    inventory['finalSourceManifestSHA256'] = sha(final_raw)
    inventory['files'] = sorted(rows, key=lambda row: row['path'])
    path.write_text(json.dumps(inventory, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'status': 'FINAL_OVERLAY_BYTES_CURATED', 'payloads': len(rows),
                      'storedBytes': sum(row['bytes'] for row in rows), 'verifierExecuted': False}))


if __name__ == '__main__':
    main()
