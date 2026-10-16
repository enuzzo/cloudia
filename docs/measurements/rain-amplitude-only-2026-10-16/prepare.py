from pathlib import Path
import subprocess,hashlib,json,difflib,datetime,shutil
OUT=Path(__file__).resolve().parent
REPO=Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
BASE=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work')
OLD=REPO/'docs/measurements/rain-cache-audit-2026-10-16/phase2'
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((BASE/'data/manifest.json').read_text())
original=OUT/'source-original/src/cumulonimbus';runtime=OUT/'source-runtime/src/cumulonimbus'
original.mkdir(parents=True);runtime.mkdir(parents=True)
entries=[]
for name in [*manifest['sourceHashesAfter'],'sun']:
 data=subprocess.run(['git','show',f'ab2e122:src/cumulonimbus/{name}.ts'],cwd=REPO,check=True,capture_output=True).stdout
 expected=manifest['sourceHashesAfter'].get(name)
 if expected and sha(data)!=expected:raise RuntimeError('Historical source drift: '+name)
 (original/(name+'.ts')).write_bytes(data)
 target=data
 if name=='motionField':
  needle=b"from 'three/webgpu'";replacement=("from '"+str(REPO/'node_modules/three/build/three.webgpu.js')+"'").encode()
  if target.count(needle)!=1:raise RuntimeError('Dependency import not unique')
  target=target.replace(needle,replacement)
 (runtime/(name+'.ts')).write_bytes(target)
 entries.append({'name':name,'gitObject':f'ab2e122:src/cumulonimbus/{name}.ts','originalSha256':sha(data),'runtimeSha256':sha(target),'bytes':len(data),'matchesBakeManifest':expected==sha(data) if expected else None,'transform':'absolute Three module path only' if name=='motionField' else 'none'})
(OUT/'inputs').mkdir()
for name in ['replay.ts','audit-core.ts']:
 shutil.copyfile(OLD/name,OUT/'inputs'/(name+'.phase2-original'))
oldRepo=str(REPO);runtimeRepo=str(OUT/'source-runtime');rawRepo=str(OUT/'source-original')
replay=(OLD/'replay.ts').read_text().replace(oldRepo+'/src/cumulonimbus/',runtimeRepo+'/src/cumulonimbus/')
needle="const repo='"+oldRepo+"';"
assert replay.count(needle)==1
replay=replay.replace(needle,"const repo='"+rawRepo+"';")
needle="const required=['volume','motion','motionField','precipitation','emptyTraversal','landscape'];"
assert replay.count(needle)==1
replay=replay.replace(needle,"const required=Object.keys(manifest.sourceHashesAfter); // Strengthened: all ten historical SHA must match.")
needle="const pose=JSON.parse(readFileSync(base+'/input-control.json','utf8'));"
extra="""
const preparation=JSON.parse(readFileSync(auditBase+'/preparation.json','utf8'));
if(sha(readFileSync(auditBase+'/PROTOCOL.md'))!=='d4aa97b964327d57246895a50aa3da4b5c1b42bd9651469a2b44c1643f4ab3b3')throw new Error('Frozen protocol drift');
for(const item of preparation.sources){
 if(sha(readFileSync(auditBase+'/source-original/src/cumulonimbus/'+item.name+'.ts'))!==item.originalSha256||sha(readFileSync(auditBase+'/source-runtime/src/cumulonimbus/'+item.name+'.ts'))!==item.runtimeSha256)throw new Error('Historical/runtime source drift: '+item.name);
}
for(const item of preparation.dependencies)if(sha(readFileSync(item.path))!==item.sha256)throw new Error('Local dependency drift: '+item.path);
for(const item of preparation.controlInputs)if(sha(readFileSync(item.path))!==item.sha256)throw new Error('Control input drift: '+item.path);
"""
assert replay.count(needle)==1
replay=replay.replace(needle,needle+extra)
(OUT/'replay.ts').write_text(replay)
core=(OLD/'audit-core.ts').read_text().replace(oldRepo+'/src/cumulonimbus/',runtimeRepo+'/src/cumulonimbus/')
(OUT/'oracle-core.ts').write_text(core)
for name,before,after in [('replay.ts',(OLD/'replay.ts').read_text(),replay),('oracle-core.ts',(OLD/'audit-core.ts').read_text(),core)]:
 (OUT/(name+'.transform.patch')).write_text(''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='phase2/'+name,tofile='amplitude-only/'+name)))
dependencyPaths=[REPO/'node_modules/three/package.json',REPO/'node_modules/three/build/three.webgpu.js',REPO/'node_modules/three/build/three.core.js']
if(json.loads(dependencyPaths[0].read_text())['version']!='0.186.0'):raise RuntimeError('Three version drift')
prep={'kind':'amplitude-only-historical-source-preparation','date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'historicalRef':'ab2e122','allTenBakeSourceHashesExact':all(e['matchesBakeManifest'] is True for e in entries if e['name']!='sun'),'sources':entries,'dependencies':[{'path':str(p),'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in dependencyPaths],'controlInputs':[{'path':str(p),'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in [BASE/'data/manifest.json',BASE/'input-control.json',BASE/'work-32x18.json']],'originalAuditInputs':[{'path':str(OLD/n),'sha256':sha((OLD/n).read_bytes())} for n in ['replay.ts','audit-core.ts']],'bakesPerformed':0,'gpuExecuted':False,'pathTransformDescription':'Replay/oracle CPU imports point at external source-runtime. Replay source guards point at external source-original. motionField Three bare module import rewritten to verified existing local three.webgpu.js. All original guards retained; required source list strengthened to all ten. No other historical source edits.'}
(OUT/'preparation.json').write_text(json.dumps(prep,indent=2)+'\n')
print(json.dumps({'allTenExact':prep['allTenBakeSourceHashesExact'],'sources':len(entries),'preparationSha256':sha((OUT/'preparation.json').read_bytes()),'noRunYet':True}))
