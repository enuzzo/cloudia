"""Independent reduction of saved A/B JSON only; never imports generators."""
from pathlib import Path
import json,hashlib,math,csv
R=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inputs=json.loads((R/'input-manifest.json').read_text());cases={};controls={}
for name in ['A-baseline','B-candidate']:
 v=json.loads((R/(name+'-validation.json')).read_text());assert v['status']=='PASS_VALID_FULL_QUALITY_MORPHOLOGY_JSON'
 assert v['outputSha256']==sha(R/(name+'.json'))
 q=json.loads((R/(name+'.json')).read_text());cases[name]=q['cases'][0]
 controls[name]=json.loads((R/(name+'-control.json')).read_text());assert controls[name]['exitCode']==0
 assert controls[name]['scriptSha256']==inputs['commonScriptSha256'] and controls[name]['sourceManifestSha256']==inputs['cases'][name]['expected']
a,b=cases.values();massA=a['integratedDensity'];massB=b['integratedDensity'];delta=massB-massA
sections=[]
for left,right in zip(a['sections'],b['sections']):
 assert left['height']==right['height']
 sections.append({'heightKm':left['height'],'massA':left['mass'],'massB':right['mass'],'massDelta':right['mass']-left['mass'],
  'occupiedAreaA':left['area'],'occupiedAreaB':right['area'],'occupiedAreaDelta':right['area']-left['area'],
  'bulkAreaA':left['denseArea'],'bulkAreaB':right['denseArea'],'bulkAreaDelta':right['denseArea']-left['denseArea']})
with open(R/'section-deltas.csv','w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(sections[0]));writer.writeheader();writer.writerows(sections)
profile=[]
for left,right in zip(a['upperProfile'],b['upperProfile']):
 assert left['x']==right['x'];profile.append({'xKm':left['x'],'heightA':left['height'],'heightB':right['height'],'deltaKm':right['height']-left['height']})
with open(R/'upper-profile-deltas.csv','w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(profile[0]));writer.writeheader();writer.writerows(profile)
faces=[]
for left,right in zip(a['boundaryLayers']['faces'],b['boundaryLayers']['faces']):
 assert left['axis']==right['axis'] and left['side']==right['side']
 faces.append({'axis':left['axis'],'side':left['side'],'A':left['layers'],'B':right['layers']})
section_delta=math.fsum(x['massDelta'] for x in sections);assert abs(section_delta-delta)<1e-6*max(1,massA,massB)
report={'status':'FULL_QUALITY_SAVED_JSON_AB_REDUCTION_NOT_ART_PASS','seed':617,'quality':{'macro':256,'detail':128},
 'inputOutputSha256':{name:sha(R/(name+'.json')) for name in cases},'sourceManifests':{name:c['expected'] for name,c in inputs['cases'].items()},
 'mass':{'A':massA,'B':massB,'delta':delta,'percent':delta/massA*100,'units':'dimensionless authored macroR density×km³, not water mass'},
 'occupiedFraction':{'A':a['occupiedFraction'],'B':b['occupiedFraction'],'absoluteDelta':b['occupiedFraction']-a['occupiedFraction'],'relativePercent':(b['occupiedFraction']/a['occupiedFraction']-1)*100},
 'centroid':{'A':a['centroid'],'B':b['centroid'],'deltaMetres':[(y-x)*1000 for x,y in zip(a['centroid'],b['centroid'])]},
 'spread':{'A':a['spread'],'B':b['spread'],'deltaMetres':[(y-x)*1000 for x,y in zip(a['spread'],b['spread'])]},
 'bulk':{'A':a['bulk'],'B':b['bulk'],'largestFractionDelta':b['bulk']['largestMassFraction']-a['bulk']['largestMassFraction'],
  'scope':'Face-connected macroR at byte>=41 (.16 threshold); thin/fine/deformed/ray density is not this criterion'},
 'verticalSections':{'sumMassDelta':section_delta,'reductionResidualVsGlobal':section_delta-delta,
  'positiveSectionSum':math.fsum(max(0,s['massDelta']) for s in sections),'negativeSectionSum':math.fsum(min(0,s['massDelta']) for s in sections),
  'maxIncrease':max(sections,key=lambda x:x['massDelta']),'maxDecrease':min(sections,key=lambda x:x['massDelta']),
  'scope':'Differences of per-height totals, not per-voxel positive/negative mass decomposition'},
 'upperProfile':{'higherColumns':sum(p['deltaKm']>0 for p in profile),'lowerColumns':sum(p['deltaKm']<0 for p in profile),'unchangedColumns':sum(p['deltaKm']==0 for p in profile),
  'maxIncrease':max(profile,key=lambda p:p['deltaKm']),'maxDecrease':min(profile,key=lambda p:p['deltaKm'])},
 'supportBounds':{'A':a['supportBounds'],'B':b['supportBounds']},'boundaryFaces':faces,
 'boundarySummary':{name:{'outerNonzeroRTotal':sum(f['layers'][0]['nonzeroR'] for f in c['boundaryLayers']['faces']),
  'secondNonzeroRTotal':sum(f['layers'][1]['nonzeroR'] for f in c['boundaryLayers']['faces']),
  'maxSecondLayerRByte':c['boundaryLayers']['maximumSecondLayerRByte']} for name,c in cases.items()},
 'budget':{name:{'elapsedSeconds':c['elapsedSeconds'],'cpuSeconds':c['childCpuSeconds'],'highwaterRssBytes':c['lifetimeHighwaterRssBytes'],'exitCode':c['exitCode']} for name,c in controls.items()},
 'r1FailurePreserved':{'path':str(R.with_name('morphology617-ab')/'TERMINAL-R1.json'),'status':'Internal1GiB guard FAIL, not product requirement; no baseline result from R1 used'},
 'limits':['Saved-statistics comparison, not a second full density replay. MacroDataSha values record generated payloads not retained here.',
 'Outer faces are forced0 by generation; second layers are a bounded cropping-risk observation, not proof over continuous geometry or all seeds.',
 'Bulk threshold/6connectivity can change with sampling and does not establish optical or artistic continuity.',
 'Generation wall/CPU and RSS are budget evidence, not GPU/FPS or causal performance comparison.',
 'No old R3 preflight substituted; no GPU, browser, product edits, art PASS or adoption.']}
(R/'comparison.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
