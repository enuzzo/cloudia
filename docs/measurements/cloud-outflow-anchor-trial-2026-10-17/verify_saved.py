#!/usr/bin/env python3
"""Read-only integrity checks for the saved, rejected Cloudia outflow trial."""
import sys
sys.dont_write_bytecode = True
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import struct
import time

ORIGINAL_PAYLOADS = json.loads(r'''{
  "run/FINAL-CONTINUITY.json": {
    "bytes": 1239,
    "sha256": "50af72413802a4e03a8244f3d05cddaee3392a754c4d11ce5629fbae11783f6c"
  },
  "run/FROZEN-BASELINE-CAMERAS.json": {
    "bytes": 6567,
    "sha256": "c78b9f91c84354ef276286fba29bac2cbd9236b49afbb806151d4cc36c955dcc"
  },
  "run/METADATA-COMPARISON-ADDENDUM-BEFORE-B.json": {
    "bytes": 1578,
    "sha256": "183013e9a0af97553f03a473a39cc5e6009ea1ca2f96c823e32e7def11f57140"
  },
  "run/PRE-RUN-PROTOCOL.json": {
    "bytes": 3746,
    "sha256": "c7f9ba9a327649a01e4c1bb7c3303ee413d44d7ab77cdf4d74876b9bf79c1e1a"
  },
  "run/R1-build.log": {
    "bytes": 1570,
    "sha256": "ab3624b318eb2597ff22ab39f727494b41390f7d1f2559bf47c8fe6f32ce3203"
  },
  "run/R1-tests.log": {
    "bytes": 304,
    "sha256": "fad0672b2c497ab7f910e8845a680875ad462c17cac88c41499065c578d9e5b1"
  },
  "run/R1-typecheck.log": {
    "bytes": 43,
    "sha256": "0e16a3edbb514aa8bffdbf94899f6caaad53fcb431e899221770792223f367c1"
  },
  "run/R1-validation.json": {
    "bytes": 769,
    "sha256": "0fbac15d1a647f9004e469b7a067e84c827fe6d8bbe9b69c0a22830f9948dc17"
  },
  "run/SOURCE-FREEZE-R1.json": {
    "bytes": 15256,
    "sha256": "e809c77ed113331d54003d5d730a964c15b87589b794d634fe1d4e4286e08792"
  },
  "preflight/PLAN.md": {
    "bytes": 4960,
    "sha256": "5a81249e6b131d80e72a2cb43dea047338181331f7ada18821cc923d6a7b53f8"
  },
  "preflight/RESULT.md": {
    "bytes": 4098,
    "sha256": "45acb9f8a14d1dd159996eb0ab294ffd94a13ff75bebdcb684fc55f929638ba8"
  },
  "preflight/contract.fixture.test.mjs": {
    "bytes": 2027,
    "sha256": "78d93bd54c2e35f003e77c602a387ccaca0ced00515b49a55ed2b5bf598a51c9"
  },
  "preflight/contract.mjs": {
    "bytes": 4348,
    "sha256": "52df1239d515d72589a44ed6eb819941ccb1338ed5acf9389f3ed23d38ac29bc"
  },
  "preflight/extract-and-check.mjs": {
    "bytes": 11805,
    "sha256": "f887f39852d4c5f85d94da4c16326cd5c47e151c4640425e59b62b77b9184645"
  },
  "preflight/raw-run-log.json": {
    "bytes": 3465,
    "sha256": "c2363bf296e2d77edae0411bb65403dd5fc31d70351d32d0fe965dbbc92dfc7f"
  },
  "preflight/result.json": {
    "bytes": 23160,
    "sha256": "967cf30ffc198991946b0b0f61e7e55dc05c70a0792024ddf127f80fcc563833"
  },
  "analysis/PROTOCOL.md": {
    "bytes": 4114,
    "sha256": "553e57185ce32182ad8f046bb287ff33f0616762086c06f90c0f77ea240d5e8b"
  },
  "analysis/RESULT.md": {
    "bytes": 3612,
    "sha256": "f7a9ba7fd1c2bc7e7ed5b4dc0befaddceba8a4b616756628bbbc7d1647f68f42"
  },
  "analysis/native-contract.fixture.test.mjs": {
    "bytes": 4933,
    "sha256": "af9fb93ab9bb98c9ebf8d7c0fbdac5b0ff6c54d9fcffcfc097299c6e4af41df3"
  },
  "analysis/native-contract.mjs": {
    "bytes": 7224,
    "sha256": "7e0f50d936432cd0ab47c7f334cf6bf0c03bfee3e687ee44f08fa9da1eebe28e"
  },
  "analysis/raw-run-log.json": {
    "bytes": 4018,
    "sha256": "ff233312771b6480330fefb603487a38befd36fa7c9d326d91a8c9c0daba87a0"
  },
  "analysis/result.json": {
    "bytes": 41067,
    "sha256": "eb6c91e3240df4ca2f303596a2e224fd8b1377b97cae90955223ebd88038b7f1"
  },
  "analysis/validate-native.mjs": {
    "bytes": 6433,
    "sha256": "fb1bb24d10f11ec761b4bca419b9d3bf9f9e96b8c1b6a70ae1504e6e16d9036b"
  },
  "browser/baseline-74-front-alias.json": {
    "bytes": 524,
    "sha256": "ebb7e4ec6d45716b4ff3877cd6f3a32083d00ccfeb317ee72e6087116499c59e"
  },
  "browser/baseline-74-front.json": {
    "bytes": 13073,
    "sha256": "a63cf6c81e79c68986797358a9a53273026d7b3aa71104f2ff345701e7be92ec"
  },
  "browser/baseline-74-side-transfer.json": {
    "bytes": 4230,
    "sha256": "68de230d83a33a272e806cbbd6b75393e54d257eed2d6ffdec880cc2dfbd6041"
  },
  "browser/baseline-74-side.json": {
    "bytes": 13075,
    "sha256": "56001fbcd1bf32fa859c7f8bdaf39734320c7c5327c930148729f59323cc0626"
  },
  "browser/baseline-74-side.png": {
    "bytes": 1359259,
    "sha256": "c9c4681b03b9c4771c7be62974712b12b516e8b8717c22dc0907f18318aa2749"
  },
  "browser/baseline-console.json": {
    "bytes": 3,
    "sha256": "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570"
  },
  "browser/candidate-74-front-transfer.json": {
    "bytes": 10716,
    "sha256": "09101f9d558e55a42a97cd88a27c359b0418da51b43e6d61a8c4663eb0de2207"
  },
  "browser/candidate-74-front.json": {
    "bytes": 13143,
    "sha256": "577dd6c1570eda54f0873730af976ceb3d7922a674b782c1bb27c07502dcceb7"
  },
  "browser/candidate-74-front.png": {
    "bytes": 3607225,
    "sha256": "a5618ec2982212f7587d7930a5f42b271d86cab19288ae9094d502f2901934aa"
  },
  "browser/candidate-74-side-transfer.json": {
    "bytes": 4512,
    "sha256": "9c35615ec37fe6eedcf071b29f324344cdafcfb517ed6a87f085f782ef653b0a"
  },
  "browser/candidate-74-side.json": {
    "bytes": 13137,
    "sha256": "347cb6730bcb553edc2e7169576cd8d3d0fd8e5ba5ddd4c92fb9a6d88901dcf3"
  },
  "browser/candidate-74-side.png": {
    "bytes": 1467060,
    "sha256": "64a047ec9d21590c6e7bdfead6a9e7b10b05210c5685c54e99ae978731d63a2a"
  },
  "browser/candidate-console.json": {
    "bytes": 3,
    "sha256": "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570"
  },
  "browser/final-ordinary-canvas.json": {
    "bytes": 271,
    "sha256": "a716e4e9528275bb5ff3e6eb966dd12c81470ee9db7b0a321e8f5ce38ebac7f9"
  },
  "browser/final-ordinary-console.json": {
    "bytes": 3,
    "sha256": "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570"
  },
  "browser/final-ordinary-state.txt": {
    "bytes": 265,
    "sha256": "dda0a84ee942a549e85078f146d82d25e0185470059db25ffe4cecbfa1c4c5cc"
  },
  "browser/final-ordinary-ui.jpg": {
    "bytes": 74101,
    "sha256": "a55dacfd4122756ef715baf73097d8a08ee562bf8692d507428b32402e01676a"
  },
  "review/a-front-junction-crop.png": {
    "bytes": 244674,
    "sha256": "4feb5c04914c4108fc47a2259b7fa9a0a7ad9acf8f2bfaa9c70cce6fc086ff2f"
  },
  "review/a-side-junction-crop.png": {
    "bytes": 254860,
    "sha256": "5b17c4e0fbf40d5541b47af6519b0553d3ad01625949e3fe6ba9180842e59cb0"
  },
  "review/b-front-junction-crop.png": {
    "bytes": 242779,
    "sha256": "5635a671a3b7e7aaf28af067a986da004269909389aa48bb5f5e8ae727cbcf79"
  },
  "review/b-side-junction-crop.png": {
    "bytes": 268658,
    "sha256": "310ccb9785b6f34095ba0f4253ee4f3e1af8b17d2227bbe431f1877ee8b3c603"
  },
  "review/native-review-image-index.json": {
    "bytes": 7745,
    "sha256": "4c4ee530a460bf862fe4c2c28ff6ad4f5de6fc06f884c9f377b8382cdd3e25bd"
  },
  "review/native-review.md": {
    "bytes": 5500,
    "sha256": "1faf43a376ad37d90a7fe3cb1946c0367e3a0e988df7632b668ca73039705e70"
  },
  "review/pretrial-contract-review.md": {
    "bytes": 6258,
    "sha256": "0c0200f7cf53ad3cf5b891aa569692532324eac0cb23bbbfc0229905b72c272c"
  },
  "review/root-native-review.md": {
    "bytes": 2567,
    "sha256": "7e2911f2699a00d0dd9a766d2f1b72539b675e217fbe40e33e4578384f4fcc89"
  },
  "review/source-review-inputs.json": {
    "bytes": 1224,
    "sha256": "0e11d256b70f8b583e816197132b5f62221c8db182a66c810492d23c6c1d1083"
  },
  "review/source-review.md": {
    "bytes": 5042,
    "sha256": "27c33e617d5d82d248b62304321001a0fa3290adca214ed3a76fe92ea623e319"
  }
}''')
BASELINE_MANIFEST_SHA = "2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73"
EXPERIMENT_MANIFEST_SHA = "e809c77ed113331d54003d5d730a964c15b87589b794d634fe1d4e4286e08792"
ALIAS_REPO_PATH = "docs/measurements/terrain-optical-material-2026-10-17/browser/candidate-b-native.png"
EXPECTED_OVERLAY = {
    "src/cumulonimbus/GPUSceneEngine.ts",
    "src/cumulonimbus/layoutPrefix.test-helper.ts",
    "src/cumulonimbus/lifecycle.test.ts",
    "src/cumulonimbus/outflowAnchor.test.ts",
    "src/cumulonimbus/outflowAnchor.ts",
    "src/cumulonimbus/volume.ts",
}
MAX_FILES = 512
MAX_DEPTH = 12
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_READ_BYTES = 512 * 1024 * 1024
MAX_WALL_SECONDS = 15
SHA_PATTERN = re.compile(r"^[0-9a-f]{64}$")
STARTED = time.monotonic()
READ_BYTES = 0


class IntegrityError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise IntegrityError(message)


def budget():
    require(time.monotonic() - STARTED <= MAX_WALL_SECONDS, "Saved verification wall budget exceeded")
    require(READ_BYTES <= MAX_TOTAL_READ_BYTES, "Saved verification read budget exceeded")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def account(count):
    global READ_BYTES
    READ_BYTES += count
    budget()


def file_hash(path):
    require(not path.is_symlink(), "Symlink payload rejected: " + str(path))
    require(path.is_file(), "Missing regular file: " + str(path))
    size = path.stat().st_size
    require(size <= MAX_FILE_BYTES, "Oversized saved file: " + str(path))
    result = hashlib.sha256()
    with path.open("rb") as stream:
        while True:
            data = stream.read(1024 * 1024)
            if not data:
                break
            account(len(data))
            result.update(data)
    return {"bytes": size, "sha256": result.hexdigest()}


def file_bytes(path, max_bytes=16 * 1024 * 1024):
    require(not path.is_symlink() and path.is_file(), "Missing or symlink input: " + str(path))
    require(path.stat().st_size <= max_bytes, "Oversized structured/image input: " + str(path))
    data = path.read_bytes()
    account(len(data))
    return data


def unique_object(pairs):
    obj = {}
    for key, value in pairs:
        require(key not in obj, "Duplicate JSON key: " + key)
        obj[key] = value
    return obj


def reject_constant(value):
    raise IntegrityError("Nonfinite JSON constant: " + value)


def decode_json(data):
    return json.loads(data, object_pairs_hook=unique_object, parse_constant=reject_constant)


def read_json(path):
    return decode_json(file_bytes(path, 256 * 1024))


def safe_relative(name):
    require(type(name) is str and name != "" and "\\" not in name, "Invalid manifest path")
    value = PurePosixPath(name)
    require(not value.is_absolute() and ".." not in value.parts and "." not in value.parts,
            "Unsafe relative path: " + name)
    require(value.as_posix() == name, "Noncanonical relative path: " + name)
    return value


def inventory(root):
    files = set()
    for current, directories, names in os.walk(root, followlinks=False):
        depth = len(Path(current).relative_to(root).parts)
        require(depth <= MAX_DEPTH, "Archive exceeds maximum depth")
        for name in directories:
            require(not (Path(current) / name).is_symlink(), "Symlink directory rejected")
        for name in names:
            path = Path(current) / name
            require(not path.is_symlink(), "Symlink file rejected")
            files.add(path.relative_to(root).as_posix())
            require(len(files) <= MAX_FILES, "Archive exceeds maximum file count")
        budget()
    return files


def manifest_contract(root):
    manifest = read_json(root / "MANIFEST.json")
    require(type(manifest) is dict and 1 <= len(manifest) <= MAX_FILES, "MANIFEST must be a path-to-record dictionary")
    require("MANIFEST.json" not in manifest, "MANIFEST must exclude itself")
    require("README.md" in manifest and "verify_saved.py" in manifest,
            "README.md and verifier must both be included in MANIFEST")
    require(inventory(root) == set(manifest) | {"MANIFEST.json"},
            "Archive file set differs from MANIFEST (only MANIFEST itself is excluded)")
    for name, expected in manifest.items():
        safe_relative(name)
        require(type(expected) is dict and set(expected) == {"bytes", "sha256"},
                "Invalid MANIFEST record: " + name)
        require(type(expected["bytes"]) is int and expected["bytes"] >= 0,
                "Invalid byte count: " + name)
        require(type(expected["sha256"]) is str and SHA_PATTERN.fullmatch(expected["sha256"]),
                "Invalid SHA256: " + name)
        require(file_hash(root / name) == expected, "Payload bytes/hash mismatch: " + name)
    for name, original in ORIGINAL_PAYLOADS.items():
        require(manifest.get(name) == original,
                "Saved original payload missing or changed: " + name)
    return manifest


def source_contract(root, manifest, repo, current141):
    baseline_path = root / "source/baseline-manifest.json"
    experiment_path = root / "source/experiment-manifest.json"
    require(file_hash(baseline_path)["sha256"] == BASELINE_MANIFEST_SHA, "Baseline141 manifest freeze mismatch")
    require(file_hash(experiment_path)["sha256"] == EXPERIMENT_MANIFEST_SHA, "Experiment143 manifest freeze mismatch")
    require(file_bytes(experiment_path, 256 * 1024) ==
            file_bytes(root / "run/SOURCE-FREEZE-R1.json", 256 * 1024),
            "Experiment manifest must be a byte-exact R1 freeze copy")
    baseline, experiment = read_json(baseline_path), read_json(experiment_path)
    require(type(baseline) is dict and len(baseline) == 141, "Expected baseline141")
    require(type(experiment) is dict and len(experiment) == 143, "Expected experiment143")
    require(set(baseline) <= set(experiment), "Unexpected deleted baseline source")
    for mapping in (baseline, experiment):
        for name, sha in mapping.items():
            safe_relative(name)
            require(type(sha) is str and SHA_PATTERN.fullmatch(sha), "Invalid source-manifest SHA")
    changed = {name for name, sha in experiment.items() if baseline.get(name) != sha}
    require(changed == EXPECTED_OVERLAY, "Source delta differs from the six frozen overlay paths")
    stored_overlay = {name.removeprefix("source/overlay/") for name in manifest if name.startswith("source/overlay/")}
    require(stored_overlay == changed, "Overlay must contain exactly six changed/new files")
    for name in changed:
        require(file_hash(root / "source/overlay" / name)["sha256"] == experiment[name],
                "Overlay source SHA mismatch: " + name)
    if current141:
        require(repo is not None, "--current141 requires a repository root")
        for name, sha in baseline.items():
            require(file_hash(repo / name)["sha256"] == sha, "Current141 differs: " + name)
    return {"baseline_paths": 141, "experiment_paths": 143, "overlay_paths": sorted(changed),
            "current141": "MATCHES_BASELINE141" if current141 else "NOT_REQUESTED"}


def png_header(data):
    require(len(data) >= 33 and data[:8] == b"\x89PNG\r\n\x1a\n", "Invalid PNG signature/header")
    require(struct.unpack(">I", data[8:12])[0] == 13 and data[12:16] == b"IHDR", "Invalid IHDR")
    return list(struct.unpack(">II", data[16:24]))


def png_binding(dto, data):
    png = dto["png"]
    require(dto["schema"] == "cloudia-native-frame-v1" and dto["state"] == "ready", "Invalid native DTO state/schema")
    require(png["mime"] == "image/png" and len(data) == png["byteLength"], "Native PNG MIME/bytes mismatch")
    require(digest(data) == png["sha256"], "Native DTO/PNG SHA mismatch")
    require(png_header(data) == [png["width"], png["height"]] == [2474, 1844], "Native DTO/IHDR dimensions mismatch")
    return {"sha256": png["sha256"], "bytes": len(data), "size": png_header(data)}


def transfer_binding(dto, data, transfer):
    require(transfer["png"] == dto["png"], "Transfer PNG metadata differs from actual DTO")
    text = "data:image/png;base64," + base64.b64encode(data).decode("ascii")
    export = dto["textExport"]
    require(export["partCharacters"] == 65536, "Unexpected text part size")
    count = (len(text) + 65535) // 65536
    require(export["totalCharacters"] == len(text) and export["parts"] == count, "DTO text-export size mismatch")
    require(len(transfer["parts"]) == count, "Transfer part count mismatch")
    for i, part in enumerate(transfer["parts"]):
        piece = text[i * 65536:(i + 1) * 65536]
        require(part["part"] == i + 1 and part["characters"] == len(piece), "Transfer part order/length mismatch")
        require(part["sha256"] == digest(piece.encode("ascii")), "Transfer part SHA mismatch")
    return count


def image_contract(root, repo):
    require(repo is not None, "Repository root is required to resolve the existing A-front alias")
    results, inputs = {}, {}
    for owner, pose, stem in [
        ("A", "front", "baseline-74-front"), ("A", "side", "baseline-74-side"),
        ("B", "front", "candidate-74-front"), ("B", "side", "candidate-74-side"),
    ]:
        dto = read_json(root / "browser" / (stem + ".json"))
        alias = None
        if owner == "A" and pose == "front":
            alias = read_json(root / "browser/baseline-74-front-alias.json")
            require(alias["kind"] == "native-png-exact-content-alias-v1", "Unexpected alias kind")
            require(alias["actualExportMetadata"] == "baseline-74-front.json", "Alias DTO provenance mismatch")
            require(alias["actualExportSHA256"] == dto["png"]["sha256"], "Alias actual-export SHA mismatch")
            require([alias["bytes"], alias["width"], alias["height"]] ==
                    [dto["png"]["byteLength"], dto["png"]["width"], dto["png"]["height"]],
                    "Alias PNG metadata mismatch")
            require(type(alias["existingExactPNG"]) is str and
                    alias["existingExactPNG"].endswith("/" + ALIAS_REPO_PATH), "Unexpected alias target")
            data = file_bytes(repo / ALIAS_REPO_PATH)
        else:
            data = file_bytes(root / "browser" / (stem + ".png"))
        record = png_binding(dto, data)
        if alias:
            record["binding"] = "ACTUAL_DTO_PLUS_EXISTING_REPO_BITMAP_HASH"
        else:
            record["transfer_parts"] = transfer_binding(dto, data, read_json(root / "browser" / (stem + "-transfer.json")))
        results[owner + "-" + pose] = record
        inputs[owner + "-" + pose] = {"dto": dto, "stem": stem}
    require([results["A-side"]["transfer_parts"], results["B-front"]["transfer_parts"],
             results["B-side"]["transfer_parts"]] == [28, 74, 30], "Frozen transfer counts differ")
    return results, inputs


def review_contract(root, images, image_inputs):
    index = read_json(root / "review/native-review-image-index.json")
    rows = index["images"]
    require(len(rows) == 4 and {row["id"] for row in rows} == set(images), "Review must index exactly four native images")
    for row in rows:
        image_id = row["id"]
        require([row["sha256"], row["bytes"], row["size"]] ==
                [images[image_id]["sha256"], images[image_id]["bytes"], images[image_id]["size"]],
                "Review index native image binding mismatch")
        stem = image_inputs[image_id]["stem"]
        require(row["metadata"].endswith("/browser/" + stem + ".json"), "Review metadata path mismatch")
        require(row["metadataSHA256"] == file_hash(root / "browser" / (stem + ".json"))["sha256"],
                "Review metadata digest mismatch")
        crop_name = image_id.lower() + "-junction-crop.png"
        require(row["crop"].endswith("/review/" + crop_name), "Review crop path mismatch")
        crop = file_bytes(root / "review" / crop_name)
        require(digest(crop) == row["cropSHA256"], "Review crop SHA mismatch")
        box = row["cropPIL_LTRB"]
        require(type(box) is list and len(box) == 4 and all(type(v) is int for v in box), "Invalid recorded crop box")
        left, top, right, bottom = box
        require(0 <= left < right <= 2474 and 0 <= top < bottom <= 1844, "Crop box outside native frame")
        require(png_header(crop) == [right - left, bottom - top], "Crop IHDR/recorded-box mismatch")
    independent = file_bytes(root / "review/native-review.md", 64 * 1024).decode("utf-8")
    root_review = file_bytes(root / "review/root-native-review.md", 64 * 1024).decode("utf-8")
    require("Verdetto: FAIL" in independent and "FAIL_VISUAL_NOT_ADOPTED" in root_review,
            "Original independent/root rejected-trial verdicts must remain explicit")
    return {"indexed_native_images": 4, "preserved_review_crops": 4,
            "trial_outcome": "FAIL_VISUAL_NOT_ADOPTED", "visual_assessment": "NOT_RERUN"}


def preserved_analysis_contract(root, image_inputs):
    result = read_json(root / "analysis/result.json")
    require(result["status"] == "FAIL_NATIVE_METADATA_CONTROLS" and result["error"] is None,
            "Original formal metadata FAIL must be preserved")
    require(len(result["rows"]) == 2 and {row["pose"] for row in result["rows"]} == {"front", "side"},
            "Expected two saved metadata comparisons")
    expected_paths = {"terrainRaster.shadow.cache.hits", "terrainRaster.shadow.cache.requests"}
    mismatches = {}
    for row in result["rows"]:
        pose = row["pose"]
        require(row["qualified"] is False and len(row["mismatches"]) == 2 and
                {m["path"] for m in row["mismatches"]} == expected_paths,
                "Saved formal FAIL must retain only hits/requests mismatches")
        a = image_inputs["A-" + pose]["dto"]["metadata"]["terrainRaster"]["shadow"]["cache"]
        b = image_inputs["B-" + pose]["dto"]["metadata"]["terrainRaster"]["shadow"]["cache"]
        require(a["scope"] == b["scope"] and "Owner-local CPU calls" in a["scope"],
                "Counter ownership scope lost")
        for mismatch in row["mismatches"]:
            key = mismatch["path"].rsplit(".", 1)[1]
            require(mismatch["a"] == a[key] and mismatch["b"] == b[key] and
                    mismatch["missingA"] is False and mismatch["missingB"] is False,
                    "Saved mismatch differs from original native DTO counters")
        mismatches[pose] = row["mismatches"]
    return {"original_status": result["status"], "mismatches": mismatches,
            "scope": "Formal frozen-validator FAIL retained; only original owner-local hits/requests differ. No new numerical or physical-control PASS is issued."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", nargs="?", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--repo", type=Path, help="Repository root for the existing A-front PNG alias and optional current141 check")
    parser.add_argument("--current141", action="store_true", help="Also hash the 141 baseline paths in --repo; never execute source")
    args = parser.parse_args()
    archive = args.archive.resolve()
    repo = args.repo.resolve() if args.repo else None
    if repo is None and archive.parent.name == "measurements" and archive.parent.parent.name == "docs":
        repo = archive.parent.parent.parent
    report = {"schema": "cloudia-saved-trial-archive-integrity-v1", "archive_integrity": "FAIL",
              "archive": str(archive), "trial_outcome": "FAIL_VISUAL_NOT_ADOPTED",
              "native_metadata_outcome": "FAIL_NATIVE_METADATA_CONTROLS",
              "scope": "Read-only saved evidence conservation only; no recipe imports, model, build, test, GPU, new numerical gate, visual judgement or FPS measurement."}
    try:
        require(archive.is_dir() and not archive.is_symlink(), "Missing or symlink archive root")
        manifest = manifest_contract(archive)
        report["manifest_payloads"] = len(manifest)
        report["original_payloads_preserved"] = len(ORIGINAL_PAYLOADS)
        report["source"] = source_contract(archive, manifest, repo, args.current141)
        images, image_inputs = image_contract(archive, repo)
        report["native_bindings"] = images
        report["review"] = review_contract(archive, images, image_inputs)
        report["preserved_analysis"] = preserved_analysis_contract(archive, image_inputs)
        budget()
        report["archive_integrity"] = "PASS"
        report["interpretation"] = "PASS means archive conservation only. The trial remains rejected and the original formal metadata FAIL is unchanged."
    except (IntegrityError, OSError, ValueError, TypeError, KeyError, IndexError, struct.error) as error:
        report["error"] = str(error)
    report["runtime"] = {"wall_seconds": time.monotonic() - STARTED, "bytes_read": READ_BYTES,
                         "limits": {"wall_seconds": MAX_WALL_SECONDS, "bytes_read": MAX_TOTAL_READ_BYTES,
                                    "archive_files": MAX_FILES, "archive_depth": MAX_DEPTH}}
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["archive_integrity"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
