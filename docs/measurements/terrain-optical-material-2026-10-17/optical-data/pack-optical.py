"""Single streaming data pack. No model, mesh, Three, image repair or GPU."""
from pathlib import Path
import argparse,hashlib,json,math,platform,resource,struct,sys,time
import numpy as np

HERE=Path(__file__).resolve().parent
SIDE=2048;ROWS=32;RSS_CAP=192*1024**2;HALF_ERROR_CAP=2**-12
EXPECTED={
 'rgb':{'bytes':50331648,'sha256':'44205c43c1f243766716060b16e7f74948fba3a9366b6f38473d045c066a074e'},
 'validity':{'bytes':16777216,'sha256':'e89361dccb2b50a515f08ee7fee8500bdd3a535bdce4f5ea6159a736120f12c7'},
}
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def rss():
 value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
 return int(value if sys.platform=='darwin' else value*1024)
def gate():
 if rss()>RSS_CAP:raise MemoryError('Child phase RSS exceeds192MiB; no retry')
def save(name,value):
 with (HERE/name).open('x') as stream:json.dump(value,stream,indent=2);stream.write('\n')

def fixtures():
 # All inputs fixed before the actual raster is read. No source threshold fit.
 tie_values=[0.,1.,2**-24,2**-25,.5+2**-12,.5+3*2**-12]
 independent_half=b''.join(struct.pack('<e',value) for value in tie_values)
 assert np.asarray(tie_values,dtype='<f2').tobytes()==independent_half
 cases=[('mixed',[[[.2,.4,.8],[.8,.2,.1]],[[0,0,0],[.6,.3,.2]]],[[1,.5],[0,.25]]),
  ('oneValid',[[[.2,.4,.8],[0,0,0]],[[0,0,0],[0,0,0]]],[[1,0],[0,0]]),
  ('allInvalid',np.zeros((2,2,3)).tolist(),np.zeros((2,2)).tolist())]
 result=[];U=np.array([.015,.02,.025]);P=np.array([.06,.09,.12]);K=.75
 for name,colors,coverage in cases:
  c=np.asarray(colors,dtype=float);v=np.asarray(coverage,dtype=float);q=np.concatenate((c*v[...,None],v[...,None]),axis=-1)
  mip=q.mean(axis=(0,1));per_pixel=U+(1-v[...,None])*P+K*q[...,:3]
  composed=U+(1-mip[3])*P+K*mip[:3];expected=per_pixel.mean(axis=(0,1))
  assert np.max(abs(composed-expected))<1e-15
  decoded=q.astype('<f2').astype(float);half_mip=decoded.mean(axis=(0,1)).astype('<f2').astype(float)
  half_composed=U+(1-half_mip[3])*P+K*half_mip[:3]
  if name=='allInvalid':assert np.array_equal(mip,np.zeros(4)) and np.array_equal(composed,U+P)
  if name=='oneValid':assert np.array_equal(mip[:3],np.array([.2,.4,.8])/4) and mip[3]==.25
  result.append({'id':name,'rgb':colors,'validity':coverage,'qFloat64':q.tolist(),'idealLinearMip':mip.tolist(),'averageOfPerPixelComposite':expected.tolist(),'compositeOfAverage':composed.tolist(),'algebraMaxAbs':float(abs(expected-composed).max()),'halfBaseWordsLE':q.astype('<f2').view('<u2').tolist(),'halfBaseThenHalfMip':half_mip.tolist(),'halfCompositeMaxAbsAgainstIdeal':float(abs(half_composed-composed).max())})
 return {'status':'PASS','formula':'U+(1-v)*P+K*Q.rgb','U':U.tolist(),'P':P.tolist(),'K':K,'halfTieOracle':{'values':tie_values,'expectedBytesHex':independent_half.hex(),'oracle':'Pythonstdlibstruct<e matches NumPy, including subnormal and ties-to-even'},'cases':result,'scope':'Tiny CPU algebra+half-rounding fixtures, not GPU mip parity or visual proof'}

def run(rgb_path,valid_path):
 started=time.perf_counter();gate()
 target=HERE/'optical-rgba16f.bin';partial=HERE/'optical-rgba16f.bin.partial'
 if target.exists() or partial.exists():raise RuntimeError('Refuse overwrite/implicit retry')
 for key,path in [('rgb',rgb_path),('validity',valid_path)]:
  if path.stat().st_size!=EXPECTED[key]['bytes']:raise ValueError('Unexpected input length '+key)
 fixture=fixtures();save('mip-fixtures.json',fixture)
 input_hashes={name:hashlib.sha256() for name in EXPECTED};output_hash=hashlib.sha256()
 source_min=np.full(4,np.inf);source_max=np.full(4,-np.inf);half_min=np.full(4,np.inf);half_max=np.full(4,-np.inf)
 error_max=np.zeros(4);error_sum=np.zeros(4);error_square_sum=np.zeros(4);error_nonzero=np.zeros(4,dtype=np.int64)
 max_locations=[None]*4;underflow=np.zeros(4,dtype=np.int64);zero_valid=partial_valid=full_valid=zero_alpha=0
 with rgb_path.open('rb') as rgb_file,valid_path.open('rb') as valid_file,partial.open('xb') as output:
  for row in range(0,SIDE,ROWS):
   rows=min(ROWS,SIDE-row);count=rows*SIDE
   rgb_bytes=rgb_file.read(count*12);valid_bytes=valid_file.read(count*4)
   if len(rgb_bytes)!=count*12 or len(valid_bytes)!=count*4:raise ValueError('Truncated input')
   input_hashes['rgb'].update(rgb_bytes);input_hashes['validity'].update(valid_bytes)
   c=np.frombuffer(rgb_bytes,dtype='<f4').reshape(rows,SIDE,3).astype(float)
   v=np.frombuffer(valid_bytes,dtype='<f4').reshape(rows,SIDE).astype(float)
   if not np.isfinite(c).all() or not np.isfinite(v).all() or c.min()<0 or c.max()>1 or v.min()<0 or v.max()>1:raise ValueError('Nonfinite/out-of-range source')
   invalid=v==0
   if np.any(c[invalid]!=0):raise ValueError('Nonzero conditional RGB at zero validity')
   q=np.empty((rows,SIDE,4),dtype=float);q[...,:3]=c*v[...,None];q[...,3]=v;q[invalid]=0.
   half=np.asarray(q,dtype='<f2');decoded=half.astype(float);words=half.view('<u2')
   if not np.isfinite(decoded).all() or decoded.min()<0 or decoded.max()>1 or np.any(decoded[...,:3]>decoded[...,3,None]):raise ValueError('Invalid half/premultiplied result')
   if np.any(words[invalid]!=0):raise ValueError('Zero-valid output is not four positive zeros')
   source_min[:3]=np.minimum(source_min[:3],c.min(axis=(0,1)));source_max[:3]=np.maximum(source_max[:3],c.max(axis=(0,1)))
   source_min[3]=min(source_min[3],float(v.min()));source_max[3]=max(source_max[3],float(v.max()))
   half_min=np.minimum(half_min,decoded.min(axis=(0,1)));half_max=np.maximum(half_max,decoded.max(axis=(0,1)))
   error=abs(decoded-q)
   for channel in range(4):
    e=error[...,channel];maximum=float(e.max())
    if maximum>error_max[channel]:
     j,i=np.unravel_index(np.argmax(e),e.shape);max_locations[channel]={'x':int(i),'z':row+int(j),'reference':float(q[j,i,channel]),'half':float(decoded[j,i,channel])};error_max[channel]=maximum
   error_sum+=error.sum(axis=(0,1));error_square_sum+=(error*error).sum(axis=(0,1));error_nonzero+=np.count_nonzero(error,axis=(0,1))
   underflow+=np.count_nonzero((q>0)&(decoded==0),axis=(0,1))
   zero_valid+=int(invalid.sum());partial_valid+=int(((v>0)&(v<1)).sum());full_valid+=int((v==1).sum());zero_alpha+=int((decoded[...,3]==0).sum())
   block=half.tobytes(order='C');assert output.write(block)==len(block);output_hash.update(block);gate()
   if row%256==0:print(json.dumps({'phase':'packed-stripe','firstRow':row,'rows':rows,'cpuSeconds':time.process_time(),'peakRssBytes':rss()}),flush=True)
  if rgb_file.read(1) or valid_file.read(1):raise ValueError('Trailing input bytes')
 for key,hasher in input_hashes.items():
  if hasher.hexdigest()!=EXPECTED[key]['sha256']:raise ValueError('Input SHA mismatch: '+key)
 if np.any(error_max>HALF_ERROR_CAP):raise ValueError('Half rounding exceeds bound')
 if partial.stat().st_size!=33554432:raise ValueError('Output length')
 if sha(partial)!=output_hash.hexdigest():raise ValueError('Written output hash differs')
 # Existing witness points only, verifying written bytes at their actual offsets.
 witnesses=[]
 with rgb_path.open('rb') as rg,valid_path.open('rb') as va,partial.open('rb') as out:
  for witness in json.loads((HERE/'provenance/source-witnesses.json').read_text())['witnesses']:
   x=witness['x'];z=witness['z'];index=z*SIDE+x
   rg.seek(index*12);va.seek(index*4);out.seek(index*8)
   c=np.frombuffer(rg.read(12),dtype='<f4').astype(float);v=float(np.frombuffer(va.read(4),dtype='<f4')[0]);actual=np.frombuffer(out.read(8),dtype='<f2').astype(float)
   if np.max(abs(c-witness['productionConditionalMeanRGB']))>3e-8 or abs(v-witness['validity'])>3e-8:raise ValueError('Existing source witness mismatch')
   q=np.array([*(c*v),v]);expected_bytes=struct.pack('<4e',*q);expected=np.frombuffer(expected_bytes,dtype='<f2').astype(float)
   if not np.array_equal(actual,expected):raise ValueError('Written half witness mismatch')
   witnesses.append({'id':witness['name'],'x':x,'z':z,'worldCentreKm':[-64+(x+.5)*.0625,-64+(z+.5)*.0625],'sourceRgb':c.tolist(),'sourceValidity':v,'referencePremultipliedRGBA':q.tolist(),'halfDecodedRGBA':actual.tolist(),'absoluteErrorRGBA':abs(actual-q).tolist(),'packedBytesHex':expected_bytes.hex(),'halfOracle':'Pythonstdlibstruct<4e independent of NumPy cast'})
 save('witnesses.json',{'status':'PASS','count':len(witnesses),'selection':'Exactly the5pre-existing cycle21 source witnesses','witnesses':witnesses})
 count=SIDE*SIDE;assert zero_valid+partial_valid+full_valid==count
 metadata={'status':'PACKED_DATA_ONLY_NO_RENDER','format':{'file':target.name,'bytes':33554432,'sha256':output_hash.hexdigest(),'width':SIDE,'height':SIDE,'channels':['R*valid','G*valid','B*valid','valid'],'scalar':'IEEE754binary16','byteOrder':'little-endian','pixelBytes':8,'headerBytes':0,'interleaved':True,'rowStrideBytes':SIDE*8,'colorSpace':'NoColorSpace; linear reflectance bands treated as RGB','arithmetic':'InputFloat32 promoted to Float64; exact binary product; one ties-to-even half rounding; no gain/gamma/clamp'},
  'grid':{'cellKm':.0625,'minEdgeKm':[-64,-64],'maxEdgeKm':[64,64],'centreFormulaKm':'-64+(index+0.5)*0.0625','originDegrees':[44,10],'axisX':'west','axisZ':'north','firstRow':'south','firstColumn':'east','flipY':False,'projection':'lat=44+z/111.1950802335;lon=10-x/(111.1950802335*cos44deg)','spatialResampling':False},
  'inputs':{key:{**EXPECTED[key],'path':str(path),'authenticatedSHA256':input_hashes[key].hexdigest()} for key,path in [('rgb',rgb_path),('validity',valid_path)]},
  'source':{'dataset':'ESA WorldCover Sentinel-2 medianL2A RGBNIR2021v200; overview4 derivative','persistedChannels':'RGB+validity; no NIR grid','officialUrls':['https://esa-worldcover.org/en/data-access','https://registry.opendata.aws/esa-worldcover-vito-composites/'],'license':'CC BY4.0; original notice and full license retained in provenance/','limits':'Annual observed composite, not light-independent albedo/BRDF or cloud truth'},
  'observed':{'sourceRgbValidityMin':source_min.tolist(),'sourceRgbValidityMax':source_max.tolist(),'halfPremultipliedRgbaMin':half_min.tolist(),'halfPremultipliedRgbaMax':half_max.tolist(),'sourceZeroValidityPixels':zero_valid,'sourcePartialValidityPixels':partial_valid,'sourceFullValidityPixels':full_valid,'packedZeroAlphaPixels':zero_alpha,'positiveUnderflowToZeroWordsByChannel':underflow.tolist(),'zeroValidityFourPositiveZeroWords':True,'allSourceAndHalfFinite':True,'premultipliedRgbAtMostAlpha':True},
  'quantization':{'reference':'Float64 Q from exact Float32inputs; errors apply to premultipliedRGB, not unpremultiplied conditional RGB','wordsPerChannel':count,'maxAbsoluteErrorRGBA':error_max.tolist(),'meanAbsoluteErrorRGBA':(error_sum/count).tolist(),'rmsErrorRGBA':np.sqrt(error_square_sum/count).tolist(),'nonzeroErrorWordsRGBA':error_nonzero.tolist(),'firstMaximumLocationsRGBA':max_locations,'hardBoundAtUnitRange':HALF_ERROR_CAP,'saturationCount':0},
  'nominalTexturePlan':{'format':'rgba16float','baseBytes':33554432,'extraMipBytes':11184808,'totalMipPayloadBytes':44739240,'levels':12,'actualMipsGeneratedHere':False,'scope':'One base resource only; GPU filter/mip generator must be qualified separately'},
  'preparation':{'scriptSha256':sha(Path(__file__)),'protocolSha256':sha(HERE/'PROTOCOL.md'),'stripeRows':ROWS,'numpyVersion':np.__version__,'pythonVersion':sys.version,'machine':platform.machine(),'cpuSeconds':time.process_time(),'wallSeconds':time.perf_counter()-started,'childPeakRssBytes':rss()},
  'scope':'No TIFF read, download, data selection, mesh/model, GPU, artistic or FPS acceptance. Source archives unchanged.'}
 gate();partial.rename(target);save('optical-rgba16f.metadata.json',metadata)
 print(json.dumps({'status':metadata['status'],'asset':metadata['format'],'quantization':metadata['quantization'],'resources':metadata['preparation']}),flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--rgb',type=Path,required=True);parser.add_argument('--validity',type=Path,required=True);args=parser.parse_args()
 try:run(args.rgb,args.validity)
 except BaseException as error:
  save('pack-failure.json',{'status':'FAIL_NO_AUTOMATIC_RETRY','error':repr(error),'cpuSeconds':time.process_time(),'peakRssBytes':rss()});raise
