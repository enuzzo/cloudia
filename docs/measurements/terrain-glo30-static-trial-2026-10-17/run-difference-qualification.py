from pathlib import Path
import subprocess,time,json,hashlib
qa=Path(__file__).resolve().parent;source=qa/'difference-source';out=qa/'difference-qualification';out.mkdir(exist_ok=False)
base=json.loads((qa/'candidate-manifest-r1.json').read_text());paths=set(base)
paths.update(['src/cumulonimbus/terrainMeshAsset.ts','src/cumulonimbus/rgba32fDifference.test.ts','src/cumulonimbus/terrainMeshAsset.test.ts','src/cumulonimbus/terrainMeshAssetIntegration.test.ts','src/cumulonimbus/measuredTerrainMesh.ts','src/cumulonimbus/assets/liguria-apuane-glo30-mesh.bin','public/COP-DEM-GLO30-F-license.pdf','src/cumulonimbus/rgba32fDifference.ts','src/cumulonimbus/rgba32fDifference.test.ts'])
manifest={p:hashlib.sha256((source/p).read_bytes()).hexdigest() for p in sorted(paths)}
(qa/'difference-manifest-r0.json').write_text(json.dumps(manifest,indent=2)+'\n')
steps=[['node_modules/.bin/vitest','run','src/cumulonimbus/rgba32fDifference.test.ts','src/cumulonimbus/terrainMeshAsset.test.ts','src/cumulonimbus/terrainMeshAssetIntegration.test.ts','src/cumulonimbus/lifecycle.test.ts','src/cumulonimbus/terrainRasterCache.test.ts','--reporter=dot'],['node_modules/.bin/vitest','run','--reporter=dot'],['npm','run','build'],['npm','run','build:hero']]
results=[]
for i,cmd in enumerate(steps,1):
 started=time.monotonic()
 with (out/(str(i)+'.log')).open('wb') as stream:code=subprocess.call(cmd,cwd=source,stdout=stream,stderr=subprocess.STDOUT)
 results.append({'command':cmd,'exitCode':code,'wallSeconds':time.monotonic()-started,'log':str(out/(str(i)+'.log'))});(out/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results[-1]),flush=True)
 if code:raise SystemExit(code)
for p,h in manifest.items():assert hashlib.sha256((source/p).read_bytes()).hexdigest()==h,p
