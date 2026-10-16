"""Original CDM1 preprocessing, exact local equirectangular contract, no installs."""
from pathlib import Path
from collections import deque
import json,math,struct,gzip,hashlib,time,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent
N=1025;SPACING_KM=.125;MIN_KM=-64.;DEGREE_KM=111.1950802335
H_SCALE_M=.125;COAST_SCALE_M=8.;INF=1e30
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def stats(a):
 a=np.asarray(a,dtype=float);return {'count':int(a.size),'min':float(a.min()),'mean':float(a.mean()),'p50':float(np.quantile(a,.5)),'p99':float(np.quantile(a,.99)),'max':float(a.max())}
def edt_line(f):
 """Lower envelope of parabolas (q−p)^2+f[p], derived directly."""
 finite=np.flatnonzero(f<INF/2);n=len(f)
 if len(finite)==0:return np.full(n,INF)
 vertices=np.empty(n,dtype=np.int32);breaks=np.empty(n+1);k=0
 vertices[0]=finite[0];breaks[0]=-np.inf;breaks[1]=np.inf
 for q in finite[1:]:
  q=int(q)
  while True:
   p=int(vertices[k]);intersection=((f[q]+q*q)-(f[p]+p*p))/(2*(q-p))
   if intersection>breaks[k]:break
   k-=1
  k+=1;vertices[k]=q;breaks[k]=intersection;breaks[k+1]=np.inf
 result=np.empty(n);k=0
 for q in range(n):
  while breaks[k+1]<q:k+=1
  p=int(vertices[k]);result[q]=(q-p)**2+f[p]
 return result
def edt(mask):
 # Zero at target centres; separability is exact for squared Euclidean distance.
 a=np.where(mask,0.,INF);tmp=np.empty_like(a);result=np.empty_like(a)
 for x in range(a.shape[1]):tmp[:,x]=edt_line(a[:,x])
 for y in range(a.shape[0]):result[y,:]=edt_line(tmp[y,:])
 return result
def test_edt():
 cases=[]
 for points in [[(0,0)],[(2,3)],[(0,6),(4,0),(2,4)]]:
  a=np.zeros((5,7),dtype=bool)
  for y,x in points:a[y,x]=True
  cases.append(a)
 for a in cases:
  got=edt(a);sources=np.argwhere(a)
  expected=np.array([[min((y-p[0])**2+(x-p[1])**2 for p in sources) for x in range(7)] for y in range(5)])
  assert np.array_equal(got,expected)
 return {'cases':3,'nodes':105,'status':'PASS','oracle':'independent brute-force nearest source centre'}
def flood_ocean(eligible):
 n=eligible.shape[0];sea=np.zeros_like(eligible);queue=deque()
 for i in range(n):
  for y,x in [(0,i),(n-1,i),(i,0),(i,n-1)]:
   if eligible[y,x] and not sea[y,x]:sea[y,x]=True;queue.append((y,x))
 while queue:
  y,x=queue.popleft()
  for yy,xx in [(y-1,x),(y+1,x),(y,x-1),(y,x+1)]:
   if 0<=yy<n and 0<=xx<n and eligible[yy,xx] and not sea[yy,xx]:sea[yy,xx]=True;queue.append((yy,xx))
 return sea
def make_sampler(mosaic):
 def sample(lon,lat):
  lon=np.asarray(lon,dtype=float);lat=np.asarray(lat,dtype=float)
  u=(lon-9)*1200;v=(45-lat)*1200
  if np.any(u< -1e-8) or np.any(v< -1e-8) or np.any(u>2399+1e-8) or np.any(v>2399+1e-8):raise ValueError('Outside four-tile sample centres')
  ix=np.clip(np.floor(u).astype(int),0,2398);iz=np.clip(np.floor(v).astype(int),0,2398);fx=u-ix;fz=v-iz
  return (mosaic[iz,ix]*(1-fx)+mosaic[iz,ix+1]*fx)*(1-fz)+(mosaic[iz+1,ix]*(1-fx)+mosaic[iz+1,ix+1]*fx)*fz
 return sample
def run():
 start=time.perf_counter();assert not (ROOT/'apuane-liguria-cdm1.bin').exists(),'Refuse overwrite; no implicit rerun'
 edt_test=test_edt();inputs=json.loads((ROOT/'tiles-manifest.json').read_text())
 mosaic=np.empty((2400,2400),dtype=np.float32);native={}
 for row in inputs['files']:
  p=ROOT/row['file'];assert sha(p)==row['sha256']
  lat=int(p.name.split('_N')[1][:2]);lon=int(p.name.split('_E')[1][:3])
  with Image.open(p) as image:
   assert image.mode=='F' and image.size==(1200,1200)
   assert tuple(image.tag_v2[33550])==(.0008333333333333334,.0008333333333333334,0.)
   assert tuple(image.tag_v2[33922])==(0.,0.,0.,float(lon),float(lat+1),0.)
   keys=image.tag_v2[34735];assert keys[keys.index(1025)+3]==2
   array=np.array(image,dtype=np.float32);assert np.isfinite(array).all()
   native[(lat,lon)]=array
   y=(44-lat)*1200;x=(lon-9)*1200;mosaic[y:y+1200,x:x+1200]=array
 sample=make_sampler(mosaic)
 point_errors=[]
 for (lat,lon),array in native.items():
  for y,x in [(0,0),(0,1199),(1199,0),(1199,1199),(600,600)]:
   value=float(sample(lon+x/1200,lat+1-y/1200));point_errors.append(abs(value-float(array[y,x])))
 assert max(point_errors)<1e-7
 axis=MIN_KM+np.arange(N)*SPACING_KM;xx,zz=np.meshgrid(axis,axis)
 latitude=44+zz/DEGREE_KM;longitude=10-xx/(DEGREE_KM*math.cos(math.radians(44)))
 original=sample(longitude,latitude);assert np.isfinite(original).all();assert original.max()<3310
 height=np.maximum(0,original);eligible=height<.5;ocean=flood_ocean(eligible);assert ocean.any() and (~ocean).any()
 height[ocean]=0
 distance_sea=edt(ocean);distance_land=edt(~ocean)
 distance=np.where(ocean,-1.,1.)*np.maximum(0,np.sqrt(np.where(ocean,distance_land,distance_sea))*SPACING_KM*1000-SPACING_KM*500)
 hcode=np.rint(height/H_SCALE_M);ccode=np.rint(distance/COAST_SCALE_M)
 assert hcode.min()>=0 and hcode.max()<=65535 and ccode.min()>=-32768 and ccode.max()<=32767
 hcode=hcode.astype('<u2');ccode=ccode.astype('<i2')
 payload=struct.pack('<4sIddd',b'CDM1',N,SPACING_KM,MIN_KM,MIN_KM)+hcode.tobytes(order='C')+ccode.tobytes(order='C')
 assert len(payload)==4202532
 output=ROOT/'apuane-liguria-cdm1.bin';output.write_bytes(payload)
 compressed=gzip.compress(payload,compresslevel=9,mtime=0);(ROOT/'apuane-liguria-cdm1.bin.gz').write_bytes(compressed)
 decoded_h=hcode.astype(float)*H_SCALE_M;decoded_c=ccode.astype(float)*COAST_SCALE_M
 height_error=abs(decoded_h-height);coast_error=abs(decoded_c-distance)
 assert height_error.max()<=.06250001 and coast_error.max()<=4.0000001
 epsilon=1e-9
 lon_line=np.linspace(float(longitude.min()),float(longitude.max()),1025);lat_line=np.linspace(float(latitude.min()),float(latitude.max()),1025)
 ew=abs(sample(10-epsilon,lat_line)-sample(10+epsilon,lat_line));ns=abs(sample(lon_line,44-epsilon)-sample(lon_line,44+epsilon))
 assert ew.max()<.01 and ns.max()<.01
 # Distinct sample centres may legitimately differ: report, do not force equality.
 native_ew=abs(mosaic[:,1200]-mosaic[:,1199]);native_ns=abs(mosaic[1200,:]-mosaic[1199,:])
 corner=[]
 for name,(j,i) in {'xMinus_zMinus':(0,0),'xPlus_zMinus':(0,N-1),'xMinus_zPlus':(N-1,0),'xPlus_zPlus':(N-1,N-1),'origin':(N//2,N//2)}.items():
  corner.append({'label':name,'xWestKm':float(xx[j,i]),'zNorthKm':float(zz[j,i]),'latitude':float(latitude[j,i]),'longitude':float(longitude[j,i]),
   'sourceBilinearM':float(original[j,i]),'heightCode':int(hcode[j,i]),'heightM':float(decoded_h[j,i]),'coastCode':int(ccode[j,i]),'coastM':float(decoded_c[j,i]),'ocean':bool(ocean[j,i])})
 # Preserve scientific source grids, not a second runtime representation.
 np.asarray(original,dtype='<f4').tofile(ROOT/'sampled-source-m.f32');np.asarray(ocean,dtype=np.uint8).tofile(ROOT/'ocean-mask.u8')
 slope_z,slope_x=np.gradient(decoded_h/1000,SPACING_KM)
 report={'status':'PREPROCESSED_CPU_NOT_RENDERED','protocolSha256':sha(ROOT/'PREPROCESS-PROTOCOL.md'),'scriptSha256':sha(Path(__file__)),'inputManifestSha256':sha(ROOT/'tiles-manifest.json'),
  'format':{'magic':'CDM1','headerBytes':32,'side':N,'spacingKm':SPACING_KM,'minXKm':MIN_KM,'minZKm':MIN_KM,'maxXKm':64,'maxZKm':64,
   'heights':'uint16LE,code*.125m or code*.000125km','coast':'int16LE,code*8m or code*.008km','order':'row-major; Z south→north, X east→west; min coordinates are NODE CENTRES'},
  'projection':{'type':'local equirectangular, explicitly not exact geodesic','originLatitude':44,'originLongitude':10,'kmPerDegreeLatitude':DEGREE_KM,'xDirection':'West','zDirection':'North',
   'latitudeFormula':'44+z/111.1950802335','longitudeFormula':'10-x/(111.1950802335*cos(44deg))','latitudeRange':[float(latitude.min()),float(latitude.max())],'longitudeRange':[float(longitude.min()),float(longitude.max())],
   'verticalDatum':'EGM2008 orthometric metres; mapped to existing spherical-sea height, not ellipsoidal height'},
  'sourceSampleMetres':stats(original),'heightMetres':stats(decoded_h),'heightQuantizationAbsErrorM':stats(height_error),'coastMetres':stats(decoded_c),'coastQuantizationAbsErrorM':stats(coast_error),
  'mask':{'eligibleUnderHalfMetreNodes':int(eligible.sum()),'borderConnectedOceanNodes':int(ocean.sum()),'landNodes':int((~ocean).sum()),'isolatedLowNodesNotOcean':int((eligible&~ocean).sum()),'connectivity':4,'negativeSourceNodesClamped':int((original<0).sum()),'oceanHeightAllZero':bool((hcode[ocean]==0).all()),
   'coastMethod':'exact separable Euclidean opposite-sample-centre distance minus half-grid62.5m; signed to approximate raster interface; not exact vector coast','edtIndependentTest':edt_test},
  'seamAudit':{'nativePixelCentreCases':20,'nativePixelCentreMaxErrorM':max(point_errors),'epsilonDegrees':epsilon,'eastWestLimitDifferenceM':stats(ew),'northSouthLimitDifferenceM':stats(ns),
   'adjacentNativeCentreDifferenceEW_M':stats(native_ew),'adjacentNativeCentreDifferenceNS_M':stats(native_ns),'scope':'limit continuity of one global bilinear mosaic; adjacent native centres need not have equal H'},
  'cornersAndOrigin':corner,'sampledSlope':stats(np.hypot(slope_x,slope_z)),
  'asset':{'path':output.name,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'gzipPath':output.name+'.gz','gzipBytes':len(compressed),'gzipSha256':hashlib.sha256(compressed).hexdigest(),'gzipMtime':0},
  'hardGates':{'finiteSource':True,'pixelIsPointNoHalfPixel':True,'fourSeamsContinuousTo1cm':True,'heightUnder3310m':bool(decoded_h.max()<3310),'heightNoExaggeration':True,'heightQuantizationUnder0_0625m':True,'coastNoSaturation':True,'exactByteLength':True},
  'timeSeconds':time.perf_counter()-start,'pythonVersion':sys.version,'numpyVersion':np.__version__,
  'limitations':['125m gridded resampling of90mDSM; no invented finer detail','DSM includes vegetation/buildings; no true landcover/biome ground truth','Ocean is threshold+connectivity approximation, not authoritative coastline','Central48km and blend48–64 belong to runtime, not this asset; transition remains hybrid/procedural','No browser/GPU/FPS/art acceptance']}
 (ROOT/'preprocess-result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'asset':report['asset'],'heightMaxM':report['heightMetres']['max'],'heightQuantizationMaxM':height_error.max(),'oceanNodes':int(ocean.sum()),'timeSeconds':report['timeSeconds'],'seamMaxM':max(float(ew.max()),float(ns.max()))}))
if __name__=='__main__':run()
