"""Original bounded S2 RGBNIR overview4 exact-area reconstruction, one run.

Float32 RGB surface-reflectance reference, separate valid-area fraction. Not albedo.
"""
from pathlib import Path
import numpy as np
import json,math,hashlib,struct,zlib,gzip,time,sys,resource,csv

ROOT=Path(__file__).resolve().parent
SOURCE_RANGE_ROOT=ROOT.with_name("sentinel2-reference")
STRIPE_ROWS=32
SIDE=2048;SPACING=.0625;MIN=-64.;KZ=111.1950802335;KX=KZ*math.cos(math.radians(44))
TILE=1024;CHANNELS=4;DECODED_BYTES=TILE*TILE*CHANNELS*2
RSS_CAP=384*1024**2;DOWNLOAD_CAP=80000000;SCALE=.0001
CLASS_CODES=[0,10,20,30,40,50,60,70,80,90,95,100]
Y_WEIGHTS=np.array([.2126,.7152,.0722])

def sha(data):return hashlib.sha256(data).hexdigest()
def file_sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def write_json(name,value):(ROOT/name).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')
def rss():
    value=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return value if sys.platform=='darwin' else value*1024
def memory_gate():
    assert rss()<=RSS_CAP,f'PeakRSS{rss()} exceeds384MiB; preserve failure, no automatic retry'

def decode_predictor2(compressed,rows=TILE,cols=TILE):
    """TIFF horizontal differencing operates on each16-bit sample modulo65536."""
    expected=rows*cols*4*2;obj=zlib.decompressobj()
    b=obj.decompress(compressed,expected+1)
    assert obj.eof and not obj.unused_data and len(b)==expected
    data=np.frombuffer(b,dtype='<u2').reshape(rows,cols,4).copy()
    np.add.accumulate(data,axis=1,dtype=np.uint16,out=data)
    return data

def segments(indices,transform,side):
    a=transform(np.asarray(indices,dtype=float));b=transform(np.asarray(indices,dtype=float)+1)
    lo=np.maximum(0,np.minimum(a,b));hi=np.minimum(side,np.maximum(a,b))
    first=np.floor(lo).astype(np.int32)
    assert np.max(abs(a-b))<1
    return [(first,np.maximum(0,np.minimum(hi,first+1)-lo)),
            (first+1,np.maximum(0,hi-np.maximum(lo,first+1)))]

def valid_native(raw):return np.all((raw>=1)&(raw<=10000),axis=-1)

def accumulate(hist,raw,source_x,source_z,tx,tz):
    """Hist channels=RGB valid weighted sums, valid area, all-source geometry area."""
    valid=valid_native(raw)
    for cz,wz in segments(source_z,tz,hist.shape[0]):
        rows=np.flatnonzero(wz>0)
        if not len(rows):continue
        zz=cz[rows];assert zz.min()>=0 and zz.max()<hist.shape[0]
        for cx,wx in segments(source_x,tx,hist.shape[1]):
            cols=np.flatnonzero(wx>0)
            if not len(cols):continue
            xx=cx[cols];assert xx.min()>=0 and xx.max()<hist.shape[1]
            x0,x1=int(xx.min()),int(xx.max())+1;z0,z1=int(zz.min()),int(zz.max())+1
            width,height=x1-x0,z1-z0
            ids=((zz[:,None]-z0).astype(np.int64)*width+xx[None,:]-x0).ravel()
            weights=wz[rows,None]*wx[None,cols]
            selected=raw[np.ix_(rows,cols)]
            weights_valid=weights*valid[np.ix_(rows,cols)]
            for channel in range(5):
                if channel<3:w=weights_valid*(selected[...,channel]*SCALE)
                elif channel==3:w=weights_valid
                else:w=weights
                partial=np.bincount(ids,w.ravel(),minlength=width*height)
                hist[z0:z1,x0:x1,channel]+=partial.reshape(height,width)

def brute(raw,tx,tz,side):
    """Independent exhaustive target-cell/source-pixel rectangles, scalar RGB."""
    out=np.zeros((side,side,5))
    for z in range(side):
        for x in range(side):
            for i in range(raw.shape[0]):
                za,zb=sorted([float(tz(i)),float(tz(i+1))]);dz=max(0,min(z+1,zb)-max(z,za))
                for j in range(raw.shape[1]):
                    xa,xb=sorted([float(tx(j)),float(tx(j+1))]);dx=max(0,min(x+1,xb)-max(x,xa));w=dx*dz
                    if not w:continue
                    out[z,x,4]+=w
                    pixel=[int(v) for v in raw[i,j]]
                    if all(1<=v<=10000 for v in pixel):
                        out[z,x,3]+=w
                        for c in range(3):out[z,x,c]+=w*pixel[c]*SCALE
    return out

def synthetic_oracle():
    original=np.array([[[0,1,65535,9],[65535,4,0,12],[1,65535,40000,2]],
                       [[5,7,11,13],[2,1,65535,65535],[65535,0,1,14]]],dtype=np.uint16)
    # Scalar original encoder, including overflow and row reset.
    encoded=np.empty_like(original)
    for r in range(2):
        for x in range(3):
            for c in range(4):encoded[r,x,c]=(int(original[r,x,c])-(int(original[r,x-1,c]) if x else 0))%65536
    packed=zlib.compress(encoded.astype('<u2').tobytes())
    decoded=decode_predictor2(packed,2,3);assert np.array_equal(decoded,original)
    # A second scalar decoder directly over uint16 values, independent of numpy accumulate.
    words=struct.unpack('<'+'H'*encoded.size,zlib.decompress(packed));scalar=[]
    for r in range(2):
        prev=[0]*4
        for x in range(3):
            for c in range(4):prev[c]=(words[(r*3+x)*4+c]+prev[c])%65536;scalar.append(prev[c])
    assert np.array_equal(np.array(scalar).reshape(2,3,4),original)
    raw=(np.arange(7*9*4).reshape(7,9,4)*31%9000+500).astype(np.uint16)
    raw[1,2]=0;raw[3,4,2]=0;raw[5,7,3]=12000
    tx=lambda q:4.37-np.asarray(q)*.57;tz=lambda q:4.22-np.asarray(q)*.71
    expected=brute(raw,tx,tz,4);single=np.zeros_like(expected);partitioned=np.zeros_like(expected)
    accumulate(single,raw,np.arange(9),np.arange(7),tx,tz)
    for y in range(0,7,3):
        for x in range(0,9,4):
            a=raw[y:y+3,x:x+4]
            accumulate(partitioned,a,np.arange(x,x+a.shape[1]),np.arange(y,y+a.shape[0]),tx,tz)
    assert np.max(abs(single-expected))<1e-12 and np.max(abs(partitioned-expected))<1e-12
    assert np.max(abs(expected[...,4]-1))<1e-12
    return {'status':'PASS','predictor2Samples':24,'uint16OverflowAndRowReset':True,
      'scalarDecoderMatches':True,'rectangleCells':16,'sourcePixels':63,
      'singleMaxAbsError':float(abs(single-expected).max()),'partitionedMaxAbsError':float(abs(partitioned-expected).max()),
      'validAwareCases':'allzero,onechannelzero,NIR>10000; exclusionsaffectvalidareaandRGBonly,geometrycoverageunchanged',
      'scope':'Synthetic scalar predictor and rectangle oracle, not a second full external GeoTIFF stack'}

def verify_local_ranges(plan):
    """No network path: reuse the exact four immutable R1 bodies after SHA checks."""
    source=json.loads((ROOT/'r2-inputs.json').read_text())
    assert str(SOURCE_RANGE_ROOT)==source['r1Root']
    for name,expected in source['r1FrozenSha256'].items():
        assert file_sha(SOURCE_RANGE_ROOT/name)==expected,f'R1 frozen drift {name}'
    manifest=json.loads((SOURCE_RANGE_ROOT/'ranges-manifest.json').read_text())
    assert len(manifest['ranges'])==len(plan['ranges'])==4
    assert manifest['totalBytes']==plan['plannedBytesTotal']==71091595
    verified=[]
    for record,planned in zip(manifest['ranges'],plan['ranges']):
        for key in ['key','rangeStart','rangeEndInclusive','etag','expectedContentRange','selectedBlocks']:
            assert record[key]==planned[key],f'Range plan mismatch {key}'
        path=SOURCE_RANGE_ROOT/record['path']
        assert record['httpStatus']==206 and record['bytes']==record['rangeEndInclusive']-record['rangeStart']+1
        assert path.stat().st_size==record['bytes'] and file_sha(path)==record['sha256']
        verified.append({'path':str(path),'bytes':record['bytes'],'sha256':record['sha256'],
          'etag':record['etag'],'contentRange':record['expectedContentRange']})
    write_json('local-range-verification.json',{'status':'FOUR_LOCAL_R1_RANGES_SHA_PASS_NO_NETWORK',
      'totalBytes':sum(r['bytes'] for r in verified),'ranges':verified})
    return manifest

class Reader:
    def __init__(self,manifest):
        self.entries={};self.cache={}
        for r in manifest['ranges']:
            lat=int(r['key'].split('/N')[1][:2]);lon=int(r['key'].split('_N')[1].split('E')[1][:3])
            for t in r['selectedBlocks']:self.entries[(lat,lon,t['tileId'])]=(r,t)
    def tile(self,lat,lon,tile):
        r,t=self.entries[lat,lon,tile]
        with open(SOURCE_RANGE_ROOT/r['path'],'rb') as f:f.seek(t['offset']-r['rangeStart']);b=f.read(t['bytes'])
        assert len(b)==t['bytes'];return decode_predictor2(b)
    def pixel(self,col,row):
        lon=9+col//3000;lat=44-row//3000;x=col%3000;z=row%3000;key=(lat,lon,(z//TILE)*3+x//TILE)
        if key not in self.cache:
            if len(self.cache)==2:self.cache.pop(next(iter(self.cache)))
            self.cache[key]=self.tile(*key)
        return self.cache[key][z%TILE,x%TILE]

def maximum_partial_cell(hist):
    # Strict comparison preserves np.argmax's first row-major tie across stripes.
    best=-float('inf');best_x=best_z=0
    for row in range(0,hist.shape[0],STRIPE_ROWS):
        v=hist[row:row+STRIPE_ROWS,...,3];score=v*(1-v)
        offset=int(np.argmax(score));value=float(score.flat[offset])
        if value>best:
            local_z,local_x=np.unravel_index(offset,score.shape)
            best=value;best_x=int(local_x);best_z=int(row+local_z)
    return best_x,best_z

def actual_witnesses(hist,reader,inputs):
    prior=json.loads(Path(inputs['worldcoverWitnesses']['path']).read_text())['witnesses']
    selected=[]
    for w in prior:
        if w['selectedBoundaryClass'] in [10,40,50,60]:selected.append((f'class{w["selectedBoundaryClass"]}quarter',2*w['outputX']+1,2*w['outputZ']+1))
    x,z=maximum_partial_cell(hist)
    selected.append(('maximumPartialValidity',int(x),int(z)))
    records=[];pixels=[]
    for name,x,z in selected:
        xa=MIN+x*SPACING;xb=xa+SPACING;za=MIN+z*SPACING;zb=za+SPACING
        u0=(10-xb/KX-9)*3000;u1=(10-xa/KX-9)*3000;v0=(45-(44+zb/KZ))*3000;v1=(45-(44+za/KZ))*3000
        expected=np.zeros(5);n=0
        for row in range(math.floor(v0),math.ceil(v1)):
            for col in range(math.floor(u0),math.ceil(u1)):
                weight=max(0,min(col+1,u1)-max(col,u0))*max(0,min(row+1,v1)-max(row,v0))/((u1-u0)*(v1-v0))
                raw=[int(v) for v in reader.pixel(col,row)];valid=all(1<=v<=10000 for v in raw)
                expected[4]+=weight
                if valid:expected[3]+=weight;expected[:3]+=np.array(raw[:3])*SCALE*weight
                pixels.append({'witness':name,'sourceCol':col,'sourceRow':row,'Rdn':raw[0],'Gdn':raw[1],'Bdn':raw[2],'NIRdn':raw[3],'valid':int(valid),'areaFraction':weight});n+=1
        error=float(abs(expected-hist[z,x]).max());assert error<2e-10
        mean=expected[:3]/expected[3] if expected[3]>0 else np.zeros(3)
        native=hist[z,x,:3]/hist[z,x,3] if hist[z,x,3]>0 else np.zeros(3)
        assert np.max(abs(mean-native))<2e-10
        records.append({'name':name,'x':x,'z':z,'worldCentreKm':[xa+SPACING/2,za+SPACING/2],
          'latitude':44+(za+SPACING/2)/KZ,'longitude':10-(xa+SPACING/2)/KX,
          'sourcePixels':n,'validity':float(expected[3]),'independentConditionalMeanRGB':mean.tolist(),
          'productionConditionalMeanRGB':native.tolist(),'maxWeightedSumAbsError':error,
          'partialValidityActuallyObserved':bool(0<expected[3]<1-1e-12)})
    with open(ROOT/'source-witness-pixels.csv','w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(pixels[0]));writer.writeheader();writer.writerows(pixels)
    write_json('source-witnesses.json',{'status':'PASS','witnesses':records,
      'scope':'Fiveactualcells,independentscalaroverlaps;samefrozenDEFLATEdecoder,notaseparateGeoTIFFstack'})
    reader.cache.clear();return records

def write_histogram_outputs(hist):
    """Identical per-cell divide/cast, streaming 32 rows without full F32 arrays."""
    import contextlib
    names=['rgb-linear.f32','valid-area.f32'];hashes=[hashlib.sha256(),hashlib.sha256()]
    max_round=0.
    with contextlib.ExitStack() as stack:
        raw=[stack.enter_context(open(ROOT/name,'xb')) for name in names]
        files=[stack.enter_context(open(ROOT/(name+'.gz'),'xb')) for name in names]
        compressed=[stack.enter_context(gzip.GzipFile(filename='',mode='wb',compresslevel=9,fileobj=f,mtime=0)) for f in files]
        for row in range(0,len(hist),STRIPE_ROWS):
            h=hist[row:row+STRIPE_ROWS];mean=np.zeros(h[...,:3].shape)
            np.divide(h[...,:3],h[...,3,None],out=mean,where=h[...,3,None]>0)
            rgb=np.asarray(mean,dtype='<f4');valid=np.asarray(np.clip(h[...,3],0,1),dtype='<f4')
            max_round=max(max_round,float(abs(mean-rgb).max()))
            for index,array in enumerate([rgb,valid]):
                b=array.tobytes(order='C');hashes[index].update(b);raw[index].write(b);compressed[index].write(b)
            memory_gate()
    assert max_round<=2**-24
    outputs=[]
    for name,h in zip(names,hashes):
        path=ROOT/name;compressed=ROOT/(name+'.gz')
        outputs.append({'path':name,'bytes':path.stat().st_size,'sha256':h.hexdigest(),'gzipPath':name+'.gz',
          'gzipBytes':compressed.stat().st_size,'gzipSha256':file_sha(compressed),'gzipMtime':0})
    return outputs[0],outputs[1],max_round

def r2_memory_oracle():
    # The old full-array conversion and new stripe conversion must produce the
    # exact same F32 bits, including zero-valid cells and a partial-validity tie.
    h=np.arange(69*7*5,dtype=float).reshape(69,7,5)/100000
    h[...,3]=np.arange(69*7).reshape(69,7)%7/7
    h[2,3,3]=h[40,4,3]=.5
    score=h[...,3]*(1-h[...,3]);z,x=np.unravel_index(np.argmax(score),score.shape)
    assert maximum_partial_cell(h)==(int(x),int(z))==(3,2)
    mean=np.zeros(h[...,:3].shape);np.divide(h[...,:3],h[...,3,None],out=mean,where=h[...,3,None]>0)
    whole_rgb=np.asarray(mean,dtype='<f4');whole_valid=np.asarray(np.clip(h[...,3],0,1),dtype='<f4')
    parts_rgb=[];parts_valid=[]
    for row in range(0,len(h),STRIPE_ROWS):
        a=h[row:row+STRIPE_ROWS];m=np.zeros(a[...,:3].shape)
        np.divide(a[...,:3],a[...,3,None],out=m,where=a[...,3,None]>0)
        parts_rgb.append(np.asarray(m,dtype='<f4').tobytes());parts_valid.append(np.asarray(np.clip(a[...,3],0,1),dtype='<f4').tobytes())
    assert b''.join(parts_rgb)==whole_rgb.tobytes() and b''.join(parts_valid)==whole_valid.tobytes()
    return {'status':'PASS','cells':69*7,'rowsPerStripe':STRIPE_ROWS,'float32BitIdentityAgainstWholeArray':True,
      'partialValidityFirstTiePreserved':True,'scope':'Small memory-orchestration oracle; full output R1 never existed'}

def diagnostics(rgb,valid,cover):
    # Sampled palette masks are frozen, independent of results. Classes are area
    # labels, not physical canopy density; complete RGB image remains unmasked.
    lattice=rgb[2::4,2::4].astype(float);v=valid[2::4,2::4]
    yy=lattice@Y_WEIGHTS;minimum=lattice.min(axis=-1);spread=lattice.max(axis=-1)-minimum
    cloud=(minimum>=.25)&(spread<=.12);dark=yy<.02;bright=yy>.60
    q=cover[1::2,1::2] # every4th62.5mcell maps to every2nd125mparent
    forbidden=(q[...,0].astype(np.uint16)+q[...,4]+q[...,5]+q[...,8])/255
    palette=[]
    for code in [10,20,30,60]:
        class_weight=q[...,CLASS_CODES.index(code)]/255
        pure=class_weight>=.95;clean=(forbidden<=.01)&(v>=.99)&~cloud&~dark&~bright
        mask=pure&clean;sample=lattice[mask];luminance=yy[mask]
        n=len(sample)
        entry={'classCode':code,'latticeCandidates':int(pure.sum()),'acceptedSamples':n,'status':'PASS_SAMPLE_COUNT' if n>=256 else 'LOW_N_NO_PALETTE_RECOMMENDATION',
          'excludedNotFullyValid':int(np.count_nonzero(pure&(v<.99))),
          'excludedForbiddenClass':int(np.count_nonzero(pure&(forbidden>.01))),
          'excludedDark':int(np.count_nonzero(pure&dark)),'excludedBright':int(np.count_nonzero(pure&bright)),
          'excludedCloudSnowSuspect':int(np.count_nonzero(pure&cloud))}
        if n:
            c=sample/luminance[:,None];median=np.median(c,axis=0);median/=median@Y_WEIGHTS
            entry.update(linearRGBmedian=np.median(sample,axis=0).tolist(),luminanceMedian=float(np.median(luminance)),
              chromaticityY1median=median.tolist(),chromaticityP10=np.quantile(c,.1,axis=0).tolist(),chromaticityP90=np.quantile(c,.9,axis=0).tolist())
        palette.append(entry)
    # Full-field suspicious area is a heuristic diagnostic, not cloud truth.
    global_counts={'cloudSnowSuspectCells':0,'darkCells':0,'brightCells':0,'visualGain3ClippedChannels':0}
    for row in range(0,SIDE,64):
        a=rgb[row:row+64];vv=valid[row:row+64]>0;lum=a@Y_WEIGHTS
        global_counts['cloudSnowSuspectCells']+=int(np.count_nonzero(vv&(a.min(axis=-1)>=.25)&((a.max(axis=-1)-a.min(axis=-1))<=.12)))
        global_counts['darkCells']+=int(np.count_nonzero(vv&(lum<.02)))
        global_counts['brightCells']+=int(np.count_nonzero(vv&(lum>.60)))
        global_counts['visualGain3ClippedChannels']+=int(np.count_nonzero(a*3>1))
    def seam(axis):
        if axis==1:a,b=rgb[:,1023],rgb[:,1024];mask=(valid[:,1023]>=.99)&(valid[:,1024]>=.99)
        else:a,b=rgb[1023],rgb[1024];mask=(valid[1023]>=.99)&(valid[1024]>=.99)
        delta=np.max(abs(a-b),axis=-1)[mask]
        controls=[]
        for edge in list(range(1016,1023))+list(range(1025,1032)):
            aa,bb=(rgb[:,edge-1],rgb[:,edge]) if axis==1 else (rgb[edge-1],rgb[edge])
            m=((valid[:,edge-1]>=.99)&(valid[:,edge]>=.99)) if axis==1 else ((valid[edge-1]>=.99)&(valid[edge]>=.99))
            controls.extend(np.max(abs(aa-bb),axis=-1)[m].tolist())
        def summary(a):return {'count':len(a),'median':float(np.median(a)),'p95':float(np.quantile(a,.95)),'max':float(np.max(a))} if len(a) else {'count':0}
        return {'boundary':summary(delta),'nearbyParallelControls':summary(controls),'scope':'Adjacentcellsnotidenticalground;diagnosticnotproofseamcausedcalibration'}
    write_json('palette-and-diagnostics.json',{'palette':palette,'globalHeuristics':global_counts,'seams':{'x0_lon10':seam(1),'z0_lat44':seam(0)},
      'maskProtocol':'latticex,z=2mod4;valid>=.99;class>=.95;sum0/40/50/80<=.01;Yin[.02,.60];excludegraybrightcloudheuristicminRGB>=.25andspread<=.12;lowN<256',
      'limits':'Heuristicsnotcloudclassifier;noSCL/QAoracquisitionangleavailablehere.Tree10includesorchards;coarse125mclassescancontaminate37mRGBfootprints.Palettechromaticityisnotalbedo.'})
    return palette,global_counts

def run(check=False):
    oracle=synthetic_oracle();memory_oracle=r2_memory_oracle()
    if check:print(json.dumps({"original":oracle,"r2Memory":memory_oracle}));return
    start=time.perf_counter();assert not (ROOT/'run-started.json').exists(),'Refuse R2 rerun'
    write_json('run-started.json',{'status':'ONE_AUTHORIZED_R2_ATTEMPT_STARTED','startedAtUnix':time.time()})
    freeze=json.loads((ROOT/'pre-run-freeze.json').read_text())
    for name,expected in freeze['sha256'].items():assert file_sha(ROOT/name)==expected,f'Frozeninputdrift{name}'
    inputs=json.loads((ROOT/'inputs.json').read_text())
    for key in ['worldcover','worldcoverWitnesses']:assert file_sha(inputs[key]['path'])==inputs[key]['sha256']
    plan=json.loads((ROOT/'overview4-range-plan.json').read_text());downloaded=verify_local_ranges(plan)
    reader=Reader(downloaded);hist=np.zeros((SIDE,SIDE,5),dtype=np.float64)
    global_x0=math.floor((10-64/KX-9)*3000);global_x1=math.ceil((10+64/KX-9)*3000)
    global_z0=math.floor((45-(44+64/KZ))*3000);global_z1=math.ceil((45-(44-64/KZ))*3000)
    raw_stats={'contributingNativePixels':0,'allChannelsZero':0,'anyChannelZero':0,'anyChannelAbove10000':0,'validPixels':0,'minimumDN':[65535]*4,'maximumDN':[0]*4}
    for r in downloaded['ranges']:
        lat=int(r['key'].split('/N')[1][:2]);lon=int(r['key'].split('_N')[1].split('E')[1][:3])
        for t in r['selectedBlocks']:
            block=reader.tile(lat,lon,t['tileId']);tile_x=t['tileId']%3;tile_z=t['tileId']//3
            sx=(lon-9)*3000+tile_x*TILE;sz=(44-lat)*3000+tile_z*TILE
            ax=max(global_x0,sx);bx=min(global_x1,sx+TILE,(lon-8)*3000)
            az=max(global_z0,sz);bz=min(global_z1,sz+TILE,(45-lat)*3000)
            assert ax<bx and az<bz
            a=block[az-sz:bz-sz,ax-sx:bx-sx]
            raw_stats['contributingNativePixels']+=a.shape[0]*a.shape[1]
            raw_stats['allChannelsZero']+=int(np.count_nonzero(np.all(a==0,axis=-1)))
            raw_stats['anyChannelZero']+=int(np.count_nonzero(np.any(a==0,axis=-1)))
            raw_stats['anyChannelAbove10000']+=int(np.count_nonzero(np.any(a>10000,axis=-1)))
            raw_stats['validPixels']+=int(np.count_nonzero(valid_native(a)))
            raw_stats['minimumDN']=np.minimum(raw_stats['minimumDN'],a.min(axis=(0,1))).tolist()
            raw_stats['maximumDN']=np.maximum(raw_stats['maximumDN'],a.max(axis=(0,1))).tolist()
            accumulate(hist,a,np.arange(ax,bx),np.arange(az,bz),
              lambda q:(KX*(1-np.asarray(q)/3000)+64)/SPACING,
              lambda q:(KZ*(1-np.asarray(q)/3000)+64)/SPACING)
            memory_gate();print(f'Aggregated {lat}/{lon}/block {t["tileId"]}',flush=True)
    del a,block
    coverage_error=0.
    for row in range(0,SIDE,STRIPE_ROWS):
        h=hist[row:row+STRIPE_ROWS]
        assert np.isfinite(h).all() and h.min()>=0
        coverage_error=max(coverage_error,float(np.max(abs(h[...,4]-1))))
        assert h[...,3].max()<=1+1e-9
    del h
    assert coverage_error<1e-9
    witnesses=actual_witnesses(hist,reader,inputs)
    equal={}
    for name in ['source-witnesses.json','source-witness-pixels.csv']:
        equal[name]=file_sha(ROOT/name)==file_sha(SOURCE_RANGE_ROOT/name)
        assert equal[name],f'R2 witness byte mismatch {name}'
    rgb_asset,valid_asset,max_round=write_histogram_outputs(hist)
    del hist,reader;memory_gate()
    report={'status':'R2_PREPROCESS_PASS_ANALYSIS_PENDING_NOT_ALBEDO_NOT_GPU_ADOPTION',
      'scriptSha256':file_sha(Path(__file__)),'protocolSha256':file_sha(ROOT/'PROTOCOL.md'),
      'inputsSha256':file_sha(ROOT/'inputs.json'),'r2InputsSha256':file_sha(ROOT/'r2-inputs.json'),
      'localRangeVerificationSha256':file_sha(ROOT/'local-range-verification.json'),
      'syntheticOracle':oracle,'r2MemoryOracle':memory_oracle,'r1WitnessByteIdentity':equal,
      'rgb':rgb_asset,'validity':valid_asset,'dimensions':[SIDE,SIDE],'spacingKm':SPACING,'domainKm':[-64,-64,64,64],
      'encoding':'raw little-endian Float32, row-major Z south to north / X east to west, RGB interleaved; RGB conditional mean of valid source area; separate valid-area fraction; zero color when validity is zero',
      'sourceBandOrder':['B04Red','B03Green','B02Blue','B08NIR'],'sourceDNScale':SCALE,'sourceDNOffset':0,
      'rawSourceStats':raw_stats,'geometryCoverageMaxAbsError':coverage_error,'float32RGBMaxRoundingAbsError':max_round,
      'actualWitnessMaxWeightedSumError':max(w['maxWeightedSumAbsError'] for w in witnesses),
      'actualPartialValidityWitnessObserved':any(w['partialValidityActuallyObserved'] for w in witnesses),
      'peakRssBytes':rss(),'peakBudgetBytes':RSS_CAP,'elapsedSeconds':time.perf_counter()-start,
      'pythonVersion':sys.version,'numpyVersion':np.__version__,
      'operationOrder':'Same 24 blocks and float64 accumulation as R1; only validation/argmax and F32 serialization striped, analysis separate after exit',
      'r1Status':'FAIL_RSS_488144896_BYTES_NO_FULL_OUTPUT_EXISTED',
      'limits':['L2A annual median observed surface reflectance, not view/sun independent albedo.',
        'Overview resampling metadata unknown; source pixel mean DN/NoData behavior needs qualification before original native optical sampling.',
        'Zero DN or out-of-range invalidity is conservative and can exclude very dark valid surfaces; separate coverage preserved.',
        'No height, product, backend, GPU, build or FPS change; photoreal goal not declared achieved.']}
    memory_gate();write_json('preprocess-result.json',report)
    print(json.dumps({'status':report['status'],'rgb':rgb_asset,'validity':valid_asset,'coverageError':coverage_error,
      'rawStats':raw_stats,'r1WitnessByteIdentity':equal,'peakMiB':rss()/1024**2,'elapsedSeconds':report['elapsedSeconds']}),flush=True)

if __name__=='__main__':
    try:run('--check-only' in sys.argv)
    except Exception as error:
        write_json('failure.json',{'status':'STOP_NO_AUTOMATIC_RERUN','error':type(error).__name__,'message':str(error),'scriptSha256':file_sha(Path(__file__))})
        raise
