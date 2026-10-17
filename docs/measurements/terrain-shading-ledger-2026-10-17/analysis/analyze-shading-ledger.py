#!/usr/bin/env python3
"""Saved-data arithmetic only. See PROTOCOL.md; no renderer/model imports."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

BASE = Path(__file__).resolve().parents[1]
OWN = Path(__file__).resolve().parent
MODES = ("macro-normal", "final-normal", "factors")
POINTS = (
    ("L1-artifact", 71, 856), ("L1-control", 64, 856),
    ("L2-artifact", 431, 849), ("L2-control", 431, 844),
    ("L3-artifact", 903, 651), ("L3-control", 903, 646),
    ("C1-ocean", 2200, 1100), ("C2-coastal-lowland", 1800, 930),
    ("C3-plain", 2200, 700), ("C4-ridge-L1", 170, 805),
    ("C5-ridge-L2", 460, 800), ("C6-ridge-L3", 925, 610),
)
CANONICAL = {
    "position": ("4c7e3f0b92c294850dad4014d3c260e0cb922ba5ade13a952722240a2e5ecc64", 7101456),
    "normal": ("3cb820d4d203c89f61e8e26809ddbdcd2f8ce2645dce0842b758a1b0ea6dcbfd", 7101456),
    "terrainSurface": ("7595b45c14d4d249df98d99145fcaa485b21d62e419764b99ce4fedc780c76f2", 4734304),
    "index": ("87e1b8d5b569577c291efefb1698ca66b657ecb3f9c73dcf6ddc73316a1030ae", 14190600),
}
HISTORICAL_NAMES = {"position": "positions", "normal": "normals", "terrainSurface": "surface", "index": "indices"}
FACES_SHA = "d8420acc356e1026cc1ae5278c43ec631568030cf8c19fd96d92e06cf10b708a"
SOURCE_REPORT_SHA = "ec3187ebc895e0aed4e3bd723d995e0196aa2825fa3167ea4e03c78898348d43"
EPS = 1e-5
SIGN_EPS = 1e-6


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read_json(path):
    raw = path.read_bytes()
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError(f"JSON exceeds the fixed 2 MiB cap: {path}")
    def bad_constant(value):
        raise ValueError(f"Non-standard JSON constant {value}")
    return json.loads(raw, parse_constant=bad_constant), {"path": str(path), "bytes": len(raw), "sha256": sha(raw)}


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def vector(value, name, size=3):
    if not isinstance(value, list) or len(value) != size or not all(finite(v) for v in value):
        raise ValueError(f"Invalid finite vector: {name}")
    return value


def f32(value):
    return struct.unpack("<f", struct.pack("<f", value))[0]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def length(a):
    return math.sqrt(dot(a, a))


def angle(a, b):
    denominator = length(a) * length(b)
    if denominator == 0:
        return None
    return math.degrees(math.acos(max(-1.0, min(1.0, dot(a, b) / denominator))))


def ratio(a, b):
    return a / b if b != 0 else None


def difference_ratio(a, b):
    return {"artifact": a, "control": b, "delta": a - b, "artifactOverControl": ratio(a, b)}


def luminance(rgb):
    return dot(rgb, (.2126, .7152, .0722))


def decode(record, label):
    if not isinstance(record, dict):
        raise ValueError(f"Missing record {label}")
    bits = record.get("bits")
    if not isinstance(bits, list) or len(bits) != 4 or any(type(v) is not int or not 0 <= v <= 0xffffffff for v in bits):
        raise ValueError(f"Invalid uint32 words {label}")
    values = list(struct.unpack("<4f", struct.pack("<4I", *bits)))
    if not all(math.isfinite(v) for v in values) or values[3] <= 0:
        raise ValueError(f"Nonfinite/miss distance record {label}")
    declared = vector(record.get("rgba"), f"{label}.rgba", 4)
    if any(a != b for a, b in zip(values, declared)):
        raise ValueError(f"JSON rgba differs from raw words {label}")
    if values[:3] == [-8192.0] * 3:
        raise ValueError(f"Uncovered clear sentinel {label}")
    return {"rgba": values, "bits": bits}


def analyze(ledger, faces, inputs):
    gates = []
    def gate(name, passed, actual=None, expected=None):
        gates.append({"name": name, "passed": bool(passed), "actual": actual, "expected": expected})
    result = {
        "schema": "cloudia-shading-ledger-saved-analysis-v1", "status": "UNQUALIFIED",
        "inputs": inputs, "protocolSHA256": sha((OWN / "PROTOCOL.md").read_bytes()),
        "scriptSHA256": sha(Path(__file__).read_bytes()), "gates": gates, "rows": [], "pairs": [],
        "thresholds": {"unitAndArithmeticConsistency": EPS, "signNearZeroBand": SIGN_EPS},
        "limits": [
            "Saved arithmetic only; no new CPU model, rays, browser or GPU work.",
            "Installed hashes identify current CPU upload views; they do not read back GPU vertex buffers.",
            "Historical CPU raycaster faces remain ideal references, not certified current GPU raster winners.",
            "Twelve historical labels do not classify the current image or establish whole-ribbon causality.",
            "No physical sunlight, geographic accuracy, artwork acceptance or FPS conclusion follows.",
        ],
    }
    for flag in ("ledgerDistanceQualified", "ledgerValuesQualified", "shadingQualified", "stable", "cacheStateQualified", "identical", "shadingAudit"):
        gate(f"engine.{flag}", ledger.get(flag) is True, ledger.get(flag), True)
    gate("engine.status", ledger.get("status") == "COMPLETE_IDENTICAL_F32", ledger.get("status"), "COMPLETE_IDENTICAL_F32")
    probe = ledger["shadingLedger"]
    for field in ("stateRestored", "inputsStable"):
        gate(f"probe.{field}", probe.get(field) is True, probe.get(field), True)
    gate("probe.status", probe.get("status") == "COMPLETE", probe.get("status"), "COMPLETE")
    drain = probe.get("drain", {})
    gate("probe.drain", drain.get("requested") is True and drain.get("settled") is True and drain.get("status") == "fulfilled", drain, "requested/settled/fulfilled")
    gate("probe.readCount", probe.get("readbackRequests") == 36, probe.get("readbackRequests"), 36)
    for name, (expected_sha, expected_bytes) in CANONICAL.items():
        row = ledger.get("installedGeometry", {}).get(name, {})
        gate(f"installedCPU.{name}", row.get("identical") is True and row.get("sha256") == expected_sha and row.get("expectedSHA256") == expected_sha and row.get("bytes") == expected_bytes, row, {"sha256": expected_sha, "bytes": expected_bytes})
        old = faces.get("canonicalHistoricalMeshSHA256", {}).get(HISTORICAL_NAMES[name])
        gate(f"historicalCPU.{name}", old == expected_sha, old, expected_sha)
    gate("historical.facesSHA256", inputs["faces"]["sha256"] == FACES_SHA, inputs["faces"]["sha256"], FACES_SHA)
    gate("historical.schema", faces.get("schema") == "cloudia-historical-cpu-face-reuse-v1", faces.get("schema"), "cloudia-historical-cpu-face-reuse-v1")
    gate("historical.sourceReport", faces.get("sourceReportSHA256") == SOURCE_REPORT_SHA, faces.get("sourceReportSHA256"), SOURCE_REPORT_SHA)
    ordinary = {}
    hashes = []
    for phase in ("cached", "fresh", "restored"):
        block = ledger[phase]
        gate(f"{phase}.dimensions", [block.get("width"), block.get("height")] == [2474, 1844], [block.get("width"), block.get("height")], [2474, 1844])
        hashes.append(block.get("sha256"))
        witness = block["witness"]
        gate(f"{phase}.fixedWitness", [(row.get("id"), *(row.get("pixel") or [])) for row in witness] == list(POINTS), None, "fixed twelve IDs/coordinates in order")
        ordinary[phase] = {row["id"]: decode(row, f"{phase}.{row['id']}") for row in witness}
    gate("ordinary.wholeHashes", len(set(hashes)) == 1 and isinstance(hashes[0], str) and len(hashes[0]) == 64 and all(c in "0123456789abcdef" for c in hashes[0]), hashes, "three identical SHA256 values")
    gate("ordinary.witnessBits", all(ordinary["cached"].get(id_) == ordinary["fresh"].get(id_) == ordinary["restored"].get(id_) for id_, _, _ in POINTS), None, "all 48 ordinary words identical across phases")
    live_rows = probe["rows"]
    gate("probe.fixedWitness", [(row.get("id"), row.get("x"), row.get("y")) for row in live_rows] == list(POINTS), None, "fixed twelve IDs/coordinates in order")
    face_rows = faces["rows"]
    gate("historical.fixedIDs", [row.get("id") for row in face_rows] == [id_ for id_, _, _ in POINTS], None, "fixed twelve IDs in order")
    sun = vector(ledger["snapshot"]["lighting"]["sunDirection"], "current Sun")
    gate("sun.unitLength", abs(length(sun) - 1) <= EPS, length(sun), 1)
    old_sun = vector(faces["frame"]["light"]["sun"], "historical Sun")
    sun_delta = max(abs(a - b) for a, b in zip(sun, old_sun))
    gate("historical.sunContinuity", sun_delta <= 1e-12, sun_delta, "absolute error <= 1e-12")
    camera = ledger["snapshot"]["camera"]
    old_camera = faces["frame"]["camera"]
    for key in ("origin", "forward", "right", "up"):
        current = [f32(v) for v in vector(camera[key], f"camera.{key}")]
        gate(f"historical.camera.{key}", current == old_camera.get(key), current, old_camera.get(key))
    for old_key, new_key in (("aspect", "aspect"), ("tanFov", "tanHalfVerticalFov"), ("inspection", "approach")):
        current = f32(camera[new_key])
        gate(f"historical.camera.{old_key}", current == old_camera.get(old_key), current, old_camera.get(old_key))
    gate("historical.camera.dimensions", [old_camera.get("width"), old_camera.get("height")] == [2474, 1844], None, [2474, 1844])
    decoded = {}
    distance_matches = 0
    for row in live_rows:
        id_ = row["id"]
        decoded[id_] = {mode: decode(row["records"].get(mode), f"{id_}.{mode}") for mode in MODES}
        for mode in MODES:
            equal = decoded[id_][mode]["bits"][3] == ordinary["fresh"].get(id_, {}).get("bits", [None] * 4)[3]
            distance_matches += equal
            gate(f"distance.{id_}.{mode}", equal, decoded[id_][mode]["bits"][3], ordinary["fresh"].get(id_, {}).get("bits", [None] * 4)[3])
    result["distanceBitComparison"] = {"compared": len(live_rows) * 3, "identical": distance_matches, "expected": 36}
    result["ordinaryWholeSHA256"] = hashes[0]
    result["recordedSun"] = sun
    result["allRequiredGatesPassed"] = all(item["passed"] for item in gates)
    if not result["allRequiredGatesPassed"]:
        return result
    solar = vector(ledger["snapshot"]["lighting"]["solarColor"], "solar RGB")
    ambient = vector(ledger["snapshot"]["lighting"]["ambientColor"], "ambient RGB")
    by_face = {row["id"]: row["historicalCPUReceiver"] for row in face_rows}
    for id_, x, y in POINTS:
        records = decoded[id_]
        macro = records["macro-normal"]["rgba"][:3]
        final = records["final-normal"]["rgba"][:3]
        d, s, v = records["factors"]["rgba"][:3]
        macro_dot, final_dot = dot(macro, sun), dot(final, sun)
        residual = d - max(0, final_dot)
        old = by_face[id_]
        face = vector(old["geometricNormal"], f"historical normal {id_}")
        rgb = ordinary["fresh"][id_]["rgba"][:3]
        row = {
            "id": id_, "pixel": [x, y], "ordinary": {**ordinary["fresh"][id_], "linearLuminance": luminance(rgb)},
            "macro": {"normal": macro, "length": length(macro), "unitLengthError": abs(length(macro) - 1), "dotSun": macro_dot},
            "final": {"normal": final, "length": length(final), "unitLengthError": abs(length(final) - 1), "dotSun": final_dot},
            "macroToFinal": {"angleDegrees": angle(macro, final), "dotSunDelta": final_dot - macro_dot,
                             "strictSignCrossing": macro_dot * final_dot < 0,
                             "crossingOutsideNearZeroBand": macro_dot * final_dot < 0 and min(abs(macro_dot), abs(final_dot)) > SIGN_EPS,
                             "macroNearZero": abs(macro_dot) <= SIGN_EPS, "finalNearZero": abs(final_dot) <= SIGN_EPS},
            "factors": {"D": d, "S": s, "V": v, "maxFinalDotSun": max(0, final_dot),
                        "DResidual": residual, "DAbsoluteResidual": abs(residual), "DConsistencyPassed": abs(residual) <= EPS,
                        "rangesPassed": -EPS <= d <= 1 + EPS and .45 - EPS <= s <= 1 + EPS and -EPS <= v <= 1 + EPS},
            "groundBranchLightMultiplierRGB": [.90 * solar[i] * d * v + 1.12 * ambient[i] * s for i in range(3)],
            "historicalCPUFaceReference": {**old, "dotWithCurrentRecordedSun": dot(face, sun),
                                          "faceToMacroAngleDegrees": angle(face, macro), "faceToFinalAngleDegrees": angle(face, final),
                                          "distanceMinusCurrentGPUKm": old["distanceKm"] - ordinary["fresh"][id_]["rgba"][3],
                                          "currentGPURasterWinnerCertified": False},
        }
        result["rows"].append(row)
    by_id = {row["id"]: row for row in result["rows"]}
    for label in ("L1", "L2", "L3"):
        a, c = by_id[f"{label}-artifact"], by_id[f"{label}-control"]
        ya, yc = a["ordinary"]["linearLuminance"], c["ordinary"]["linearLuminance"]
        result["pairs"].append({
            "ids": [a["id"], c["id"]], "labelsAreHistorical": True,
            "ordinaryRGB": [difference_ratio(x, y) for x, y in zip(a["ordinary"]["rgba"][:3], c["ordinary"]["rgba"][:3])],
            "ordinaryLuminance": {**difference_ratio(ya, yc), "relativeDeltaOverControl": ratio(ya - yc, yc), "signedMichelson": ratio(ya - yc, ya + yc)},
            "macroDotSun": difference_ratio(a["macro"]["dotSun"], c["macro"]["dotSun"]),
            "finalDotSun": difference_ratio(a["final"]["dotSun"], c["final"]["dotSun"]),
            "factors": {key: difference_ratio(a["factors"][key], c["factors"][key]) for key in ("D", "S", "V")},
        })
    result["arithmeticConsistencyPassed"] = all(row["macro"]["unitLengthError"] <= EPS and row["final"]["unitLengthError"] <= EPS and row["factors"]["DConsistencyPassed"] and row["factors"]["rangesPassed"] for row in result["rows"])
    result["status"] = "QUALIFIED_SAVED_ARITHMETIC" if result["arithmeticConsistencyPassed"] else "QUALIFIED_INPUTS_ARITHMETIC_FLAGGED"
    result["summary"] = {"points": 12, "maxMacroUnitLengthError": max(row["macro"]["unitLengthError"] for row in result["rows"]),
                         "maxFinalUnitLengthError": max(row["final"]["unitLengthError"] for row in result["rows"]),
                         "maxDAbsoluteResidual": max(row["factors"]["DAbsoluteResidual"] for row in result["rows"]),
                         "strictMacroToFinalSignCrossings": [row["id"] for row in result["rows"] if row["macroToFinal"]["strictSignCrossing"]],
                         "robustMacroToFinalSignCrossings": [row["id"] for row in result["rows"] if row["macroToFinal"]["crossingOutsideNearZeroBand"]]}
    return result


def markdown(report):
    lines = ["# Saved shading ledger analysis", "", f"**{report['status']}**", "",
             "Arithmetic from saved JSON only; historical CPU faces are not certified current GPU raster winners.", ""]
    failed = [item["name"] for item in report.get("gates", []) if not item["passed"]]
    if failed:
        lines.extend(["Failed qualification gates:", "", *[f"- `{name}`" for name in failed], ""])
    if report.get("error"):
        lines.extend([f"Input error: {report['error']}", ""])
    if report.get("rows"):
        lines.extend(["| Historical ID | Macro dot Sun | Final dot Sun | Angle degrees | D | S | V | Ordinary Y |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"])
        for row in report["rows"]:
            lines.append(f"| {row['id']} | {row['macro']['dotSun']:.9g} | {row['final']['dotSun']:.9g} | {row['macroToFinal']['angleDegrees']:.9g} | {row['factors']['D']:.9g} | {row['factors']['S']:.9g} | {row['factors']['V']:.9g} | {row['ordinary']['linearLuminance']:.9g} |")
        lines.extend(["", "| Historical pair | Y artifact/control | Delta Y | Signed Michelson |", "| --- | ---: | ---: | ---: |"])
        for pair in report["pairs"]:
            y = pair["ordinaryLuminance"]
            lines.append(f"| {' / '.join(pair['ids'])} | {y['artifactOverControl']} | {y['delta']:.9g} | {y['signedMichelson']} |")
        lines.append("")
    lines.extend(["Limits:", "", *[f"- {limit}" for limit in report.get("limits", [])], ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ledger", type=Path, default=BASE / "browser/shading-ledger.json")
    parser.add_argument("--faces", type=Path, default=BASE / "face-witness-reuse/faces12.json")
    parser.add_argument("--output-json", type=Path, default=OWN / "shading-ledger-analysis.json")
    parser.add_argument("--output-md", type=Path, default=OWN / "shading-ledger-analysis.md")
    args = parser.parse_args()
    for output in (args.output_json, args.output_md):
        if not output.resolve().is_relative_to(OWN):
            parser.error("Outputs must remain inside this analysis directory")
    if not args.ledger.is_file() or not args.faces.is_file():
        parser.exit(2, "Pending saved input: both ledger and faces files must exist; no analysis written.\n")
    inputs = {}
    try:
        ledger, inputs["ledger"] = read_json(args.ledger.resolve())
        faces, inputs["faces"] = read_json(args.faces.resolve())
        report = analyze(ledger, faces, inputs)
    except (ValueError, KeyError, TypeError, OverflowError, IndexError) as error:
        report = {"schema": "cloudia-shading-ledger-saved-analysis-v1", "status": "UNQUALIFIED_INPUT_ERROR", "inputs": inputs,
                  "error": str(error), "gates": [], "rows": [], "pairs": [], "limits": ["No causal attribution is permitted from malformed/unqualified input."]}
    args.output_json.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    args.output_md.write_text(markdown(report))
    print(json.dumps({"status": report["status"], "rows": len(report["rows"]), "output": str(args.output_json.resolve())}))
    return 0 if report["status"] == "QUALIFIED_SAVED_ARITHMETIC" else 1


if __name__ == "__main__":
    sys.exit(main())
