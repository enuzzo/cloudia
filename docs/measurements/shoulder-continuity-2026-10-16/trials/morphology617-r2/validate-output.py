"""Independent saved-JSON schema/quality validation; no generator imports."""
from pathlib import Path
import json,math,hashlib,sys
ROOT=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
name=sys.argv[1];path=ROOT/(name+'.json');control=json.loads((ROOT/(name+'-control.json')).read_text())
assert control['exitCode']==0 and control['ownedChildReaped'] and control['status']=='PASS_ONE_BOUNDED_FULL_QUALITY_CPU_DIAGNOSTIC'
assert control['outputSha256']==sha(path)
q=json.loads(path.read_text());assert q['configuredQuality']=={'macro':256,'detail':128}
assert len(q['cases'])==1
c=q['cases'][0];assert c['seed']==617 and c['macroResolution']==256 and c['detailResolution']==128
assert isinstance(c['integratedDensity'],(int,float)) and math.isfinite(c['integratedDensity']) and c['integratedDensity']>0
assert 0<c['occupiedFraction']<=1
assert all(len(c[k])==3 and all(isinstance(v,(int,float)) and math.isfinite(v) for v in c[k]) for k in ['centroid','spread'])
assert c['bulk']['components']>0 and 0<c['bulk']['largestMassFraction']<=1+1e-9
assert len(c['sections'])==len(c['upperProfile'])==256
for section in c['sections']:
 assert math.isfinite(section['mass']) and section['mass']>=0 and math.isfinite(section['height'])
 assert 0<=section['occupied']<=256**2 and 0<=section['dense']<=section['occupied']
for p in c['upperProfile']:assert math.isfinite(p['x']) and math.isfinite(p['height'])
assert all(len(c['supportBounds'][k])==3 and all(math.isfinite(v) for v in c['supportBounds'][k]) for k in ['min','max'])
faces=c['boundaryLayers']['faces'];assert len(faces)==6
assert {(f['axis'],f['side']) for f in faces}=={(a,s) for a in ['x','y','z'] for s in ['min','max']}
for face in faces:
 assert len(face['layers'])==2
 for depth,layer in enumerate(face['layers']):
  assert layer['depth']==depth and layer['index']==(depth if face['side']=='min' else 255-depth)
  assert layer['texels']==256**2 and 0<=layer['bulkR']<=layer['nonzeroR']<=256**2
  assert isinstance(layer['maxRByte'],int) and 0<=layer['maxRByte']<=255 and abs(layer['maxR']-layer['maxRByte']/255)<1e-15
assert len(c['macroDataSha256'])==64 and all(v in '0123456789abcdef' for v in c['macroDataSha256'])
assert q['rssCapBytes']==2*1024**3 and c['rssSampledPeak']<=q['rssCapBytes']
section_sum=math.fsum(s['mass'] for s in c['sections']);residual=section_sum-c['integratedDensity']
assert abs(residual)<1e-7*max(1,c['integratedDensity'])
report={'status':'PASS_VALID_FULL_QUALITY_MORPHOLOGY_JSON','case':name,'outputSha256':sha(path),
 'configuredQuality':q['configuredQuality'],'seed':617,'sections':256,'upperProfile':256,'boundaryFaces':6,
 'integratedDensity':c['integratedDensity'],'sectionMassSumResidual':residual,'bulk':c['bulk'],
 'noGeneratorReexecution':True,'limits':'Schema, finite-value and reduction consistency only; no independent full density replay or art proof.'}
(ROOT/(name+'-validation.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
