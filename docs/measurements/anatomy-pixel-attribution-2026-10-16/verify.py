#!/usr/bin/env python3
"""Read the original audit archive without extraction or numeric reruns."""
import hashlib
import json
import tarfile
from pathlib import Path, PurePosixPath

root = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
outer = json.loads((root / 'manifest.json').read_text())
for row in outer['files']:
    data = (root / row['path']).read_bytes()
    assert len(data) == row['bytes'] and sha(data) == row['sha256'], row['path']
provenance = json.loads((root / 'provenance.json').read_text())
archive = root / 'original-audit.tar.gz'
assert sha(archive.read_bytes()) == provenance['archiveSHA256']
with tarfile.open(archive) as tar:
    members = tar.getmembers()
    names = [member.name for member in members]
    assert len(members) == len(set(names)) == 29
    for member in members:
        path = PurePosixPath(member.name)
        assert member.isfile() and not path.is_absolute() and '..' not in path.parts
    raw = tar.extractfile('evidence-manifest.json').read()
    assert sha(raw) == provenance['sourceManifestSHA256']
    original = json.loads(raw)
    assert len(original['files']) == original['fileCount'] == 28
    assert sum(row['bytes'] for row in original['files']) == original['totalBytes'] == 827979
    assert set(names) == {row['path'] for row in original['files']} | {'evidence-manifest.json'}
    for row in original['files']:
        data = tar.extractfile(row['path']).read()
        assert len(data) == row['bytes'] and sha(data) == row['sha256'], row['path']
    photos = [row for row in original['files'] if row['path'].endswith('.jpg')]
    assert len(photos) == 1
    assert photos[0]['sha256'] == 'bfeffac68a071d1c6920ccd5480a13f56eb9102140f9c9d277acf08aa77e2ec2'
print(json.dumps(dict(status='PASS', originalPayloads=28, archiveMembers=29,
                     originalBytes=827979, archiveBytes=archive.stat().st_size,
                     scope='Original file integrity only; no numeric, GPU, RGB or artistic qualification'), indent=2))
