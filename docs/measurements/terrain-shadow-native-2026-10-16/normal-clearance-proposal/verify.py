from pathlib import Path
import hashlib,json,math
P=Path(__file__).resolve().parent
manifest=json.loads((P/'MANIFEST.json').read_text())
for item in manifest['payload']:
 b=(P/item['path']).read_bytes()
 assert len(b)==item['bytes'] and hashlib.sha256(b).hexdigest()==item['sha256'],item['path']
r=json.loads((P/'cpu-r2.stdout.json').read_text());run=json.loads((P/'cpu-r2-run.json').read_text())
assert r['status']=='PASS_NUMERICAL_SCOPE_ONLY' and r['assertions']==654
assert len(r['rows'])==126 and run['exitCode']==0 and run['budgetPASS']
assert run['cpuSeconds']<=5 and run['peakRSSBytes']<=2*1024**3
# Offline reconstruction only from saved f32 coordinates; this is not a helper/GPU replay.
errs=[]
for row in r['rows']:
 a=math.tan(math.radians(row['degrees']))*math.cos(row['azimuth'])
 b=math.tan(math.radians(row['degrees']))*math.sin(row['azimuth'])
 q,p=row['f32Lookup'],row['point']
 d=(q[1]-p[1]-a*(q[0]-p[0])-b*(q[2]-p[2]))/math.sqrt(a*a+1+b*b)
 errs.append(abs(d-.03125))
assert abs(max(errs)-r['maxF32PlaneErrorKm'])<1e-14
assert max(errs)<=2e-6 and r['maxDoublePlaneErrorKm']<=1e-11
assert r['limits']['real35mContactErased'] and r['limits']['multiFaceTexelFalseShadowNotSolved']
assert json.loads((P/'cpu-r1-failure.json').read_text())['kernelExecuted'] is False
print(json.dumps({'status':'PASS_ARCHIVE_ONLY','payload':len(manifest['payload']),'savedF32RowsRecomputed':len(errs),'helperOrGPUReplay':False,'artPASS':False}))
