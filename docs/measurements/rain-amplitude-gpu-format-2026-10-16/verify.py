#!/usr/bin/env python3
"""Offline integrity/fixture verification. No WebGPU, network or dependencies."""
import argparse
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import tarfile


ROOT = Path(__file__).resolve().parent
SOURCE_MANIFESTS = {
    "R1": "d09df5170adeee846b58e6e57c04ee256673d59b6ef27220b82d8d958f39abe6",
    "R2": "9f8a934344a3daec9d6f4fcf11be4341cd7df2fbfcbfcab26a93dcdf3548b40f",
    "R3": "0957e8ec0adfbc2bf7406aa29c16e1f851a2e1e1e9fc3c4bc75c8da4c8ccd81d",
}
RUNTIME_FILES = {"index.html", "app.js", "pack.wgsl", "direct-r16f.wgsl", "read-sample.wgsl"}
HALVES = [0, 0x3000, 0x3400, 0x3800, 0x3c00, 0x4000, 0x4400, 0x3a00,
          0x3e00, 0x2e66, 0x3c00, 0x3c02, 0x0400, 1, 0x0200, 3]
POINTS = [[-.25, .25, .5], [0, .25, .5], [1, .75, .5], [1.25, .5, .5],
          [.5, .25, .5], [.25, .5, .25], [.75, .75, .75], [.5, .5, .5],
          [.125, .25, .5], [.875, .75, .5], [.5, 0, 0], [.5, 1, 1]]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def f32(value):
    return struct.unpack("<f", struct.pack("<f", value))[0]


VALUES = [0, .125, .25, .5, 1, 2, 4, .75, 1.5, f32(.1),
          1 + 1 / 2048, 1 + 3 / 2048, 2**-14, 2**-24, 2**-15, 3 * 2**-24]


def half_value(bits):
    return struct.unpack("<e", struct.pack("<H", bits))[0]


def source_files():
    layout = json.loads((ROOT / "source-layout.json").read_text())
    objects = {}
    with tarfile.open(fileobj=io.BytesIO((ROOT / "source-originals.tar.gz").read_bytes()), mode="r:gz") as archive:
        for member in archive.getmembers():
            require(member.isfile() and member.name.startswith("objects/"), "Unexpected source object")
            data = archive.extractfile(member).read()
            digest = member.name.removeprefix("objects/")
            require(len(digest) == 64 and sha(data) == digest and digest not in objects, "Source object hash")
            objects[digest] = data
    revisions, used = {}, set()
    for revision, item in layout["revisions"].items():
        files = {}
        for entry in item["files"]:
            require(Path(entry["path"]).name == entry["path"], "Unsafe source path")
            data = objects[entry["sha256"]]
            require(len(data) == entry["bytes"], "Source byte count")
            files[entry["path"]] = data
            used.add(entry["sha256"])
        require(sha(files["manifest.json"]) == SOURCE_MANIFESTS[revision], "Original manifest hash")
        original = json.loads(files["manifest.json"])
        for entry in original["files"]:
            data = files[entry["path"]]
            require(len(data) == entry["bytes"] and sha(data) == entry["sha256"], "Original manifest entry")
        revisions[revision] = files
    require(used == set(objects), "Unused/missing source objects")
    for name in revisions["R1"]:
        if name not in {"direct-r16f.wgsl", "manifest.json"}:
            require(revisions["R1"][name] == revisions["R2"][name] == revisions["R3"][name], "Unchanged payload")
    r1 = revisions["R1"]["direct-r16f.wgsl"]
    r2 = revisions["R2"]["direct-r16f.wgsl"]
    r3 = revisions["R3"]["direct-r16f.wgsl"]
    require(r1.count(b"target") == 2 and r1.replace(b"target", b"amplitudeTarget") == r2, "R2 sole identifier repair")
    old = b"  textureStore(amplitudeTarget,vec3<i32>(id),vec4<f32>(values[index],0.0,0.0,1.0));"
    new = b"  let halfAmplitude=unpack2x16float(pack2x16float(vec2<f32>(values[index],0.0))).x;\n  textureStore(amplitudeTarget,vec3<i32>(id),vec4<f32>(halfAmplitude,0.0,0.0,1.0));"
    require(r2.count(old) == 1 and r2.replace(old, new) == r3, "R3 sole prequantization change")
    return revisions, len(objects)


def interpolation(texels, width, point):
    axes = []
    for u, size in zip(point, [width, 2, 3]):
        p = max(0, min(size - 1, u * size - .5))
        lo = math.floor(p)
        axes.append((lo, min(size - 1, lo + 1), p - lo))
    ideal, maximum = 0, 0
    for z in range(2):
        for y in range(2):
            for x in range(2):
                value = half_value(texels[(axes[2][z] * 2 + axes[1][y]) * width + axes[0][x]])
                weight = (axes[0][2] if x else 1 - axes[0][2]) * (axes[1][2] if y else 1 - axes[1][2]) * (axes[2][2] if z else 1 - axes[2][2])
                ideal += value * weight
                maximum = max(maximum, abs(value))
    return ideal, max(1, maximum) * 2**-10 + 2**-20


def verify_case(revision, method, case):
    width = case["dims"][0]
    require(width in (16, 17) and case["dims"] == [width, 2, 3], "Fixture dimensions")
    ids = [(x + y * 7 + z * 11) % 16 for z in range(3) for y in range(2) for x in range(width)]
    texels = [HALVES[i] for i in ids]
    expected_failure_indices = [i for i, v in enumerate(ids) if v == 11] if revision == "R2" and method == "tier1" else []
    # The R2 lower neighbor is a recorded observation, not the portable required rounding mode.
    for index in expected_failure_indices:
        texels[index] = 0x3c01
    require(case["encodingFailureCount"] == len(expected_failure_indices), "Encoding failure count")
    require([item["i"] for item in case["encodingFailures"]] == expected_failure_indices, "Encoding failure indices")
    for item in case["encodingFailures"]:
        require(item["input"] == VALUES[11] and item["expectedHalf"] == "0x3c02" and item["actualHalf"] == "0x3c01", "R2 recorded neighbor")
    require(case["status"] == ("FAIL" if expected_failure_indices else "PASS"), "Case verdict")
    count = width * 6
    require(case["texelCount"] == count and case["normalChecks"] == sum(i < 13 for i in ids) and case["subnormalChecks"] == sum(i >= 13 for i in ids), "Palette coverage")
    require(case["completeRecords"] == case["expectedRecords"] == count + 12, "Complete output records")
    for key in ("textureSentinels", "copyBitMismatches", "nonfinite", "loadMismatches", "sampleMismatches"):
        require(case[key] == 0, key)
    require((case["bytesPerRow"], case["rowsPerImage"], case["paddedBytes"]) == (256, 2, 1536), "Copy layout")
    padding = case["padding"]
    core = method == "core"
    require(padding["sourcePaddingBytes"] == (6 * (256 - math.ceil(width / 2) * 4) if core else 0), "Source padding size")
    require(padding["oddTailChecks"] == (6 if core and width % 2 else 0), "Odd tail coverage")
    require(padding["readbackPaddingBytes"] == 6 * (256 - width * 2), "Readback padding size")
    require(all(padding[key] == 0 for key in ("sourcePaddingChanged", "oddTailChanged", "readbackPaddingChanged")), "Padding changed")
    cleanup = case["cleanup"]
    buffers = 9 if core else 7
    require(cleanup == {"allocatedBuffers": buffers, "destroyedBuffers": buffers, "allocatedTextures": 1, "destroyedTextures": 1}, "Reported cleanup")
    tight = b"".join(struct.pack("<H", bits) for bits in texels)
    padded, packed = bytearray([0xa5] * 1536), bytearray([0x5a] * 1536)
    for row in range(6):
        for x in range(width):
            struct.pack_into("<H", padded, row * 256 + x * 2, texels[row * width + x])
            struct.pack_into("<H", packed, row * 256 + x * 2, texels[row * width + x])
        if width % 2:
            struct.pack_into("<H", packed, row * 256 + width * 2, 0xc000)
    output = bytearray()
    # Try the deterministic preserved-half load fixture. Full output digest equality
    # validates it; the JSON alone serializes only the first six subnormal loads.
    for index, bits in enumerate(texels):
        output += struct.pack("<fIII", half_value(bits), 0x11223344, index, 0)
    require(len(case["samples"]) == len(POINTS), "Sampler coverage")
    for index, sample in enumerate(case["samples"]):
        require(sample["uv"] == POINTS[index], "Sampler coordinates")
        bits = int(sample["bits"], 16)
        value = struct.unpack("<f", struct.pack("<I", bits))[0]
        ideal, tolerance = interpolation(texels, width, POINTS[index])
        require(math.isfinite(value) and value == sample["value"], "Recorded sampler float bits")
        require(abs(ideal - sample["idealFromStoredTexels"]) < 1e-15 and tolerance == sample["diagnosticTolerance"], "Sampler CPU diagnostic")
        require(abs(value - ideal) == sample["absoluteError"] and sample["withinDiagnosticTolerance"] and abs(value - ideal) <= tolerance, "Sampler error")
        output += struct.pack("<IIII", bits, 0x11223344, count + index, 1)
    blobs = {"inputF32": b"".join(struct.pack("<f", VALUES[i]) for i in ids),
             "tightTextureHalf": tight, "textureReadback": padded, "loadAndSampleOutput": output}
    if core:
        blobs["packedSource"] = packed
    else:
        require(case["hashes"]["packedSource"] is None, "Tier1 has no packed source")
    for name, data in blobs.items():
        require(sha(data) == case["hashes"][name], f"{revision} {method} {width} digest {name}")
    return {"revision": revision, "method": method, "width": width,
            "matchedDigests": len(blobs), "reconstructedBytes": {name: len(data) for name, data in blobs.items()}}


def verify():
    manifest = json.loads((ROOT / "manifest.json").read_text())
    actual = {str(p.relative_to(ROOT)) for p in ROOT.rglob("*") if p.is_file() and p.name != "manifest.json"}
    require(actual == {entry["path"] for entry in manifest["files"]}, "Archive file inventory")
    for entry in manifest["files"]:
        data = (ROOT / entry["path"]).read_bytes()
        require(len(data) == entry["bytes"] and sha(data) == entry["sha256"], "Archive hash " + entry["path"])
    originals = json.loads((ROOT / "browser-originals.json").read_text())["files"]
    for entry in originals:
        data = (ROOT / entry["archivePath"]).read_bytes()
        if entry["encoding"] == "gzip-lossless":
            data = gzip.decompress(data)
        require(len(data) == entry["originalBytes"] and sha(data) == entry["originalSha256"], "Original browser bytes")
    revisions, object_count = source_files()
    require([struct.unpack("<H", struct.pack("<e", value))[0] for value in VALUES] == HALVES, "Fixed RNE palette witnesses")
    cases = []
    reports = {}
    for revision in ("R1", "R2", "R3"):
        raw = json.loads(gzip.decompress((ROOT / "browser" / f"rain-format-{revision.lower()}.json.gz").read_bytes()))
        reports[revision] = raw
        require(raw["status"] == ("PASS_BOTH_FORMAT_PATHS" if revision == "R3" else "FAIL"), "Overall verdict")
        require(raw["secureContext"] and raw["gpuRequested"], "GPU request evidence")
        require([item["value"] for item in raw["palette"]] == VALUES and [int(item["half"], 16) for item in raw["palette"]] == HALVES, "Recorded palette")
        require(set(raw["sourceHashes"]) == RUNTIME_FILES, "Runtime source inventory")
        for name, digest in raw["sourceHashes"].items():
            require(sha(revisions[revision][name]) == digest, "Actual GPU run source hash")
        require(json.loads((ROOT / "browser" / f"rain-format-{revision.lower()}-console.json").read_text()) == [], "Console")
        require(raw["tier1Gate"]["apiTier1"] and raw["tier1Gate"]["wgslTier1"], "Tier1 actually advertised")
        require("texture_formats_tier1" in raw["wgslLanguageFeatures"], "WGSL Tier1")
        for method in ("core", "tier1"):
            path = raw[method]
            require(path["destroyCalled"] and not path["uncapturedErrors"] and path["unexpectedDeviceLoss"] is None, "Device cleanup/errors")
            if method == "core":
                require(path["requestedFeatures"] == ["timestamp-query"] and "texture-formats-tier1" not in path["deviceFeatures"], "Core policy")
            else:
                require(path["requestedFeatures"] == ["texture-formats-tier1"] and "texture-formats-tier1" in path["deviceFeatures"], "Explicit Tier1 device")
            require([case["dims"] for case in path["cases"]] == [[16, 2, 3], [17, 2, 3]], "Both grids")
            if revision == "R1" and method == "tier1":
                require(path["status"] == "FAIL" and len(path["scopedErrors"]) == 1, "R1 reserved keyword failure")
                require("reserved keyword" in path["scopedErrors"][0]["message"], "R1 parse error")
                require(all(case["status"] == "ERROR" and "hashes" not in case and "cleanup" not in case for case in path["cases"]), "R1 unreported buffers")
                continue
            require(not path["scopedErrors"] and all(not compilation["messages"] for compilation in path["compilation"]), "Compilation/error scopes")
            require(path["status"] == ("FAIL" if revision == "R2" and method == "tier1" else "PASS"), "Path verdict")
            cases.extend(verify_case(revision, method, case) for case in path["cases"])
    for index in (0, 1):
        a, b = reports["R3"]["core"]["cases"][index], reports["R3"]["tier1"]["cases"][index]
        require(all(a["hashes"][name] == b["hashes"][name] for name in ("inputF32", "textureReadback", "tightTextureHalf", "loadAndSampleOutput")), "R3 cross-path digest equality")
    result = {"status": "PASS", "scope": "Offline integrity and deterministic-fixture digest reconstruction; no GPU replay or serialized full GPU buffer claim",
              "archivePayloads": len(actual), "sourceObjects": object_count,
              "originalSourceFiles": sum(map(len, revisions.values())), "actualRuntimeSourceHashes": 15,
              "originalBrowserFiles": len(originals),
              "completedCases": len(cases), "reconstructedDigestChecks": sum(case["matchedDigests"] for case in cases),
              "r2RecordedStrictWitnessFailures": 13, "cases": cases}
    return result, revisions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extract-source", choices=["R1", "R2", "R3"])
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    require(bool(args.extract_source) == bool(args.output_dir), "Use --extract-source and --output-dir together")
    result, revisions = verify()
    if args.extract_source:
        destination = args.output_dir.resolve()
        require(not destination.exists(), "Extraction requires a new directory")
        destination.mkdir(parents=True)
        for name, data in revisions[args.extract_source].items():
            (destination / name).write_bytes(data)
        result["extractedRevision"] = args.extract_source
        result["extractedDirectory"] = str(destination)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
