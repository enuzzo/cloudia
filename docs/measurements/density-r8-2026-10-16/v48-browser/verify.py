from pathlib import Path
import hashlib, json, statistics, gzip

p = Path(__file__).resolve().parent
def payload(path):
    return path.read_bytes() if path.exists() else gzip.decompress(path.with_name(path.name + '.gz').read_bytes())

rows = []
for name in ['worker-rain-static-30s', 'main-rain-motion-90s', 'main-dry-after-rain-30s']:
    raw = payload(p / (name + '.json'))
    a = json.loads(raw)
    n = a['stats']['frames']
    assert len(a['frameIntervalsMs']) == n
    assert abs(sum(a['frameIntervalsMs']) - a['stats']['durationMs']) < 1e-5
    assert abs(n * 1000 / a['stats']['durationMs'] - a['submissionFps']) < 1e-9
    assert a['rendererVersion'] == 'observatory-v48-rain-density-r8-trial'
    assert a['output'] == a['internal'] == [2560, 1440]
    assert a['volume'] == [256] * 3 and a['detailVolume'] == [128] * 3
    assert a['nominalSteps'] == 384 and a['quality'] == 'ultra'
    assert a['flowMode'] == a['ablation'] == 'full' and a['presentedCanvasFps'] is None
    q = a['queuePrefix']
    assert q['status'] == 'completed' and q['unconfirmedMeasuredFrames'] == 0
    assert q['confirmedPrefixId'] == q['measuredSubmissions'] == n
    expected = 'macro-rgba8-r' if 'dry' in name else 'r8unorm-extracted-r'
    d = a['densitySamplingStart']
    assert d == a['densitySamplingEnd'] and d['path'] == expected
    assert d['extraGpuPayloadBytes'] == d['extraCpuPayloadBytes'] == 16777216
    assert d['fallback'] is None
    t = a['timestampPasses']
    for key in ['duplicateUidRows', 'invalidPassRows', 'ambiguousPassRows', 'duplicateCallSlots']:
        assert t['diagnostics'][key] == 0
    for kind in ['render', 'compute']:
        c, s = t['coverage'][kind], t['completeSamples'][kind]
        assert c['measuredDraws'] == n and c['completeDraws'] == len(s)
        assert abs(statistics.mean(x['passSumMs'] for x in s) - t['statistics'][kind]['meanMs']) < 1e-7
    if 'motion' in name:
        assert not a['paused'] and a['stats']['durationMs'] >= 90000
        assert a['simulationTimeEnd'] > a['simulationTimeStart']
        assert a['clockStateEnd']['precipitationUniformTime'] > a['clockStateStart']['precipitationUniformTime']
    else:
        assert a['paused'] and a['simulationTimeStart'] == a['simulationTimeEnd']
    assert a['executionThread'] == ('worker' if name.startswith('worker') else 'main')
    rows.append(dict(name=name, sha256=hashlib.sha256(raw).hexdigest(), fps=a['submissionFps'],
                     stats=a['stats'], prefix=q['status'], drainMs=q['endDrainMs'],
                     completionBoundedRate=q['completionBoundedSubmissionFps'],
                     simulationTime=[a['simulationTimeStart'], a['simulationTimeEnd']],
                     clockState=[a['clockStateStart'], a['clockStateEnd']], path=expected,
                     timestampCoverage=t['coverage']))
for name in ['worker-console.json', 'main-console.json']:
    assert json.loads((p / name).read_text()) == []
result = dict(status='PASS scoped v48 runtime and report consistency; global60 and artistic gates OPEN',
              runs=rows, presentationMeasured=False,
              comparisonCausality='v48 runs qualify paths and completed prefixes, not new A/B improvement claims; v47 frozen rain shader is identical',
              motionImages='before/after only; no continuous video or temporal-art acceptance')
(p / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(result['status'])
