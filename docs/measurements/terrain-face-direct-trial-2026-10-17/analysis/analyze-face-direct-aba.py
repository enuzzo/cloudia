#!/usr/bin/env python3
"""Read-only A/B/A saved audit/alias analysis; see frozen PROTOCOL.md."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

OWN = Path(__file__).resolve().parent
BROWSER = OWN.parent / "browser"
PHASES = ("baseline-a", "candidate-b", "return-a")
ORDINARY_SHA = "07fa43ec5de6d77b9bdf83d5a78e73cb607ae573d875ce382b3c28f909fb2fb9"
PNG_A_SHA = "6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9"
POINTS = (("L1-artifact", 71, 856), ("L1-control", 64, 856), ("L2-artifact", 431, 849), ("L2-control", 431, 844),
          ("L3-artifact", 903, 651), ("L3-control", 903, 646), ("C1-ocean", 2200, 1100), ("C2-coastal-lowland", 1800, 930),
          ("C3-plain", 2200, 700), ("C4-ridge-L1", 170, 805), ("C5-ridge-L2", 460, 800), ("C6-ridge-L3", 925, 610))
CAMERA_KEYS = ("origin", "target", "forward", "right", "up", "yaw", "pitch", "approach", "aspect", "tanHalfVerticalFov", "ground",
               "comparisonSurfaceKm", "comparisonTargetKm", "probeSkipped", "terrainClearanceKm")
GEOMETRY_KEYS = ("vertices", "triangles", "stitchedCells", "levels", "cellsPerSide", "baseSpacingKm", "outerExtentKm", "geometryBytes",
                 "sampleCalls", "minimumHeightKm", "maximumHeightKm", "normalMode", "refinement", "geometryScope", "cpuTriangleLookupBytes",
                 "normalPolicy", "perFrameCpuHeightSamples")
SNAPSHOT_KEYS = ("seed", "quality", "nominalSteps", "output", "internal", "canvas", "outputMode", "volume", "detailVolume", "flowMode",
                 "ablation", "ablationCode", "paused", "orbit", "speed", "densitySampling", "terrainOptical", "executionThread")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def valid_sha(value):
    return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


def read_json(path):
    raw = path.read_bytes()
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError(f"Input JSON exceeds 2 MiB: {path}")
    def bad_constant(token):
        raise ValueError(f"Nonstandard JSON constant: {token}")
    return json.loads(raw, parse_constant=bad_constant), {"path": str(path), "bytes": len(raw), "sha256": sha(raw)}


def decoded(row, label):
    bits = row.get("bits")
    if not isinstance(bits, list) or len(bits) != 4 or any(type(v) is not int or not 0 <= v <= 0xffffffff for v in bits):
        raise ValueError(f"Invalid raw Float32 words: {label}")
    values = list(struct.unpack("<4f", struct.pack("<4I", *bits)))
    if not all(math.isfinite(v) for v in values) or values[3] <= 0:
        raise ValueError(f"Nonfinite or missed receiver: {label}")
    if row.get("rgba") != values:
        raise ValueError(f"JSON numbers disagree with saved raw words: {label}")
    return {"rgba": values, "bits": bits}


def selected(value, keys):
    return {key: value[key] for key in keys}


def controls(snapshot):
    return {**selected(snapshot, SNAPSHOT_KEYS), "camera": selected(snapshot["camera"], CAMERA_KEYS),
            "lighting": snapshot["lighting"], "weather": snapshot["weather"]}


def ratio(a, b):
    return a / b if b != 0 else None


def luminance(rgb):
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]


def pair(a, c):
    return {"artifactY": a, "controlY": c, "signedDeltaY": a - c, "artifactOverControl": ratio(a, c),
            "relativeDeltaOverControl": ratio(a - c, c), "signedMichelson": ratio(a - c, a + c)}


def png_proof(phase, audit_snapshot, inputs, gate):
    alias_path = BROWSER / f"{phase}-native-alias.json"
    alias, inputs[f"{phase}.alias"] = read_json(alias_path)
    expected_metadata = f"{phase}-native.json"
    gate(f"{phase}.aliasKind", alias.get("kind") == "native-png-exact-content-alias-v1", alias.get("kind"), "native-png-exact-content-alias-v1")
    gate(f"{phase}.metadataName", alias.get("actualExportMetadata") == expected_metadata, alias.get("actualExportMetadata"), expected_metadata)
    dto, inputs[f"{phase}.nativeMetadata"] = read_json(BROWSER / expected_metadata)
    png = dto["png"]
    gate(f"{phase}.nativeReady", dto.get("state") == "ready", dto.get("state"), "ready")
    gate(f"{phase}.exportPngSHA", png.get("sha256") == PNG_A_SHA and alias.get("actualExportSHA256") == PNG_A_SHA,
         [png.get("sha256"), alias.get("actualExportSHA256")], PNG_A_SHA)
    gate(f"{phase}.nativeControls", controls(dto["metadata"]) == controls(audit_snapshot), None, "native DTO and audit controls identical")
    gate(f"{phase}.nativeMode", dto["metadata"].get("terrainDirectMode") == "ordinary-smooth", dto["metadata"].get("terrainDirectMode"), "ordinary-smooth")
    existing = Path(alias["existingExactPNG"])
    if not existing.is_absolute():
        raise ValueError(f"Expected an absolute existing bitmap path in {alias_path}")
    size = existing.stat().st_size
    if size > 32 * 1024 * 1024 or size < 24:
        raise ValueError(f"Existing PNG outside 24-byte..32-MiB bound: {existing}")
    raw = existing.read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        raise ValueError(f"Existing alias target has no PNG IHDR: {existing}")
    dimensions = list(struct.unpack(">II", raw[16:24]))
    actual_sha = sha(raw)
    inputs[f"{phase}.existingBitmap"] = {"path": str(existing), "bytes": size, "sha256": actual_sha, "dimensions": dimensions}
    gate(f"{phase}.existingPngSHA", actual_sha == PNG_A_SHA, actual_sha, PNG_A_SHA)
    gate(f"{phase}.existingBytes", size == png.get("byteLength") == alias.get("bytes"), [size, png.get("byteLength"), alias.get("bytes")], "same exact encoded byte count")
    gate(f"{phase}.nativeDimensions", dimensions == [png.get("width"), png.get("height")] == [alias.get("width"), alias.get("height")] == [2474, 1844],
         [dimensions, [png.get("width"), png.get("height")], [alias.get("width"), alias.get("height")]], [2474, 1844])
    return {"newActualExportSHA256": png["sha256"], "rehashExistingBitmapSHA256": actual_sha, "bytes": size,
            "dimensions": dimensions, "scope": "Exact encoded-content alias to a new actual export; no new pixel transfer or visual inspection by this analysis."}


def analyze(audits, inputs):
    gates = []
    def gate(name, passed, actual=None, expected=None):
        gates.append({"name": name, "passed": bool(passed), "actual": actual, "expected": expected})
    report = {"schema": "cloudia-face-direct-saved-aba-analysis-v1", "status": "UNQUALIFIED", "inputs": inputs, "gates": gates,
              "scriptSHA256": sha(Path(__file__).read_bytes()), "protocolSHA256": sha((OWN / "PROTOCOL.md").read_bytes()),
              "rows": [], "pairs": [], "directFactorReadback": False,
              "limits": ["Saved JSON/bitmap authentication and arithmetic only; no GPU, browser, model or new ray.",
                         "No actual D or derivative normal is read by this A/B/A experiment.",
                         "Geometry equality is a snapshot-statistics check; whole alpha equality is fixed-view receiver-distance/miss parity, not raw depth or global geometry identity.",
                         "Historical artifact/control IDs do not classify current dark marks; twelve pixels do not measure a whole ribbon or frame.",
                         "RGB changes alone do not establish physical correctness, artistic improvement or FPS."]}
    records = {}
    alpha_hashes = []
    snapshots = {phase: audits[phase]["snapshot"] for phase in PHASES}
    for phase in PHASES:
        audit = audits[phase]
        for flag in ("identical", "stable", "cacheStateQualified"):
            gate(f"{phase}.{flag}", audit.get(flag) is True, audit.get(flag), True)
        gate(f"{phase}.status", audit.get("status") == "COMPLETE_IDENTICAL_F32", audit.get("status"), "COMPLETE_IDENTICAL_F32")
        expected_mode = "geometric-fragment-Y-positive" if phase == "candidate-b" else "ordinary-smooth"
        gate(f"{phase}.mode", snapshots[phase].get("terrainDirectMode") == expected_mode, snapshots[phase].get("terrainDirectMode"), expected_mode)
        phase_hashes = []
        records[phase] = {}
        for kind in ("cached", "fresh"):
            block = audit[kind]
            phase_hashes.append(block["sha256"])
            gate(f"{phase}.{kind}.dimensions", [block.get("width"), block.get("height")] == [2474, 1844], None, [2474, 1844])
            gate(f"{phase}.{kind}.alphaBytes", block.get("alphaBytes") == 18248224, block.get("alphaBytes"), 18248224)
            alpha_hashes.append(block.get("alphaSHA256"))
            witness = block["witness"]
            gate(f"{phase}.{kind}.points", [(row.get("id"), *(row.get("pixel") or [])) for row in witness] == list(POINTS), None, "fixed twelve IDs/coordinates/order")
            records[phase][kind] = {row["id"]: decoded(row, f"{phase}.{kind}.{row['id']}") for row in witness}
        gate(f"{phase}.cacheFreshWholeSHA", phase_hashes[0] == phase_hashes[1] and all(valid_sha(value) for value in phase_hashes), phase_hashes, "identical cached/fresh SHA256")
        gate(f"{phase}.cacheFreshWitnessBits", records[phase]["cached"] == records[phase]["fresh"], None, "48 cached/fresh witness words identical")
        if phase != "candidate-b":
            gate(f"{phase}.ordinaryWholeSHA", phase_hashes == [ORDINARY_SHA, ORDINARY_SHA], phase_hashes, ORDINARY_SHA)
        geometry = snapshots[phase]["terrainRaster"]
        for key, expected in (("vertices", 591788), ("triangles", 1182550), ("geometryBytes", 33127816), ("cpuTriangleLookupBytes", 2949120), ("perFrameCpuHeightSamples", 0)):
            gate(f"{phase}.geometry.{key}", geometry.get(key) == expected, geometry.get(key), expected)
        gate(f"{phase}.fullQuality", snapshots[phase]["quality"] == "ultra" and snapshots[phase]["nominalSteps"] == 384 and snapshots[phase]["volume"] == [256] * 3 and snapshots[phase]["detailVolume"] == [128] * 3,
             selected(snapshots[phase], ("quality", "nominalSteps", "volume", "detailVolume")), "ultra/384/256cubed/128cubed")
        gate(f"{phase}.nativeOutput", snapshots[phase]["output"] == snapshots[phase]["internal"] == snapshots[phase]["canvas"] == [2474, 1844] and snapshots[phase]["outputMode"] == "screen", None, "screen/native2474x1844")
        gate(f"{phase}.fixedOpticalOwner", snapshots[phase]["paused"] is True and snapshots[phase]["orbit"] is False and snapshots[phase]["terrainOptical"]["enabled"] is True, None, "paused/noorbit/optical")
    gate("all.fullAlphaSHA", len(set(alpha_hashes)) == 1 and all(valid_sha(value) for value in alpha_hashes), alpha_hashes, "all six whole alpha digests identical")
    baseline_controls = controls(snapshots["baseline-a"])
    baseline_geometry = selected(snapshots["baseline-a"]["terrainRaster"], GEOMETRY_KEYS)
    for phase in PHASES[1:]:
        gate(f"{phase}.controlsMatchA", controls(snapshots[phase]) == baseline_controls, None, "selected camera/lighting/weather/quality controls identical")
        gate(f"{phase}.geometryStatsMatchA", selected(snapshots[phase]["terrainRaster"], GEOMETRY_KEYS) == baseline_geometry, None, "complete selected geometry stats identical")
    alpha_matches = 0
    for id_, _, _ in POINTS:
        words = [records[phase][kind][id_]["bits"][3] for phase in PHASES for kind in ("cached", "fresh")]
        equal = len(set(words)) == 1
        alpha_matches += equal
        gate(f"all.pixelAlpha.{id_}", equal, words, "same distance uint32 across six reads")
    gate("return-a.allWitnessBitsMatchA", records["return-a"]["fresh"] == records["baseline-a"]["fresh"], None, "all 48 ordinary witness words return exactly")
    report["AEncodedPNGAliases"] = {phase: png_proof(phase, snapshots[phase], inputs, gate) for phase in ("baseline-a", "return-a")}
    report["alphaComparison"] = {"wholeDigests": alpha_hashes, "selectedPixelsComparedAcrossSixReads": 12, "selectedPixelsIdentical": alpha_matches}
    report["wholeHashes"] = {phase: {kind: audits[phase][kind]["sha256"] for kind in ("cached", "fresh")} for phase in PHASES}
    report["controlsCompared"] = baseline_controls
    report["geometryStatsCompared"] = baseline_geometry
    report["allRequiredGatesPassed"] = all(item["passed"] for item in gates)
    if not report["allRequiredGatesPassed"]:
        return report
    for id_, x, y in POINTS:
        phase_values = {phase: records[phase]["fresh"][id_] for phase in PHASES}
        ys = {phase: luminance(row["rgba"][:3]) for phase, row in phase_values.items()}
        a, b = phase_values["baseline-a"], phase_values["candidate-b"]
        report["rows"].append({"id": id_, "pixel": [x, y], "phases": phase_values, "linearLuminance": ys,
                               "candidateMinusARGB": [b["rgba"][i] - a["rgba"][i] for i in range(3)],
                               "candidateOverARGB": [ratio(b["rgba"][i], a["rgba"][i]) for i in range(3)],
                               "candidateMinusAY": ys["candidate-b"] - ys["baseline-a"], "candidateOverAY": ratio(ys["candidate-b"], ys["baseline-a"]),
                               "changedRGBWords": [i for i in range(3) if a["bits"][i] != b["bits"][i]],
                               "returnAWordsIdentical": a["bits"] == phase_values["return-a"]["bits"]})
    by_id = {row["id"]: row for row in report["rows"]}
    for label in ("L1", "L2", "L3"):
        artifact, control = by_id[f"{label}-artifact"], by_id[f"{label}-control"]
        values = {phase: pair(artifact["linearLuminance"][phase], control["linearLuminance"][phase]) for phase in PHASES}
        before, after = values["baseline-a"], values["candidate-b"]
        delta = {key: after[key] - before[key] if after[key] is not None and before[key] is not None else None for key in ("signedDeltaY", "artifactOverControl", "relativeDeltaOverControl", "signedMichelson")}
        report["pairs"].append({"ids": [artifact["id"], control["id"]], "labelsAreHistorical": True, "phases": values, "candidateMinusA": delta})
    report["summary"] = {"changedSelectedPixels": sum(bool(row["changedRGBWords"]) for row in report["rows"]),
                         "changedSelectedRGBWords": sum(len(row["changedRGBWords"]) for row in report["rows"]),
                         "maxAbsoluteSelectedRGBDelta": max(abs(value) for row in report["rows"] for value in row["candidateMinusARGB"]),
                         "candidateWholeDifferentFromA": audits["candidate-b"]["fresh"]["sha256"] != ORDINARY_SHA,
                         "allReturnAWordsIdentical": all(row["returnAWordsIdentical"] for row in report["rows"])}
    report["status"] = "QUALIFIED_SAVED_ABA_ARITHMETIC"
    return report


def markdown(report):
    lines = ["# Face-direct saved A/B/A arithmetic", "", f"**{report['status']}**", "", "No D factor or derivative face normal was read by this experiment.", ""]
    if report.get("error"):
        lines.extend([f"Input error: {report['error']}", ""])
    failed = [gate["name"] for gate in report.get("gates", []) if not gate["passed"]]
    if failed:
        lines.extend(["Failed gates:", "", *[f"- `{name}`" for name in failed], ""])
    if report.get("rows"):
        lines.extend(["| Historical ID | A Y | B Y | B−A Y | B/A Y | Changed RGB words |", "| --- | ---: | ---: | ---: | ---: | ---: |"])
        for row in report["rows"]:
            y = row["linearLuminance"]
            lines.append(f"| {row['id']} | {y['baseline-a']:.9g} | {y['candidate-b']:.9g} | {row['candidateMinusAY']:.9g} | {row['candidateOverAY']} | {len(row['changedRGBWords'])} |")
        lines.extend(["", "| Historical pair | A Michelson | B Michelson | B−A Michelson |", "| --- | ---: | ---: | ---: |"])
        for pair_row in report["pairs"]:
            lines.append(f"| {' / '.join(pair_row['ids'])} | {pair_row['phases']['baseline-a']['signedMichelson']} | {pair_row['phases']['candidate-b']['signedMichelson']} | {pair_row['candidateMinusA']['signedMichelson']} |")
        lines.append("")
    lines.extend(["Limits:", "", *[f"- {limit}" for limit in report.get("limits", [])], ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-json", type=Path, default=OWN / "face-direct-aba-analysis.json")
    parser.add_argument("--output-md", type=Path, default=OWN / "face-direct-aba-analysis.md")
    args = parser.parse_args()
    for output in (args.output_json, args.output_md):
        if not output.resolve().is_relative_to(OWN):
            parser.error("Output must remain inside this analysis directory")
    required = [BROWSER / f"{phase}-audit.json" for phase in PHASES]
    required += [BROWSER / f"{phase}-native{suffix}.json" for phase in ("baseline-a", "return-a") for suffix in ("", "-alias")]
    if any(not path.is_file() for path in required):
        parser.exit(2, "Pending actual saved inputs; no analysis written.\n")
    inputs = {}
    try:
        audits = {}
        for phase in PHASES:
            audits[phase], inputs[f"{phase}.audit"] = read_json(BROWSER / f"{phase}-audit.json")
        report = analyze(audits, inputs)
    except (OSError, ValueError, KeyError, TypeError, OverflowError, IndexError) as error:
        report = {"schema": "cloudia-face-direct-saved-aba-analysis-v1", "status": "UNQUALIFIED_INPUT_ERROR", "inputs": inputs,
                  "error": str(error), "gates": [], "rows": [], "pairs": [], "limits": ["Malformed/unqualified input permits no effect attribution."]}
    args.output_json.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    args.output_md.write_text(markdown(report))
    print(json.dumps({"status": report["status"], "rows": len(report["rows"]), "output": str(args.output_json.resolve())}))
    return 0 if report["status"] == "QUALIFIED_SAVED_ABA_ARITHMETIC" else 1


if __name__ == "__main__":
    sys.exit(main())
