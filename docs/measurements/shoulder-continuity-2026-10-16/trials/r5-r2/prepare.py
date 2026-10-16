from pathlib import Path
import hashlib,json,shutil,difflib,datetime,os
here=Path(__file__).resolve().parent;r1=here.parent/'anatomy-r5-recenter';source=here/'candidate-source'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=r1/'candidate-source-manifest.json';assert sha(manifest)=='f892755100cf21665dee22c6adb7f72707d30cdae3855fc3c9a5a09827e6a6bb'
m=json.loads(manifest.read_text());assert len(m)==119
for rel,digest in m.items():assert sha(r1/'candidate-source'/rel)==digest,rel
baseproto=json.loads((r1/'PROTOCOL.json').read_text())
proto={'status':'EXTERNAL R5 R2 TRIAL ONLY, NOT ADOPTED','frozenUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseline':baseproto['baseline'],'r3':baseproto['r3'],'baselineManifestSHA256':baseproto['baselineManifestSHA256'],'r3ManifestSHA256':baseproto['r3ManifestSHA256'],'parentR1ManifestSHA256':sha(r1/'MANIFEST.json'),'parentR1SourceManifestSHA256':sha(manifest),'sourceFiles':119,'rendererVersion':'observatory-v56-inward-shoulder-trial','semantics':{'translation':'if signed projection > 0, translate selected shoulder and 91-lobe group by -inner*projection in X/Z only','invariants':['shared body91 exact baseline A always','all Y, radii and blend values exact A','nonselected tuples exact A','inward projected offset becomes zero, perpendicular offset preserved','child relative offsets preserved','no new primitive/RNG/coefficient/noise/seed branch'],'differenceFromR1':'no full pivot recenter: preserve authored offset perpendicular to source-cell inward axis','partitionFromPriorExistingScannerOnly':{'inward':323,'outwardExactA':18,'otherFamilyExactA':683}},'checks':['7 named prefixes:74/77/80/617/323/917/2; no new 1024 scanner','typecheck','31 existing focused tests','one app then one separate hero build','source119/raster suffix/dependency identity'],'notRun':['full suite','full-resolution bake','GPU','browser','performance'],'quality':'256/128/384/full output unchanged; no promotion before root visual judgment'}
assert not (here/'PROTOCOL.json').exists();(here/'PROTOCOL.json').write_text(json.dumps(proto,indent=2)+'\n')
assert not source.exists();source.mkdir()
for rel in m:
 p=source/rel;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(r1/'candidate-source'/rel,p)
vol=source/'src/cumulonimbus/volume.ts';old=vol.read_text()
needle='    const translation=[selected.pivot[0]-selected.core[0],0,selected.pivot[2]-selected.core[2]];'
replacement='    const translation=[-inner[0]*selected.projection,0,-inner[2]*selected.projection];'
assert old.count(needle)==1;new=old.replace(needle,replacement)
comment='    // Recenter only an inward-facing mature shoulder onto its feeding axis;\n    // shared body and other groups stay unchanged.'
recomment='    // Remove only the inward component of the mature shoulder offset;\n    // perpendicular offsets, shared body and other groups stay unchanged.'
assert new.count(comment)==1;vol.write_text(new.replace(comment,recomment))
eng=source/'src/cumulonimbus/GPUSceneEngine.ts';oldeng=eng.read_text();oldv="rendererVersion:'observatory-v56-shoulder-recenter-trial'";newv="rendererVersion:'observatory-v56-inward-shoulder-trial'";assert oldeng.count(oldv)==1;eng.write_text(oldeng.replace(oldv,newv))
mc={rel:sha(source/rel) for rel in m};assert sorted(r for r in m if m[r]!=mc[r])==['src/cumulonimbus/GPUSceneEngine.ts','src/cumulonimbus/volume.ts']
(here/'candidate-source-manifest.json').write_text(json.dumps(mc,indent=2)+'\n')
for origin,name in [(r1/'candidate-source','r1-to-r2.patch'),(Path(proto['r3']),'r3-to-r5-r2.patch'),(Path(proto['baseline']),'baseline-to-r5-r2.patch')]:
 patch=''.join(''.join(difflib.unified_diff((origin/rel).read_text().splitlines(True),(source/rel).read_text().splitlines(True),fromfile='a/'+rel,tofile='b/'+rel)) for rel in m if sha(origin/rel)!=mc[rel]);(here/name).write_text(patch)
for label in ['baseline','r3']:shutil.copyfile(r1/(label+'-source-manifest.json'),here/(label+'-source-manifest.json'))
marker='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.'
suffix={label:hashlib.sha256((root/'src/cumulonimbus/volume.ts').read_text().split(marker)[1].encode()).hexdigest() for label,root in [('A',Path(proto['baseline'])),('R3',Path(proto['r3'])),('R5R2',source)]};assert len(set(suffix.values()))==1
freeze={'protocolSHA256':sha(here/'PROTOCOL.json'),'prepareSHA256':sha(Path(__file__)),'sourceManifestSHA256':sha(here/'candidate-source-manifest.json'),'volumeSHA256':mc['src/cumulonimbus/volume.ts'],'rasterSuffixSHA256':suffix}
(here/'source-freeze.json').write_text(json.dumps(freeze,indent=2)+'\n');os.symlink('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules',source/'node_modules')
print(json.dumps(freeze,indent=2))
