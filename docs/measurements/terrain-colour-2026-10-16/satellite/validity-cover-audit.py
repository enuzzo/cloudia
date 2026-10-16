"""Read-only descriptive cross-tab; no preprocessing, thresholds or data changes."""
from pathlib import Path
import numpy as np,json,hashlib
r=Path(__file__).resolve().parent
result=json.loads((r/'result.json').read_text());inputs=json.loads((r/'inputs.json').read_text())
v=np.memmap(r/'valid-area.f32',dtype='<f4',mode='r',shape=(2048,2048))
c=np.memmap(inputs['worldcover']['path'],dtype=np.uint8,mode='r',offset=32,shape=(1024,1024,12))
codes=[0,10,20,30,40,50,60,70,80,90,95,100];sums=np.zeros((12,3),dtype=float)
for row in range(0,2048,32):
    # A WCV125m cell covers exactly four S2 target62.5m cells in the same axes.
    q=np.repeat(np.repeat(c[row//2:(row+32)//2],2,axis=0),2,axis=1).astype(float)/255
    valid=v[row:row+32].astype(float)
    sums[:,0]+=q.sum(axis=(0,1))*.0625**2
    sums[:,1]+=(q*valid[...,None]).sum(axis=(0,1))*.0625**2
    sums[:,2]+=(q*(1-valid[...,None])).sum(axis=(0,1))*.0625**2
records=[{'code':code,'projectedClassAreaKm2':a,'validAreaKm2':b,'invalidAreaKm2':d,
  'invalidFractionWithinClass':d/a if a else None} for code,(a,b,d) in zip(codes,sums)]
assert abs(sums[:,0].sum()-128**2)<1e-7
assert abs(sums[:,2].sum()-(128**2-result['validityStats']['validAreaProjectedKm2']))<1e-7
report={'status':'READ_ONLY_CROSS_TAB','classFractionSource':inputs['worldcover'],
  'validitySha256':result['validity']['sha256'],'classes':records,
  'nonWaterNonUnknownInvalidKm2':float(sums[[i for i,x in enumerate(codes) if x not in [0,80]],2].sum()),
  'waterAndUnknownInvalidKm2':float(sums[[0,8],2].sum()),
  'scope':'Projected class-fraction weighted area, not a coast/ground-truth intersection. WCV2021 and annual S2 composite differ by source/processing; invalid means the frozen four-band DN gate, not missing satellite observation or certified cloud. No modification to either field.'}
(r/'validity-by-worldcover.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
