"""Independent Decimal comparison and hash validation, no generator imports."""
from pathlib import Path
from decimal import Decimal,getcontext
import argparse,json,hashlib,math,csv
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parent);p.add_argument('--output',type=Path);args=p.parse_args()
R=args.root;getcontext().prec=50;D=Decimal
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def j(name):return json.loads((R/name).read_text())
def dec(x):return D(str(x))
def close(a,b,tol='1e-11'):assert abs(dec(a)-dec(b))<=D(tol),(a,b)
inputs=j('input-manifest.json');freeze=j('pre-run-freeze.json');q=j('comparison.json')
refs=j('R1-evidence-reference.json')
for record in refs.values():assert sha(Path(record['path']))==record['sha256']
terminal=json.loads(Path(refs['r1Terminal']['path']).read_text())
assert terminal['status']=='R1_TERMINAL_INTERNAL_RSS_GUARD_FAILURE' and not terminal['candidateBStarted'] and terminal['ownedChildReaped']
prior=j('prior-approach-qa-run-control.json');assert prior['status']=='WRAPPERFAIL' and prior['childExitCode'] is None

for name,h in freeze['sha256'].items():assert sha(R/name)==h,name
assert sha(Path(inputs['sameBunBinary']))==inputs['bunBinarySha256']
original=(R/'qa-morphology.r1-common.ts.frozen').read_text();new=(R/'qa-morphology.common.ts').read_text()
assert original.replace('const RSS_CAP=1024**3;','const RSS_CAP=2*1024**3;')==new
cases={};controls={}
for name,c in inputs['cases'].items():
 records=j(name+'-source-manifest.json');assert len(records)==119
 assert sha(R/(name+'-source-manifest.json'))==c['expected']
 for path,h in records.items():assert sha(Path(c['source'])/path)==h,(name,path)
 control=j(name+'-control.json');controls[name]=control
 assert control['exitCode']==0 and control['ownedChildReaped'] and control['error'] is None
 assert control['lifetimeHighwaterRssBytes']<=2*1024**3 and control['elapsedSeconds']<=240 and control['childCpuSeconds']<=180
 assert control['scriptSha256']==inputs['commonScriptSha256']==sha(R/name/'scripts/qa-morphology.ts')
 output=j(name+'.json');assert output['configuredQuality']=={'macro':256,'detail':128} and len(output['cases'])==1
 cases[name]=output['cases'][0];assert cases[name]['seed']==617 and cases[name]['detailResolution']==128
 assert sha(R/(name+'.json'))==control['outputSha256']==q['inputOutputSha256'][name]
 assert j(name+'-validation.json')['status']=='PASS_VALID_FULL_QUALITY_MORPHOLOGY_JSON'
a,b=cases.values();delta=dec(b['integratedDensity'])-dec(a['integratedDensity']);close(q['mass']['delta'],delta)
close(q['mass']['percent'],delta/dec(a['integratedDensity'])*100)
for i in range(3):
 close(q['centroid']['deltaMetres'][i],(dec(b['centroid'][i])-dec(a['centroid'][i]))*1000)
 close(q['spread']['deltaMetres'][i],(dec(b['spread'][i])-dec(a['spread'][i]))*1000)
close(q['occupiedFraction']['relativePercent'],(dec(b['occupiedFraction'])/dec(a['occupiedFraction'])-1)*100)
sections=list(csv.DictReader((R/'section-deltas.csv').open()));assert len(sections)==256
for i,row in enumerate(sections):
 close(row['heightKm'],a['sections'][i]['height']);assert a['sections'][i]['height']==b['sections'][i]['height']
 close(row['massDelta'],dec(b['sections'][i]['mass'])-dec(a['sections'][i]['mass']))
 close(row['occupiedAreaDelta'],dec(b['sections'][i]['area'])-dec(a['sections'][i]['area']))
 close(row['bulkAreaDelta'],dec(b['sections'][i]['denseArea'])-dec(a['sections'][i]['denseArea']))
profile=list(csv.DictReader((R/'upper-profile-deltas.csv').open()));assert len(profile)==256
for i,row in enumerate(profile):
 assert a['upperProfile'][i]==b['upperProfile'][i];assert dec(row['deltaKm'])==0
assert q['upperProfile']['unchangedColumns']==256
assert a['supportBounds']==b['supportBounds']==q['supportBounds']['A']==q['supportBounds']['B']
for name,c in cases.items():
 faces=c['boundaryLayers']['faces'];assert len(faces)==6
 for face in faces:
  assert len(face['layers'])==2
  for depth,layer in enumerate(face['layers']):
   assert layer['index']==(depth if face['side']=='min' else 255-depth)
   assert layer['nonzeroR']==layer['maxRByte']==layer['bulkR']==0
 assert q['boundarySummary'][name]['secondNonzeroRTotal']==0
# Check every frozen evidence payload when the final manifest is present.
count=0
if (R/'MANIFEST.json').exists():
 for e in j('MANIFEST.json')['files']:
  path=R/e['path'];assert path.stat().st_size==e['bytes'] and sha(path)==e['sha256'];count+=1
report={'status':'PASS_INDEPENDENT_DECIMAL_JSON_REDUCTION_AND_HASHES','payloadFilesVerified':count,'sourceFilesVerified':238,
 'commonA_BScriptSha256':inputs['commonScriptSha256'],'guardOnlyScriptDiff':True,
 'integratedDensityDelta':str(delta),'integratedDensityPercentDecimal':str(delta/dec(a['integratedDensity'])*100),
 'sectionRowsVerified':256,'profileColumnsUnchanged':256,'supportBoundsUnchanged':True,
 'sixOuterAndSecondLayersRZeroBoth':True,'bothExit0AndReaped':True,'r1FailureStillPreserved':True,
 'limits':'Independent arithmetic/schema/hash verification over saved JSON. No raw macro-array replay, GPU, rendered-image, FPS or art acceptance.'}
encoded=json.dumps(report,indent=2)+'\n'
if args.output:args.output.write_text(encoded)
print(encoded,end='')
