"""Archive/source preservation only. Never imports or reruns Cloudia."""
from pathlib import Path
import argparse
import hashlib
import json

parser = argparse.ArgumentParser()
parser.add_argument('--manifest-sha256', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
archive = Path(__file__).resolve().parent.parent
root = archive.parents[2]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(archive / 'MANIFEST.json') == args.manifest_sha256
manifest = json.loads((archive / 'MANIFEST.json').read_text())
total = 0
for name, row in manifest['payload'].items():
    path = archive / name
    assert path.resolve().is_relative_to(archive.resolve())
    assert path.is_file() and not path.is_symlink(), name
    assert path.stat().st_size == row['bytes'] and sha(path) == row['sha256'], name
    total += row['bytes']
base = json.loads((archive / 'run/source-baseline141.json').read_text())
candidate = json.loads((archive / 'run/SOURCE-FREEZE-R1.json').read_text())
assert len(base) == len(candidate) == 141
changed = {name for name in base if base[name] != candidate[name]}
assert changed == {
    'src/cumulonimbus/cloudShader.ts', 'src/cumulonimbus/GPUSceneEngine.ts',
    'src/cumulonimbus/cloudShader.test.ts', 'src/cumulonimbus/lifecycle.test.ts',
}
for name, digest in base.items():
    assert sha(root / name) == digest, 'Canonical changed: ' + name
for name, digest in candidate.items():
    overlay = archive / 'source-overlay' / name
    assert sha(overlay if overlay.exists() else root / name) == digest, name
comparison = json.loads((archive / 'browser/performance-comparison.json').read_text())
assert comparison['status'] == 'FAIL_ADOPTION_GATE_NO_ADOPTION'
assert comparison['gates'] == {
    'submissionFpsAtLeast5Percent': False, 'completionBoundedAtLeast5Percent': False,
    'p95NoWorse': True, 'p99NoWorse': True,
}
for row in comparison['rows']:
    report = archive / 'browser' / (row['name'] + '.json')
    assert sha(report) == row['reportSHA256']
    assert row['status'] == 'PASS_WINDOW_INPUTS_AND_ARITHMETIC'
    assert all(row['checks'].values())
    assert row['queue']['status'] == 'completed' and row['stats']['fps'] < 60
native = archive / 'browser/native-a-rain.png'
assert sha(native) == '6ea5e9a22052c40ebdbd223594a1a9ec2761e321410e6a009086ea8ca5972fd1'
out = {
    'status': 'PASS_CONSERVATION_ONLY', 'manifestSHA256': args.manifest_sha256,
    'payloadFiles': len(manifest['payload']), 'payloadBytes': total,
    'canonicalSourceFilesExact': 141, 'reconstructedCandidateSourceFilesExact': 141,
    'candidateOverlayFiles': 4, 'candidateAdopted': False,
    'candidateOverall': 'FAIL_ADOPTION_GATE_NO_ADOPTION',
    'invalidInitialA': 'Retained and excluded before B; no threshold widening',
    'global60': 'NOT_REACHED', 'wholeGoal': 'active',
    'modelReplays': 0, 'testReplays': 0, 'GPUReplays': 0,
    'scope': 'File integrity and preserved verdicts only; no new visual, timing or whole-goal qualification.',
}
Path(args.output).write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(out))
