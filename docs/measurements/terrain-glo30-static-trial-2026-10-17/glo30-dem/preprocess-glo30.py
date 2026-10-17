"""GLO30 native-level acquisition derivative: two CDM1 outputs, no terrain mesh.
EDT/flood functions copied unchanged from frozen cycle19 internal preprocessing.
Dependencies use existing bundled Python; no installation or runtime asset changes.
"""
from pathlib import Path
import argparse,datetime,gzip,hashlib,json,math,platform,resource,signal,struct,sys,time
from collections import deque
import numpy as np
from PIL import Image, __version__ as PIL_VERSION
ROOT=Path(__file__).resolve().parent
N=2049;SPACING_KM=.0625;MIN_KM=-64.;DEGREE_KM=111.1950802335
SOURCE_SIDE=3600;SOURCE_PER_DEGREE=3600;MOSAIC_SIDE=7200
H_SCALE_M=.125;COAST_SCALE_M=8.;INF=1e30
MAX_RSS=2*1024**3;START=time.perf_counter()
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def rss():
 value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
 return int(value if sys.platform=='darwin' else value*1024)
def phase(name):
 if rss()>MAX_RSS:raise MemoryError('Terminal/phase RSS gate2GiB exceeded')
 print(json.dumps({'phase':name,'wallSeconds':time.perf_counter()-START,'cpuSeconds':time.process_time(),'peakRssBytes':rss()}),flush=True)
def stats(a):
 a=np.asarray(a,dtype=float);return {'count':int(a.size),'min':float(a.min()),'mean':float(a.mean()),'p50':float(np.quantile(a,.5)),'p99':float(np.quantile(a,.99)),'max':float(a.max()),'rms':float(np.sqrt(np.mean(a*a)))}
def signed_summary(a,mask):
 return {name:stats(a[selected]) for name,selected in [('all',np.ones_like(mask,dtype=bool)),('legacyCoastNonnegative',mask),('legacyCoastNegative',~mask)]}
def write_unique(path,data):
 with path.open('xb') as f:f.write(data)
def write_asset(name,hcode,ccode):
 payload=struct.pack('<4sIddd',b'CDM1',N,SPACING_KM,MIN_KM,MIN_KM)+hcode.tobytes(order='C')+ccode.tobytes(order='C')
 if len(payload)!=16793636:raise ValueError('CDM1 byte count changed')
 path=ROOT/name;write_unique(path,payload);compressed=gzip.compress(payload,compresslevel=9,mtime=0);write_unique(ROOT/(name+'.gz'),compressed)
 return {'file':name,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest(),'gzipFile':name+'.gz','gzipBytes':len(compressed),'gzipSha256':hashlib.sha256(compressed).hexdigest(),'gzipMtime':0}
def timeout(signum,frame):raise TimeoutError('Preprocessing time budget exceeded; no implicit retry')
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

def source_sampler(mosaic):
 def sample(lon,lat):
  u=(np.asarray(lon,dtype=float)-9)*SOURCE_PER_DEGREE;v=(45-np.asarray(lat,dtype=float))*SOURCE_PER_DEGREE
  if np.any(u< -1e-8) or np.any(v< -1e-8) or np.any(u>MOSAIC_SIDE-1+1e-8) or np.any(v>MOSAIC_SIDE-1+1e-8):raise ValueError('Outside four-tile node coverage')
  u=np.clip(u,0,MOSAIC_SIDE-1);v=np.clip(v,0,MOSAIC_SIDE-1)
  ix=np.minimum(np.floor(u).astype(np.int32),MOSAIC_SIDE-2);iz=np.minimum(np.floor(v).astype(np.int32),MOSAIC_SIDE-2);fx=u-ix;fz=v-iz
  return (mosaic[iz,ix]*(1-fx)+mosaic[iz,ix+1]*fx)*(1-fz)+(mosaic[iz+1,ix]*(1-fx)+mosaic[iz+1,ix+1]*fx)*fz
 return sample

def grid_sample(values,x,z,side,spacing):
 u=(np.asarray(x)+64)/spacing;v=(np.asarray(z)+64)/spacing
 if np.any(u<0) or np.any(v<0) or np.any(u>side-1) or np.any(v>side-1):raise ValueError('Legacy/new grid coverage changed')
 ix=np.minimum(np.floor(u).astype(np.int32),side-2);iz=np.minimum(np.floor(v).astype(np.int32),side-2);fx=u-ix;fz=v-iz
 return (values[iz,ix]*(1-fx)+values[iz,ix+1]*fx)*(1-fz)+(values[iz+1,ix]*(1-fx)+values[iz+1,ix+1]*fx)*fz

def run(baseline_path):
 for path in [ROOT/'preprocess-result.json',ROOT/'glo30-62_5m-recomputed-coast.cdm1.bin',ROOT/'glo30-62_5m-legacy-coast.cdm1.bin',ROOT/'holdout-native-m.f64le.bin']:
  if path.exists():raise RuntimeError('Refuse overwrite or implicit rerun: '+str(path))
 resource.setrlimit(resource.RLIMIT_CPU,(180,181));signal.signal(signal.SIGXCPU,timeout);signal.signal(signal.SIGALRM,timeout);signal.alarm(240)
 inputs=json.loads((ROOT/'tiles-manifest.json').read_text());assert inputs['status']=='ACQUIRED_ORIGINALS_NOT_YET_RESAMPLED' and len(inputs['files'])==4
 edt_test=test_edt();phase('tiny-EDT-oracle-PASS')
 # One207.36MB mosaic. Native tiles are not retained as a second copy.
 mosaic=np.empty((MOSAIC_SIDE,MOSAIC_SIDE),dtype=np.float32);native_points=[];source_metadata=[]
 for row in inputs['files']:
  path=ROOT/row['file'];assert sha(path)==row['sha256']
  lat=int(path.name.split('_N')[1][:2]);lon=int(path.name.split('_E')[1][:3])
  with Image.open(path) as image:
   assert image.mode=='F' and image.size==(SOURCE_SIDE,SOURCE_SIDE)
   scale=tuple(image.tag_v2[33550]);tie=tuple(image.tag_v2[33922]);keys=tuple(image.tag_v2[34735]);geokeys={keys[k]:keys[k+3] for k in range(4,len(keys),4) if keys[k+1]==0 and keys[k+2]==1}
   assert scale==(1/3600,1/3600,0.) and tie==(0.,0.,0.,float(lon),float(lat+1),0.) and geokeys[1025]==2 and geokeys[2048]==4326
   array=np.array(image,dtype=np.float32);assert np.isfinite(array).all()
   nodata_tag=image.tag_v2.get(42113);nodata=None if nodata_tag is None else float(str(nodata_tag).strip('\x00'))
   if nodata is not None and (np.isnan(nodata) or np.any(array==nodata)):raise ValueError('Declared NoData in original source')
   # Finite TIFF without a NoData tag declares no missing sample; sentinel safety
   # check is explicit and does not turn missing samples into sea by clamping.
   if np.any(array==-32767) or np.any(array==-9999):raise ValueError('DEM sentinel found')
   source_metadata.append({'file':row['file'],'sha256':row['sha256'],'size':list(image.size),'mode':image.mode,'bits':image.tag_v2.get(258),'sampleFormat':image.tag_v2.get(339),'pixelScale':scale,'tiepoint':tie,'geoKeys':geokeys,'noDataTag':nodata_tag,'finite':True,'extremaM':[float(array.min()),float(array.max())]})
   for y,x in [(0,0),(0,3599),(3599,0),(3599,3599),(1800,1800)]:native_points.append((lon+x/3600,lat+1-y/3600,float(array[y,x])))
   y=(44-lat)*SOURCE_SIDE;x=(lon-9)*SOURCE_SIDE;mosaic[y:y+SOURCE_SIDE,x:x+SOURCE_SIDE]=array
  del array;phase('decoded-'+path.stem)
 sample=source_sampler(mosaic);point_errors=[abs(float(sample(lon,lat))-value) for lon,lat,value in native_points];assert max(point_errors)<1e-7
 axis=MIN_KM+np.arange(N)*SPACING_KM
 # Broadcast axes avoid five full latitude/longitude/coordinate arrays.
 latitude=44+axis[:,None]/DEGREE_KM;longitude=10-axis[None,:]/(DEGREE_KM*math.cos(math.radians(44)))
 original=sample(longitude,latitude);assert original.shape==(N,N) and np.isfinite(original).all() and original.max()<3310
 phase('source-resampled62_5m')
 # Frozen holdout:384² cell centres, every4cells per axis, BEFORE seeing output.
 hold_axis=-48+(4*np.arange(384)+.5)*SPACING_KM
 hold_native=sample(10-hold_axis[None,:]/(DEGREE_KM*math.cos(math.radians(44))),44+hold_axis[:,None]/DEGREE_KM)
 hold_data=np.asarray(hold_native,dtype='<f8').tobytes(order='C');assert len(hold_data)==1179648
 write_unique(ROOT/'holdout-native-m.f64le.bin',hold_data)
 hold_metadata={'file':'holdout-native-m.f64le.bin','bytes':len(hold_data),'sha256':hashlib.sha256(hold_data).hexdigest(),'dtype':'Float64LE','units':'metres EGM2008','shape':[384,384],'count':147456,'rowOrder':'Z south to north; X east to west increasing localX','coordinatesKm':{'xEqualsZAxis':True,'formula':'-48+(4*i+0.5)*0.0625; i=0..383','first':float(hold_axis[0]),'stride':.25,'last':float(hold_axis[-1])},'reference':'Native GLO30 mosaic bilinear; NOT sampled from62.5m raster; before clamp, ocean flattening or quantization','sourceManifestSha256':sha(ROOT/'tiles-manifest.json'),'summaryM':stats(hold_native)}
 (ROOT/'holdout-native-m.metadata.json').write_text(json.dumps(hold_metadata,indent=2)+'\n');del hold_native,hold_data
 height=np.maximum(0,original);eligible=height<.5;ocean=flood_ocean(eligible);assert ocean.any() and (~ocean).any();height[ocean]=0;phase('ocean-flood-complete')
 distance_sea=edt(ocean);phase('distance-to-ocean-complete')
 distance_land=edt(~ocean);phase('distance-to-land-complete')
 distance=np.where(ocean,-1.,1.)*np.maximum(0,np.sqrt(np.where(ocean,distance_land,distance_sea))*SPACING_KM*1000-SPACING_KM*500)
 del distance_sea,distance_land
 hcode=np.rint(height/H_SCALE_M);ccode=np.rint(distance/COAST_SCALE_M)
 assert hcode.min()>=0 and hcode.max()<=65535 and ccode.min()>=-32768 and ccode.max()<=32767
 hcode=hcode.astype('<u2');ccode=ccode.astype('<i2')
 decoded_h=hcode.astype(float)*H_SCALE_M;decoded_c=ccode.astype(float)*COAST_SCALE_M
 h_error=abs(decoded_h-height);c_error=abs(decoded_c-distance)
 assert h_error.max()<=.06250001 and c_error.max()<=4.0000001 and (hcode[ocean]==0).all()
 # Authenticated legacy1025² CDM1, no regeneration or live-project source read.
 baseline_bytes=baseline_path.read_bytes();baseline_sha=hashlib.sha256(baseline_bytes).hexdigest()
 assert baseline_sha=='92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d'
 assert struct.unpack_from('<4sIddd',baseline_bytes)==(b'CDM1',1025,.125,-64.,-64.) and len(baseline_bytes)==4202532
 count=1025**2;old_h=np.frombuffer(baseline_bytes,dtype='<u2',count=count,offset=32).reshape(1025,1025).astype(float)*.125
 old_c=np.frombuffer(baseline_bytes,dtype='<i2',count=count,offset=32+count*2).reshape(1025,1025).astype(float)*8
 legacy_c=grid_sample(old_c,axis[None,:],axis[:,None],1025,.125);legacy_codes=np.rint(legacy_c/8)
 assert legacy_codes.min()>=-32768 and legacy_codes.max()<=32767;legacy_codes=legacy_codes.astype('<i2');legacy_decoded=legacy_codes.astype(float)*8
 legacy_error=abs(legacy_decoded-legacy_c);assert legacy_error.max()<=4.0000001
 # Quantized legacy variant is NOT the exact original continuous field.
 legacy_hold=grid_sample(old_c,hold_axis[None,:],hold_axis[:,None],1025,.125)
 new_legacy_hold=grid_sample(legacy_decoded,hold_axis[None,:],hold_axis[:,None],N,SPACING_KM)
 legacy_offnode_error=abs(new_legacy_hold-legacy_hold);assert legacy_offnode_error.max()<=4.0000001
 del legacy_hold,new_legacy_hold
 new_h_common=decoded_h[::2,::2];new_c_common=decoded_c[::2,::2];old_land=old_c>=0;new_land=new_c_common>=0
 comparison={'baselineFile':str(baseline_path),'baselineSha256':baseline_sha,'coordinates':'all1025² nodes coincide exactly; new[::2,::2] vs old; X/Z endpoints±64km, same origin','heightDeltaNewMinusOldM':signed_summary(new_h_common-old_h,old_land),'recomputedCoastDeltaNewMinusOldM':signed_summary(new_c_common-old_c,old_land),'maskAtCoincidentNodes':{'oldLandNewOcean':int((old_land&~new_land).sum()),'oldOceanNewLand':int((~old_land&new_land).sum())},'legacyRequantizationAtNewNodesAbsM':stats(legacy_error),'legacyRequantizedOffNodeHoldoutAbsM':stats(legacy_offnode_error),'limitation':'Delta between DSM derivatives is not physical accuracy. Legacy coast variant does not preserve original continuous125m coast exactly.'}
 phase('legacy-comparison-complete')
 epsilon=1e-9;lon_line=np.linspace(float(longitude.min()),float(longitude.max()),2049);lat_line=np.linspace(float(latitude.min()),float(latitude.max()),2049)
 ew=abs(sample(10-epsilon,lat_line)-sample(10+epsilon,lat_line));ns=abs(sample(lon_line,44-epsilon)-sample(lon_line,44+epsilon));assert ew.max()<.01 and ns.max()<.01
 corners=[]
 for label,(j,i) in {'xMinus_zMinus':(0,0),'xPlus_zMinus':(0,N-1),'xMinus_zPlus':(N-1,0),'xPlus_zPlus':(N-1,N-1),'origin':(N//2,N//2)}.items():
  corners.append({'label':label,'xWestKm':float(axis[i]),'zNorthKm':float(axis[j]),'latitude':float(latitude[j,0]),'longitude':float(longitude[0,i]),'nativeBilinearM':float(original[j,i]),'heightM':float(decoded_h[j,i]),'recomputedCoastM':float(decoded_c[j,i]),'legacyRequantizedCoastM':float(legacy_decoded[j,i]),'ocean':bool(ocean[j,i])})
 asset_a=write_asset('glo30-62_5m-recomputed-coast.cdm1.bin',hcode,ccode);asset_b=write_asset('glo30-62_5m-legacy-coast.cdm1.bin',hcode,legacy_codes)
 report={'status':'PREPROCESSED_DATA_ONLY_NO_MESH_NO_GPU','protocolSha256':sha(ROOT/'PREPROCESS-PROTOCOL.md'),'scriptSha256':sha(Path(__file__)),'sourceManifestSha256':sha(ROOT/'tiles-manifest.json'),'sourceRelease':'AWS public COG2021','sourceMetadata':source_metadata,
  'format':{'magic':'CDM1','headerBytes':32,'side':N,'spacingKm':SPACING_KM,'minXKm':-64,'minZKm':-64,'maxXKm':64,'maxZKm':64,'heightUnits':'u16LE*0.125m','coastUnits':'i16LE*8m','nodeCentres':True,'rowOrder':'Zsouth→north, Xeast→west'},
  'projection':{'originLatitude':44,'originLongitude':10,'kmPerDegreeLatitude':DEGREE_KM,'latitudeFormula':'44+z/111.1950802335','longitudeFormula':'10-x/(111.1950802335*cos44deg)','latitudeRange':[float(latitude.min()),float(latitude.max())],'longitudeRange':[float(longitude.min()),float(longitude.max())],'verticalDatum':'EGM2008 orthometric metres per official product; no extra geoid correction; mapped later to existing spherical sea','exaggeration':1,'geodesicExact':False},
  'sourceSampleMetres':stats(original),'heightMetres':stats(decoded_h),'heightQuantizationAbsErrorM':stats(h_error),'recomputedCoastMetres':stats(decoded_c),'recomputedCoastQuantizationAbsErrorM':stats(c_error),
  'mask':{'eligibleUnderHalfMetreNodes':int(eligible.sum()),'borderConnectedOceanNodes':int(ocean.sum()),'landNodes':int((~ocean).sum()),'isolatedLowNodesNotOcean':int((eligible&~ocean).sum()),'negativeSourceNodesClamped':int((original<0).sum()),'connectivity':4,'oceanHeightAllZero':True,'coastMethod':'Exact separable squared EDT to opposite class centres, sqrt*62.5m minus31.25m; signed; NOT official coast','tinyEDTOracle':edt_test},
  'seamAudit':{'nativeCentreCases':20,'nativeCentreMaxAbsM':max(point_errors),'epsilonDegrees':epsilon,'eastWestLimitDifferenceM':stats(ew),'northSouthLimitDifferenceM':stats(ns),'note':'Adjacent distinct source samples can differ; only seam limits tested'},'cornersAndOrigin':corners,'comparisonWithLegacy125m':comparison,'holdout':hold_metadata,
  'assets':{'recomputedCoast':asset_a,'legacyCoastRequantized':asset_b,'heightChannelsIdentical':True,'legacyCoastContinuousFieldIdentical':False},
  'hardGates':{'sourceFinite':True,'declaredNoDataRejected':True,'nativeFloat32NoOverview':True,'pixelIsPointNoHalfPixel':True,'seamsWithin1cm':True,'heightUnder3310m':True,'heightQuantizationWithin0_0625m':True,'coastQuantizationWithin4m':True,'noSaturation':True,'sameOriginAsLegacy':True,'exactByteCounts':True,'noModelOrGPU':True},
  'runtime':{'pythonExecutable':sys.executable,'pythonVersion':sys.version,'machine':platform.machine(),'numpyVersion':np.__version__,'pillowVersion':PIL_VERSION,'cpuSeconds':time.process_time(),'wallSeconds':time.perf_counter()-START,'peakRssBytes':rss(),'budgets':{'cpuSeconds':180,'wallSeconds':240,'peakRssBytes':MAX_RSS},'rssEnforcement':'Phase and terminal gate; not a hard interruption during native calls'},
  'limitations':['DSM includes vegetation/buildings; not a bare-earth DTM','No physical truth comparison, erosion/noise/vertical rescaling','Ocean mask and EDT are approximate authored derivatives','No mesh construction, GPU, visual acceptance or FPS inference','Future builder should use old125m coast sampler directly for CPU field identity; new triangulation can change raster interpolation']}
 phase('outputs-written');report['runtime'].update(cpuSeconds=time.process_time(),wallSeconds=time.perf_counter()-START,peakRssBytes=rss())
 assert report['runtime']['cpuSeconds']<=180 and report['runtime']['wallSeconds']<=240 and rss()<=MAX_RSS
 write_unique(ROOT/'preprocess-result.json',(json.dumps(report,indent=2)+'\n').encode());signal.alarm(0)
 print(json.dumps({'status':report['status'],'assets':report['assets'],'heightMaxM':report['heightMetres']['max'],'sourceMinM':report['sourceSampleMetres']['min'],'seamMaxM':max(float(ew.max()),float(ns.max())),'runtime':report['runtime']}),flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--baseline',type=Path,required=True);args=parser.parse_args()
 try:run(args.baseline)
 except BaseException as error:
  failure={'status':'FAIL_NO_IMPLICIT_RETRY','error':repr(error),'wallSeconds':time.perf_counter()-START,'cpuSeconds':time.process_time(),'peakRssBytes':rss()}
  with (ROOT/'preprocess-failure.json').open('x') as stream:json.dump(failure,stream,indent=2)
  raise
