from pathlib import Path
import gzip,hashlib,sys
p=Path(__file__).resolve().parent
b=gzip.decompress((p/'audit-cases.json.gz').read_bytes())
expected="cfad064c4dbe4b100294222c8c12a4fbcd98cf8f5316f0f1a3a10494543800a1"
assert hashlib.sha256(b).hexdigest()==expected
(p/'audit-cases.json').write_bytes(b)
if '--previous-gpu' in sys.argv:
    (p/'previous-gpu-attempt/audit-cases.json').write_bytes(b)
print('Restored exact original fixture:',len(b),'bytes; sha256',expected)
