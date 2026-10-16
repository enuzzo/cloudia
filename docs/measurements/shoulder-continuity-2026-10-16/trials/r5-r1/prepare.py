from pathlib import Path
import hashlib,json,shutil,difflib,datetime,os
here=Path(__file__).resolve().parent
base=here.parent.parent/'Cloudia-QA-2026-10-16-cycle21/v55-final/source'
r3=here.parent/'anatomy-r3-v55-source'
base_manifest=base.parent/'source-manifest.json'
r3_manifest=here.parent/'anatomy-r3-v55-evidence/candidate-source-manifest.json'
def sha(data):return hashlib.sha256(data).hexdigest()
def check(root,manifest,expected):
 assert sha(manifest.read_bytes())==expected,(manifest,'manifest changed')
 entries=json.loads(manifest.read_text());assert len(entries)==119
 for rel,digest in entries.items():assert sha((root/rel).read_bytes())==digest,(root,rel,'source drift')
 return entries
ma=check(base,base_manifest,'30c5448e87fb60c3bd3fdc8ca133993c49e54503a9950f9da1815fd59883171f')
mb=check(r3,r3_manifest,'e65c9209938773d3e4d1e3e6f649e4fb11bad01c731a4ee38258ebefdf39e3e9')
protocol={'status':'EXTERNAL TRIAL ONLY, NOT ADOPTED','frozenUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseline':str(base),'baselineManifestSHA256':sha(base_manifest.read_bytes()),'r3':str(r3),'r3ManifestSHA256':sha(r3_manifest.read_bytes()),'sourceFiles':119,'semantics':{'sharedBodyAnd91Group':'all ordered lobe tuple values identical to baseline A','selectedShoulderAnd91Group':'only X/Z recenter when signed projection > 0, exactly R3 translation; Y and all radii/blend unchanged','outwardAndOtherFamilies':'all ordered lobe tuples identical to A','noNew':'no primitives, RNG, coefficients, noises or seed branches','expectedPartitionFromExisting1024AuditOnly':{'inwardSameR3XZ':323,'outwardFullA':18,'otherFamilyFullA':683}},'checks':['all 119 pinned sources independently hash checked before copy','few named actual prefix traces only, no duplicate 1024 scan','raster suffix and imported geometry dependencies identical A/R3/R5','31 existing focused tests: volume.test.ts + inclinedShoulder.test.ts','typecheck','one app build followed by one separate hero build'],'notRun':['full suite','full-resolution bake','GPU','browser','performance'],'quality':'macro256/detail128/384 and output unchanged; quality acceptance remains root visual review','rendererVersion':'observatory-v56-shoulder-recenter-trial'}
assert not (here/'PROTOCOL.json').exists()
(here/'PROTOCOL.json').write_text(json.dumps(protocol,indent=2)+'\n')
for src,dst in [(base_manifest,'baseline-source-manifest.json'),(r3_manifest,'r3-source-manifest.json')]:shutil.copyfile(src,here/dst)
source=here/'candidate-source';assert not source.exists();source.mkdir()
for rel in mb:
 dest=source/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(r3/rel,dest)
assert {rel:sha((source/rel).read_bytes()) for rel in mb}==mb
vol=source/'src/cumulonimbus/volume.ts';before=vol.read_text()
oldcomment='    // Joint-body r3: keep the same shared-body roof rule for every layout.\n    // Only an inward-facing mature shoulder recenters onto its feeding axis;\n    // already outward-facing shoulders and descendants remain untouched.'
newcomment='    // Recenter only an inward-facing mature shoulder onto its feeding axis;\n    // shared body and other groups stay unchanged.'
assert before.count(oldcomment)==1
after=before.replace(oldcomment,newcomment)
for line in [
'    const bottom=sharedBody[1]-sharedBody[4],oldRoof=sharedBody[1]+sharedBody[4],newRoof=Math.max(oldRoof,selected.pivot[1]);\n',
'    const scale=newRoof>oldRoof?(newRoof-bottom)/(2*sharedBody[4]):1;\n',
'    if(newRoof>oldRoof)for(const lobe of bodyGroup){lobe[1]=bottom+(lobe[1]-bottom)*scale;lobe[4]*=scale;}\n']:
 assert after.count(line)==1;after=after.replace(line,'')
vol.write_text(after)
eng=source/'src/cumulonimbus/GPUSceneEngine.ts';text=eng.read_text();old="rendererVersion:'observatory-v56-joint-r3-trial'";new="rendererVersion:'observatory-v56-shoulder-recenter-trial'";assert text.count(old)==1;eng.write_text(text.replace(old,new))
mc={rel:sha((source/rel).read_bytes()) for rel in mb}
changedR3=[r for r in mb if mb[r]!=mc[r]];assert sorted(changedR3)==['src/cumulonimbus/GPUSceneEngine.ts','src/cumulonimbus/volume.ts']
(here/'candidate-source-manifest.json').write_text(json.dumps(mc,indent=2)+'\n')
for origin,name,manifest in [(r3,'r3-to-r5.patch',mb),(base,'baseline-to-r5.patch',ma)]:
 patch=''.join(''.join(difflib.unified_diff((origin/rel).read_text().splitlines(True),(source/rel).read_text().splitlines(True),fromfile='a/'+rel,tofile='b/'+rel)) for rel in manifest if manifest[rel]!=mc[rel])
 (here/name).write_text(patch)
marker='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.'
suffix={label:sha((root/'src/cumulonimbus/volume.ts').read_text().split(marker)[1].encode()) for label,root in [('A',base),('R3',r3),('R5',source)]};assert len(set(suffix.values()))==1
imports=['light.ts','sun.ts','motion.ts','inclinedShoulder.ts']
deps={rel:{label:sha((root/'src/cumulonimbus'/rel).read_bytes()) for label,root in [('A',base),('R3',r3),('R5',source)]} for rel in imports};assert all(len(set(d.values()))==1 for d in deps.values())
freeze={'protocolSHA256':sha((here/'PROTOCOL.json').read_bytes()),'prepareScriptSHA256':sha(Path(__file__).read_bytes()),'candidateManifestSHA256':sha((here/'candidate-source-manifest.json').read_bytes()),'changedVsR3':changedR3,'volumeSHA256':mc['src/cumulonimbus/volume.ts'],'rasterSuffixSHA256':suffix,'dependencies':deps,'baselineVolumeSHA256':ma['src/cumulonimbus/volume.ts'],'r3VolumeSHA256':mb['src/cumulonimbus/volume.ts'],'sourceFiles':119}
(here/'source-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n')
os.symlink('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules',source/'node_modules')
print(json.dumps(freeze,indent=2))
