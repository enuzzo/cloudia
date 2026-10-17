from pathlib import Path
import json,hashlib,sys,struct
from PIL import Image
r=Path(__file__).resolve().parent;repo=r.parents[2];m=json.loads((r/'MANIFEST.json').read_text())
for p,v in m['files'].items():
 b=(r/p).read_bytes();assert len(b)==v['bytes'] and hashlib.sha256(b).hexdigest()==v['sha256'],p
phases=['baseline-a','candidate-b','return-a'];audits=[json.loads((r/f'browser/{p}-audit.json').read_text()) for p in phases]
alpha='29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c'
for a in audits:
 assert a['status']=='COMPLETE_IDENTICAL_F32' and a['stable'] and a['cacheStateQualified']
 assert a['cached']['sha256']==a['fresh']['sha256']
 assert all(a[k]['alphaSHA256']==alpha for k in ['cached','fresh'])
assert audits[0]['fresh']['sha256']==audits[2]['fresh']['sha256']=='07fa43ec5de6d77b9bdf83d5a78e73cb607ae573d875ce382b3c28f909fb2fb9'
assert audits[1]['fresh']['sha256']=='efcfeab71e90f5c6a22b30f1473e75c414e661493c5aa70a5d8ff52419767a4d'
for phase in ['baseline-a','return-a']:
 n=json.loads((r/f'browser/{phase}-native.json').read_text());alias=json.loads((r/f'browser/{phase}-native-alias.json').read_text());p=repo/'docs/measurements/terrain-optical-material-2026-10-17/browser/candidate-b-native.png'
 assert hashlib.sha256(p.read_bytes()).hexdigest()==alias['actualExportSHA256']==n['png']['sha256']=='6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9'
b=(r/'browser/candidate-b-native.png').read_bytes();n=json.loads((r/'browser/candidate-b-native.json').read_text());assert hashlib.sha256(b).hexdigest()==n['png']['sha256']=='66aa0e659a0975b55960c151caa75eeb1063ae868636256fe44f735d40909d67'
assert len(b)==3804264 and struct.unpack('>II',b[16:24])==(2474,1844)
aPath=repo/'docs/measurements/terrain-optical-material-2026-10-17/browser/candidate-b-native.png'
for crop in json.loads((r/'browser/crop-ledger.json').read_text())['crops']:
 src=aPath if crop['path'].startswith('baseline') else r/'browser/candidate-b-native.png'
 with Image.open(src) as im:expected=im.crop(crop['PIL_box_LTRB']).tobytes()
 with Image.open(r/'browser'/crop['path']) as im:actual=im.tobytes();assert list(im.size)==crop['widthHeight']
 assert actual==expected and hashlib.sha256(actual).hexdigest()==crop['pixelSHA256']
base=json.loads((r/'source/baseline-manifest.json').read_text());exp=json.loads((r/'source/experiment-manifest.json').read_text());assert len(base)==141 and len(exp)==143
for p,h in exp.items():
 f=r/'source/overlay'/p;assert (hashlib.sha256(f.read_bytes()).hexdigest() if f.exists() else base[p])==h,p
if '--current' in sys.argv:
 for p,h in base.items():assert hashlib.sha256((repo/p).read_bytes()).hexdigest()==h,p
print(json.dumps({'status':'PASS_SAVED_ONLY','files':len(m['files']),'bytes':sum(v['bytes'] for v in m['files'].values()),'source141Current':'--current' in sys.argv,'visualVerdict':'FAIL_NOT_ADOPTED','noGPUReplay':True}))
