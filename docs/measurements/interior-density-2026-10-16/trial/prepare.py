from pathlib import Path
import hashlib,json,shutil,difflib,subprocess
root=Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
cycle=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle23')
evidence=cycle/'interior05-evidence'
source=cycle/'interior05-source'
base=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle22/anatomy-r5-v55-source')
manifestpath=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle22/anatomy-r5-v55-qualification-harness-r2/source-manifest.json')
def sha(b):return hashlib.sha256(b).hexdigest()
def save(path,v):path.write_text(json.dumps(v,indent=2)+'\n')
assert not source.exists(),'Preserve prior snapshots'
assert sha(manifestpath.read_bytes())=='e826b119ff2758fa51ed04cf8748d0d40ad1ff09516fc498826466ceae3974b7'
old=json.loads(manifestpath.read_text());assert len(old)==122
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()=='a8653c53ba617e7dd8ba56c868d28b7c3d4c5234'
attr=subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(root/'node_modules')],text=True).strip();assert attr=='1'
for rel,h in old.items():
 assert sha((root/rel).read_bytes())==h,('root',rel)
 assert sha((base/rel).read_bytes())==h,('base',rel)
for rel in old:
 dst=source/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(base/rel,dst)
replacements={
 'src/cumulonimbus/volume.ts':('const interior=1-.6*smoothstep(.04,.28,field[idx]);','const interior=1-.5*smoothstep(.04,.28,field[idx]);'),
 'src/cumulonimbus/GPUSceneEngine.ts':("rendererVersion:'observatory-v56-inward-shoulder'","rendererVersion:'observatory-v57-interior05-trial'"),
 'src/cumulonimbus/lifecycle.test.ts':("toBe('observatory-v56-inward-shoulder')","toBe('observatory-v57-interior05-trial')"),
}
patch=[]
for rel,(a,b) in replacements.items():
 p=source/rel;text=p.read_text();assert text.count(a)==1,(rel,text.count(a));new=text.replace(a,b)
 p.write_text(new)
 patch.extend(difflib.unified_diff(text.splitlines(keepends=True),new.splitlines(keepends=True),fromfile='a/'+rel,tofile='b/'+rel))
(source/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
new={rel:sha((source/rel).read_bytes()) for rel in old};diffs=[rel for rel in old if old[rel]!=new[rel]];assert set(diffs)==set(replacements)
assert new['src/cumulonimbus/volume.ts']!=old['src/cumulonimbus/volume.ts']
shutil.copy2(manifestpath,evidence/'baseline-source-manifest.json')
(evidence/'candidate.patch').write_text(''.join(patch))
save(evidence/'source-manifest.json',new)
protocol={
 'status':'FROZEN_BEFORE_EXECUTION','model':'interior05-r1','version':'observatory-v57-interior05-trial',
 'baseCommit':'a8653c53ba617e7dd8ba56c868d28b7c3d4c5234','baseSourceManifestSHA256':sha(manifestpath.read_bytes()),
 'sourceFileCount':len(new),'changedPaths':diffs,'formulaBefore':replacements['src/cumulonimbus/volume.ts'][0],'formulaAfter':replacements['src/cumulonimbus/volume.ts'][1],
 'sourceManifestSHA256':sha((evidence/'source-manifest.json').read_bytes()),'patchSHA256':sha((evidence/'candidate.patch').read_bytes()),
 'volumeSHA256':new['src/cumulonimbus/volume.ts'],'dependencies':{'method':'existing root symlink; no install','ignoreAttributeBefore':attr},
 'allowedChecks':['typecheck','31 existing volume+inclinedShoulder tests','APP build','hero build appended to same dist'],
 'limits':{'typecheckWallSeconds':120,'targetedWallSeconds':600,'eachBuildWallSeconds':180,'noNewFull256CPUAudit':True,'noLayoutScanner':True,'noGPU':True},
 'visualStatus':'NOT_ASSESSED; parent owns same-world-camera seed74 near60 Sole/Tramonto qualification',
 'historicalWarning':'Seed72 CPU old-front+5m emptied; this is not by itself an artistic veto on a newly rebaked application',
}
save(evidence/'PROTOCOL.json',protocol)
freeze={'protocolSHA256':sha((evidence/'PROTOCOL.json').read_bytes()),'sourceManifestSHA256':protocol['sourceManifestSHA256'],'files':new}
save(evidence/'source-freeze.json',freeze)
print(json.dumps({'status':'FROZEN','files':len(new),'changedPaths':diffs,'sourceManifestSHA256':protocol['sourceManifestSHA256'],'volumeSHA256':protocol['volumeSHA256'],'patchSHA256':protocol['patchSHA256'],'freezeSHA256':sha((evidence/'source-freeze.json').read_bytes())},indent=2))
