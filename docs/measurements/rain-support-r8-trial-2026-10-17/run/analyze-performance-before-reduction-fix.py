"""Read existing UI JSON only; no model, benchmark, test or GPU replay."""
from pathlib import Path
import sys,json,hashlib,struct,math
p=Path(sys.argv[1]);expected=sys.argv[2];v=json.loads(p.read_text());native=json.loads((p.parent/'native-a-rain.json').read_text());values=v['frameIntervalsMs'];s=sorted(values);n=len(s);duration=sum(values);percentile=lambda x:s[min(n-1,int(n*x))]
recomputed={'frames':n,'durationMs':duration,'fps':n*1000/duration,'medianMs':percentile(.5),'p95Ms':percentile(.95),'p99Ms':percentile(.99),'maxMs':s[-1],'over18Ms':sum(x>18 for x in values),'over33Ms':sum(x>33.34 for x in values)}
q=v['queuePrefix'];checks={
 'statisticsRecompute':recomputed==v['stats'],'finiteIntervals':all(math.isfinite(x) and x>0 for x in values),
 'sourceVersion':v['rendererVersion']==expected,'fullQuality':v['quality']=='ultra' and v['volume']==[256]*3 and v['detailVolume']==[128]*3 and v['nominalSteps']==384,
 'fullOutput':v['output']==[2474,1844] and v['internal']==[2474,1844] and v['outputMode']=='screen','fullModes':v['flowMode']=='full' and v['ablation']=='full' and v['maxFramesInFlight'] is None,
 'timingStagesMain':v['timingMode']=='stages' and v['executionThread']=='main',
 'startEnvelope':60<=v['simulationTimeStart']<=60.1 and 0<=v['clockStateStart']['forcingTime']<=.1,
 'settledRain':struct.pack('f',v['weather']['rain'])==struct.pack('f',.8) and v['weather']['sky']=='rain' and v['skyPending'] is False and v['weather']['atmosphereTransition']==1,
 'motion':v['paused'] is False and v['orbit'] is False and v['simulationTimeEnd']>v['simulationTimeStart'],
 'noFlash':v['weather']['autoLightning'] is False and v['flashCountStart']==v['flashCountEnd']==0 and v['weather']['flashPreview'] is False,
 'windDispersionSpeed':v['weather']['wind']==.55 and v['weather']['dispersion']==0 and v['weather']['speed']==1,
 'cameraHeld':v['camera']['origin']==v['cameraEnd']['origin']==native['metadata']['camera']['origin'] and v['camera']['comparisonTargetKm']==native['metadata']['camera']['comparisonTargetKm'],
 'duration90':duration>=90000,'queueCompleted':q['status']=='completed' and q['confirmedPrefixId']==q['measuredSubmissions']==n and q['unconfirmedMeasuredFrames']==0,
 'completionRateRecompute':q['completionBoundedSubmissionFps']==n*1000/(q['samples'][-1]['resolvedAtMs']-q['windowStartedAtMs']),
 'presentationUnmeasured':v['presentedCanvasFps'] is None}
if expected=='experiment-v61-support-alpha-r8-r1':
 b=json.loads((p.parent/'native-b-rain.json').read_text())['metadata']['supportSampling']
 checks['supportR8BoundThroughout']=v.get('supportSamplingStart')==v.get('supportSamplingEnd')==b
else:
 checks['canonicalHasNoSupportR8']='supportSamplingStart' not in v and 'supportSamplingEnd' not in v

out={'status':'PASS_WINDOW_INPUTS_AND_ARITHMETIC' if all(checks.values()) else 'FAIL_WINDOW_QUALIFICATION','reportSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'checks':checks,'stats':recomputed,'simulationStart':v['simulationTimeStart'],'forcingStart':v['clockStateStart']['forcingTime'],'simulationEnd':v['simulationTimeEnd'],'queue':{k:q[k] for k in ['status','measuredSubmissions','confirmedPrefixId','endDrainMs','completionBoundedSubmissionFps','maxUnconfirmedMeasuredFrames']},'timestampCoverage':v.get('timestampPasses',{}).get('coverage'),'scope':'Saved report arithmetic/context only; no presentation, paired frame replay, isolated GPU throughput, broad visual or global60 claim'}
p.with_name(p.stem+'-validity.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'path':str(p),'status':out['status'],'failed':[k for k,x in checks.items() if not x],'fps':recomputed['fps'],'start':[v['simulationTimeStart'],v['clockStateStart']['forcingTime']]}));raise SystemExit(0 if all(checks.values()) else 1)
