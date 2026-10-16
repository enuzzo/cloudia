"""Read-only archive integrity check. No render, bake or numerical model run."""
from pathlib import Path
import gzip
import hashlib
import json

base = Path(__file__).resolve().parent
manifest = json.loads((base / 'manifest.json').read_text())
observed = {}
for path in sorted(base.rglob('*')):
    assert not path.is_symlink(), f'Unexpected symlink: {path}'
    if not path.is_file() or path == base / 'manifest.json':
        continue
    data = path.read_bytes()
    observed[str(path.relative_to(base))] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
assert observed == manifest['files'], 'Payload list, size or SHA256 differs'
provenance = json.loads((base / 'provenance.json').read_text())
for relative, expected in provenance['losslessGzipOriginals'].items():
    data = gzip.decompress((base / relative).read_bytes())
    assert len(data) == expected['bytes'], f'Original size {relative}'
    assert hashlib.sha256(data).hexdigest() == expected['sha256'], f'Original SHA {relative}'
inner = json.loads((base / 'preclamp/manifest.json').read_text())
for relative, expected in inner['files'].items():
    assert observed['preclamp/' + relative] == expected, f'Inner proof differs: {relative}'
print(json.dumps(dict(status='PASS', payloads=len(observed),
                      bytes=sum(item['bytes'] for item in observed.values()),
                      gzipOriginals=len(provenance['losslessGzipOriginals']),
                      scope='File integrity only; no numerical replay or artistic acceptance'), indent=2))
