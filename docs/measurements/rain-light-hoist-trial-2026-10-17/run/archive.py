"""Copy explicit saved evidence and four source deltas; never run the product."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

workspace = Path(__file__).resolve().parent.parent
repository = Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
archive = repository / 'docs/measurements/rain-light-hoist-trial-2026-10-17'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
base = json.loads((workspace / 'run/source-baseline141.json').read_text())
candidate = json.loads((workspace / 'run/SOURCE-FREEZE-R1.json').read_text())
assert len(base) == len(candidate) == 141
for name in base:
    assert sha(repository / name) == base[name], name
    assert sha(workspace / 'candidate-source' / name) == candidate[name], name
for folder in ('run', 'review', 'browser'):
    for source in sorted((workspace / folder).iterdir()):
        if not source.is_file():
            continue  # Durable part directories remain external; full exports and ledgers are copied.
        assert not source.is_symlink()
        target = archive / folder / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            assert target.read_bytes() == source.read_bytes(), str(target)
        else:
            shutil.copyfile(source, target)
for name in base:
    if base[name] == candidate[name]:
        continue
    target = archive / 'source-overlay' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    source = workspace / 'candidate-source' / name
    if target.exists():
        assert target.read_bytes() == source.read_bytes()
    else:
        shutil.copyfile(source, target)
payload = {}
stack = [(archive, 0)]
while stack:
    folder, depth = stack.pop()
    assert depth < 10
    for path in sorted(folder.iterdir()):
        assert not path.is_symlink()
        if path.is_dir():
            stack.append((path, depth + 1))
        elif path.name != 'MANIFEST.json':
            name = str(path.relative_to(archive))
            payload[name] = {'bytes': path.stat().st_size, 'sha256': sha(path)}
            assert len(payload) < 250
manifest = {
    'kind': 'Saved literal wet light-hoist trial, rejected by prefixed practical FPS gate',
    'canonicalVersion': 'observatory-v61-observed-terrain-material',
    'candidateVersion': 'experiment-v61-rain-light-hoist-r1',
    'canonicalSourceManifestSHA256': sha(workspace / 'run/source-baseline141.json'),
    'candidateSourceManifestSHA256': sha(workspace / 'run/SOURCE-FREEZE-R1.json'),
    'candidateAdopted': False, 'payload': dict(sorted(payload.items())),
}
manifest_path = archive / 'MANIFEST.json'
assert not manifest_path.exists(), 'Do not rewrite a frozen archive manifest'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'manifestSHA256': sha(manifest_path), 'payloadFiles': len(payload),
                  'payloadBytes': sum(row['bytes'] for row in payload.values())}))
