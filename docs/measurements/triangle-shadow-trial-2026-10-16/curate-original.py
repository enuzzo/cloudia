from pathlib import Path
import hashlib,json,shutil,os

EXT=Path(__file__).resolve().parent
REPO=Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
OUT=REPO/'docs/measurements/triangle-shadow-trial-2026-10-16'
OUT.mkdir(exist_ok=False)
count=0;total=0

def copy(source,dest):
 global count,total
 assert source.is_file() and not source.is_symlink(),source
 count+=1;total+=source.stat().st_size
 assert count<512 and total<50*1024*1024
 dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,dest)
 assert hashlib.sha256(source.read_bytes()).digest()==hashlib.sha256(dest.read_bytes()).digest()

for directory in ['positive-witness','caster-proposal','clipping-validation','qualification','browser','gpu-readback','intrinsic-counterexample']:
 for parent,dirs,files in os.walk(EXT/directory,followlinks=False):
  for name in list(dirs):
   path=Path(parent)/name
   if name=='node_modules':
    assert path.is_symlink();dirs.remove(name)
   else:assert not path.is_symlink(),path
  for name in sorted(files):
   path=Path(parent)/name;copy(path,OUT/path.relative_to(EXT))

for name in ['PROTOCOL.json','source-manifest.json','baseline-native.json','clipping-design-review.md',
             'trial-integration-review.md','native-visual-review.md','gpu-mismatch-static-review.md',
             'select-scope-and-affine-counterexample.md','readback-independent-review.md','mesh-refinement-feasibility.md']:
 copy(EXT/name,OUT/name)

base=json.loads((EXT/'source-manifest.json').read_text())
trial=json.loads((EXT/'qualification/source-manifest.json').read_text())
diagnostic=json.loads((EXT/'gpu-readback/source-manifest.json').read_text())
assert len(base)==124 and len(trial)==len(diagnostic)==128
for name in trial:
 if name not in base or base[name]!=trial[name]:
  if name in base:copy(EXT/'source'/name,OUT/'source-before'/name)
  copy(EXT/'candidate-source'/name,OUT/'source-trial'/name)
 if trial[name]!=diagnostic[name]:copy(EXT/'diagnostic-source'/name,OUT/'source-diagnostic'/name)
print(json.dumps({'curated':str(OUT),'copiedFiles':count,'copiedBytes':total}))
