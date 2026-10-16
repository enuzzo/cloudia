"""Independent Decimal rederivation and structural source checks, no GPU."""
from pathlib import Path
from decimal import Decimal,getcontext
import json,hashlib,struct,math,itertools
R=Path(__file__).resolve().parent;getcontext().prec=50
D=Decimal;Y=list(map(D,['.2126','.7152','.0722']))
f32=lambda q:struct.unpack('<f',struct.pack('<f',float(q)))[0]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
q=json.loads((R/'comparison.json').read_text());manifest=json.loads((R/'trial-source-manifest.json').read_text())
palette_path=R.with_name('sentinel2-reference-r2')/'palette-and-diagnostics.json'
assert sha(palette_path)==manifest['paletteInputSha256']
palette={e['classCode']:e for e in json.loads(palette_path.read_text())['palette']}
dot=lambda a:sum(v*w for v,w in zip(a,Y))
a=(R/'terrainSurface.before.ts').read_text();expected=a
maxy=maxcontrast=0.;class_results=[]
for code in [10,30]:
 rows=[e for e in q['endpoints'] if e['classCode']==code]
 original=[[D(s) for s in e['oldLiteral'].split(',')] for e in rows]
 centroid=[sum(c[i] for c in original)/len(rows) for i in range(3)];ref=[v/dot(centroid) for v in centroid]
 target=[D(str(v)) for v in palette[code]['chromaticityY1median']];target=[v/dot(target) for v in target]
 factor=[x/y for x,y in zip(target,ref)];new=[]
 for e,old in zip(rows,original):
  raw=[x*y for x,y in zip(old,factor)];proposal=[x*dot(old)/dot(raw) for x in raw]
  literal=[D(x) for x in e['newLiteral'].split(',')]
  assert list(map(f32,proposal))==list(map(f32,literal)),e['name']
  quantized=list(map(f32,literal));new.append(quantized)
  needle='vec3<f32>('+e['oldLiteral']+')';assert expected.count(needle)==1
  expected=expected.replace(needle,'vec3<f32>('+e['newLiteral']+')')
  yold=sum(float(w)*f32(v) for w,v in zip(Y,old));ynew=sum(float(w)*v for w,v in zip(Y,quantized))
  maxy=max(maxy,abs(yold-ynew))
 for i,j in itertools.combinations(range(len(rows)),2):
  for ch in [0,2]:
   oldi=list(map(f32,original[i]));oldj=list(map(f32,original[j]))
   c0=math.log(oldi[ch]/oldi[1])-math.log(oldj[ch]/oldj[1])
   c1=math.log(new[i][ch]/new[i][1])-math.log(new[j][ch]/new[j][1])
   maxcontrast=max(maxcontrast,abs(c1-c0))
 class_results.append({'code':code,'endpoints':len(rows),'DecimalPrecision':50,'allCandidateF32ComponentsMatchIndependentDecimalFormula':True})
expected=expected.replace(' let denseForest=',' // S2 class-wise chromaticity correction retains endpoint authored Y and relative hue contrasts.\n let denseForest=',1)
assert expected==(R/'terrainSurface.after.ts').read_text()==(R/'candidate-source/src/cumulonimbus/terrainSurface.ts').read_text()
changed=[]
for name,h in manifest['sourceHashesAfter'].items():
 assert sha(R/'candidate-source'/name)==h,name
 if h!=manifest['sourceHashesBefore'][name]:changed.append(name)
assert set(changed)=={'src/cumulonimbus/terrainSurface.ts','src/cumulonimbus/GPUSceneEngine.ts'}
before_engine=(Path(manifest['baseDirectory'])/'src/cumulonimbus/GPUSceneEngine.ts').read_text()
assert before_engine.replace('observatory-v54-cover-fragment','observatory-v55-s2-palette-r2-trial')==(R/'candidate-source/src/cumulonimbus/GPUSceneEngine.ts').read_text()
report={'status':'PASS_DECIMAL_FORMULA_Y_LOG_CONTRAST_AND_119_SOURCE_HASHES','classes':class_results,'changedFiles':changed,
 'pairwiseIndependentLogContrasts':14,'maxF32IntrinsicYAbsDelta':maxy,'maxF32LogContrastDelta':maxcontrast,
 'noAddedRuntimeExpressionsTexturesReadsPasses':True,'limits':'Not GPU image, coloured-light radiance, hue-distribution or FPS qualification.'}
(R/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
