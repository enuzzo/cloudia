from pathlib import Path
import hashlib,json,math
p=Path(__file__).resolve().parent
names=['preliminary-B-30s.json','preliminary-A-after-30s.json','preliminary-near-A-30s.json','preliminary-near-B-30s.json','preliminary-near-v45-30s.json','preliminary-near-A-after-30s.json','preliminary-rain-v45-30s.json','preliminary-near-v46-30s.json','preliminary-rain-v46-30s.json']
rows=[];reports={}
for n in names:
 r=json.loads((p/n).read_text());reports[n]=r
 assert r['output']==r['internal']==[2560,1440]
 assert r['volume']==[256]*3 and r['detailVolume']==[128]*3 and r['nominalSteps']==384
 assert r['quality']=='ultra' and r['seed']==72 and r['paused']
 assert r['simulationTimeStart']==r['simulationTimeEnd']==60
 assert r['clockStateStart']['forcingTime']==r['clockStateEnd']['forcingTime']==0
 assert r['clockStateStart']['precipitationUniformTime']==r['clockStateEnd']['precipitationUniformTime']==0
 assert r['presentedCanvasFps'] is None
 st=r['stats'];intervals=r['frameIntervalsMs'];assert len(intervals)==st['frames']
 assert abs(sum(intervals)-st['durationMs'])<1e-5
 assert abs(st['frames']*1000/st['durationMs']-r['submissionFps'])<1e-9
 if 'v46' in n:
  expected='rain' if '-rain-' in n else 'dry'
  assert r['narrowCloudSkip']['specialization']==r['narrowCloudSpecializationEnd']==expected
  assert r['narrowCloudSkip']['boundInIntegrator']==(expected=='rain')
 q=r['queuePrefix'];assert q['status']=='completed' and q['unconfirmedMeasuredFrames']==0 and q['confirmedPrefixId']==q['measuredSubmissions']==st['frames']
 rows.append({'file':n,'sha256':hashlib.sha256((p/n).read_bytes()).hexdigest(),'renderer':r['rendererVersion'],'submissionFps':r['submissionFps'],'p95Ms':st['p95Ms'],'p99Ms':st['p99Ms'],'endDrainMs':q['endDrainMs'],'completeDraws':r['timestampPasses']['coverage']['render'],'scope':'preliminary; unresponsive terrain tab, unknown background state'})

def compare(a,b):
 x=reports[a];y=reports[b]
 for k in ['camera','quality','output','internal','nominalSteps','volume','detailVolume','seed','shape','supportBounds','sun','paused']:
  assert x[k]==y[k],k
 assert x['weather']['sky']==y['weather']['sky']
 assert abs(x['weather']['rain']-y['weather']['rain'])<1e-6
 return {'baseline':a,'candidate':b,'changePercent':(y['submissionFps']/x['submissionFps']-1)*100,'cameraAndQualityEqual':True,'rainTolerance':1e-6}
comparison=[compare('preliminary-A-after-30s.json','preliminary-B-30s.json'),compare('preliminary-A-after-30s.json','preliminary-rain-v45-30s.json'),compare('preliminary-near-A-30s.json','preliminary-near-B-30s.json'),compare('preliminary-near-A-after-30s.json','preliminary-near-v45-30s.json'),compare('preliminary-near-A-after-30s.json','preliminary-near-v46-30s.json'),compare('preliminary-A-after-30s.json','preliminary-rain-v46-30s.json')]
out={'status':'PASS finite report consistency; not performance acceptance','reports':rows,'comparisons':comparison}
(p/'variant-verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'status':out['status'],'reports':len(rows),'comparisons':comparison},indent=2))
