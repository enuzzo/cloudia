"""Qualify saved DTOs/PNG against the categories fixed before GPU work."""
from pathlib import Path
import json, hashlib, struct
r=Path(__file__).resolve().parent.parent
a=json.loads((r/'browser/native-a-rain.json').read_text())
b=json.loads((r/'browser/native-b-rain.json').read_text())
diff=json.loads((r/'browser/native-parameter-differences.json').read_text())['differences']
allowed={'.metadata.clocks.weatherTime','.metadata.rendererVersion','.metadata.supportSampling','.metadata.weather.rain'}
allowed|={'.metadata.frame.'+x for x in ['date','localSnapshotTime','localTimeOrigin','ownerDrawSerial','rafTimestamp']}
allowed|={'.metadata.skyTextures.'+x+'.uuid' for x in ['from','to']}
allowed|={'.metadata.terrainRaster.cache.'+x for x in ['hits','requests','submissions']}
allowed|={'.metadata.terrainRaster.shadow.cache.'+x for x in ['hits','requests','submissions']}
assert all(row['path'] in allowed for row in diff)
assert 'supportSampling' not in a['metadata']
support={'path':'r8unorm-extracted-alpha','format':'r8unorm','dimensions':[128]*3,
 'textureBytes':2097152,'extraCpuPayloadBytes':2097152,'extraGpuPayloadBytes':2097152,
 'sampling':'same detailSampler; linear/repeat/mip0; explicit half-detail-texel inset clamp; NoColorSpace',
 'reason':'rain with valid supportR8 payload','allocationAccounting':'nominal payload; GPU upload/residency not measured','fallback':None}
assert b['metadata']['supportSampling']==support
assert a['metadata']['rendererVersion']=='observatory-v61-observed-terrain-material'
assert b['metadata']['rendererVersion']=='experiment-v61-support-alpha-r8-r1'
for dto in [a,b]:
 m=dto['metadata'];assert m['quality']=='ultra' and m['volume']==[256]*3 and m['detailVolume']==[128]*3 and m['nominalSteps']==384
 assert m['output']==m['internal']==m['canvas']==[2474,1844] and m['outputMode']=='screen'
 assert m['seed']==74 and m['executionThread']=='main' and m['flowMode']==m['ablation']=='full'
 assert m['paused'] and not m['orbit'] and m['ready'] and not m['regenerating']
 assert m['clocks']['simulationTime']==60 and m['clocks']['forcingTime']==m['clocks']['precipitationUniformTime']==0
 assert m['lighting']['flash'][3]==0 and m['lighting']['flashCount']==0
 assert m['weather']['skyPending'] is False and m['weather']['atmosphereProgress']==m['weather']['atmosphereBlend']==1
 assert m['terrainRaster']['cache']['valid'] and m['terrainRaster']['shadow']['cache']['valid']
 assert struct.pack('f',m['weather']['rain'])==struct.pack('f',.8)
assert a['png']==b['png']
png=(r/'browser/native-a-rain.png').read_bytes()
assert len(png)==a['png']['byteLength'] and hashlib.sha256(png).hexdigest()==a['png']['sha256']
assert struct.unpack('>II',png[16:24])==(2474,1844)
out={'status':'PASS_FIXED_NATIVE_PNG_AND_INPUTS','differences':diff,'differenceCount':len(diff),
 'rainCPUFloat64':[a['metadata']['weather']['rain'],b['metadata']['weather']['rain']],
 'rainGPUFloat32Equal':True,'candidateSupportSampling':support,'png':a['png'],
 'scope':'Whole PNG and entire saved CPU DTO qualification for this paused state; no HDR/universal filter/animated/presentation claim.'}
(r/'browser/native-parameter-comparison.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='differences'},indent=2))
