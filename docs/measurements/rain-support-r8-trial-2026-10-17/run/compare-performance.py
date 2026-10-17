"""Compare the three already saved windows against the gate fixed before B."""
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
rows = []
for name in ('performance-a1', 'performance-b', 'performance-a2'):
    row = json.loads((root / 'browser' / (name + '-validity.json')).read_text())
    assert row['status'] == 'PASS_WINDOW_INPUTS_AND_ARITHMETIC'
    rows.append({'name': name, **row})
a1, b, a2 = rows
fps_base = max(a1['stats']['fps'], a2['stats']['fps'])
queue_base = max(a1['queue']['completionBoundedSubmissionFps'], a2['queue']['completionBoundedSubmissionFps'])
gates = {
    'submissionFpsAtLeast5Percent': b['stats']['fps'] >= 1.05 * fps_base,
    'completionBoundedAtLeast5Percent': b['queue']['completionBoundedSubmissionFps'] >= 1.05 * queue_base,
    'p95NoWorse': b['stats']['p95Ms'] <= max(a1['stats']['p95Ms'], a2['stats']['p95Ms']),
    'p99NoWorse': b['stats']['p99Ms'] <= max(a1['stats']['p99Ms'], a2['stats']['p99Ms']),
}
out = {
    'status': 'PASS_ADOPTION_GATE' if all(gates.values()) else 'FAIL_ADOPTION_GATE_NO_ADOPTION',
    'gateFrozenBeforeB': True, 'gates': gates,
    'submissionFpsBVsMaxA_percent': 100 * (b['stats']['fps'] / fps_base - 1),
    'completionBoundedBVsMaxA_percent': 100 * (b['queue']['completionBoundedSubmissionFps'] / queue_base - 1),
    'baselineA2VsA1_percent': 100 * (a2['stats']['fps'] / a1['stats']['fps'] - 1),
    'submissionThreshold': 1.05 * fps_base, 'completionBoundedThreshold': 1.05 * queue_base,
    'rows': rows,
    'invalidPerformanceWindows': 0,
    'sourceQualificationRepair': 'R1 579pass/1fail old five-buffer test; R2 changes only test packet expectation to six and passes580; runtime unchanged',
    'limitations': [
        'One A/B/A bracket; no confidence interval or isolated thermal/driver state',
        'Phase accepted within frozen100ms; active dt is not replayed per frame',
        'Presented FPS not measured', 'Native parity is one paused Rain state only',
        'No hero/worker/other weather or anatomy trial after failed adoption gate',
    ],
}
(root / 'browser/performance-comparison.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps({key: value for key, value in out.items() if key != 'rows'}, indent=2))
