#!/usr/bin/env python3
"""Small f32 sequence model; no volume, GPU, product imports or dependencies."""
from dataclasses import dataclass
from pathlib import Path
import hashlib
import json
import math
import struct

OUT=Path(__file__).resolve().parent
def f(x): return struct.unpack('f',struct.pack('f',x))[0]

@dataclass
class Field:
    name:str
    mask:object
    density:object
    rain:object
    near:float=.003
    far:float=.15
    rain_near:float=.003
    rain_far:float=.15
    base_step:float=f(7/384)
    empty_step:float=f(.0546875)
    rain_step:float=f(.006)
    inspection:float=0

def integrate(field,optimized=False,reuse_outside=False,check_certificate=True):
    t,until=f(field.near),f(0)
    trace=[];queries=[];reused=[];radiance=f(0);transmittance=f(1)
    near,far,rain_near,rain_far=map(f,[field.near,field.far,field.rain_near,field.rain_far])
    for _ in range(8192):
        if t>=far or transmittance<f(.006): break
        in_rain=t>=rain_near and t<rain_far
        use=optimized and (in_rain or reuse_outside) and t<until
        if use:
            support=f(0);density=f(0);reused.append(t)
            if check_certificate:
                assert f(field.density(t))==0, f'Invalid synthetic certificate at {t}'
        else:
            support=f(field.mask(t));queries.append(t)
            density=f(field.density(t)) if support>0 else f(0)
            if optimized and in_rain and support<=0:
                until=f(t+max(0,f(field.empty_step-field.base_step)))
        adaptive=min(field.base_step,max(f(.0015),f(t*f(.008))))
        ordinary=f(f(field.base_step*f(1-field.inspection))+f(adaptive*field.inspection))
        media=min(ordinary,field.rain_step) if in_rain else ordinary
        advance=field.empty_step if support<=0 and not in_rain else media
        until_rain=f(rain_near-t) if t<rain_near else f(far-t)
        boundary=f(rain_far-t) if in_rain else f(far-t)
        ds=f(min(advance,boundary,until_rain))
        assert ds>0
        trace.append([t,ds])
        ce=f(density*18);re=f(field.rain(t)) if in_rain else f(0);total=f(ce+re)
        if total>0:
            cloud_source=f(.35+.1*math.sin(t*37));rain_source=f(.22+.03*math.cos(t*51))
            source=f(f(f(cloud_source*ce)+f(rain_source*re))/total)
            opacity=f(1-f(math.exp(f(-total*ds))))
            radiance=f(radiance+f(f(transmittance*source)*opacity))
            transmittance=f(transmittance*f(1-opacity))
        t=f(t+ds)
    else: raise AssertionError('Loop cap reached in the tiny model')
    return {'trace':trace,'radiance':radiance,'transmittance':transmittance,
        'maskQueries':queries,'reusedPositions':reused,'emptyUntil':until}

def main():
    rain=lambda t:.35+.2*math.sin(t*80)**2
    fields=[
        Field('all empty cloud with variable rain',lambda t:0,lambda t:0,rain),
        Field('occupied cloud retains every6m sample',lambda t:1,lambda t:.2+.1*math.sin(t*41),rain),
        Field('mask becomes positive inside a valid empty certificate',lambda t:0 if t<.010 else 1,lambda t:0 if t<.060 else .45,rain),
        Field('thin occupied cloud immediately after the certified region',lambda t:0 if t<.030 else 1,lambda t:1 if .080<=t<=.087 else 0,rain),
        Field('clamped positive mask after rain exit',lambda t:0 if .020<=t<.050 else 1,lambda t:0,rain,
            near=.002,rain_near=.020,rain_far=.050,far=.15),
        Field('early H0 disables reuse',lambda t:0,lambda t:0,rain,empty_step=f(7/384)),
        Field('inspection retains its original smaller sample steps',lambda t:0 if t<.040 else 1,lambda t:0 if t<.090 else .4,rain,
            near=.0011,rain_near=.0027,rain_far=.1137,far=.161,inspection=1),
        Field('zero rain extinction keeps the same advance',lambda t:0,lambda t:0,lambda t:0,
            near=.0029,rain_near=.0071,rain_far=.0973,far=.1317),
        Field('strict exclusive certificate endpoint',lambda t:0,lambda t:0,rain,near=0,rain_near=0,rain_far=.125,far=.125,
            base_step=1/64,empty_step=1/16,rain_step=1/128),
    ]
    rows=[]
    for field in fields:
        baseline=integrate(field);candidate=integrate(field,True)
        assert baseline['trace']==candidate['trace'],field.name
        assert baseline['radiance']==candidate['radiance'] and baseline['transmittance']==candidate['transmittance'],field.name
        if field.name.startswith('strict'):
            endpoint=f(field.empty_step-field.base_step)
            assert endpoint in candidate['maskQueries'] and endpoint not in candidate['reusedPositions']
        if field.name.startswith('early'):
            assert not candidate['reusedPositions']
        rows.append({'case':field.name,'sequenceExactlyEqual':True,'f32MediaExactlyEqual':True,
            'samples':len(baseline['trace']),'baselineMaskQueries':len(baseline['maskQueries']),
            'candidateMaskQueries':len(candidate['maskQueries']),'reusedCloudZeros':len(candidate['reusedPositions'])})
    clamped=fields[4]
    wrong=integrate(clamped,True,reuse_outside=True)
    assert wrong['trace']!=integrate(clamped)['trace'], 'Negative control did not expose the outside-rain step change'
    invalid=Field('invalid halo can hide matter',lambda t:0 if t<.01 else 1,lambda t:.7 if .015<=t<=.028 else 0,rain)
    reference=integrate(invalid)
    wrong=integrate(invalid,True,check_certificate=False)
    assert reference['radiance']!=wrong['radiance'], 'Negative control did not expose missing halo proof'
    result={'status':'NINE SMALL SYNTHETIC SEQUENCE CHECKS PASSED; TWO NEGATIVE CONTROLS CONFIRMED',
        'limits':['Not a proof of the real occupancy halo or inverse-growth/shear bound.',
            'Not GPU/WGSL parity, renderer image equivalence or a performance measurement.',
            'Fields deliberately satisfy the cloud-zero certificate except in the explicit negative control.',
            'The shared step equations model the current shader; this does not execute production code.'],
        'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'cases':rows,
        'negativeControls':{'reuseOutsideRainChangesSequence':True,'invalidHaloCanHideCloudMatter':True}}
    (OUT/'cloud-empty-until-sequence-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
