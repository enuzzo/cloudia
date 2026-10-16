"""Reproduce the read-only cross-dataset NoData vs DEM-centre coast audit.

Usage: python audit-nodata-dem.py --dem /path/to/apuane-liguria-cdm1.bin
Does not alter either field or perform classification/preprocessing again.
"""
from pathlib import Path
import argparse, json, hashlib, numpy as np

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--dem',required=True)
args=parser.parse_args()
dem=Path(args.dem).read_bytes()
dem_sha=hashlib.sha256(dem).hexdigest()
assert dem_sha=='92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d'
coast=np.frombuffer(dem,dtype='<i2',count=1025*1025,offset=32+1025*1025*2).reshape(1025,1025).astype(float)
coast=(coast[:-1,:-1]+coast[1:,:-1]+coast[:-1,1:]+coast[1:,1:])*.008/4
raw=(ROOT/'worldcover-cells-wcv1.bin').read_bytes()
q=np.frombuffer(raw,np.uint8,offset=32).reshape(1024,1024,12)
fraction=q[...,0].astype(float)/255
result=json.loads((ROOT/'result.json').read_text())
regions={}
for name,mask in [('demLandCoastPositive',coast>0),('demSeaCoastNegative',coast<0),('demCoastExactlyZero',coast==0)]:
    regions[name]={'cellCount':int(mask.sum()),'unknownPositiveCellCount':int(np.count_nonzero(fraction[mask])),
                   'unknownAreaKm2':float(fraction[mask].sum()*.125**2)}
report={'status':'READ_ONLY_QUANTIZED_NODATA_DEM_CENTRE_COAST_CROSSCHECK',
        'demAssetSha256':dem_sha,'wcvAssetSha256':hashlib.sha256(raw).hexdigest(),
        'method':'DEM coast at each WCV1 cell centre is arithmetic average of4CDM1 nodes; sign classifies reference land/sea, no field correction. WCV1unknown is quantized class0fraction, not float64 prequantization histogram.',
        'unknownAreaQuantizedKm2':float(fraction.sum()*.125**2),
        'unknownAreaOriginalFloat64Km2':result['classAreasProjectedKm2'][0],
        'quantizationAreaDeltaKm2':float(fraction.sum()*.125**2-result['classAreasProjectedKm2'][0]),
        'regions':regions,
        'limits':'DEM sea is itself threshold/connectivity and raster-distance approximation; this is a cross-dataset comparison, not authoritative shoreline ground truth.'}
expected=json.loads((ROOT/'nodata-dem-coast-audit.json').read_text())
assert report==expected
print(json.dumps(report,indent=2))
