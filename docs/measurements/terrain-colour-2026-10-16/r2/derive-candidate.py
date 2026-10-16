"""Original single fixed R2 formula; external copy only, stdlib."""
from pathlib import Path
import json,hashlib,math,struct,shutil,difflib,itertools
ROOT=Path(__file__).resolve().parent
BASE=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle20/cover-r2-source')
MANIFEST=BASE.with_name('cover-r2-source-manifest.json')
PALETTE=ROOT.with_name('sentinel2-reference-r2')/'palette-and-diagnostics.json'
Y=(.2126,.7152,.0722)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
dot=lambda a:sum(x*w for x,w in zip(a,Y))
f32=lambda a:struct.unpack('<f',struct.pack('<f',a))[0]
ENTRIES=[('denseForestLo',10,'.019,.042,.027'),('denseForestHi',10,'.039,.075,.035'),
 ('openForestLo',10,'.054,.062,.032'),('openForestHi',10,'.075,.083,.039'),
 ('grassLo',30,'.063,.085,.037'),('grassHi',30,'.105,.120,.061')]

def main():
 freeze=json.loads((ROOT/'protocol-freeze.json').read_text())
 assert sha(ROOT/'PROTOCOL.md')==freeze['protocolSha256']
 assert not (ROOT/'candidate-source').exists(),'Do not overwrite or repeat R2 candidate generation'
 old=json.loads(MANIFEST.read_text());assert len(old)==119
 for name,expected in old.items():assert sha(BASE/name)==expected,name
 assert sha(PALETTE)=='deb51505ffbf1c598b5bb346cb79e7042fb9cc2eeec079f55a66dd91320127a7'
 palette={e['classCode']:e for e in json.loads(PALETTE.read_text())['palette']}
 inputs=[{'name':n,'classCode':c,'oldLiteral':v,'oldRGB':[float(q) for q in v.split(',')]} for n,c,v in ENTRIES]
 classes={}
 for code in [10,30]:
  rows=[e['oldRGB'] for e in inputs if e['classCode']==code]
  centroid=[sum(row[c] for row in rows)/len(rows) for c in range(3)]
  ref=[v/dot(centroid) for v in centroid]
  target=palette[code]['chromaticityY1median'];target=[v/dot(target) for v in target]
  factor=[a/b for a,b in zip(target,ref)]
  assert abs(dot(target)-1)<3e-16
  classes[code]={'sampleCount':palette[code]['acceptedSamples'],'endpointCount':len(rows),'centroidRGB':centroid,
   'centroidY':dot(centroid),'chromRefY1':ref,'targetMedianY1':target,'factorRGB':factor}
 before=(BASE/'src/cumulonimbus/terrainSurface.ts').read_text();after=before;endpoints=[]
 for entry in inputs:
  values=entry['oldRGB'];factor=classes[entry['classCode']]['factorRGB'];raw=[v*f for v,f in zip(values,factor)]
  normalization=dot(values)/dot(raw);ideal=[v*normalization for v in raw]
  literal=','.join(format(f32(v),'.9g') for v in ideal);quantized=[f32(float(v)) for v in literal.split(',')]
  needle='vec3<f32>('+entry['oldLiteral']+')';assert after.count(needle)==1
  after=after.replace(needle,'vec3<f32>('+literal+')')
  oldf32=[f32(v) for v in values]
  endpoints.append({**entry,'oldY':dot(values),'commonFactorRGB':factor,'rawRGB':raw,'renormalization':normalization,
   'idealRGB':ideal,'newLiteral':literal,'binary32RGB':quantized,'idealY':dot(ideal),
   'oldChromaticityY1':[v/dot(values) for v in values],'newChromaticityY1':[v/dot(ideal) for v in ideal],
   'binary32YDelta':dot(quantized)-dot(oldf32),'binary32YRelativeDelta':(dot(quantized)-dot(oldf32))/dot(oldf32)})
 contrasts=[]
 for code in [10,30]:
  rows=[e for e in endpoints if e['classCode']==code]
  for a,b in itertools.combinations(rows,2):
   entry={'classCode':code,'pair':[a['name'],b['name']]}
   for name,i,j in [('R/G',0,1),('B/G',2,1)]:
    contrast=lambda p,q:math.log(p[i]/p[j])-math.log(q[i]/q[j])
    value=contrast(a['oldRGB'],b['oldRGB']);ideal=contrast(a['idealRGB'],b['idealRGB'])
    old32=contrast([f32(v) for v in a['oldRGB']],[f32(v) for v in b['oldRGB']]);new32=contrast(a['binary32RGB'],b['binary32RGB'])
    entry[name]={'before':value,'afterIdeal':ideal,'idealDelta':ideal-value,'binary32Delta':new32-old32}
   contrasts.append(entry)
  post=[sum(e['idealRGB'][c] for e in rows)/len(rows) for c in range(3)];postc=[v/dot(post) for v in post]
  classes[code]['postRenormalizedCentroidRGB']=post
  classes[code]['postRenormalizedCentroidChromaY1']=postc
  classes[code]['postCentroidMinusTarget']=[a-b for a,b in zip(postc,classes[code]['targetMedianY1'])]
 assert max(abs(c[k]['idealDelta']) for c in contrasts for k in ['R/G','B/G'])<1e-14
 changed=[i+1 for i,(a,b) in enumerate(zip(before.splitlines(),after.splitlines())) if a!=b];assert len(changed)==3
 out=ROOT/'candidate-source';out.mkdir()
 for name,expected in old.items():
  p=out/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(BASE/name,p);assert sha(p)==expected
 (out/'node_modules').symlink_to((BASE/'node_modules').resolve(),target_is_directory=True)
 after=after.replace(' let denseForest=',' // S2 class-wise chromaticity correction retains endpoint authored Y and relative hue contrasts.\n let denseForest=',1)
 (out/'src/cumulonimbus/terrainSurface.ts').write_text(after)
 engine=out/'src/cumulonimbus/GPUSceneEngine.ts';e=engine.read_text();assert e.count('observatory-v54-cover-fragment')==1
 engine.write_text(e.replace('observatory-v54-cover-fragment','observatory-v55-s2-palette-r2-trial'))
 (ROOT/'terrainSurface.before.ts').write_text(before);(ROOT/'terrainSurface.after.ts').write_text(after)
 changes={name:{'before':h,'after':sha(out/name)} for name,h in old.items() if sha(out/name)!=h}
 assert set(changes)=={'src/cumulonimbus/terrainSurface.ts','src/cumulonimbus/GPUSceneEngine.ts'}
 (ROOT/'trial-source.patch').write_text(''.join(''.join(difflib.unified_diff((BASE/name).read_text().splitlines(True),(out/name).read_text().splitlines(True),fromfile='a/'+name,tofile='b/'+name)) for name in changes))
 manifest={'status':'R2_PRE_BUILD_SOURCE_FROZEN_NOT_GPU_ADOPTION','baseDirectory':str(BASE),'baseManifestSha256':sha(MANIFEST),
  'sourceHashesBefore':old,'sourceHashesAfter':{name:sha(out/name) for name in old},'changedFiles':changes,
  'rendererVersion':'observatory-v55-s2-palette-r2-trial','nodeModulesSymlink':str((out/'node_modules').resolve()),
  'protocolSha256':sha(ROOT/'PROTOCOL.md'),'derivationScriptSha256':sha(Path(__file__)),'paletteInputSha256':sha(PALETTE)}
 (ROOT/'trial-source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 result={'status':'ONE_FIXED_R2_NO_FITTING_NO_GPU','YWeights':Y,'classes':classes,'endpoints':endpoints,'pairwiseLogContrasts':contrasts,
  'maxIdealYDelta':max(abs(e['oldY']-e['idealY']) for e in endpoints),'maxBinary32YAbsDelta':max(abs(e['binary32YDelta']) for e in endpoints),
  'maxBinary32YRelativeDelta':max(abs(e['binary32YRelativeDelta']) for e in endpoints),
  'maxIdealLogContrastDelta':max(abs(c[k]['idealDelta']) for c in contrasts for k in ['R/G','B/G']),
  'maxBinary32LogContrastDelta':max(abs(c[k]['binary32Delta']) for c in contrasts for k in ['R/G','B/G']),
  'colourSourceLinesChanged':changed,'sourceFilesVerified':119,'noRootProductWrites':True,
  'limits':['Intrinsic authored Y only; coloured illumination does not preserve final radiance Y.',
   'Relative endpoint log-channel contrasts are preserved, not the whole nonlinear rendered hue distribution.',
   'Post-normalized centroid may deviate slightly from S2 target; no empirical correction is allowed.',
   'No bare/shrub, crop, built, shape, normals, matte/grain, lookup, texture or pass changes.']}
 (ROOT/'comparison.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'classes':classes,'endpoints':endpoints,'maximums':{k:v for k,v in result.items() if k.startswith('max')},'changedFiles':changes},indent=2))

if __name__=='__main__':main()
