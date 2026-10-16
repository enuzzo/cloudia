from pathlib import Path
from PIL import Image,ImageChops
import hashlib,json,statistics
p=Path(__file__).resolve().parent
names=['A1','B','A2'];reports={n:json.loads((p/(n+'-30s.json')).read_text()) for n in names}
rows=[]
for n,r in reports.items():
 assert r['output']==r['internal']==[2560,1440]
 assert r['volume']==[256]*3 and r['detailVolume']==[128]*3 and r['nominalSteps']==384
 assert r['quality']=='ultra' and r['seed']==72 and r['paused'] and r['executionThread']=='main'
 assert r['simulationTimeStart']==r['simulationTimeEnd']==60 and r['presentedCanvasFps'] is None
 for k in ['forcingTime','precipitationUniformTime']:assert r['clockStateStart'][k]==r['clockStateEnd'][k]==0
 st=r['stats'];assert len(r['frameIntervalsMs'])==st['frames']
 assert abs(sum(r['frameIntervalsMs'])-st['durationMs'])<1e-5
 assert abs(st['frames']*1000/st['durationMs']-r['submissionFps'])<1e-9
 q=r['queuePrefix'];assert q['status']=='completed' and q['unconfirmedMeasuredFrames']==0
 assert q['confirmedPrefixId']==q['measuredSubmissions']==st['frames']
 t=r['timestampPasses'];diag=t['diagnostics']
 for k in ['duplicateUidRows','invalidPassRows','ambiguousPassRows','duplicateCallSlots']:assert diag[k]==0
 for kind in ['render','compute']:
  c=t['coverage'][kind];s=t['completeSamples'][kind];assert c['measuredDraws']==st['frames'] and len(s)==c['completeDraws']
  assert abs(statistics.mean(x['passSumMs'] for x in s)-t['statistics'][kind]['meanMs'])<1e-7
 if n=='B':
  assert r['rendererVersion']=='observatory-v46-compiled-rain-mask-trial'
  assert r['narrowCloudSkip']['specialization']==r['narrowCloudSpecializationEnd']=='rain'
  assert r['narrowCloudSkip']['boundInIntegrator']
 else:assert r['rendererVersion']=='observatory-v40-terrain-camera-focus' and 'narrowCloudSkip' not in r
 assert abs(r['weather']['rain']-.8)<1e-6 and r['weather']['sky']=='rain' and r['weather']['atmosphereTransition']==1
 rows.append({'name':n,'reportSha256':hashlib.sha256((p/(n+'-30s.json')).read_bytes()).hexdigest(),'submissionFps':r['submissionFps'],'stats':st,'prefixStatus':q['status'],'drainMs':q['endDrainMs'],'completionBoundedRate':q['completionBoundedSubmissionFps'],'timestampCoverage':t['coverage'],'renderPassSumMs':t['statistics']['render']})
keys=['camera','quality','output','internal','nominalSteps','volume','detailVolume','seed','shape','supportBounds','sun','sunDirection','paused','flowMode','ablation','terrainHash','precipitationSourceBounds']
for n in ['B','A2']:
 for k in keys:assert reports[n][k]==reports['A1'][k],(n,k)
 for k in ['wind','dispersion','sky','speed','autoLightning']:
  assert reports[n]['weather'][k]==reports['A1']['weather'][k],(n,k)
base=Image.open(p/'A1-preview.jpg').convert('RGB');images=[]
for n in names:
 b=(p/(n+'-preview.jpg')).read_bytes();im=Image.open(p/(n+'-preview.jpg')).convert('RGB');box=ImageChops.difference(base,im).getbbox()
 assert im.size==(1280,720)
 assert box is None or (box[0]>=840 and box[1]>=616 and box[2]<=952 and box[3]<=696),box
 assert json.loads((p/(n+'-console.json')).read_text())==[]
 images.append({'name':n,'sha256':hashlib.sha256(b).hexdigest(),'differenceBoundsVsA1':box,'scope':'CSS JPEG; scene equal, only possible Regola hover; no native framebuffer/motion proof'})
a1=reports['A1']['submissionFps'];a2=reports['A2']['submissionFps'];b=reports['B']['submissionFps']
out={'status':'PASS finite A/B/A consistency; performance conclusion scoped to this state/device','context':json.loads((p/'context.json').read_text()),'reports':rows,'matchedFields':keys,'images':images,'candidateVsA1Percent':(b/a1-1)*100,'candidateVsA2Percent':(b/a2-1)*100,'candidateVsMeanControlsPercent':(b/((a1+a2)/2)-1)*100,'controlsDriftPercent':(a2/a1-1)*100,'candidateExceedsBothControls':b>max(a1,a2),'presentationMeasured':False,'global60Target':'OPEN'}
(p/'verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:out[k] for k in ['status','candidateVsA1Percent','candidateVsA2Percent','candidateVsMeanControlsPercent','controlsDriftPercent','candidateExceedsBothControls']},indent=2))
