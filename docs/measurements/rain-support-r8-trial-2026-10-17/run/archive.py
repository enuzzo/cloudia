"""Copy bounded saved files and source deltas; no product execution."""
from pathlib import Path
import hashlib,json,shutil
r=Path(__file__).resolve().parent.parent
root=Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
arc=root/'docs/measurements/rain-support-r8-trial-2026-10-17'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads((r/'run/source-baseline141.json').read_text());candidate=json.loads((r/'run/SOURCE-FREEZE-R2.json').read_text())
for name,digest in base.items():assert sha(root/name)==digest,name
for name,digest in candidate.items():assert sha(r/'candidate-source'/name)==digest,name
def copy(source,target):
 assert source.is_file() and not source.is_symlink()
 target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():assert target.read_bytes()==source.read_bytes(),str(target)
 else:shutil.copyfile(source,target)
for group in ['run','browser','review']:
 for source in sorted((r/group).iterdir()):
  if source.is_file():copy(source,arc/group/source.name)
  elif group=='review' and source.name in ['author-before','author-after']:
   for p in sorted(source.iterdir()):copy(p,arc/group/source.name/p.name)
for name,digest in candidate.items():
 if base.get(name)!=digest:copy(r/'candidate-source'/name,arc/'source-overlay'/name)
payload={};stack=[(arc,0)]
while stack:
 folder,depth=stack.pop();assert depth<10
 for p in sorted(folder.iterdir()):
  assert not p.is_symlink()
  if p.is_dir():stack.append((p,depth+1))
  elif p.name!='MANIFEST.json':
   payload[str(p.relative_to(arc))]={'bytes':p.stat().st_size,'sha256':sha(p)};assert len(payload)<256
m={'kind':'First dedicated broad-support alpha R8 trial; practical adoption gate failed','canonicalVersion':'observatory-v61-observed-terrain-material','candidateVersion':'experiment-v61-support-alpha-r8-r1','canonicalManifestSHA256':sha(r/'run/source-baseline141.json'),'candidateR2ManifestSHA256':sha(r/'run/SOURCE-FREEZE-R2.json'),'candidateAdopted':False,'payload':dict(sorted(payload.items()))}
p=arc/'MANIFEST.json';assert not p.exists();p.write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps({'manifestSHA256':sha(p),'payloadFiles':len(payload),'payloadBytes':sum(v['bytes'] for v in payload.values())}))
