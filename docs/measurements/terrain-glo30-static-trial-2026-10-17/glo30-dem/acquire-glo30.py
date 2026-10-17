"""Bounded acquisition of four explicit AWS GLO30 objects, no fallback/install.

Adapted from cycle19/probe-dem.py. Original bytes and partial failures retained.
This program downloads data only; decoding and resampling are a separate step.
"""
from pathlib import Path
import datetime,hashlib,json,sys,time,urllib.request

ROOT=Path(__file__).resolve().parent
EXPECTED=[
 (43,9,275853,'a4357a39508e267e708bb5f6aaab8af6'),
 (43,10,31619637,'dbe27f5719000b024c3a84a37954f29b'),
 (44,9,35799772,'a6697d98be1bbeb2363c41b6bc5fc845'),
 (44,10,45578379,'0cb06a9eeee0cc51b7cf1e8d2a2f3b61'),
]
LICENSE_URL='https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf'

def download(url,path,maximum,expected_length=None,expected_etag=None):
 start=time.monotonic();partial=path.with_suffix(path.suffix+'.part')
 if path.exists() or partial.exists():raise RuntimeError('Refuse overwrite or implicit retry: '+str(path))
 digest=hashlib.sha256();count=0
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Cloudia-GLO30-acquisition/1.0'}),timeout=20) as response:
  headers=dict(response.headers);length=int(response.headers.get('Content-Length','0'))
  if response.status!=200 or not 0<length<=maximum:raise RuntimeError('Unexpected status/length')
  if expected_length is not None and length!=expected_length:raise RuntimeError('Object length changed since HEAD')
  if expected_etag is not None and response.headers.get('ETag','').strip('"')!=expected_etag:raise RuntimeError('Object ETag changed since HEAD')
  with partial.open('xb') as stream:
   while True:
    if time.monotonic()-start>90:raise TimeoutError('Single object wall budget90s')
    block=response.read(min(262144,maximum-count+1))
    if not block:break
    count+=len(block)
    if count>maximum:raise RuntimeError('Acquisition byte budget exceeded')
    stream.write(block);digest.update(block)
 if count!=length:raise RuntimeError('Truncated object')
 partial.rename(path)
 return {'file':str(path.relative_to(ROOT)),'url':url,'bytes':count,'sha256':digest.hexdigest(),'headers':headers,'wallSeconds':time.monotonic()-start}

def main():
 start=time.monotonic();rows=[]
 report={'status':'RUNNING','source':'https://registry.opendata.aws/copernicus-dem/','sourceRelease':'AWS public COG2021','python':sys.version,'startedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':rows}
 try:
  for lat,lon,length,etag in EXPECTED:
   name=f'Copernicus_DSM_COG_10_N{lat:02d}_00_E{lon:03d}_00_DEM'
   row=download(f'https://copernicus-dem-30m.s3.amazonaws.com/{name}/{name}.tif',ROOT/'inputs'/(name+'.tif'),60*1024*1024,length,etag)
   rows.append(row);print(json.dumps({'phase':'downloaded',**{k:row[k] for k in ['file','bytes','sha256','wallSeconds']}}),flush=True)
   if sum(r['bytes'] for r in rows)>120*1024*1024:raise RuntimeError('Total tile budget120MiB')
   if time.monotonic()-start>240:raise TimeoutError('Acquisition total wall budget240s')
  license_row=download(LICENSE_URL,ROOT/'License-COPDEM-30.pdf',2*1024*1024)
  if not (ROOT/'License-COPDEM-30.pdf').read_bytes().startswith(b'%PDF-'):raise RuntimeError('License is not a PDF')
  report.update(status='ACQUIRED_ORIGINALS_NOT_YET_RESAMPLED',totalTileBytes=sum(r['bytes'] for r in rows),license=license_row)
  (ROOT/'tiles-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
 except BaseException as error:
  report.update(status='FAIL_NO_AUTOMATIC_RETRY',error=repr(error));raise
 finally:
  report['wallSeconds']=time.monotonic()-start
  (ROOT/'acquisition-result.json').write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':main()
