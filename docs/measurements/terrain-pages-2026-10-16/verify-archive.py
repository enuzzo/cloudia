#!/usr/bin/env python3
"""Read-only evidence verification, apart from its own verification.json output.
No terrain point evaluation, tracer, builder, replay or GPU workload is executed.
"""
from pathlib import Path
import hashlib,gzip,json,collections
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def local(name):
    p=Path(name)
    assert not p.is_absolute() and '..' not in p.parts,name
    q=ROOT/p
    assert q.is_file() and not q.is_symlink(),name
    return q
manifest=json.loads(local('manifest.json').read_bytes())
checked=0;originals=0
for item in manifest['files']:
    b=local(item['path']).read_bytes()
    assert len(b)==item['bytes'] and sha(b)==item['sha256'],item['path']
    checked+=1
    if item.get('originalSha256'):
        raw=gzip.decompress(b) if item.get('encoding')=='gzip-original-bytes' else b
        assert len(raw)==item['originalBytes'] and sha(raw)==item['originalSha256'],item['path']
        originals+=1
entries={x['path']:x for x in manifest['files']}
def raw_json(name):
    if name in entries:return json.loads(local(name).read_bytes())
    name+='.gz';return json.loads(gzip.decompress(local(name).read_bytes()))
source_map=raw_json('executed-source-map.json');source_checks=0
for phase,items in source_map['phases'].items():
    result=raw_json('results/packing.json' if phase=='packing' else 'results/full.json')
    assert len(items)==len(result['frozenSourceHashes'])
    for item in items:
        assert sha(local(item['archivePath']).read_bytes())==item['sha256']==result['frozenSourceHashes'][item['executedPath']]
        source_checks+=1
packing=raw_json('results/packing.json');normal=raw_json('results/packing-normalized-summary.json')
a=raw_json('results/packing-original-rows.json');b=raw_json('results/packing-compact-rows.json');full=raw_json('results/full.json');after=raw_json('results/full-rows.json');unresolved=raw_json('results/all-unresolved.json');pages=raw_json('results/pages.json')
assert len(a)==len(b)==len(after)==5198
skip={'metadataLoads','baseRecordLoads','gradientRecordLoads','childClips','blockerKey'}
normalize=lambda r:{k:v for k,v in r.items() if k not in skip}
assert all(normalize(x)==normalize(y) for x,y in zip(a,b))
assert packing['identity']['failureCount']==0 and packing['identity']['count']==5198
assert packing['recordsBefore']==sum(r['metadataLoads'] for r in a)*3==751146
assert packing['recordsAfter']==sum(r['metadataLoads'] for r in b)==99506
assert normal['original']['metadataRecordLoads']==751146 and normal['rawResultSha256']==sha(local('results/packing.json').read_bytes())
assert packing['structural']['bytes']==16*(packing['structural']['nodeCount']+packing['structural']['leafCount'])==3055952
assert pages['descriptor']['bytes']==16*(pages['descriptor']['nodeCount']+pages['descriptor']['leafCount'])==5549520
assert pages['descriptor']['bytes']<=8*1024*1024
assert unresolved==[r for r in after if r['status'].startswith('unresolved')]
assert len(unresolved)==660 and full['unresolvedGatePassed'] is False and full['protocol']['primaryUnresolvedGate']==333
assert dict(collections.Counter(r['status'] for r in after))==full['after']['counts']
assert pages['verification']['failureCount']==0 and pages['verification']['samples']==10240
invalid=[];conflicts=[];regressions=[]
for old,new in zip(b,after):
    assert old['name']==new['name']
    if new['status']=='hit':
        if not(new['enclosureKm']<=.00100001 and new['witness']['upperClearance']<=0):invalid.append(new['name'])
    if old['status']=='hit' and new['status'] in ['miss','outer-envelope-miss']:conflicts.append(new['name'])
    if old['status'] in ['miss','outer-envelope-miss'] and new['status']=='hit':conflicts.append(new['name'])
    if old['status']==new['status']=='hit' and (old['interval'][0]>new['interval'][1]+1e-5 or new['interval'][0]>old['interval'][1]+1e-5):conflicts.append(new['name'])
    if not old['status'].startswith('unresolved') and new['status'].startswith('unresolved'):regressions.append(new['name'])
assert not invalid and not conflicts and not regressions
for key,count,before_count,after_count in [('holdout',48,32,21),('yawHoldout',18,12,7),('controls',2,2,2)]:
    q=pages[key];assert q['before']['count']==q['after']['count']==count and q['before']['unresolved']==before_count and q['after']['unresolved']==after_count
    assert not any(q['safety'].values())
assert full['after']['metadataRecordLoads']==sum(r['metadataLoads'] for r in after)==99662
assert full['after']['heightEvaluations']==sum(r['heightEvaluations'] for r in after)==31207
assert full['after']['visits']==sum(r['visits'] for r in after)==107038
assert not list(ROOT.rglob('*.bin')),'Derived tree binary unexpectedly archived'
report=manifest.get('report')
if report:
    p=ROOT.parents[2]/report['repositoryPath']
    assert p.is_file() and sha(p.read_bytes())==report['sha256'],'Sibling report hash mismatch'
result={'schema':1,'passed':True,'manifestSha256':sha(local('manifest.json').read_bytes()),'payloadFilesChecked':checked,'originalByteStreamsChecked':originals,'executedSourceHashesChecked':source_checks,'packingGeometryIdenticalRays':len(a),'fullGridRays':len(after),'fullUnresolved':len(unresolved),'prospectiveUnresolvedGate':333,'pagingGatePassed':False,'newGeometricConflicts':len(conflicts),'invalidHitWitnesses':len(invalid),'resolvedToUnresolved':len(regressions),'newPageFiniteChecksReported':10240,'terrainPointEvaluationsExecutedByVerifier':0,'tracerOrBuilderExecuted':False,'GPUExecuted':False,'phaseBoundaryDerivedBinaryHashGuardWasPresent':False}
(ROOT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
