"""Hash-only archive verification. No external large inputs, GPU or cloud bake."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
expected = set(manifest['payloads'])
actual = {str(p.relative_to(root)) for p in root.rglob('*')
          if p.is_file() and p.name != 'manifest.json'}
assert actual == expected, {'missing': sorted(expected - actual),
                            'unexpected': sorted(actual - expected)}
for relative, spec in manifest['payloads'].items():
    path = root / relative
    assert not path.is_symlink()
    raw = path.read_bytes()
    assert len(raw) == spec['bytes'], relative
    assert hashlib.sha256(raw).hexdigest() == spec['sha256'], relative
print('PASS archive payload SHA-256:', len(expected), 'files,',
      sum(v['bytes'] for v in manifest['payloads'].values()), 'bytes')
