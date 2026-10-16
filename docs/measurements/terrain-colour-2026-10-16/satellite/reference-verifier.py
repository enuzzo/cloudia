"""Independent bounded stdlib verifier. No model rerun, numpy or network.

Checks payload/input hashes, gzip originals, F32 ranges and five scalar actual
pixel/area witnesses. It does not independently reconstruct all4M output cells.
"""
from pathlib import Path
import argparse,hashlib,json,gzip,struct,zlib,math,csv,ast
p=argparse.ArgumentParser();p.add_argument('--archive-root',type=Path,default=Path(__file__).resolve().parent)
p.add_argument('--r1-root',type=Path);p.add_argument('--output',type=Path);args=p.parse_args()
r=args.archive_root.resolve();inputs=json.loads((r/'r2-inputs.json').read_text());base=args.r1_root or Path(inputs['r1Root'])
def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def json_read(path):return json.loads(path.read_text())
manifest=json_read(r/'artifact-manifest.json')
for entry in manifest['files']:
    path=r/entry['path'];assert path.stat().st_size==entry['bytes'] and sha(path)==entry['sha256'],entry['path']
for name,expected in inputs['r1FrozenSha256'].items():assert sha(base/name)==expected,name
freeze=json_read(r/'pre-run-freeze.json')
for name,expected in freeze['sha256'].items():assert sha(r/name)==expected,name
source=json_read(r/'inputs.json')
for key in ['worldcover','worldcoverWitnesses']:assert sha(Path(source[key]['path']))==source[key]['sha256'],key
ranges=json_read(r/'ranges-manifest-r1.json');assert sum(x['bytes'] for x in ranges['ranges'])==71091595
for entry in ranges['ranges']:
    path=base/entry['path'];assert path.stat().st_size==entry['bytes'] and sha(path)==entry['sha256']
    assert entry['httpStatus']==206 and entry['headers']['Content-Range']==entry['expectedContentRange']
assert len(ranges['ranges'])==4 and sum(len(e['selectedBlocks']) for e in ranges['ranges'])==24
result=json_read(r/'result.json')
for entry in [result['rgb'],result['validity']]:
    assert sha(r/entry['path'])==entry['sha256'] and sha(r/entry['gzipPath'])==entry['gzipSha256']
    with open(r/entry['gzipPath'],'rb') as f:
        header=f.read(10);assert header[:2]==b'\x1f\x8b' and header[4:8]==bytes(4)
    count=0
    with gzip.open(r/entry['gzipPath'],'rb') as a,open(r/entry['path'],'rb') as b:
        while True:
            aa=a.read(1024*1024);bb=b.read(1024*1024);assert aa==bb
            count+=len(aa)
            if not aa:break
    assert count==entry['bytes']
# Stream every F32 cell without ndarray allocations or reprojecting sources.
count=zero=partial=under=0;validsum=0.;rgbmax=0.
with open(r/'rgb-linear.f32','rb') as rf,open(r/'valid-area.f32','rb') as vf:
    while True:
        vb=vf.read(65536*4);rb=rf.read(65536*3*4)
        if not vb:assert not rb;break
        vs=list(struct.iter_unpack('<f',vb));rs=struct.iter_unpack('<fff',rb)
        for (v,),rgb in zip(vs,rs):
            assert math.isfinite(v) and 0<=v<=1
            assert all(math.isfinite(q) and 0<=q<=1 for q in rgb)
            if v==0:assert rgb==(0.,0.,0.)
            count+=1;zero+=v==0;partial+=0<v<1;under+=v<.99;validsum+=v;rgbmax=max(rgbmax,*rgb)
assert count==2048**2
vs=result['validityStats'];assert zero==vs['zeroCells'] and partial==vs['partialCells'] and under==vs['cellsUnder99percent']
assert abs(validsum/count-vs['mean'])<1e-10
# Independent scalar Predictor2 for only the rows/pixels recorded in the witness.
entries={}
for entry in ranges['ranges']:
    lat=int(entry['key'].split('/N')[1][:2]);lon=int(entry['key'].split('_N')[1].split('E')[1][:3])
    for tile in entry['selectedBlocks']:entries[lat,lon,tile['tileId']]=(entry,tile)
cache={};rows={}
def pixel(col,row):
    lon=9+col//3000;lat=44-row//3000;x=col%3000;y=row%3000;key=lat,lon,(y//1024)*3+x//1024
    entry,tile=entries[key]
    if key not in cache:
        cache.clear()
        with open(base/entry['path'],'rb') as f:f.seek(tile['offset']-entry['rangeStart']);compressed=f.read(tile['bytes'])
        body=zlib.decompress(compressed);assert len(body)==1024*1024*4*2;cache[key]=body
    body=cache[key];offset=(y%1024)*1024*4*2
    values=struct.unpack_from('<'+'H'*((x%1024+1)*4),body,offset)
    channels=[0,0,0,0]
    for at,value in enumerate(values):channels[at%4]=(channels[at%4]+value)%65536
    return channels
witnesses=json_read(r/'source-witnesses.json')['witnesses'];by_name={w['name']:w for w in witnesses}
assert (r/'source-witnesses.json').read_bytes()==(base/'source-witnesses.json').read_bytes()
assert (r/'source-witness-pixels.csv').read_bytes()==(base/'source-witness-pixels.csv').read_bytes()
weighted={w['name']:[0.,0.,0.,0.,0.] for w in witnesses};pixels=0;maxweightdiff=0.
KZ=111.1950802335;KX=KZ*math.cos(math.radians(44));S=.0625
with open(r/'source-witness-pixels.csv',newline='') as f:
    for record in csv.DictReader(f):
        col,row=int(record['sourceCol']),int(record['sourceRow']);raw=pixel(col,row)
        assert raw==[int(record[k]) for k in ['Rdn','Gdn','Bdn','NIRdn']]
        w=by_name[record['witness']];x,z=w['x'],w['z'];xa=-64+x*S;za=-64+z*S
        u0=(10-(xa+S)/KX-9)*3000;u1=(10-xa/KX-9)*3000
        v0=(45-(44+(za+S)/KZ))*3000;v1=(45-(44+za/KZ))*3000
        area=max(0,min(col+1,u1)-max(col,u0))*max(0,min(row+1,v1)-max(row,v0))/((u1-u0)*(v1-v0))
        maxweightdiff=max(maxweightdiff,abs(area-float(record['areaFraction'])));assert abs(area-float(record['areaFraction']))<1e-12
        valid=all(1<=q<=10000 for q in raw);assert valid==bool(int(record['valid']))
        q=weighted[w['name']];q[4]+=area
        if valid:
            q[3]+=area
            for c in range(3):q[c]+=raw[c]*.0001*area
        pixels+=1
maxmeanerror=0.;output_f32_bits=True
for w in witnesses:
    q=weighted[w['name']];mean=[v/q[3] if q[3] else 0 for v in q[:3]]
    error=max(abs(a-b) for a,b in zip(mean,w['independentConditionalMeanRGB']));assert error<2e-10;maxmeanerror=max(maxmeanerror,error)
    assert abs(q[3]-w['validity'])<2e-10 and abs(q[4]-1)<2e-10
    with open(r/'rgb-linear.f32','rb') as f:f.seek((w['z']*2048+w['x'])*12);actual=f.read(12)
    assert actual==struct.pack('<fff',*w['productionConditionalMeanRGB'])
    with open(r/'valid-area.f32','rb') as f:f.seek((w['z']*2048+w['x'])*4);v=struct.unpack('<f',f.read(4))[0]
    assert abs(v-q[3])<=2**-24
# Verify exact untouched operation bodies, not just a textual assertion.
a=(r/'preprocess-sentinel2.r1.py.frozen').read_text();b=(r/'preprocess-sentinel2.py').read_text()
def funcs(s):return {n.name:ast.get_source_segment(s,n) for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)}
af,bf=funcs(a),funcs(b);names=['decode_predictor2','segments','valid_native','accumulate','brute','synthetic_oracle','diagnostics']
assert all(af[n]==bf[n] for n in names)
report={'status':'PASS_OFFLINE_HASH_GZIP_FULL_F32_SCAN_AND_FIVE_ACTUAL_SCALAR_WITNESSES',
 'payloadFilesVerified':len(manifest['files']),'r1FrozenFilesVerified':len(inputs['r1FrozenSha256']),
 'sourceRangeBytesVerified':71091595,'sourceBlocksReferenced':24,'gzipOriginalByteComparisons':2,
 'float32CellsScanned':count,'rgbMaximum':rgbmax,'validityCountsMatch':True,'actualWitnesses':len(witnesses),
 'actualSourcePixelsDecodedScalar':pixels,'maximumAreaWeightDifference':maxweightdiff,'maximumIndependentMeanDifference':maxmeanerror,
 'actualOutputWitnessRGBf32BitsMatch':output_f32_bits,'r1WitnessFilesByteIdentical':True,'unchangedOperationBodies':names,
 'limits':['The 50 recorded source pixels are independently decoded with scalar Predictor2; full 24-block geographic aggregation is not independently replayed.',
 'All output F32 values and gzip originals are verified, but full output is not compared to R1 because R1 failed before writing it.',
 'No physical albedo, cloud classification, renderer, GPU or FPS qualification is implied.']}
encoded=json.dumps(report,indent=2)+'\n'
if args.output:args.output.write_text(encoded)
print(encoded,end='')
