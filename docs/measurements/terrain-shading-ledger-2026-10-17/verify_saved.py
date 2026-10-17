from pathlib import Path
import hashlib,json,sys,struct
r=Path(__file__).resolve().parent
m=json.loads((r/'MANIFEST.json').read_text())
for p,v in m['files'].items():
 b=(r/p).read_bytes();assert len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256'],p
a=json.loads((r/'browser/shading-ledger.json').read_text())
assert a['status']=='COMPLETE_IDENTICAL_F32' and all(a[k] for k in ['stable','cacheStateQualified','shadingQualified','ledgerDistanceQualified','ledgerValuesQualified'])
assert len(a['shadingLedger']['rows'])==12 and a['shadingLedger']['readbackRequests']==36 and a['shadingLedger']['drain']['status']=='fulfilled'
assert len({a[k]['sha256'] for k in ['cached','fresh','restored']})==1
assert a['fresh']['sha256']=='07fa43ec5de6d77b9bdf83d5a78e73cb607ae573d875ce382b3c28f909fb2fb9'
assert a['fresh']['alphaSHA256']=='29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c'
assert all(v['identical'] and v['sha256']==v['expectedSHA256'] for v in a['installedGeometry'].values())
for row,w in zip(a['shadingLedger']['rows'],a['fresh']['witness']):
 assert row['id']==w['id'] and [row['x'],row['y']]==w['pixel']
 assert all(rec['bits'][3]==w['bits'][3] for rec in row['records'].values())
base=json.loads((r/'source/baseline-manifest.json').read_text());exp=json.loads((r/'source/experiment-manifest.json').read_text())
assert len(base)==141 and len(exp)==144
for p,h in exp.items():
 overlay=r/'source/overlay'/p
 assert (hashlib.sha256(overlay.read_bytes()).hexdigest() if overlay.exists() else base[p])==h,p
repo=r.parents[2]
if '--current' in sys.argv:
 for p,h in base.items():assert hashlib.sha256((repo/p).read_bytes()).hexdigest()==h,p
alias=json.loads((r/'browser/restored-native-bitmap-alias.json').read_text());png=repo/'docs/measurements/terrain-optical-material-2026-10-17/browser/candidate-b-native.png';b=png.read_bytes()
assert hashlib.sha256(b).hexdigest()==alias['actualExportSHA256'] and len(b)==alias['bytes']
assert list(struct.unpack('>II',b[16:24]))==[alias['width'],alias['height']]
print(json.dumps({'status':'PASS_SAVED_ONLY','files':len(m['files']),'bytes':sum(v['bytes'] for v in m['files'].values()),'source141Current':'--current' in sys.argv,'noGPUReplay':True}))
