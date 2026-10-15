#!/usr/bin/env python3
"""Prepare a main-only external v40 shader candidate. Never edits the checkout."""
from __future__ import annotations
import difflib
import hashlib
import json
import math
from pathlib import Path
import signal

ROOT = Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
OUT = Path(__file__).resolve().parent
APP = 'assets/CumulonimbusApp-6wBUXA1V.js'
APP_SHA = '12cef7783f8db74d41861a195956b1651dbc2b6baae51cf04e682501987a8050'
BASE_VERSION = 'observatory-v40-terrain-camera-focus'
CANDIDATE_VERSION = 'candidateexternal-v40-rain-cloud-support'
OLD = '''    let reference=cloudReference(position-drift,growth,iceRange,wind);
    // Conservative support includes domain displacement and macro interpolation.
    // One cheap mask lookup avoids evaluating fine noise throughout empty sky.
    let referenceCoord=(reference-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
    let support=textureSampleLevel(detail,detailSampler,clamp(referenceCoord,maskInset,vec3<f32>(1.0)-maskInset),0.0).a;
    let ordinaryStep=mix(stepSize,min(stepSize,max(.0015,t*.008)),inspection);
    let rp=position-drift;
    let rainRegion=hasRain && t>=rainNear && t<rainFar;'''
NEW = '''    let rainRegion=hasRain && t>=rainNear && t<rainFar;
    var reference=vec3<f32>(0.0);
    var referenceCoord=vec3<f32>(0.0);
    var support=0.0;
    // Outside the conservative cloud box, rain keeps its original sample grid.
    // Restrict the gate to rainRegion: there sampleStep is independent of support.
    let evaluateCloud=!rainRegion||(all(position>=supportMin+drift)&&all(position<=supportMax+drift));
    if(evaluateCloud){
      reference=cloudReference(position-drift,growth,iceRange,wind);
      referenceCoord=(reference-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
      support=textureSampleLevel(detail,detailSampler,clamp(referenceCoord,maskInset,vec3<f32>(1.0)-maskInset),0.0).a;
    }
    let ordinaryStep=mix(stepSize,min(stepSize,max(.0015,t*.008)),inspection);
    let rp=position-drift;'''

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def save(relative: str, data: bytes) -> dict:
    destination = OUT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.read_bytes() != data:
        raise RuntimeError(f'Refusing to replace a different existing artifact: {destination}')
    destination.write_bytes(data)
    return {'path': str(destination), 'bytes': len(data), 'sha256': sha(data)}

def normalize(v):
    length = math.sqrt(sum(x*x for x in v))
    return [x/length for x in v]

def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]

def slab(origin, ray, lower, upper):
    near, far = 0.0, math.inf
    for o, r, lo, hi in zip(origin, ray, lower, upper):
        if abs(r) < 1e-14:
            if o < lo or o > hi:
                return None
        else:
            a, b = sorted(((lo-o)/r, (hi-o)/r))
            near, far = max(near, a), min(far, b)
    return [near, far] if far > near else None

def subtract(a, b):
    if a is None:
        return []
    if b is None or b[1] <= a[0] or b[0] >= a[1]:
        return [a]
    return [part for part in ([a[0], min(a[1], b[0])], [max(a[0], b[1]), a[1]]) if part[1] > part[0]]

def ray_analysis():
    cases = []
    for thread in ['main', 'worker']:
        report_path = ROOT / f'docs/measurements/terrain-focus-2026-10-15/{thread}-low-rain-native-30s.json'
        raw = report_path.read_bytes()
        report = json.loads(raw)
        assert report['paused'] and report['nominalSteps'] == 384
        assert report['output'] == report['internal'] == [3344, 1882]
        t, strength, seed = report['simulationTimeStart'], report['weather']['wind'], report['seed']
        assert t >= 38  # These reports are mature: growth is exactly [1,1,1].
        phase = (seed % 71)/71*.35
        wind = [strength*(.52+.23*math.sin(t*.055+phase*3)), strength*.26*math.sin(t*.031+.6)]
        drift = [strength*(.32*math.sin(t*.027)+.11*math.sin(t*.071)), math.sin(t*.04)*.015, 0]
        cloud_min = [a+b for a,b in zip(report['supportBounds']['min'], drift)]
        cloud_max = [a+b for a,b in zip(report['supportBounds']['max'], drift)]
        bounds = report['precipitationSourceBounds']
        rain_min = [bounds[0]+min(0,wind[0]*2.5)+drift[0], -4.75+drift[1], bounds[1]+min(0,wind[1]*2.5)]
        rain_max = [bounds[2]+max(0,wind[0]*2.5)+drift[0], 2.8+drift[1], bounds[3]+max(0,wind[1]*2.5)]
        origin, target = report['camera']['origin'], report['camera']['target']
        forward = normalize([a-b for a,b in zip(target,origin)])
        right = normalize(cross(forward, [0,1,0]))
        up = normalize(cross(right,forward))
        aspect = report['output'][0]/report['output'][1]
        inspection = report['camera']['approach']
        rows = []
        for v in [0,.5,1]:
            for u in [0,.5,1]:
                screen_x, screen_y = 2*u-1, 2*v-1-.16*(1-inspection)
                ray = normalize([forward[i]+right[i]*screen_x*aspect*.2867+up[i]*screen_y*.2867 for i in range(3)])
                radial = [origin[0], origin[1]+6375, origin[2]]
                b = sum(a*r for a,r in zip(radial,ray))
                c = sum(a*a for a in radial)-6371**2
                d = b*b-c
                sea_hit = -b-math.sqrt(d) if d >= 0 else -1
                assert sea_hit <= 0, 'This lightweight analysis does not model terrain hits.'
                rain, cloud = slab(origin,ray,rain_min,rain_max), slab(origin,ray,cloud_min,cloud_max)
                rain_only = subtract(rain,cloud)
                length = sum(hi-lo for lo,hi in rain_only)
                rain_length = rain[1]-rain[0] if rain else 0
                rows.append({'uv':[u,v], 'ray':ray, 'seaSphereHitKm':None, 'terrainSolverCalled':False,
                    'rainIntervalKm':rain, 'cloudIntervalKm':cloud, 'rainOnlyIntervalsKm':rain_only,
                    'rainLengthKm':rain_length, 'rainOnlyLengthKm':length,
                    'potentialRainSamplesCeil':math.ceil(rain_length/.006),
                    'potentialCloudMaskLookupsAvoidedCeil':sum(math.ceil((hi-lo)/.006) for lo,hi in rain_only)})
        cases.append({'report':str(report_path), 'reportSha256':sha(raw), 'thread':thread,
            'origin':origin,'target':target,'growth':[1,1,1],'windReconstructed':wind,'driftReconstructed':drift,
            'cloudBoxWorld':{'min':cloud_min,'max':cloud_max},'rainBoxWorld':{'min':rain_min,'max':rain_max},'rays':rows})
    return {'status':'GEOMETRIC OPPORTUNITY ONLY; NOT RENDERED OR TIMED',
        'arithmetic':'Python f64 reconstruction of recorded camera, mature growth and authored wind/drift; not GPU f32 parity.',
        'limits':['Nine rays per report are not a screen-area estimate.',
            'Counts are ceil(length/6m) opportunities, not measured loop iterations.',
            'No jitter phase, cloud/rain texture values or opacity early termination evaluated.',
            'No claim of speedup, image equivalence, device cost or presented FPS.',
            'Main and worker reports have different camera origins and are not a causal A/B.'], 'cases':cases}

def main():
    signal.alarm(30)
    source_path = ROOT / 'src/cumulonimbus/cloudShader.ts'
    source_bytes = source_path.read_bytes()
    source = source_bytes.decode()
    assert source.count(OLD) == 1, 'Readable source block must match exactly once.'
    candidate = source.replace(OLD, NEW, 1)
    artifacts = [save('cloudShader.base.ts', source_bytes), save('cloudShader.candidate.ts', candidate.encode())]
    patch = ''.join(difflib.unified_diff(source.splitlines(True), candidate.splitlines(True),
        fromfile='a/src/cumulonimbus/cloudShader.ts',tofile='b/src/cumulonimbus/cloudShader.ts'))
    artifacts.append(save('rain-cloud-support.patch', patch.encode()))
    app_bytes = (ROOT/'dist'/APP).read_bytes()
    assert sha(app_bytes) == APP_SHA, 'Current app bundle is not the frozen cycle6 v40 asset.'
    app = app_bytes.decode()
    if app.count(OLD) == 1:
        needle, replacement, encoding = OLD, NEW, 'literal-newlines'
    else:
        needle, replacement, encoding = OLD.replace('\n','\\n'), NEW.replace('\n','\\n'), 'escaped-newlines'
    assert app.count(needle) == 1, 'Compiled WGSL block must match exactly once.'
    assert app.count(BASE_VERSION) == 1, 'Renderer version must match exactly once.'
    patched = app.replace(needle,replacement,1).replace(BASE_VERSION,CANDIDATE_VERSION,1)
    artifacts.extend([save('base/'+APP,app_bytes),save('overrides/'+APP,patched.encode())])
    index_bytes = (ROOT/'dist/index.html').read_bytes()
    artifacts.append(save('base/index.html',index_bytes))
    analysis = ray_analysis()
    artifacts.append(save('rain-support-ray-analysis.json',(json.dumps(analysis,ensure_ascii=False,indent=2)+'\n').encode()))
    scripts=[]
    for name in ['prepare-rain-support-candidate.py','serve-rain-support-candidate.py']:
        data=(OUT/name).read_bytes()
        scripts.append({'path':str(OUT/name),'bytes':len(data),'sha256':sha(data)})
    manifest={'status':'PREPARED; NOT RENDERED OR TIMED','scope':'main app only; worker unpatched and not qualified',
        'root':str(ROOT),'distRoot':str(ROOT/'dist'),'outRoot':str(OUT),'candidateVersion':CANDIDATE_VERSION,
        'baseVersion':BASE_VERSION,'baseIndexSha256':sha(index_bytes),'baseAppSha256':APP_SHA,
        'overrideUrl':'/'+APP,'baseSourceSha256':sha(source_bytes),'candidateSourceSha256':sha(candidate.encode()),
        'compiledWgslEncoding':encoding,'sourceBlockMatches':1,'compiledBlockMatches':1,'versionMatches':1,
        'gate':'rainRegion && outside inclusive world cloud box; no gate before/after rainRegion',
        'preconditions':['Base app bytes must equal the archived cycle6 SHA256.',
            'Readable source and compiled WGSL each match the original block exactly once.',
            'Only that WGSL block and one renderer-version label change in the compiled asset.',
            'No changes to step equations, jitter, timers, density/rain material or medium integration.',
            'Inside rainRegion, original sampleStep is independent of support.',
            'Cloud world support conservativity remains an assumption to verify visually/numerically.',
            'Server not started; production src and dist never written.'],
        'unreadableAssets':['dist/assets/render.worker-DHcLwyw_.js: read timed out after20s; not retried or patched'],
        'artifacts':artifacts,'scripts':scripts}
    (OUT/'rain-support-candidate-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':manifest['status'],'manifest':str(OUT/'rain-support-candidate-manifest.json'),
        'candidateVersion':CANDIDATE_VERSION,'compiledBlockMatches':1,'override':manifest['overrideUrl']},indent=2))

if __name__ == '__main__':
    main()
