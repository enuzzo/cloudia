"""Portable stdlib verifier of saved DEM evidence; never resamples or builds mesh."""
from pathlib import Path
import argparse,gzip,hashlib,json,math,struct,sys

HERE=Path(__file__).resolve().parent
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def require(condition,message):
 if not condition:raise AssertionError(message)
def read_cdm(path,expected_side,expected_spacing):
 data=path.read_bytes();require(len(data)==32+expected_side**2*4,'CDM1 length')
 require(struct.unpack_from('<4sIddd',data)==(b'CDM1',expected_side,expected_spacing,-64.,-64.),'CDM1 header')
 count=expected_side**2
 heights=[v[0] for v in struct.iter_unpack('<H',memoryview(data)[32:32+2*count])]
 coast=[v[0] for v in struct.iter_unpack('<h',memoryview(data)[32+2*count:])]
 require(max(heights)*.125<3310,'height limit')
 return data,heights,coast
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--baseline',type=Path,required=True);args=parser.parse_args()
 manifest=json.loads((HERE/'MANIFEST.json').read_text());require(len(manifest['files'])==manifest['fileCount'],'manifest count')
 for row in manifest['files']:
  path=HERE/row['path'];require(path.is_relative_to(HERE) and '..' not in Path(row['path']).parts,'relative inventory path')
  require(path.stat().st_size==row['bytes'] and sha(path)==row['sha256'],'manifest mismatch: '+row['path'])
 require(sum(r['bytes'] for r in manifest['files'])==manifest['payloadBytes'],'manifest byte sum')
 report=json.loads((HERE/'preprocess-result.json').read_text());require(all(report['hardGates'].values()),'saved gates')
 for name,entry in report['assets'].items():
  if not isinstance(entry,dict):continue
  require(sha(HERE/entry['file'])==entry['sha256'],'asset SHA')
  raw=(HERE/entry['file']).read_bytes();require(gzip.decompress((HERE/entry['gzipFile']).read_bytes())==raw,'lossless gzip')
 a,ah,ac=read_cdm(HERE/report['assets']['recomputedCoast']['file'],2049,.0625)
 b,bh,bc=read_cdm(HERE/report['assets']['legacyCoastRequantized']['file'],2049,.0625)
 require(a[32:32+2049**2*2]==b[32:32+2049**2*2],'height channels differ')
 require(all(h==0 for h,c in zip(ah,ac) if c<0),'ocean nonzero height')
 require(sha(args.baseline)==report['comparisonWithLegacy125m']['baselineSha256'],'legacy asset SHA')
 _,oldh,oldc=read_cdm(args.baseline,1025,.125)
 minimum=math.inf;maximum=-math.inf;squares=0.;old_land_to_sea=0;old_sea_to_land=0
 for z in range(1025):
  for x in range(1025):
   j=z*1025+x;i=(2*z)*2049+2*x;delta=(ah[i]-oldh[j])*.125
   minimum=min(minimum,delta);maximum=max(maximum,delta);squares+=delta*delta
   old_land_to_sea+=int(oldc[j]>=0 and ac[i]<0);old_sea_to_land+=int(oldc[j]<0 and ac[i]>=0)
 saved=report['comparisonWithLegacy125m'];stats=saved['heightDeltaNewMinusOldM']['all']
 require(minimum==stats['min'] and maximum==stats['max'] and abs(math.sqrt(squares/1025**2)-stats['rms'])<1e-12,'coincident-node height arithmetic')
 require(old_land_to_sea==saved['maskAtCoincidentNodes']['oldLandNewOcean'] and old_sea_to_land==saved['maskAtCoincidentNodes']['oldOceanNewLand'],'mask arithmetic')
 hold=report['holdout'];holdbytes=(HERE/hold['file']).read_bytes()
 require(len(holdbytes)==147456*8 and hashlib.sha256(holdbytes).hexdigest()==hold['sha256'],'holdout length/SHA')
 require(all(math.isfinite(x[0]) for x in struct.iter_unpack('<d',holdbytes)),'holdout finite')
 require(hold['coordinatesKm']['first']==-48+.5*.0625 and hold['coordinatesKm']['last']==-48+(4*383+.5)*.0625,'holdout coordinates')
 require(report['heightQuantizationAbsErrorM']['max']<=.06250001 and report['recomputedCoastQuantizationAbsErrorM']['max']<=4.0000001,'saved quantization arithmetic')
 runtime=report['runtime'];require(runtime['cpuSeconds']<=180 and runtime['wallSeconds']<=240 and runtime['peakRssBytes']<=2*1024**3,'saved budget arithmetic')
 freeze=json.loads((HERE/'PREPROCESS-PRE-RUN.json').read_text())
 for name,row in freeze['files'].items():require(sha(HERE/name)==row['sha256'],'preprocess frozen input: '+name)
 result={'status':'PASS_SAVED_EVIDENCE_ONLY','manifestFiles':manifest['fileCount'],'payloadBytes':manifest['payloadBytes'],'sameHeightCodes':True,'nativeHoldoutCount':147456,'coincidentNodes':1025**2,'heightDeltaExtremaM':[minimum,maximum],'maskChangesAtCoincidentNodes':old_land_to_sea+old_sea_to_land,'noResamplingModelOrGPU':True,'scopeLimit':'Authenticates files and saved gate arithmetic; does not re-run source bilinear/EDT or prove native reference accuracy/art/FPS.'}
 print(json.dumps(result));return result
if __name__=='__main__':main()
