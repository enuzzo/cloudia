"""Root preparation only: creates an immutable pre-run input ledger, runs no model."""
import hashlib,json,math,struct
from pathlib import Path
R=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle44');H=R/'mesh-witness';S=R/'patch-source'
C=Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia');P=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle43/terrain-grid-audit')
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def f32(n):return struct.unpack('f',struct.pack('f',n))[0]
old=json.loads((P/'PRE-RUN-FREEZE.json').read_text());scalar=json.loads((R/'dem-patch-scalar/PRE-RUN-FREEZE.json').read_text())
source=json.loads((R/'run/SOURCE-FREEZE-R2.json').read_text())
for rel,digest in source.items():
 if sha(S/rel)!=digest:raise RuntimeError('Source differs: '+rel)
I=f32(128*.256);J=math.ceil(I/.125)*.125;Ccut=f32(94*.512)
seams=[]
for a,b in [(I,J),(48,Ccut)]:
 r=(a+b)/2
 for t in [-1,-.37,0,.37,1]:
  for x,z in [(r,t*r),(-r,t*r),(t*r,r),(t*r,-r)]:
   if [x,z] not in seams:seams.append([x,z])
d=dict(state='FROZEN_NOT_EXECUTED',scope='One sequential actual A OFF and B annulus R2 CPU mesh execution; no GPU, retries or parameter sweep.',sourceRoot=str(S),dependencyRoot=str(C/'node_modules'),bunPath=scalar['bunPath'],demPath=str(S/'src/cumulonimbus/assets/liguria-apuane-dem.bin'),historicalReport=old['historicalReport'],expectedDemSHA256=old['expectedDemSHA256'],expectedHistoricalFitSHA256=old['expectedHistoricalFitSHA256'],aStreamPath=str(P/'run/A/errors.f64le.gz'),scalarStreamPath=str(R/'dem-patch-scalar/run/errors.f64le.gz'),expectedACombinedErrorSHA256='ef4836dae907207f904b851db56404df9f5cc40e370f56852246d9b2aac2189d',expectedScalarHoldoutSHA256='81b2e470cd4a9b48feb7bf9037b98d56ce107872fc6a98c4e37549c9e2d8db35',innerProbes=[[1.13,2.27],[-2.31,8.13],[12.37,-19.41],[-29.1,-31.8],[32.7,1.9]],outerProbes=[[49.1,2.3],[-50.7,19.3],[32.1,61.7],[-77.9,-88.3],[100.1,25.3]],seamProbes=seams,limitsSingleChild=dict(cpuSeconds=20,wallSeconds=30,terminalDarwinRSSBytes=1610612736),numericGate='Fit and holdout lower land RMS and nonworse global p99/max; near bytes identical, far holdout scalar parity within1e-9metres; independent saved-stream review before GPU',selfDigestPolicy='Root supplies SHA of this file; it excludes itself.')
paths=[H/'witness.ts',H/'run.py',H/'PROTOCOL-DRAFT.md',H/'POINTS.json',R/'run/SOURCE-FREEZE-R2.json',R/'run/NATIVE-PROTOCOL-BEFORE-B.json']+[S/p for p in source]+[Path(old['historicalReport']),P/'run/A/result.json',Path(d['aStreamPath']),R/'dem-patch-scalar/run/result.json',Path(d['scalarStreamPath'])]
for row in scalar['inputs']:
 p=Path(row['path'])
 if str(p).startswith(str(C/'node_modules')) or str(p)==d['bunPath']:paths.append(p)
d['inputs']=[dict(path=str(p),bytes=p.stat().st_size,sha256=sha(p)) for p in dict.fromkeys(paths)]
p=H/'PRE-RUN-FREEZE.json'
with p.open('x') as f:f.write(json.dumps(d,indent=2)+'\n')
print(json.dumps(dict(freezeSHA256=sha(p),inputCount=len(d['inputs']),sourceFiles=len(source),seamProbes=len(seams),I=I,J=J,C=Ccut)))
