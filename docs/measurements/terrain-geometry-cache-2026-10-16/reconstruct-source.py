#!/usr/bin/env python3
"""Reconstruct the external source pair from local Git and archived originals.

Explicitly writes only a new output directory. No dependency install, build,
test, server, browser or GPU execution. Does not change Git or the input repo.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import time


BASE = Path(__file__).resolve().parent
COMMIT = "10493afa7f6d90389c39e17b2cad79397dfdac01"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"Unsafe source path: {name}")
    return path


def read_manifest(name):
    return json.loads(gzip.decompress((BASE / "source" / name).read_bytes()))


def validate(files, manifest):
    expected = {item["path"]: item for item in manifest["files"]}
    if set(files) != set(expected):
        raise ValueError("Reconstructed source path set differs from manifest")
    for name, data in files.items():
        item = expected[name]
        if len(data) != item["bytes"] or sha(data) != item["sha256"]:
            raise ValueError(f"Source mismatch: {name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    repo, output = args.repo.resolve(), args.output.resolve()
    if output.exists():
        parser.error("Output must be a new directory; nothing is overwritten")
    if repo == output or repo in output.parents:
        parser.error("Output must be outside the input checkout")
    baseline_manifest = read_manifest("baseline-manifest.json.gz")
    r1_manifest = read_manifest("r1-source-manifest.json.gz")
    r2_manifest = read_manifest("r2-source-manifest.json.gz")
    baseline = {}
    deadline = time.monotonic() + 60
    for item in baseline_manifest["files"]:
        name = str(safe_name(item["path"]))
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Git source reads exceeded 60 seconds")
        baseline[name] = subprocess.run(
            ["git", "-C", str(repo), "show", f"{COMMIT}:{name}"],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=remaining,
        ).stdout
    validate(baseline, baseline_manifest)
    r1, r2 = dict(baseline), None
    changes = {"baseline": {}, "r1": {}, "r2": {}}
    with tarfile.open(BASE / "source/changed-source-originals.tar.gz") as archive:
        for member in archive.getmembers():
            path = safe_name(member.name)
            if not member.isfile() or path.parts[0] not in changes:
                raise ValueError(f"Unexpected source member: {member.name}")
            changes[path.parts[0]][str(PurePosixPath(*path.parts[1:]))] = archive.extractfile(member).read()
    for name, data in changes["baseline"].items():
        if baseline.get(name) != data:
            raise ValueError(f"Archived original differs from Git: {name}")
    r1.update(changes["r1"])
    validate(r1, r1_manifest)
    r2 = dict(r1)
    r2.update(changes["r2"])
    validate(r2, r2_manifest)
    # All bytes are checked before the first output write. Partial I/O failures
    # preserve their output for inspection; this program deletes nothing.
    output.mkdir(parents=True, exist_ok=False)
    for folder, files in [("baseline-source", baseline), ("candidate-source", r2)]:
        for name, data in files.items():
            target = output / folder / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    print(json.dumps({"status": "PASS", "baselineFiles": len(baseline),
                      "candidateFiles": len(r2), "output": str(output),
                      "buildOrGPUExecuted": False}))


if __name__ == "__main__":
    main()
