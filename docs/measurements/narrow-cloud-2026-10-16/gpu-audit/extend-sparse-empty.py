from pathlib import Path
import json,hashlib,array,shutil,struct
p=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/narrow-cloud/gpu-audit')
sha=lambda b:hashlib.sha256(b).hexdigest()
oldInput=(p/'inputs.json').read_bytes();inp=json.loads(oldInput)
assert len(inp['groups'])==6 and inp['datasets'][1]['queryCount']==6912,'Expected original input, refuse duplicate append.'
snap=p/'input-snapshots/initial-sparse-no-zero';assert not snap.exists();snap.mkdir(parents=True)
# Snapshot every regular initial artifact, never follow/copy the 66MiB cache symlinks.
refs={}
for a in sorted(p.iterdir()):
 if a.is_symlink():refs[a.name]={'target':str(a.resolve()),'sha256':json.loads((p/'prepared-files.json').read_text())['files'][a.name]['sha256']};continue
 if not a.is_file():continue
 b=a.read_bytes();(snap/a.name).write_bytes(b)
files={a.name:{'bytes':a.stat().st_size,'sha256':sha(a.read_bytes())} for a in snap.iterdir() if a.is_file()}
(snap/'snapshot-manifest.json').write_text(json.dumps({'kind':'before-sparse-empty-coverage-revision','files':files,'immutableCacheReferencesNotCopied':refs,'reason':'Initial sparse dataset had no narrow-zero queries; criterion unchanged. Preserve initial GPU output and inputs.'},indent=2)+'\n')
# Only append queries; no macro/cache read or texture work.
fixture=inp['datasets'][1];original=(p/fixture['queryFile']).read_bytes();assert sha(original)==fixture['querySha256']
q=array.array('f');groups=inp['groups'];counts=fixture['groups']
points=[(.1,.1,.8),(.1,.8,.1),(.8,.1,.1),(.25,.25,.75),(.25,.75,.25),(.75,.25,.25)]
newDistant=[]
def add(coord,fine,ice,group):
 if group not in groups:groups.append(group)
 row=[*coord,ice,*fine,float(groups.index(group))];q.extend(row);counts[group]=counts.get(group,0)+1
 if group=='sparse-distant-empty':newDistant.append(row)
for coord in points:
 for ice in [0,.5,1]:
  for k in range(8):add(coord,[1 if k&4 else 0,1 if k&1 else 0,1 if k&2 else 0],ice,'sparse-distant-empty')
def halton(i,b):
 v=0;w=1/b
 while i:v+=(i%b)*w;i//=b;w/=b
 return v
for i in range(1,2049):
 coord=[halton(i,2),halton(i,3),halton(i,5)]
 for ice in [0,.5,1]:add(coord,[halton(i,7),halton(i,11),halton(i,13)],ice,'sparse-halton-domain')
assert len(newDistant)==144 and len(q)//8==6288
# A cheap independent metadata-only check: these designated probes are far from
# every sparse texel and its r2 seed. It does not sample/generate any macro array.
for row in newDistant:
 coord=row[:3];ice=row[3];fine=row[4:7];idx=[min(127,int(max(0,min(1,v))*128)) for v in coord]
 warp=[(fine[1]-.5)*(.16-.08*ice),(fine[2]-.5)*(.12-.10*ice),(fine[0]-.5)*(.16-.06*ice)]
 warped=[coord[a]+warp[a]/[10,8.5,7][a] for a in range(3)]
 for e in fixture['entries']:
  ix=[e['index']%256,(e['index']//256)%256,e['index']//65536];seed=[v//2 for v in ix]
  assert any(abs(idx[a]-seed[a])>2 for a in range(3))
  assert any(abs(max(0,min(1,warped[a]))-(ix[a]+.5)/256)>1/256 for a in range(3))
new=original+q.tobytes();(p/fixture['queryFile']).write_bytes(new)
fixture.update(queryCount=len(new)//32,queryBytes=len(new),querySha256=sha(new))
inp['coverageRevision']={'reason':'Add genuinely empty/distant sparse probes plus Halton domain coverage; initial criterion narrowZero>0 remains unchanged.',
 'previousInputsSha256':sha(oldInput),'previousSparseQueriesSha256':sha(original),'previousQueryCount':6912,'appendedQueries':6288,'distantEmptyQueries':144,'haltonDomainQueries':6144,
 'unchanged':['audit.js','audit.wgsl','source snapshots','real query dataset','macro array','narrow R8 array','GPU pass/fail criteria'],'newBakes':0,'gpuExecutedByRevision':False}
(p/'inputs.json').write_text(json.dumps(inp,indent=2)+'\n')
# Keep the original preparer reproducible for the revised query set. Do not execute it.
a=p/'prepare-audit.py';s=a.read_text();needle=" b=q.tobytes();filename=name+'-queries-f32.bin';(out/filename).write_bytes(b)"
assert needle in s
block=''' if fixture:
  # Coverage revision: genuinely empty points and independent Halton volume.
  for coord in [(.1,.1,.8),(.1,.8,.1),(.8,.1,.1),(.25,.25,.75),(.25,.75,.25),(.75,.25,.25)]:
   for ice in [0,.5,1]:
    for k in range(8):add(coord,[1 if k&4 else 0,1 if k&1 else 0,1 if k&2 else 0],ice,'sparse-distant-empty')
  def sparse_halton(i,b):
   v=0;w=1/b
   while i:v+=(i%b)*w;i//=b;w/=b
   return v
  for i in range(1,2049):
   co=[sparse_halton(i,2),sparse_halton(i,3),sparse_halton(i,5)]
   for ice in [0,.5,1]:add(co,[sparse_halton(i,7),sparse_halton(i,11),sparse_halton(i,13)],ice,'sparse-halton-domain')
'''
a.write_text(s.replace(needle,block+needle,1))
readme=p/'README.md';s=readme.read_text().replace('Fixture sparsa:6.912 query','Fixture sparsa:13.200 query').replace('  hash confrontati. Non è una seconda nube o un bake anatomico.','  hash confrontati. Include144 probe distanti garantiti vuoti e6.144 Halton\n  nel dominio, oltre ai6.912 originali vicini ai contributor. Non è una seconda\n  nube o un bake anatomico.')
s+='''

Revisione copertura dopo il primo audit: la fixture originale non conteneva
query narrow-zero, quindi falliva correttamente il criterio anti-PASS-vuoto.
Gli input originali e il primo risultato sono conservati byte per byte in
`input-snapshots/initial-sparse-no-zero/`. Il runner, shader, criteri e dataset
reale sono invariati. Sono state aggiunte6.288 query soltanto alla fixture;
nessuna esecuzione GPU/bake/macro array è stata fatta per la revisione.
'''
readme.write_text(s)
(p/'extend-sparse-empty.py').write_bytes(Path(__file__).read_bytes())
manifest=json.loads((p/'prepared-files.json').read_text())
for name in ['inputs.json',fixture['queryFile'],'prepare-audit.py','README.md','extend-sparse-empty.py']:
 a=p/name;b=a.read_bytes();manifest['files'][name]={'bytes':len(b),'sha256':sha(b),'symlinkTarget':None}
manifest['coverageRevision']=inp['coverageRevision'];manifest['initialSnapshotManifestSha256']=sha((snap/'snapshot-manifest.json').read_bytes())
(p/'prepared-files.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Verify all unchanged runner/kernel/real input bytes against their preserved versions.
for name in ['audit.js','audit.wgsl','cloudShader.before.ts','cloudShader.after.ts','real-queries-f32.bin']:
 assert (p/name).read_bytes()==(snap/name).read_bytes(),name
print(json.dumps({'fixtureQueries':fixture['queryCount'],'appended':6288,'runnerSha256':sha((p/'audit.js').read_bytes()),'inputsSha256':sha((p/'inputs.json').read_bytes()),'sparseQueriesSha256':sha(new),'preparedManifestSha256':sha((p/'prepared-files.json').read_bytes()),'initialSnapshotManifestSha256':sha((snap/'snapshot-manifest.json').read_bytes()),'gpuExecuted':False,'newBakes':0,'macroArrayReadOrWritten':False},indent=2))
