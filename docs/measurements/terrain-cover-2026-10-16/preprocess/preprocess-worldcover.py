"""Original bounded WorldCover COG ROI -> WCV1 exact-area class fractions.

One frozen run, no external geospatial dependency, no full native raster buffer.
"""
from pathlib import Path
from urllib.request import Request, urlopen
import numpy as np
import json, math, struct, hashlib, gzip, zlib, time, sys, signal, resource, csv

ROOT = Path(__file__).resolve().parent
SIDE = 1024
SPACING = .125
MINIMUM = -64.
KY = 111.1950802335
KX = KY * math.cos(math.radians(44))
CODES = [0,10,20,30,40,50,60,70,80,90,95,100]
CHANNELS = len(CODES)
LUT = np.full(256,255,dtype=np.uint8)
for channel, code in enumerate(CODES): LUT[code] = channel
PREFIX_SHA = '65ff4780170766563fba8b2d2974f11d62602de4ede152cdee6e77d0fa7932f4'
SOURCE_BYTES = 72420601
ETAG = '"16b2cf7e8d2b5cfe2679bdcf5c3e15cf-9"'
NATIVE_SIDE = 36000
TILE = 1024
MEMORY_LIMIT_BYTES = 256 * 1024**2

def digest(data):
    return hashlib.sha256(data).hexdigest()

def write_json(name, value):
    (ROOT/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')

def peak_rss_bytes():
    peak=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return peak if sys.platform=='darwin' else peak*1024

def boundaries(index, k):
    """Native pixel boundary -> target-cell coordinate; both world axes reverse."""
    return (k*(1-np.asarray(index,dtype=float)/12000)+64)/SPACING

def segments(indices, transform, side):
    p = transform(np.asarray(indices,dtype=float))
    q = transform(np.asarray(indices,dtype=float)+1)
    lo = np.maximum(0,np.minimum(p,q))
    hi = np.minimum(side,np.maximum(p,q))
    first = np.floor(lo).astype(np.int32)
    first_weight = np.maximum(0,np.minimum(hi,first+1)-lo)
    second_weight = np.maximum(0,hi-np.maximum(lo,first+1))
    assert np.max(abs(p-q)) < 1, 'Each native pixel must span fewer than one target cell'
    return [(first,first_weight),(first+1,second_weight)]

def accumulate(histogram, raw, source_x, source_y, tx, tz):
    """At most two positive overlaps per axis; exact rectangular area products."""
    side = histogram.shape[0]
    classes = LUT[raw]
    assert np.all(classes < CHANNELS), 'Unexpected source class code: do not map it silently'
    for cell_z, weight_z in segments(source_y,tz,side):
        rows = np.flatnonzero(weight_z>0)
        if not len(rows): continue
        cz = cell_z[rows]
        assert cz.min()>=0 and cz.max()<side
        for cell_x, weight_x in segments(source_x,tx,side):
            cols = np.flatnonzero(weight_x>0)
            if not len(cols): continue
            cx = cell_x[cols]
            assert cx.min()>=0 and cx.max()<side
            z0,z1=int(cz.min()),int(cz.max())+1
            x0,x1=int(cx.min()),int(cx.max())+1
            nx,nz=x1-x0,z1-z0
            ids = ((cz[:,None]-z0).astype(np.int64)*nx+(cx[None,:]-x0))*CHANNELS
            ids = ids + classes[np.ix_(rows,cols)]
            weights = weight_z[rows,None]*weight_x[None,cols]
            partial = np.bincount(ids.ravel(),weights.ravel(),minlength=nz*nx*CHANNELS)
            histogram[z0:z1,x0:x1] += partial.reshape(nz,nx,CHANNELS)

def brute_force(raw, tx, tz, side):
    """Independent small exhaustive oracle: target cells vs every source pixel."""
    expected=np.zeros((side,side,CHANNELS),dtype=float)
    for z in range(side):
        for x in range(side):
            for row in range(raw.shape[0]):
                za,zb=sorted([float(tz(row)),float(tz(row+1))])
                oz=max(0,min(z+1,zb)-max(z,za))
                if oz==0: continue
                for col in range(raw.shape[1]):
                    xa,xb=sorted([float(tx(col)),float(tx(col+1))])
                    ox=max(0,min(x+1,xb)-max(x,xa))
                    if ox: expected[z,x,int(LUT[raw[row,col]])] += ox*oz
    return expected

def quantize(histogram):
    total=histogram.sum(axis=-1,keepdims=True)
    assert np.all(total>0)
    normalized=histogram/total
    scaled=normalized*255
    base=np.floor(scaled).astype(np.int16)
    remainder=255-base.sum(axis=-1)
    assert remainder.min()>=0 and remainder.max()<CHANNELS
    order=np.argsort(-(scaled-base),axis=-1,kind='stable')
    rank=np.empty_like(order)
    np.put_along_axis(rank,order,np.broadcast_to(np.arange(CHANNELS),order.shape),axis=-1)
    output=(base+(rank<remainder[...,None])).astype(np.uint8)
    assert np.all(output.astype(np.uint16).sum(axis=-1)==255)
    assert not np.any((output>0)&(histogram==0)), 'Do not create an absent class while quantizing'
    return output

def small_oracles():
    labels=np.array(CODES,dtype=np.uint8)
    raw=labels[(np.arange(7)[:,None]*3+np.arange(9)[None,:])%CHANNELS]
    tx=lambda j:4.37-np.asarray(j)*.57
    tz=lambda i:4.22-np.asarray(i)*.71
    expected=brute_force(raw,tx,tz,4)
    actual=np.zeros_like(expected)
    accumulate(actual,raw,np.arange(9),np.arange(7),tx,tz)
    tiled=np.zeros_like(expected)
    for y0 in range(0,7,3):
        for x0 in range(0,9,4):
            a=raw[y0:y0+3,x0:x0+4]
            accumulate(tiled,a,np.arange(x0,x0+a.shape[1]),np.arange(y0,y0+a.shape[0]),tx,tz)
    assert np.max(abs(actual-expected))<1e-12
    assert np.max(abs(tiled-expected))<1e-12
    assert np.max(abs(expected.sum(axis=-1)-1))<1e-12
    a=np.zeros((1,3,CHANNELS));a[0,0,0]=1;a[0,1,:2]=.5;a[0,2,:3]=1/3
    q=quantize(a)
    assert list(q[0,0])==[255]+[0]*11
    assert list(q[0,1])==[128,127]+[0]*10
    assert list(q[0,2])==[85,85,85]+[0]*9
    return {'status':'PASS','independentRectangleCells':16,'sourcePixels':63,
            'allTwelveClassesPresent':bool(len(np.unique(raw))==12),
            'singleBlockMaxAbsError':float(abs(actual-expected).max()),
            'partitionedBlocksMaxAbsError':float(abs(tiled-expected).max()),
            'oneHotUnknownAndTieQuantization':True,
            'scope':'Synthetic area oracle independent of production overlap decomposition; not a full independent GeoTIFF decoder'}

def roi(metadata):
    longitude=[10-64/KX,10+64/KX]
    latitude=[44-64/KY,44+64/KY]
    u0,u1=[(v-9)*12000 for v in longitude]
    v0,v1=[(45-v)*12000 for v in latitude[::-1]]
    x0,x1=math.floor(u0),math.ceil(u1)
    y0,y1=math.floor(v0),math.ceil(v1)
    assert 0<=x0<x1<=NATIVE_SIDE and 0<=y0<y1<=NATIVE_SIDE
    columns=math.ceil(NATIVE_SIDE/TILE)
    selected=[]
    main=metadata['levels'][0]
    for ty in range(y0//TILE,(y1-1)//TILE+1):
        for tx in range(x0//TILE,(x1-1)//TILE+1):
            tile_id=ty*columns+tx
            start=main['tileOffsets'][tile_id]
            count=main['tileByteCounts'][tile_id]
            selected.append({'id':tile_id,'x':tx,'y':ty,'offset':start,'bytes':count})
    ranges=[]
    for tile in sorted(selected,key=lambda t:t['offset']):
        start,end=tile['offset'],tile['offset']+tile['bytes']
        if ranges and start-ranges[-1]['endExclusive']<=16:
            ranges[-1]['endExclusive']=end;ranges[-1]['tiles'].append(tile['id'])
        else:ranges.append({'start':start,'endExclusive':end,'tiles':[tile['id']]})
    assert len(selected)==300 and len(ranges)==15
    assert sum(r['endExclusive']-r['start'] for r in ranges)==9114088
    return {'pixelBoundsHalfOpen':[x0,y0,x1,y1],'nativePixelBoundaryBounds':[u0,v0,u1,v1],
            'latitude':latitude,'longitude':longitude,'tiles':selected,'ranges':ranges}

def download(metadata, plan):
    directory=ROOT/'ranges';directory.mkdir(exist_ok=False)
    result=[]
    def timeout(signum,frame):
        raise TimeoutError('60-second total download budget exceeded; no automatic retry')
    previous_handler=signal.signal(signal.SIGALRM,timeout)
    signal.alarm(60)
    try:
        for i,interval in enumerate(plan['ranges']):
            lo,hi=interval['start'],interval['endExclusive']
            expected=hi-lo
            request=Request(metadata['url'],headers={'Range':f'bytes={lo}-{hi-1}','If-Match':ETAG})
            with urlopen(request,timeout=15) as response:
                assert response.status==206,'Refuse non-range response before reading body'
                assert response.headers.get('ETag')==ETAG,'Source changed; no source drift accepted'
                assert response.headers.get('Content-Range')==f'bytes {lo}-{hi-1}/{SOURCE_BYTES}'
                assert int(response.headers['Content-Length'])==expected
                data=response.read(expected+1)
                assert len(data)==expected
                headers=dict(response.headers)
            name=f'ranges/range-{i:02d}-{lo}-{hi-1}.bin'
            (ROOT/name).write_bytes(data)
            result.append({**interval,'path':name,'bytes':len(data),'sha256':digest(data),'httpStatus':206,'headers':headers})
            print(f'Range {i+1}/15: {len(data)} bytes',flush=True)
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM,previous_handler)
    report={'status':'FIFTEEN_BOUNDED_RANGES_COMPLETE','url':metadata['url'],'sourceObjectBytes':SOURCE_BYTES,
            'sourceETag':ETAG,'etagIsWholeObjectSha256':False,'totalBytes':sum(r['bytes'] for r in result),'ranges':result}
    write_json('ranges-manifest.json',report)
    return report

class RawReader:
    def __init__(self,plan,downloaded):
        self.tiles={t['id']:t for t in plan['tiles']}
        self.containers={tile:r for r in downloaded['ranges'] for tile in r['tiles']}
        self.cached_id=None;self.cached=None
    def tile(self,tile_id):
        t=self.tiles[tile_id];r=self.containers[tile_id]
        with open(ROOT/r['path'],'rb') as f:
            f.seek(t['offset']-r['start']);compressed=f.read(t['bytes'])
        assert len(compressed)==t['bytes']
        inflater=zlib.decompressobj()
        decoded=inflater.decompress(compressed,TILE*TILE+1)
        assert inflater.eof and not inflater.unused_data and len(decoded)==TILE*TILE
        return np.frombuffer(decoded,dtype=np.uint8).reshape(TILE,TILE)
    def pixel(self,col,row):
        tile_id=(row//TILE)*math.ceil(NATIVE_SIDE/TILE)+col//TILE
        if tile_id!=self.cached_id:self.cached=self.tile(tile_id);self.cached_id=tile_id
        return int(self.cached[row%TILE,col%TILE])

def source_witnesses(histogram,quantized,reader):
    records=[];pixel_rows=[]
    for code in [10,40,50,60,80]:
        ch=CODES.index(code);fraction=histogram[...,ch]
        z,x=np.unravel_index(np.argmax(fraction*(1-fraction)),fraction.shape)
        x=int(x);z=int(z)
        xa,xb=MINIMUM+x*SPACING,MINIMUM+(x+1)*SPACING
        za,zb=MINIMUM+z*SPACING,MINIMUM+(z+1)*SPACING
        u0=(10-xb/KX-9)*12000;u1=(10-xa/KX-9)*12000
        v0=(45-(44+zb/KY))*12000;v1=(45-(44+za/KY))*12000
        native_area=(u1-u0)*(v1-v0)
        expected=np.zeros(CHANNELS)
        for row in range(math.floor(v0),math.ceil(v1)):
            dy=max(0,min(row+1,v1)-max(row,v0))
            for col in range(math.floor(u0),math.ceil(u1)):
                dx=max(0,min(col+1,u1)-max(col,u0))
                weight=dx*dy/native_area
                source_code=reader.pixel(col,row)
                expected[CODES.index(source_code)]+=weight
                pixel_rows.append({'witnessClass':code,'outputX':x,'outputZ':z,'sourceCol':col,'sourceRow':row,'sourceCode':source_code,'areaFraction':weight})
        error=float(np.max(abs(expected-histogram[z,x])))
        assert error<2e-10
        centre_x=(xa+xb)/2;centre_z=(za+zb)/2
        centre_lon=10-centre_x/KX;centre_lat=44+centre_z/KY
        col=math.floor((centre_lon-9)*12000);row=math.floor((45-centre_lat)*12000)
        records.append({'selectedBoundaryClass':code,'selection':'first row-major maximum f*(1-f), fixed class list before run',
                        'outputX':x,'outputZ':z,'worldCentreKm':[centre_x,centre_z],
                        'latitude':centre_lat,'longitude':centre_lon,'sourceCentrePixel':[col,row],
                        'sourceCentreClass':reader.pixel(col,row),'sourcePixelCount':sum(p['witnessClass']==code for p in pixel_rows),
                        'independentFractions':expected.tolist(),'accumulatedFractions':histogram[z,x].tolist(),
                        'quantizedBytes':quantized[z,x].tolist(),'maxAbsAreaFractionError':error})
    with open(ROOT/'source-witness-pixels.csv','w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(pixel_rows[0]));writer.writeheader();writer.writerows(pixel_rows)
    write_json('source-witnesses.json',{'channelOrder':CODES,'witnesses':records,
                'scope':'Independent scalar rectangle overlap per actual source pixel at five selected mixed cells; same frozen raw DEFLATE decoder/bytes. Not a separate whole-COG software stack.'})
    return max(p['maxAbsAreaFractionError'] for p in records)

def run(check_only=False):
    oracle=small_oracles()
    if check_only:
        print(json.dumps(oracle));return
    start=time.perf_counter()
    assert not (ROOT/'worldcover-cells-wcv1.bin').exists(),'Refuse implicit preprocessing rerun'
    freeze=json.loads((ROOT/'pre-run-freeze.json').read_text())
    for name,expected in freeze['sha256'].items():
        assert digest((ROOT/name).read_bytes())==expected,f'Pre-run freeze mismatch: {name}'
    assert digest((ROOT/'source-prefix-64k.bin').read_bytes())==PREFIX_SHA
    metadata=json.loads((ROOT/'source-metadata.json').read_text());main=metadata['levels'][0]
    assert metadata['head']['headers']['ETag']==ETAG
    assert (main['width'],main['height'],main['bitsPerSample'],main['compression'],main['predictor'],main['tileWidth'],main['tileHeight'])==(36000,36000,8,8,1,1024,1024)
    assert main['noData']=='0' and main['pixelScale']==[1/12000,1/12000,0]
    plan=roi(metadata);write_json('roi-plan.json',plan)
    downloaded=download(metadata,plan)
    reader=RawReader(plan,downloaded)
    hist=np.zeros((SIDE,SIDE,CHANNELS),dtype=np.float64)
    native_counts=np.zeros(CHANNELS,dtype=np.int64)
    x0,y0,x1,y1=plan['pixelBoundsHalfOpen']
    for i,tile in enumerate(plan['tiles']):
        native=reader.tile(tile['id'])
        sx,sy=tile['x']*TILE,tile['y']*TILE
        ax,bx=max(x0,sx),min(x1,sx+TILE);ay,by=max(y0,sy),min(y1,sy+TILE)
        cropped=native[ay-sy:by-sy,ax-sx:bx-sx]
        assert np.all(LUT[cropped]<CHANNELS)
        native_counts+=np.bincount(LUT[cropped].ravel(),minlength=CHANNELS)
        accumulate(hist,cropped,np.arange(ax,bx),np.arange(ay,by),lambda j:boundaries(j,KX),lambda j:boundaries(j,KY))
        if (i+1)%50==0:print(f'Aggregated {i+1}/300 source blocks',flush=True)
        if peak_rss_bytes()>MEMORY_LIMIT_BYTES:
            raise MemoryError('256MiB peak budget exceeded; preserve diagnostics, no automatic rerun')
    closure=hist.sum(axis=-1)
    assert np.isfinite(hist).all() and hist.min()>=0 and hist.max()<=1+1e-9
    closure_error=float(np.max(abs(closure-1)))
    assert closure_error<1e-9
    fractions=np.empty((SIDE,SIDE,CHANNELS),dtype=np.uint8)
    max_quantization=0.
    class_areas=hist.sum(axis=(0,1))*SPACING**2
    for row in range(0,SIDE,32):
        a=hist[row:row+32]
        q=quantize(a);fractions[row:row+32]=q
        max_quantization=max(max_quantization,float(np.max(abs(q.astype(float)/255-a/a.sum(axis=-1,keepdims=True)))))
    assert max_quantization<=1/255+1e-12
    witness_error=source_witnesses(hist,fractions,reader)
    payload=struct.pack('<4sIddd',b'WCV1',SIDE,SPACING,MINIMUM,MINIMUM)+fractions.tobytes(order='C')
    assert len(payload)==32+SIDE*SIDE*CHANNELS
    compressed=gzip.compress(payload,compresslevel=9,mtime=0)
    (ROOT/'worldcover-cells-wcv1.bin').write_bytes(payload)
    (ROOT/'worldcover-cells-wcv1.bin.gz').write_bytes(compressed)
    class_qarea=fractions.sum(axis=(0,1),dtype=np.uint64)/255*SPACING**2
    report={'status':'CPU_PREPROCESSED_NOT_RENDERED_NOT_ADOPTED','sourceUrl':metadata['url'],'sourceETag':ETAG,
            'sourceWholeObjectSha256':'NOT_COMPUTED_ONLY_BOUNDED_RANGES_DOWNLOADED',
            'schemaSha256':digest((ROOT/'schema.json').read_bytes()),'scriptSha256':digest(Path(__file__).read_bytes()),
            'protocolSha256':digest((ROOT/'PROTOCOL.md').read_bytes()),
            'rangeManifestSha256':digest((ROOT/'ranges-manifest.json').read_bytes()),
            'sourceBlockCount':300,'sourcePixelCountIncludingPartialEdges':int(native_counts.sum()),
            'sourceNativeBoundingBoxPixels':int((x1-x0)*(y1-y0)),
            'classOrder':CODES,'classAreasProjectedKm2':class_areas.tolist(),'quantizedClassAreasProjectedKm2':class_qarea.tolist(),
            'classAreaQuantizationDeltaKm2':(class_qarea-class_areas).tolist(),
            'nativeBoundingBoxClassPixelCounts':native_counts.tolist(),
            'positiveOutputCellsPerClass':np.count_nonzero(fractions,axis=(0,1)).tolist(),
            'coverageSumMaxAbsErrorBeforeQuantization':closure_error,'quantizationMaxAbsFractionError':max_quantization,
            'allCellByteSums255':bool(np.all(fractions.astype(np.uint16).sum(axis=-1)==255)),
            'independentSmallOracle':oracle,'fiveActualSourceWitnessMaxError':witness_error,
            'asset':{'path':'worldcover-cells-wcv1.bin','bytes':len(payload),'sha256':digest(payload),
                     'gzipPath':'worldcover-cells-wcv1.bin.gz','gzipBytes':len(compressed),'gzipSha256':digest(compressed),'gzipMtime':0},
            'peakRssBytes':peak_rss_bytes(),'peakBudgetBytes':MEMORY_LIMIT_BYTES,
            'elapsedSeconds':time.perf_counter()-start,'pythonVersion':sys.version,'numpyVersion':np.__version__,
            'scope':'Exact rectangular overlaps in frozen local equirectangular plane (up to float64 arithmetic), not geodesic or terrain-surface area.',
            'limitations':['Class10 includes orchards/plantations and tree cover>=10%; not certified natural forest or physical canopy density.',
                           'Class60 includes bare soil, sand, rock and sparse vegetation; not geological rock classification.',
                           'Classes40 cropland and50 built-up retained distinctly; no conversion to forest.',
                           'NoData0 is separate from permanent-water80; do not silently turn missing data into ocean.',
                           'WorldCover2021 categorical classification has errors; no current ground truth claim.',
                           'No product integration, height change, GPU/browser/FPS or artistic acceptance.']}
    assert report['peakRssBytes']<=MEMORY_LIMIT_BYTES
    write_json('result.json',report)
    print(json.dumps({'status':report['status'],'asset':report['asset'],'classAreasKm2':report['classAreasProjectedKm2'],
                      'closureError':closure_error,'quantizationError':max_quantization,'sourceWitnessError':witness_error,
                      'peakRssMiB':report['peakRssBytes']/1024**2,'elapsedSeconds':report['elapsedSeconds']}),flush=True)

if __name__=='__main__':
    try:run('--check-only' in sys.argv)
    except Exception as error:
        write_json('failure.json',{'status':'STOP_NO_AUTOMATIC_RERUN','error':type(error).__name__,
                  'message':str(error),'scriptSha256':digest(Path(__file__).read_bytes())})
        raise
