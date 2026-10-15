"""Recheck frozen cycle10 reports; no browser, GPU or writes to report inputs."""
from pathlib import Path
import collections, hashlib, json, math, statistics
base = Path(__file__).resolve().parent
summaries = []
for path in sorted(base.glob('*-30s.json')):
    data = path.read_bytes(); report = json.loads(data)
    assert report['metricsSchemaVersion'] == 3
    assert report['measurementVersion'] == 'submission-queue-prefix-v2-pass-ledger'
    assert report['output'] == report['internal'] == [2560, 1440]
    assert report['volume'] == [256]*3 and report['detailVolume'] == [128]*3
    assert report['nominalSteps'] == 384 and report['seed'] == 72
    assert report['presentedCanvasFps'] is None
    stats = report['stats']; intervals = report['frameIntervalsMs']
    assert stats['frames'] == len(intervals)
    assert math.isclose(sum(intervals), stats['durationMs'], abs_tol=1e-5)
    assert math.isclose(stats['fps'], 1000*len(intervals)/sum(intervals), abs_tol=1e-8)
    queue = report['queuePrefix']
    assert queue['status'] == 'completed'
    assert queue['measuredSubmissions'] == queue['confirmedPrefixId'] == stats['frames']
    assert queue['unconfirmedMeasuredFrames'] == 0
    passes = report['timestampPasses']; diag = passes['diagnostics']
    assert diag['freshBatchCount'] == diag['batchCount'] and diag['staleBatchCount'] == 0
    assert not diag['duplicateUidRows'] and not diag['duplicateCallSlots']
    assert not diag['ambiguousPassRows'] and not diag['invalidPassRows']
    assert not diag['duplicateLedgerIds'] and not diag['duplicateMeasuredIntervalIds']
    measured = [d for d in passes['draws'] if d['measuredIntervalId'] is not None]
    assert len(measured) == stats['frames']
    assert sorted(d['measuredIntervalId'] for d in measured) == list(range(1, stats['frames']+1))
    context_rows = collections.defaultdict(list)
    fresh_uids = []
    for batch in passes['rawBatches']:
        assert batch['status'] == 'fresh' and batch['fresh']
        assert len(batch['passes'])*2 == batch['before']['currentQueryIndex']
        for p in batch['passes']:
            fresh_uids.append(p['uid'])
            context_rows[(p['kind'], p['contextId'])].append(p['durationMs'])
    assert len(set(fresh_uids)) == len(fresh_uids) == diag['freshPassRows']
    cov = {}
    for kind in ['render', 'compute']:
        complete = passes['completeSamples'][kind]
        coverage = passes['coverage'][kind]
        assert coverage['measuredDraws'] == stats['frames']
        assert coverage['completeDraws'] == len(complete)
        assert not coverage['invalidLedgerDraws'] and not coverage['conflictDraws']
        assert sum(d[kind]['expectedCalls'] for d in measured) == coverage['expectedCalls']
        assert sum(d[kind]['matchedFreshCalls'] for d in measured) == coverage['matchedFreshCalls']
        mean = statistics.mean(p['passSumMs'] for p in complete)
        assert math.isclose(mean, passes['statistics'][kind]['meanMs'], abs_tol=1e-8)
        missing = sorted(d['measuredIntervalId'] for d in measured if d[kind]['status'] != 'complete')
        assert missing == list(range(len(complete)+1, stats['frames']+1))
        cov[kind] = {'complete':len(complete), 'measured':stats['frames'], 'missingTail':missing, 'meanPassSumMs':mean}
    if 'clockStateStart' in report:
        for phase in ['clockStateStart', 'clockStateEnd']:
            assert report[phase]['forcingTime'] == report[phase]['precipitationUniformTime'] == 0
    summaries.append({'path':path.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
      'thread':report['executionThread'],'weather':report['weather'], 'camera':report['camera'],
      'stats':stats,'endDrainMs':queue['endDrainMs'],
      'completionBoundedSubmissionFps':queue['completionBoundedSubmissionFps'],
      'coverage':cov,'diagnostics':diag,
      'perContextRawMeans':[{'kind':kind,'contextId':ctx,'count':len(v),'meanMs':statistics.mean(v)} for (kind,ctx),v in context_rows.items()],
      'clockStateStart':report.get('clockStateStart'),'clockStateEnd':report.get('clockStateEnd')})
assert summaries
result = {'passed':True,'scope':'Arithmetic, metadata and ledger integrity of frozen cycle10 reports only; no presentation or physical GPU timeline proof','reports':summaries}
(base/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passed':True,'reports':[{'path':s['path'],'fps':s['stats']['fps'],'complete':s['coverage']['render']['complete']} for s in summaries]},indent=2))
