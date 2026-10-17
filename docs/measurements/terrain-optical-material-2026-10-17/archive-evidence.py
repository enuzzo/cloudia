from pathlib import Path
import hashlib,json,shutil
b=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle36');repo=Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia');a=repo/'docs/measurements/terrain-optical-material-2026-10-17';a.mkdir(parents=True,exist_ok=True)
sha=lambda data:hashlib.sha256(data).hexdigest()
def save(rel,data):
 p=a/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
def copy(rel,src):save(rel,src.read_bytes())
base=json.loads((b/'baseline-manifest.json').read_text());copy('source/baseline-manifest.json',b/'baseline-manifest.json')
index={'baseGitCommit':'3e4f4f82a77742c3227ccaf64e339983b8d94c96','scope':'Unchanged source files resolved from immutable base Git commit. Overlays preserve each executed source, including failed test/type setup. One shared optical binary stored in final overlay.','variants':{}}
variants=[('r1','candidate-manifest-r1.json','optical-source'),('r2','candidate-manifest-r2.json','optical-source'),('navigation-r4','candidate-navigation-manifest-r4.json','navigation-source'),('final','final-manifest.json','final-source')]
asset='src/cumulonimbus/assets/liguria-apuane-optical.bin';assetstored='source/final-overlay/'+asset
for name,manifest,folder in variants:
 m=json.loads((b/manifest).read_text());copy('source/'+manifest,b/manifest);rows={}
 for p,h in m.items():
  if base.get(p)==h:rows[p]={'sha256':h,'baseGitPath':p};continue
  raw=(b/folder/p).read_bytes()
  if name=='r1':
   s=raw.decode() if p.endswith('.ts') else None
   if p.endswith('GPUSceneEngine.ts'):raw=s.replace('const opticalBindings:Record<string,Node>=','const opticalBindings=').encode()
   elif p.endswith('lifecycle.test.ts'):raw=s.replace("expect(report.rendererVersion).toBe('observatory-v60-optical-material-trial-r1')","expect(report.rendererVersion).toBe('observatory-v60-terrain-raster-cache')").encode()
   elif p.endswith('terrainOpticalRaster.test.ts'):raw=s.replace("readFileSync('src/cumulonimbus/fixtures/terrain-v60-raster.wgsl','utf8')","readFileSync(new URL('./fixtures/terrain-v60-raster.wgsl',import.meta.url),'utf8')").encode()
  assert sha(raw)==h,(name,p,sha(raw),h)
  stored=assetstored if p==asset else 'source/'+name+'-overlay/'+p
  if p!=asset or name=='final':save(stored,raw)
  rows[p]={'sha256':h,'stored':stored}
 index['variants'][name]={'manifest':'source/'+manifest,'fileCount':len(m),'files':rows}
save('source/INDEX.json',(json.dumps(index,indent=2)+'\n').encode())
pack=json.loads((b/'optical-data/MANIFEST.json').read_text())
for row in pack['files']:
 p=row['path'];raw=(b/'optical-data'/p).read_bytes();assert len(raw)==row['bytes'] and sha(raw)==row['sha256']
 if p!='optical-rgba16f.bin':save('optical-data/'+p,raw)
copy('optical-data/MANIFEST.json',b/'optical-data/MANIFEST.json')
save('optical-data/ASSET-ALIAS.json',(json.dumps({'originalPath':'optical-rgba16f.bin','stored':assetstored,'sha256':'217325bcdb50dd58076b2f5068ee0b5ba524f6f076a70d4345f279f233f5dd62','scope':'Identical offline pack and runtime asset; one archive payload, original pack manifest retained.'},indent=2)+'\n').encode())
for folder in ['optical-material-helper','optical-loader-helper','navigation-helper']:
 for p in (b/folder).rglob('*'):
  if not p.is_file() or any(x in p.parts for x in ['node_modules','__pycache__']):continue
  if p.suffix in ['.md','.json','.log','.ts','.py','.mjs']:copy('helpers/'+folder+'/'+str(p.relative_to(b/folder)),p)
for p in (b/'browser').iterdir():
 if p.is_file() and p.suffix in ['.png','.jpg','.json']:copy('browser/'+p.name,p)
for p in b.iterdir():
 if not p.is_file() or p.name in ['archive-evidence.py','REPORT-DRAFT.md','HANDOFF-TOP-DRAFT.md']:continue
 if p.suffix in ['.json','.log','.md','.ts']:copy('run/'+p.name,p)
copy('archive-evidence.py',b/'archive-evidence.py')
print(json.dumps({'archive':str(a),'payloadFilesBeforeVerifier':len([p for p in a.rglob('*') if p.is_file()])}))
