"""Independent offline archive/record verifier; never executes I1 or a generator.

Reads original tar/gzip in memory. No extraction, JS runtime, volume, bake,
test runner, image decoder, browser or GPU is required.
"""
from pathlib import Path
from itertools import product
from collections import Counter
import gzip
import hashlib
import json
import math
import statistics
import struct
import tarfile

BASE=Path(__file__).resolve().parent
def sha(data):return hashlib.sha256(data).hexdigest()
def read_json(name):return json.loads((BASE/name).read_text())
def close(a,b):
    if isinstance(a,dict):
        assert set(a)==set(b)
        for k in a:close(a[k],b[k])
    elif isinstance(a,list):
        assert len(a)==len(b)
        for x,y in zip(a,b):close(x,y)
    elif isinstance(a,float) or isinstance(b,float):
        assert math.isfinite(a) and math.isfinite(b) and math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-12),(a,b)
    else:assert a==b,(a,b)
def add(a,b):return tuple(x+y for x,y in zip(a,b))
def sequential_sum(values):
    total=0
    for value in values:total+=value
    return total
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)

manifest=read_json('manifest.json')
observed={}
for p in sorted(BASE.rglob('*')):
    assert not p.is_symlink(),p
    if p.is_file() and p!=BASE/'manifest.json':
        data=p.read_bytes();observed[str(p.relative_to(BASE))]=dict(bytes=len(data),sha256=sha(data))
assert observed==manifest['files']
assert sum(v['bytes'] for v in observed.values())==manifest['payloadBytes']
lossless=read_json('lossless-provenance.json')
packages={}
for label,proof in lossless['originalPackages'].items():
    files={}
    with tarfile.open(BASE/proof['file'],'r:gz') as archive:
        for member in archive.getmembers():
            assert member.isfile() and member.name.startswith(label+'/')
            assert '..' not in Path(member.name).parts
            name=member.name[len(label)+1:]
            assert name and name not in files
            files[name]=archive.extractfile(member).read()
    raw=files['manifest.json'];original=json.loads(raw)
    assert len(raw)==proof['manifestBytes'] and sha(raw)==proof['manifestSHA256']
    assert set(files)==set(original['files'])|{'manifest.json'}
    assert len(original['files'])==proof['originalPayloads'] and len(files)==proof['archivedFiles']
    assert sum(v['bytes'] for v in original['files'].values())==original['payloadBytes']
    for name,item in original['files'].items():
        assert len(files[name])==item['bytes'] and sha(files[name])==item['sha256'],name
    packages[label]=files
inputs={}
original_inputs={}
for name,proof in lossless['losslessGzipOriginals'].items():
    raw=gzip.decompress((BASE/name).read_bytes())
    assert len(raw)==proof['bytes'] and sha(raw)==proof['sha256']
    inputs[Path(name).name.removesuffix('.gz')]=raw
    original_inputs[proof['originalPath']]=raw

# Causality of the saved primitive mismatch: reciprocal sin/cos outputs.
pv=packages['provenance']
def pv_json(name):return json.loads(gzip.decompress(pv[name+'.json.gz']))
old=pv_json('old-primitive-metadata')
trace=pv_json('baseline10493-trace72')['geometry']
node,bun=pv_json('node'),pv_json('bun')
nb,bn=pv_json('node-forced-bun'),pv_json('bun-forced-node')
assert node['geometry']['lobes']==trace['pre']==trace['post']
assert bun['geometry']==old==nb['geometry']
assert bn['geometry']==node['geometry']
assert node['rng']==bun['rng']==nb['rng']==bn['rng']
assert node['contractions']==bun['contractions']==nb['contractions']==bn['contractions']
assert len(old['lobes'])==len(trace['pre'])==2589
counts=Counter();tuples=0;maximum=0
for a,b in zip(old['lobes'],trace['pre']):
    assert len(a)==len(b)
    tuples+=a!=b
    for channel,(x,y) in enumerate(zip(a,b)):
        if x!=y:
            assert channel<3
            counts[['x','y','z'][channel]]+=1;maximum=max(maximum,abs(x-y))
        assert struct.pack('<f',x)==struct.pack('<f',y)
assert tuples==299 and dict(counts)=={'x':145,'z':169,'y':19}
assert maximum==4.440892098500626e-16
assert len(node['trig'])==len(bun['trig'])==12666
trig_differences=0
for a,b in zip(node['trig'],bun['trig']):
    assert a['name']==b['name'] and a['input']==b['input']
    trig_differences+=a['output']!=b['output']
assert trig_differences==521
for label in ['liquid','iceCores','summits','foundations']:
    assert node['geometry'][label]==bun['geometry'][label]
volumes=[gzip.decompress(pv[name+'.ts.gz']).decode() for name in ['volume08c','volume10493']]
prefix=lambda s:s[s.index('export function generateVolume('):s.index('  // Rasterize lobes')]
assert prefix(volumes[0])==prefix(volumes[1])

# Saved old/provisional bytes only: the I1 formula is never executed here.
gd=packages['guard']
raw_nodes=json.loads(gd['nodes.json']);result=json.loads(gd['result.json']);decision=json.loads(gd['DECISION.json'])
assert decision['decision']=='not promoted; no app trial'
assert decision['resultSHA256']==sha(gd['result.json'])
assert decision['provenanceManifestSHA256']==sha(pv['manifest.json'])
assert raw_nodes['runtime']=='v26.11.0' and raw_nodes['baselineCommit']=='10493afa7f6d90389c39e17b2cad79397dfdac01'
assert raw_nodes['originalKnownByteMismatches']==raw_nodes['originalCandidateByteMismatches']==raw_nodes['allReconstructedOriginalByteMismatches']==0
for path,item in result['inputHashes'].items():
    if Path(path).name in gd and Path(path).name!='manifest.json':data=gd[Path(path).name]
    elif path in original_inputs:data=original_inputs[path]
    else:
        assert path.endswith('/near-provenance-diff/manifest.json');data=pv['manifest.json']
    assert len(data)==item['bytes'] and sha(data)==item['sha256'],path
points=json.loads(inputs['near-interior-stencils.json'])
prior=json.loads(inputs['near-interior-next.json'])
patches=json.loads(inputs['jpeg-comparison.json'])
valid={tuple(s['uv']) for s in patches['samples'] if not s['excluded']}
assert len(valid)==9
nodes={tuple(n['index']):dict(n) for n in raw_nodes['nodes']}
known={k:n for k,n in nodes.items() if n['known252']}
changed={k:n for k,n in known.items() if n['oldByte']!=n['newByte']}
assert len(nodes)==461 and len(known)==252 and len(changed)==55
assert all(n['predictedByte']==n['oldByte'] and n['newByte']<=n['oldByte'] for n in nodes.values())
for n in prior['nodes']:
    assert n['oldByte']==nodes[tuple(n['index'])]['oldByte'] and n['newByte']==nodes[tuple(n['index'])]['newByte']
assert raw_nodes['cache']==points['inputChecks']['macro-rgba8.bin']
parameters=result['parameters']
assert parameters['forcing']==0 and parameters['flowAlphaHalfMaximum']==.1800537109375
assert parameters['cutoffF32']==struct.unpack('<f',struct.pack('<f',.002))[0]
assert parameters['normalizedDensitySlack']==2**-16 and parameters['coordinateSlackKm']==2**-14
ice_start,ice_end=raw_nodes['iceRange']
accepted=set();cells={}
assert {tuple(r['index']) for r in result['nodeGuards']}==set(changed)
for row in result['nodeGuards']:
    index=tuple(row['index']);verdict=[];neighborhood=set()
    assert row['oldByte']==nodes[index]['oldByte'] and row['provisionalByte']==nodes[index]['newByte']
    assert {tuple(c['low']) for c in row['cells']}=={add(index,off) for off in product([-1,0],repeat=3)}
    for cell in row['cells']:
        low=tuple(cell['low']);corners=[add(low,off) for off in product([0,1],repeat=3)];neighborhood.update(corners)
        max_y=-.5+(low[1]+1.5)/256*8.5
        local_max=max_y+.06+2**-14
        ice=smooth(ice_start,ice_end,local_max)
        erosion=.6950537109375+.065*ice;material=1-.99766*ice
        threshold=erosion+parameters['cutoffF32']*(1-erosion)/material
        padded=threshold+2**-16
        old_min=min(nodes[k]['oldByte'] for k in corners)
        provisional_min=min(nodes[k]['newByte'] for k in corners)
        close(cell['maxWarpedYKm'],max_y);close(cell['maxLocalYKmPadded'],local_max)
        close(cell['iceMax'],ice);close(cell['erosionBound'],erosion);close(cell['materialMinimum'],material)
        close(cell['threshold'],threshold);close(cell['paddedThreshold'],padded)
        assert cell['oldMinimumByte']==old_min and cell['provisionalMinimumByte']==provisional_min
        close(cell['oldMargin'],old_min/255-padded);close(cell['provisionalMargin'],provisional_min/255-padded)
        passes=old_min/255>padded and provisional_min/255>padded
        assert passes==cell['passes'];verdict.append(passes);cells[low]=cell
    assert len(neighborhood)==27 and neighborhood=={add(index,off) for off in product([-1,0,1],repeat=3)}
    assert row['accepted']==all(verdict)
    if row['accepted']:accepted.add(index)
assert len(accepted)==12 and len(cells)==176 and all(c['iceMax']==0 for c in cells.values())
for k,n in nodes.items():
    n['guardedByte']=n['newByte'] if k in accepted else n['oldByte']
    assert n['oldByte']>=n['guardedByte']>=n['newByte']
assert {tuple(n['index']):n for n in result['nodes']}==nodes
worst=min((c for row in result['nodeGuards'] if row['accepted'] for c in row['cells']),key=lambda c:c['provisionalMargin'])
assert worst['provisionalMinimumByte']==178 and worst['minimumAllowedByte']==178
close(worst['provisionalMargin'],result['nodeSummary']['worstAcceptedCell']['provisionalMargin'])
close((worst['provisionalMinimumByte']/255-worst['erosionBound'])/(1-worst['erosionBound'])*worst['materialMinimum'],result['nodeSummary']['worstAcceptedCell']['strictPositiveFineDensityLowerBound'])
assert result['nodeSummary']['worstAcceptedCell']['strictPositiveFineDensityLowerBound']>.002
for row in result['nodeGuards']:
    if row['accepted']:
        for cell in row['cells']:
            assert min(nodes[add(tuple(cell['low']),off)]['guardedByte']/255 for off in product([0,1],repeat=3))>cell['paddedThreshold']

# Reconstruct saved sample arithmetic from captured bytes/stencils only.
def sample(stencil,macro,rho):
    assert sequential_sum(c['weight']*nodes[tuple(c['index'])]['oldByte']/255 for c in stencil)==macro
    erosion=(macro-rho)/(1-rho)
    values={'oldMacro':macro,'oldDensity':rho}
    for variant,field in [('provisional','newByte'),('guarded','guardedByte')]:
        value=sequential_sum(c['weight']*nodes[tuple(c['index'])][field]/255 for c in stencil)
        density=rho if value==macro else max(0,min(1,(value-erosion)/(1-erosion)))
        if density<.002:density=0
        values[variant+'Macro']=value;values[variant+'Density']=density
    return values
assert len(result['records'])==len(points['records'])==52
for saved,source in zip(result['records'],points['records']):
    assert saved['uv']==source['uv'] and saved['label']==source['label']
    assert saved['validJPEGPatch']==(tuple(saved['uv']) in valid)
    close({k:saved[k] for k in ['oldMacro','oldDensity','provisionalMacro','provisionalDensity','guardedMacro','guardedDensity']},sample(source['stencil'],source['macro'],source['renderDensity']))
assert len(result['centerRecords'])==len(points['centerPlateau']['trace'])==394
for saved,source in zip(result['centerRecords'],points['centerPlateau']['trace']):
    assert saved['distanceKm']==source['distanceKm'] and saved['oldOpacityWeight']==source['weight']
    close({k:saved[k] for k in ['oldMacro','oldDensity','provisionalMacro','provisionalDensity','guardedMacro','guardedDensity']},sample(source['stencil'],source['macro'],source['rho']))
def stats(values):
    mean=statistics.mean(values);std=statistics.pstdev(values)
    return dict(n=len(values),min=min(values),max=max(values),mean=mean,standardDeviation=std,cvPercent=std/mean*100)
for label,rows in [('all',result['records']),('valid',[r for r in result['records'] if r['validJPEGPatch']])]:
    expected=result['summaries13Rays' if label=='all' else 'summaries9ValidPatches']
    for depth,summary in expected.items():
        selected=[r for r in rows if r['label']==depth]
        assert len(selected)==summary['samples']
        for variant in ['old','provisional','guarded']:
            close(summary[variant]['density'],stats([r[variant+'Density'] for r in selected]))
            assert summary[variant]['zeroDensitySamples']==sum(r[variant+'Density']==0 for r in selected)==0
            assert summary[variant]['exactlyUnchanged']==sum(r[variant+'Macro']==r['oldMacro'] and r[variant+'Density']==r['oldDensity'] for r in selected)
for variant in ['old','provisional','guarded']:
    tau=0;crossing={str(level):None for level in [1,3,5]}
    for row in result['centerRecords']:
        rho=row[variant+'Density'];increment=rho*18*.001
        for level in [1,3,5]:
            if crossing[str(level)] is None and tau+increment>=level:crossing[str(level)]=row['distanceKm']-.0005+(level-tau)/(rho*18)
        tau+=increment
    close(result['centerPaths'][variant],dict(tauWithinOriginalWindow=tau,opacityWithinOriginalWindow=-math.expm1(-tau),crossingsKm=crossing))
assert all(r['oldDensity']==r['guardedDensity'] for r in result['records'] if r['label']=='first-plus5m' or r['uv']==[.05,.05])
assert decision['acceptedKnownChanges']==result['nodeSummary']['acceptedKnownChanges']==12
print(json.dumps(dict(status='PASS',scope='Lossless originals and independent saved-record checks only; no extraction, I1 execution, field, bake, build, GPU, whole-volume proof or artistic acceptance',payloads=len(observed),payloadBytes=manifest['payloadBytes'],originalPackages={k:v['originalPayloads'] for k,v in lossless['originalPackages'].items()},losslessInputs=len(inputs),provenance=dict(primitives=2589,differingTuples=299,trigCalls=12666,differentTrigResults=521,reciprocalChecks=True),guard=dict(knownNodes=252,recoveredNeighbors=209,totalNodes=461,originalChanges=55,accepted=12,reverted=43,cells=176,frontSamplesUnchanged=13,materialSamples=52,centerSamples=394),decision=decision['decision']),indent=2))
