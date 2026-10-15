#!/usr/bin/env python3
"""Prepare a readable shader patch outside the product; never applies it."""
from pathlib import Path
import difflib
import hashlib
import json

ROOT=Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
OUT=Path(__file__).resolve().parent
OLD='''    let reference=cloudReference(position-drift,growth,iceRange,wind);
    // Conservative support includes domain displacement and macro interpolation.
    // One cheap mask lookup avoids evaluating fine noise throughout empty sky.
    let referenceCoord=(reference-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
    let support=textureSampleLevel(detail,detailSampler,clamp(referenceCoord,maskInset,vec3<f32>(1.0)-maskInset),0.0).a;
    let ordinaryStep=mix(stepSize,min(stepSize,max(.0015,t*.008)),inspection);
    let rp=position-drift;
    let rainRegion=hasRain && t>=rainNear && t<rainFar;'''
NEW='''    let rainRegion=hasRain && t>=rainNear && t<rainFar;
    var reference=vec3<f32>(0.0);
    var referenceCoord=vec3<f32>(0.0);
    var support=0.0;
    // Reuse only certified empty cloud space, within this ray and this frame.
    // Rain still samples every original point; occupied cloud is never decimated.
    let reuseCloudEmpty=rainRegion&&t<cloudEmptyUntil;
    if(!reuseCloudEmpty){
      reference=cloudReference(position-drift,growth,iceRange,wind);
      referenceCoord=(reference-vec3<f32>(-5.0,-0.5,-3.5))/vec3<f32>(10.0,8.5,7.0);
      support=textureSampleLevel(detail,detailSampler,clamp(referenceCoord,maskInset,vec3<f32>(1.0)-maskInset),0.0).a;
      if(rainRegion&&support<=0.0){
        cloudEmptyUntil=t+max(0.0,emptyStep-stepSize);
      }
    }
    let ordinaryStep=mix(stepSize,min(stepSize,max(.0015,t*.008)),inspection);
    let rp=position-drift;'''
LOOP='  for (var i=0u; i<8192u; i++) {'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def save(name,data):
    path=OUT/name
    if path.exists() and path.read_bytes()!=data:
        raise RuntimeError(f'Refusing to replace a different existing artifact: {path}')
    path.write_bytes(data)
    return {'path':str(path),'bytes':len(data),'sha256':digest(data)}

def main():
    original=(ROOT/'src/cumulonimbus/cloudShader.ts').read_bytes()
    source=original.decode()
    assert source.count(OLD)==1 and source.count(LOOP)==1
    assert 'cloudEmptyUntil' not in source
    candidate=source.replace(LOOP,'  var cloudEmptyUntil=0.0;\n'+LOOP,1).replace(OLD,NEW,1)
    assert candidate.count('let rainRegion=')==1
    # This suffix contains every step, rain, density, source and integration equation.
    boundary='    // Integrate only the remaining visible interval, including the terrain clip.'
    assert candidate.split(boundary,1)[1]==source.split(boundary,1)[1]
    assert candidate.split(LOOP,1)[0].replace('  var cloudEmptyUntil=0.0;\n','')==source.split(LOOP,1)[0]
    patch=''.join(difflib.unified_diff(source.splitlines(True),candidate.splitlines(True),
        fromfile='a/src/cumulonimbus/cloudShader.ts',tofile='b/src/cumulonimbus/cloudShader.ts'))
    artifacts=[save('cloudShader.base.ts',original),save('cloudShader.cloud-empty-until.ts',candidate.encode()),
        save('cloud-empty-until.patch',patch.encode())]
    scripts=[]
    for name in ['prepare-cloud-empty-until.py','cloud-empty-until-sequence-check.py']:
        data=(OUT/name).read_bytes();scripts.append({'path':str(OUT/name),'bytes':len(data),'sha256':digest(data)})
    manifest={'status':'EXTERNAL PATCH ONLY; NOT APPLIED OR RENDERED; PROOF REVIEW PENDING',
        'root':str(ROOT),'scope':'One local per-ray/per-frame empty-cloud certificate; no persistent temporal cache.',
        'performanceObjective':'Improve measured native FPS while preserving matter, <=6m rain samples, nominal384 steps and full output. No measured benefit claimed.',
        'baseSourceSha256':digest(original),'candidateSourceSha256':digest(candidate.encode()),
        'originalBlockMatches':1,'originalLoopMatches':1,
        'horizon':'H=max(0,emptyStep-stepSize); cloudEmptyUntil=t+H; reuse only rainRegion && t<cloudEmptyUntil',
        'contracts':['Occupied cloud density/light are evaluated at their original sample locations, including rain substeps.',
            'Rain density, sources, extinction and <=6m samples are untouched.',
            'Outside rainRegion all reference/mask evaluations follow the baseline.',
            'sampleStep, jitter, t advance, medium integration and early termination equations are byte-identical.',
            'No new texture, volume bake, uniform, worker upload or frame-history state.',
            'emptyStep<=stepSize yields H=0 and cannot reuse a certificate.'],
        'proofObligation':'A zero mask at t0 must prove cloud density exactly zero at every reused sample with t<t0+H under trilinear filtering, clamp, warp, bounded half-float flow and growth/shear. Point tests alone are not this proof.',
        'equivalenceArgument':['Inside rainRegion sampleStep is independent of mask support.',
            'If the certificate is valid, skipped cloud values equal zero; rain coefficients and combined source remain equal.',
            'Therefore radiance, transmittance, early termination and the entire t/sampleStep sequence agree, modulo compiler floating-point reassociation.',
            'Outside rainRegion reference/mask and step selection are unchanged.'],
        'sequenceCheckLimit':'The lightweight model checks this induction and negative controls for synthetic certified fields; it does not establish validity of the real spatial certificate or WGSL compilation.',
        'notPerformed':['Product edits','Bundle edits','Product tests','Cloud generation','GPU work','Browser run','Benchmark','Git writes'],
        'artifacts':artifacts,'scripts':scripts}
    (OUT/'cloud-empty-until-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'manifest':str(OUT/'cloud-empty-until-manifest.json'),
        'baseSha256':manifest['baseSourceSha256'],'candidateSha256':manifest['candidateSourceSha256'],'patch':artifacts[2]},indent=2))

if __name__=='__main__':
    main()
