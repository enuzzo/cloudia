"""Integrity verification only. No image or product mutation."""
from pathlib import Path
import gzip
import hashlib
import json

base = Path(__file__).resolve().parent
manifest = json.loads((base / 'manifest.json').read_text())
seen = {}
for path in sorted(base.rglob('*')):
    assert not path.is_symlink(), f'Unexpected symlink: {path}'
    if not path.is_file() or path == base / 'manifest.json':
        continue
    data = path.read_bytes()
    seen[str(path.relative_to(base))] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
assert seen == manifest['files'], 'Archive payload list/bytes/SHA256 differ'
references = json.loads((base / 'input-references.json').read_text())
for relative, expected in references['compressedPayloadOriginals'].items():
    raw = gzip.decompress((base / relative).read_bytes())
    assert len(raw) == expected['uncompressedBytes']
    assert hashlib.sha256(raw).hexdigest() == expected['uncompressedSha256']
print(json.dumps(dict(status='PASS', payloads=len(seen), bytes=sum(item['bytes'] for item in seen.values()),
                      gzipOriginalsVerified=len(references['compressedPayloadOriginals']),
                      decision='Negative counterfactual; not promoted'), indent=2))
