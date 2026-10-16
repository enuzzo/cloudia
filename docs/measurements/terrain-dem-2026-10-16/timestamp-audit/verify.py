#!/usr/bin/env python3
"""Independent offline audit of recorded GPU timestamp values; never uses a GPU."""
from pathlib import Path
from collections import Counter
from statistics import mean, median
import gzip, hashlib, json, math, re

HERE=Path(__file__).resolve().parent
RAW_SHA='f493c72379a7239deaeb87433ceebf608c1aa9b189c02c431a66bcc10431ce58'
raw=gzip.decompress((HERE/'timestamp-r2-dom.json.gz').read_bytes())
assert hashlib.sha256(raw).hexdigest()==RAW_SHA
manifest_path=HERE/'manifest.json'
if manifest_path.exists():
 for item in json.loads(manifest_path.read_text())['files']:
  assert hashlib.sha256((HERE/item['path']).read_bytes()).hexdigest()==item['sha256'],item['path']
provenance=json.loads((HERE/'provenance.json').read_text())
for filename,key in [('harness-r2-manifest.json.gz','manifestSha256'),('harness-r2-source-scope.json.gz','sourceScopeSha256')]:
 assert hashlib.sha256(gzip.decompress((HERE/filename).read_bytes())).hexdigest()==provenance['harness'][key]
x=json.loads(raw)
assert x['status']=='RECORDED_ALL_GATES_PASS' and all(x['gates'].values())
assert x['errors']==[] and x['validation'] is None
s=x['initial'];assert s==x['final']
assert s['sourceCheckpoint']=='b985617' and s['quality']=='ultra' and s['nominalSteps']==384
assert s['output']==s['internal']==[round(s['observedViewport'][0]*s['observedViewport'][2]),round(s['observedViewport'][1]*s['observedViewport'][2])]
assert s['output']==[2474,1844] and s['volume']==[256,256,256] and s['detailVolume']==[128,128,128]
assert s['resolution']==s['output'] and s['skyPending'] is False and s['atmosphereProgress']==1
assert s['density']['path']=='r8unorm-extracted-r' and s['wind']==.55 and s['dispersion']==0 and s['forcingTime']==s['precipitationTime']==0
assert s['seed']==74 and s['paused'] and s['simulationTime']==60 and s['flow']=='full' and s['ablation']=='full'
assert s['sky']=='rain' and abs(s['rain']-.8)<1e-6 and s['narrow'] is True and s['ground']==1
assert set(x['deviceFeatures'])=={'core-features-and-limits','timestamp-query'}
assert len(x['draws'])==12 and len(x['stages'])==48 and len(x['clears'])==24
assert Counter(c['draw'] for c in x['clears'])==Counter({i:2 for i in range(1,13)})
assert all(c['timestampWrites'] is False for c in x['clears'])
roles=['terrain-shadow','terrain-radiance','cloud-integrator','output-color-transform']
shader_ids={}
for digest,value in x['compiledShaders'].items():
 b=value['source'].encode();assert len(b)==value['bytes'] and hashlib.sha256(b).hexdigest()==digest
assert len(x['compiledShaders'])==4
for d in x['draws']:
 i=d['draw'];assert 1<=i<=12 and d['stateUnchanged'] and d['renderCallDelta']==4 and d['computeCallDelta']==1
 assert d['before']['frame']==d['after']['frame'] and d['after']['render']-d['before']['render']==4 and d['after']['compute']-d['before']['compute']==1
 stages=[z for z in x['stages'] if z['draw']==i]
 assert [z['role'] for z in stages]==roles
 for key in ['uid','materialId','pipelineLocalId','nativePipelineLocalId','fragmentProgramId','fragmentShaderSha256']:
  assert len({z[key] for z in stages})==4,(i,key)
 for offset,z in enumerate(stages,1):
  assert z['uid']==f"r:{d['before']['render']+offset}:{[1,3,4,5][offset-1]}:f{d['before']['frame']}"
  target=z['target'];assert target['samples']==1 and target['depth'] is True
  assert [target['width'],target['height']]==([2048,2048] if offset==1 else s['output'])
  assert target['canvas']==(offset==4)
  assert [t['gpuFormat'] for t in target['textures']]==([['r32float'],['rgba32float'],['rgba16float'],[]][offset-1])
  assert z['usedSceneOverride']==(offset==1)
  if offset==1:assert z['sourceMaterialId']!=z['materialId'] and z['sourceMaterialName']=='Cloudia terrain radiance and km distance'
  else:assert z['sourceMaterialId']==z['materialId']
  shader_ids.setdefault(z['role'],set()).add(z['fragmentShaderSha256'])
assert all(len(v)==1 for v in shader_ids.values())
source={r:x['compiledShaders'][next(iter(h))]['source'] for r,h in shader_ids.items()}
assert re.search(r'\bfn\s+integrateCloud\s*\(',source['cloud-integrator'])
assert re.search(r'\bfn\s+terrainShadowCasterMinimum\s*\(',source['terrain-shadow'])
assert re.search(r'\bfn\s+terrainSurfaceMaterial\s*\(',source['terrain-radiance'])
assert 'integrateCloud' not in source['output-color-transform'] and 'textureSample' in source['output-color-transform']
assert re.search(r'\bfn\s+sRGBTransferOETF\s*\(',source['output-color-transform'])
rows={}
for kind,count in [('render',48),('compute',12)]:
 batch=x[kind+'Batch'];absolute=x[kind+'Absolute']
 assert batch['fresh'] and batch['status']=='fresh' and len(batch['passes'])==len(absolute)==count
 assert len({p['uid'] for p in absolute})==count
 assert sorted(i for p in absolute for i in p['queryIndices'])==list(range(count*2))
 passes={p['uid']:p for p in batch['passes']}
 assert set(passes)=={p['uid'] for p in absolute}
 for p in absolute:
  assert p['resolveSerial']==1 and p['queryCount']==count*2
  assert re.fullmatch(r'\d+',p['startNs']) and re.fullmatch(r'\d+',p['endNs'])
  start,end=int(p['startNs']),int(p['endNs']);assert end>=start>0
  expected=passes[p['uid']];assert p['queryIndices']==expected['queryIndices'] and (end-start)/1e6==expected['durationMs']
  if kind=='render':rows[p['uid']]=(start,end)
assert len(set(rows.values()))==48

def union(intervals):
 total=0;end=None
 for start,stop in sorted(intervals):
  if end is None or start>end:total+=stop-start;end=stop
  elif stop>end:total+=stop-end;end=stop
 return total

def stats(values):
 return {'count':len(values),'mean':mean(values),'median':median(values),'min':min(values),'max':max(values),'total':sum(values)}

relations=[];pair_counts=Counter();multiplicity_ns=Counter();sum_ns=0;union_ns=0;per_role={r:[] for r in roles};last_end=None
for i in range(1,13):
 stages=[z for z in x['stages'] if z['draw']==i];intervals=[rows[z['uid']] for z in stages]
 for z,(a,b) in zip(stages,intervals):per_role[z['role']].append((b-a)/1e6)
 for a in range(4):
  for b in range(a+1,4):
   amount=min(intervals[a][1],intervals[b][1])-max(intervals[a][0],intervals[b][0])
   if amount>0:pair_counts[f'{roles[a]} / {roles[b]}']+=1
 a,b=intervals[2:];overlap=max(0,min(a[1],b[1])-max(a[0],b[0]))
 record={'draw':i,'cloudUID':stages[2]['uid'],'outputUID':stages[3]['uid'],'cloudStartNs':str(a[0]),'cloudEndNs':str(a[1]),'outputStartNs':str(b[0]),'outputEndNs':str(b[1]),
  'overlapNs':str(overlap),'overlapMs':overlap/1e6,'equalStarts':a[0]==b[0],'equalEnds':a[1]==b[1],'startDeltaMs':(b[0]-a[0])/1e6,'endDeltaMs':(b[1]-a[1])/1e6}
 original=x['relations'][i-1]
 assert original['status']=='recorded' and original['draw']==i and original['overlapNs']==str(overlap)
 assert original['cloudUID']==record['cloudUID'] and original['outputUID']==record['outputUID']
 assert original['outputStartsBeforeCloudEnds']==(b[0]<a[1]) and original['equalStarts']==record['equalStarts'] and original['equalEnds']==record['equalEnds']
 assert overlap>0
 if last_end is not None:assert min(t[0] for t in intervals)>=last_end
 last_end=max(t[1] for t in intervals)
 events=Counter()
 for start,stop in intervals:events[start]+=1;events[stop]-=1
 active=0;previous=None
 for instant,delta in sorted(events.items()):
  if previous is not None and active>0:multiplicity_ns[active]+=instant-previous
  active+=delta;assert 0<=active<=4;previous=instant
 assert active==0
 sum_ns+=sum(stop-start for start,stop in intervals);union_ns+=union(intervals);relations.append(record)
assert pair_counts['cloud-integrator / output-color-transform']==12
assert sum_ns==sum(n*span for n,span in multiplicity_ns.items())
assert union_ns==sum(multiplicity_ns.values())
assert sum_ns-union_ns==sum((n-1)*span for n,span in multiplicity_ns.items())
summary={'scope':'Recorded timestamp interval overlap, not proof of hardware parallelism, command-buffer cause, exclusive busy time or FPS',
 'rawSha256':RAW_SHA,'checkpoint':'b985617 R5 external diagnostic','output':s['output'],'driver':'12 logical draws, one in flight; same-grid R5 source, source-entry Three186 bundling and observer hooks',
 'independentChecks':'PASS: 48 render +12 compute endpoints/durations/indices, 48 role/target/pipeline records,4 compiled shader hashes,12 draw ledgers,24 clear calls, native/full-quality state and initial/final equality',
 'roles':{r:{'compiledShaderSha256':next(iter(shader_ids[r])),'returnedDurationMs':stats(per_role[r])} for r in roles},
 'overlappingRolePairs':dict(pair_counts),'returnedIntervalMultiplicityMs':{str(n):span/1e6 for n,span in sorted(multiplicity_ns.items())},'cloudOutputOverlapMs':stats([r['overlapMs'] for r in relations]),'equalStarts':sum(r['equalStarts'] for r in relations),'equalEnds':sum(r['equalEnds'] for r in relations),
 'cloudOutputStartDeltaMs':stats([r['startDeltaMs'] for r in relations]),'cloudOutputEndDeltaMs':stats([r['endDeltaMs'] for r in relations]),
 'sumOfReturnedRenderIntervalsMs':sum_ns/1e6,'unionOfReturnedRenderIntervalsMs':union_ns/1e6,'doubleCountedOverlapMs':(sum_ns-union_ns)/1e6,
 'unionLimit':'Union describes only queried returned intervals, excludes untimed clears/gaps and is not GPU busy time, complete frame time or FPS',
 'relations':relations,'gpuTimestampQuantumGcdNs':math.gcd(*[b-a for a,b in rows.values()]),'adapter':s['adapter'],'deviceFeatures':x['deviceFeatures'],
 'v53Implication':'Preserve whole-frame submission pacing and completed queue-prefix metrics at full native quality; do not sum cloud/output as exclusive costs or assign long intervals to terrain. This R5 diagnostic proves no v53 FPS or 60-stable result.'}
assert (HERE/'summary.json').read_text()==json.dumps(summary,indent=2)+'\n','Summary differs from independent recomputation'
print(json.dumps({'status':'PASS','renderPairs':48,'computePairs':12,'actualRoles':4,'compiledShaderHashes':4,'overlapDraws':12,'overlapMs':summary['cloudOutputOverlapMs'],'sumMs':sum_ns/1e6,'unionMs':union_ns/1e6,'rawSha256':RAW_SHA},indent=2))
