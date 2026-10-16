"""One exact R-byte extraction + bounded finite queries; never generates cloud data."""
from pathlib import Path
import hashlib,json,struct,shutil
OUT=Path(__file__).resolve().parent
BASE=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work')
SHA='72e3f360b81f3c8f812800cc309a174ce893d96c80e666c9bf98fca178187b9f'
sha=lambda b:hashlib.sha256(b).hexdigest()
macro=(BASE/'data/macro-rgba8.bin').read_bytes()
assert len(macro)==256**3*4 and sha(macro)==SHA
red=macro[::4];assert len(red)==256**3
(OUT/'macro-rgba8.bin').write_bytes(macro);(OUT/'density-r8.bin').write_bytes(red)
snap=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle11/rain-cache-audit/source-snapshots/cloudShader.ts').read_bytes()
assert sha(snap)=='b24ce50ad82609723b1f083a2195c07baf388309a3e3cfa102d9b8abef953e3d'
assert b'let warped=textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r;' in snap
(OUT/'cloudShader.v46.ts').write_bytes(snap)
f=lambda x:struct.unpack('<f',struct.pack('<f',x))[0]
def nextf(x,delta):
 b=struct.unpack('<I',struct.pack('<f',x))[0];return struct.unpack('<f',struct.pack('<I',b+delta))[0]
state=0x7a1db347
def rnd():
 global state
 state=(1664525*state+1013904223)&0xffffffff;return state/2**32
def halton(n,b):
 r=0;s=1
 while n:s/=b;r+=s*(n%b);n//=b
 return r
queries=[];groups={}
def add(q,g):
 assert all(abs(v)<1e20 for v in q);queries.append((*map(f,q),float(g)));groups[g]=groups.get(g,0)+1
positive=[];zeros=[]
for i in range(65536):
 x,y,z=[int(rnd()*256) for _ in range(3)];idx=(z*256+y)*256+x
 if red[idx]>0 and len(positive)<512:positive.append((x,y,z))
 if red[idx]==0 and len(zeros)<512:zeros.append((x,y,z))
 if len(positive)==len(zeros)==512:break
assert len(positive)==len(zeros)==512
for g,points in [(1,positive),(2,zeros)]:
 for p in points:add([(v+.5)/256 for v in p],g)
for z in range(16):
 for y in range(16):
  for x in range(16):add([(v*16+8.5)/256 for v in [x,y,z]],3)
for i in range(4096):add([halton(i+1,b) for b in [2,3,5]],4)
for i in range(32768):add([rnd()*1.04-.02 for _ in range(3)],5)
for i in range(512):
 p=[int(rnd()*256) for _ in range(3)];q=[(v+.5)/256 for v in p]
 for axis in range(3):
  for v in [nextf(q[axis],-1),q[axis],nextf(q[axis],1),p[axis]/256]:
   t=q.copy();t[axis]=v;add(t,6)
edge=[-16,-.01,-2**-24,0,2**-24,nextf(.5/256,-1),.5/256,nextf(.5/256,1),.5,nextf(1-.5/256,-1),1-.5/256,nextf(1-.5/256,1),nextf(1,-1),1,nextf(1,1),1.01,16]
for z in edge:
 for y in edge:
  for x in edge:add([x,y,z],7)
raw=b''.join(struct.pack('<4f',*q) for q in queries);(OUT/'real-queries-f32.bin').write_bytes(raw)
small=[]
for i in range(4096):small.append((*[f(halton(i+1,b)*1.02-.01) for b in [2,3,5]],8.0))
for p in [(0,0,0),(1,1,1),(-16,.5,16),(.5,.5,.5)]:small.append((*map(f,p),9.0))
for z in range(16):
 for y in range(16):
  for x in range(16):small.append(((x+.5)/16,(y+.5)/16,(z+.5)/16,10.0))
rawsmall=b''.join(struct.pack('<4f',*q) for q in small);(OUT/'fixture-queries-f32.bin').write_bytes(rawsmall)
fixtures=[]
for name,mode in [('zero-r-varying-gba','zero'),('one-r-varying-gba','one'),('ramp-checker-varying-gba','pattern')]:
 rgba=bytearray(16**3*4)
 for z in range(16):
  for y in range(16):
   for x in range(16):
    i=(z*16+y)*16+x;r=0 if mode=='zero' else 255 if mode=='one' else (x*17+y*31+z*47+((x^y^z)&1)*113)%256
    rgba[i*4:i*4+4]=bytes([r,(x*53+y*11+71)%256,(z*29+y*79+193)%256,(i*43+17)%256])
 r8=bytes(rgba[::4]);(OUT/(name+'-rgba.bin')).write_bytes(rgba);(OUT/(name+'-r8.bin')).write_bytes(r8)
 fixtures.append({'name':name,'size':16,'rgbaFile':name+'-rgba.bin','r8File':name+'-r8.bin','queryFile':'fixture-queries-f32.bin','queryCount':len(small),'expectedConstant':0 if mode=='zero' else 1 if mode=='one' else None})
datasets=[{'name':'real-seed72','size':256,'rgbaFile':'macro-rgba8.bin','r8File':'density-r8.bin','queryFile':'real-queries-f32.bin','queryCount':len(queries),'expectedConstant':None},*fixtures]
files={}
for name in {d[k] for d in datasets for k in ['rgbaFile','r8File','queryFile']}|{'audit.wgsl','cloudShader.v46.ts'}:
 b=(OUT/name).read_bytes();files[name]={'bytes':len(b),'sha256':sha(b)}
m={'kind':'density-r8-sampler-audit-inputs','newBakes':0,'criterion':'Exact equality of f32 output bit patterns; all finite differences reported even if zero absolute difference with differing bits. Finite dataset only, not universal equivalence.','source':{'originalPath':str(BASE/'data/macro-rgba8.bin'),'macroSHA256':SHA,'exactRExtraction':'density[i]=macro[4*i], order x+256*(y+256*z)','v46ShaderSHA256':sha(snap),'shaderSnapshotScope':'Frozen v46 sampler reference, not the future densityR8 candidate or a Three compiled pipeline.'},'datasets':datasets,'files':files,'queryLayout':{'strideBytes':16,'components':'u,v,w,group all little-endian f32'},'outputLayout':{'strideBytes':48,'samplesF32ByteOffset':0,'bitsU32ByteOffset':16,'echoF32ByteOffset':32},'groups':{str(k):{'queries':v,'description':{1:'512 exact positive texel centres',2:'512 exact zero texel centres',3:'16-cubed stratified texel centres',4:'Halton domain',5:'deterministic random near/outside domain',6:'f32 ULP neighbours of centres + interpolation planes',7:'Cartesian faces/edges/OOB clamp',8:'fixture Halton/OOB',9:'fixture endpoint probes',10:'all fixture texel centres'}[k]} for k,v in groups.items()},'fixtureGroups':[8,9,10],'textureContract':{'dimension':'3d','mipLevelCount':1,'formats':['rgba8unorm','r8unorm'],'usages':['TEXTURE_BINDING','COPY_DST'],'sampler':{'addressModeUVW':'clamp-to-edge','minFilter':'linear','magFilter':'linear','mipmapFilter':'nearest'},'level':0},'memory':{'realTexturePayloadBytes':256**3*5,'fixtureTexturePayloadBytes':16**3*5,'queryBuffers':'16N input +48N storage output +48N+16 readback +16 counters; textures released between datasets'},'cpuPreparation':'Bounded input extraction/query preparation, no volume generation. R identity is byte-exact; that alone does not qualify native sampler equivalence.'}
(OUT/'inputs.json').write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps({'realQueries':len(queries),'fixtureQueriesEach':len(small),'allQueries':len(queries)+3*len(small),'densityBytes':len(red),'densitySHA':sha(red),'macroSHA':SHA,'inputSHA':sha((OUT/'inputs.json').read_bytes())},indent=2))
