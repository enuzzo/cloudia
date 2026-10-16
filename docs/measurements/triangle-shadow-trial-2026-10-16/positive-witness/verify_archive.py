from pathlib import Path
import hashlib,json,sys
P=Path(__file__).resolve().parent
manifest=json.loads((P/'MANIFEST.json').read_text())
for row in manifest['payload']:
 f=P/row['path'];raw=f.read_bytes()
 assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'],row['path']
w=json.loads((P/'result.json').read_text());c=json.loads((P/'clipping/result.json').read_text())
assert len(w['rows'])==len(c['rows'])==12 and w['raycasts']==36
assert [r['id'] for r in w['rows']]==[r['id'] for r in c['rows']]
assert all(r['shadow']['coverageFade']==0 for r in w['rows'])
physical={r['id']:r['physicalSunRay'] for r in w['rows']}
assert sum(bool(r['blocker']) for r in physical.values())==6
assert sum(r['physicallyUnoccluded'] for r in physical.values())==6
assert all(physical[r['id']]['physicallyUnoccluded'] for r in w['rows'] if r['id'].startswith('C'))
for r in physical.values():assert r['physicallyUnoccluded']==(r['blocker'] is None and r['farPastEntireMeshMaximumY'])
counts={}
for variant in ['baselineAffineTexel','fullTriangleClamp','clippedTriangleTexel']:
 counts[variant]={'shadowed':sum(r['variants'][variant]['rawVisibility']==0 for r in c['rows']),
  'litWithPhysicalBlocker':sum(r['variants'][variant]['rawVisibility']==1 and physical[r['id']]['blocker'] is not None for r in c['rows']),
  'falseShadowPhysicallyUnoccluded':sum(r['variants'][variant]['rawVisibility']==0 and physical[r['id']]['physicallyUnoccluded'] for r in c['rows']),
  'physicallyUnoccludedLit':sum(r['variants'][variant]['rawVisibility']==1 and physical[r['id']]['physicallyUnoccluded'] for r in c['rows'])}
assert counts==c['counts']
assert counts['baselineAffineTexel']['litWithPhysicalBlocker']==3
assert counts['fullTriangleClamp']['litWithPhysicalBlocker']==2
assert counts['clippedTriangleTexel']['litWithPhysicalBlocker']==0
assert all(v['falseShadowPhysicallyUnoccluded']==0 and v['physicallyUnoccludedLit']==6 for v in counts.values())
inputs=0
if '--verify-inputs' in sys.argv:
 for fn in ['PRE-RUN-FREEZE.json','clipping/PRE-RUN-FREEZE.json']:
  for row in json.loads((P/fn).read_text())['inputs']:
   raw=Path(row['path']).read_bytes();assert len(raw)==row['bytes'] and hashlib.sha256(raw).hexdigest()==row['sha256'],row['path'];inputs+=1
 source=json.loads((P/'inputs/source-manifest.json').read_text())
 assert len(source)==124
 for name,sha in source.items():assert hashlib.sha256((P.parent/'source'/name).read_bytes()).hexdigest()==sha,name
print(json.dumps({'state':'ARCHIVE_HASH_AND_SAVED_RECORD_COUNTS_PASS','payloadFiles':len(manifest['payload']),'payloadBytes':sum(r['bytes'] for r in manifest['payload']),'rows':12,'raycastsRecorded':36,'physicallyUnoccludedControls':6,'clippedFalseShadows':0,'externalFreezeInputsChecked':inputs,'modelReplay':False,'scope':'Hash/JSON consistency only; no mesh construction, no raycast, no new clipping computation or GPU proof.'}))
