"""Verify archived bytes only. This does not establish visual or FPS acceptance."""
from pathlib import Path
import gzip
import hashlib
import json

root = Path(__file__).resolve().parent
manifest = json.loads((root / "manifest.json").read_text())
for row in manifest["files"]:
    data = (root / row["path"]).read_bytes()
    assert len(data) == row["bytes"], row["path"]
    assert hashlib.sha256(data).hexdigest() == row["sha256"], row["path"]
originals = json.loads((root / "compressed-originals.json").read_text())
for row in originals:
    data = gzip.decompress((root / row["path"]).read_bytes())
    assert len(data) == row["originalBytes"], row["path"]
    assert hashlib.sha256(data).hexdigest() == row["originalSha256"], row["path"]
print(json.dumps({"status": "PASS", "payloads": len(manifest["files"]),
                  "bytes": sum(row["bytes"] for row in manifest["files"]),
                  "gzipOriginals": len(originals), "scope": "archive integrity only"}))
