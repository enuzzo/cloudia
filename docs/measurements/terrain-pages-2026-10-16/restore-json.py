#!/usr/bin/env python3
"""Restore exact raw JSON byte streams to an explicit external directory."""
from pathlib import Path
import gzip,hashlib,json,sys
if len(sys.argv)!=2:raise SystemExit('Usage: python3 restore-json.py /absolute/external/destination')
root=Path(__file__).resolve().parent;dest=Path(sys.argv[1]).expanduser().resolve()
if not Path(sys.argv[1]).expanduser().is_absolute():raise SystemExit('Destination must be absolute')
if dest==root or root in dest.parents or '/Library/CloudStorage/Dropbox/' in str(dest)+'/':raise SystemExit('Use an external destination outside this archive and Dropbox')
manifest=json.loads((root/'manifest.json').read_bytes());restored=[]
sha=lambda b:hashlib.sha256(b).hexdigest()
for item in manifest['files']:
    if item.get('encoding')!='gzip-original-bytes':continue
    rel=Path(item['path']);assert not rel.is_absolute() and '..' not in rel.parts
    source=root/rel;assert source.is_file() and not source.is_symlink()
    compressed=source.read_bytes();assert sha(compressed)==item['sha256'] and len(compressed)==item['bytes']
    b=gzip.decompress(compressed);assert sha(b)==item['originalSha256'] and len(b)==item['originalBytes']
    target=dest/str(rel)[:-3];target.parent.mkdir(parents=True,exist_ok=True)
    if target.is_symlink():raise SystemExit('Refusing symlink '+str(target))
    if target.exists():
        if target.read_bytes()!=b:raise SystemExit('Refusing to overwrite different file '+str(target))
    else:target.write_bytes(b)
    assert sha(target.read_bytes())==item['originalSha256'];restored.append(str(target))
print(json.dumps({'restoredCount':len(restored),'paths':restored}))
