from pathlib import Path
import hashlib,json,struct,math,array,heapq,os
base=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/narrow-cloud')
cache=base.parent/'rain-work/data';out=base/'gpu-audit';out.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
expected={'cloudShader.before.ts':'d80225521258edb4beed2e713afe3c6b97fad5eca79d7dcdc657f9f47c1deddd','cloudShader.after.ts':'b1dde880c8cc572dfebcf30825035c8c028925e75da52be05a64f214bbafbe93','narrow-r8.bin':'ad38c2b581882a0686e3d81031e0972fbd1cc0fb4bb9dab09c43451387e418ad'}
for n,h in expected.items():assert sha((base/n).read_bytes())==h,n
raw=(cache/'macro-rgba8.bin').read_bytes();assert sha(raw)=='72e3f360b81f3c8f812800cc309a174ce893d96c80e666c9bf98fca178187b9f'
before=(base/'cloudShader.before.ts').read_text();after=(base/'cloudShader.after.ts').read_text()
guard='let narrowIndex=min(vec3<u32>(floor(clamp(coord,vec3<f32>(0.0),vec3<f32>(1.0))*vec3<f32>(narrowDimensions))),narrowDimensions-vec3<u32>(1u));'
warp='let warp=(fine.gbr-vec3<f32>(0.5))*mix(vec3<f32>(0.16,0.12,0.16),vec3<f32>(0.08,0.02,0.1),ice);'
macro='let warped=textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r;'
assert guard in after and warp in after and macro in after and warp in before and macro in before
f=lambda v:struct.unpack('<f',struct.pack('<f',v))[0]
def adj(v,d):
 v=f(v)
 if v==0:return struct.unpack('<f',struct.pack('<I',1 if d>0 else 0x80000001))[0]
 bits=struct.unpack('<I',struct.pack('<f',v))[0];bits+=1 if (v>0)==(d>0) else -1
 return struct.unpack('<f',struct.pack('<I',bits))[0]
R=raw[::4];positive=[];boundary=[];count=0
for i,b in enumerate(R):
 if not b:continue
 count+=1
 if count%1682==1 and len(positive)<512:positive.append(i)
 h=((i*1664525+1013904223)&0xffffffff)
 if h%32:continue
 x=i%256;y=(i//256)%256;z=i//65536
 if any(R[j]==0 for j in [i-1 if x else i,i+1 if x<255 else i,i-256 if y else i,i+256 if y<255 else i,i-65536 if z else i,i+65536 if z<255 else i]):
  heapq.heappush(boundary,(-h,i))
  if len(boundary)>256:heapq.heappop(boundary)
boundary=[i for h,i in sorted(boundary,reverse=True)]
assert count==861511 and len(positive)==512 and len(boundary)>=128
extent=[10,8.5,7];signs=[(-1 if k&1 else 1,-1 if k&2 else 1,-1 if k&4 else 1) for k in range(8)]
groups=[]
def build_queries(name,indices,fixture=False):
 q=array.array('f');counts={}
 def add(coord,fine,ice,group):
  if group not in groups:groups.append(group)
  q.extend([*coord,ice,*fine,float(groups.index(group))]);counts[group]=counts.get(group,0)+1
 def center(i):return [((i%256)+.5)/256,(((i//256)%256)+.5)/256,((i//65536)+.5)/256]
 def warped_coord(target,sgn,ice):
  # Solve local from requested macro coordinate using the same authored warp amplitude.
  fine=[1 if sgn[2]>0 else 0,1 if sgn[0]>0 else 0,1 if sgn[1]>0 else 0]
  amps=[.16-.08*ice,.12-.10*ice,.16-.06*ice]
  W=[sgn[a]*.5*amps[a] for a in range(3)]
  return [target[a]-W[a]/extent[a] for a in range(3)],fine
 for i in indices:
  c=center(i)
  for ice in [0,.5,1]:
   for s in signs:
    co,fi=warped_coord(c,s,ice);add(co,fi,ice,'positive-macro-centres')
 surface=indices if fixture else boundary
 for i in surface[:(len(surface) if fixture else 64)]:
  c=center(i)
  for axis in range(3):
   for direction in [-1,1]:
    target=c.copy();target[axis]+=direction*.98/256
    for ice in [0,.5,1]:
     for s in signs:
      co,fi=warped_coord(target,s,ice);add(co,fi,ice,'near-macro-footprint-axis')
 for i in surface[:(len(surface) if fixture else 32)]:
  c=center(i)
  for off in signs:
   target=[c[a]+off[a]*.8/256 for a in range(3)]
   for ice in [0,.5,1]:
    for s in signs:
     co,fi=warped_coord(target,s,ice);add(co,fi,ice,'near-macro-footprint-diagonal')
 for i in surface[:(len(surface) if fixture else 64)]:
  c=center(i)
  for axis in range(3):
   b=round(c[axis]*128)/128
   for value in [adj(b,-1),b,adj(b,1)]:
    co=c.copy();co[axis]=value
    for ice in [0,.5,1]:
     for s in signs:
      fi=[1 if s[2]>0 else 0,1 if s[0]>0 else 0,1 if s[1]>0 else 0]
      add(co,fi,ice,'f32-around-narrow-cell-boundaries')
 if not fixture:
  edges=[-1/128,0,adj(0,1),.5/128,1-.5/128,adj(1,-1),1,1+1/128]
  for axis in range(3):
   for edge in edges:
    for along in [.1,.5,.9]:
     co=[along,along,along];co[axis]=edge
     for ice in [0,.5,1]:
      for s in signs:add(co,[1 if s[2]>0 else 0,1 if s[0]>0 else 0,1 if s[1]>0 else 0],ice,'domain-clamp-faces-and-outside')
  def halton(i,b):
   v=0;w=1/b
   while i:v+=(i%b)*w;i//=b;w/=b
   return v
  for i in range(1,2049):
   co=[halton(i,2),halton(i,3),halton(i,5)]
   for ice in [0,.5,1]:add(co,[halton(i,7),halton(i,11),halton(i,13)],ice,'halton-volume')
 b=q.tobytes();filename=name+'-queries-f32.bin';(out/filename).write_bytes(b)
 return {'name':name,'queryFile':filename,'queryCount':len(q)//8,'queryBytes':len(b),'querySha256':sha(b),'groups':counts,'selectedMacroIndices':indices}
real=build_queries('real',positive)
# Sparse synthetic edge/face/corner and minimum-code inputs; no generated cloud.
positions=[(0,0,0),(255,255,255),(0,128,128),(255,128,128),(128,0,128),(128,255,128),(128,128,0),(128,128,255),(64,64,64),(191,191,191),(0,255,128),(255,0,128)]
entries=[{'index':(z*256+y)*256+x,'R':1 if k%2==0 else 255} for k,(x,y,z) in enumerate(positions)]
fixture=build_queries('sparse-fixture',[e['index'] for e in entries],True);fixture['entries']=entries
fixtureRaw=bytearray(len(raw));fixtureNarrow=bytearray(128**3)
for e in entries:
 i=e['index'];fixtureRaw[i*4]=e['R'];x=i%256//2;y=(i//256)%256//2;z=i//65536//2
 for zz in range(max(0,z-2),min(128,z+3)):
  for yy in range(max(0,y-2),min(128,y+3)):
   for xx in range(max(0,x-2),min(128,x+3)):fixtureNarrow[(zz*128+yy)*128+xx]=255
fixture['macroSha256']=sha(fixtureRaw);fixture['narrowSha256']=sha(fixtureNarrow)
# Symlinks reuse the existing external arrays; no duplicate 66MiB disk cache.
for n,target in [('macro-rgba8.bin',cache/'macro-rgba8.bin'),('narrow-r8.bin',base/'narrow-r8.bin')]:
 p=out/n
 if p.is_symlink():p.unlink()
 assert not p.exists();p.symlink_to(target)
for n in ['cloudShader.before.ts','cloudShader.after.ts']:(out/n).write_bytes((base/n).read_bytes())
shader='''struct Query { coordIce:vec4<f32>, fineGroup:vec4<f32> };
struct Result { sampled:vec4<f32>, indexIce:vec4<f32>, warpedCoord:vec4<f32> };
@group(0) @binding(0) var volume:texture_3d<f32>;
@group(0) @binding(1) var volumeSampler:sampler;
@group(0) @binding(2) var narrowCloud:texture_3d<f32>;
@group(0) @binding(3) var<storage,read> queries:array<Query>;
@group(0) @binding(4) var<storage,read_write> results:array<Result>;
@compute @workgroup_size(64)
fn auditNarrow(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=arrayLength(&queries)){return;}
 let coord=queries[id.x].coordIce.xyz;
 let ice=queries[id.x].coordIce.w;
 let fine=vec4<f32>(queries[id.x].fineGroup.xyz,1.0);
 let narrowDimensions=textureDimensions(narrowCloud,0);
 '''+guard+'''
 let narrowValue=textureLoad(narrowCloud,vec3<i32>(narrowIndex),0).r;
 '''+warp+'\n '+macro+'''
 results[id.x].sampled=vec4<f32>(narrowValue,warped,select(0.0,1.0,narrowValue==0.0&&warped>0.0),select(0.0,1.0,narrowValue==0.0&&warped>=0.002));
 results[id.x].indexIce=vec4<f32>(vec3<f32>(narrowIndex),ice);
 results[id.x].warpedCoord=vec4<f32>(coord+warp/vec3<f32>(10.0,8.5,7.0),queries[id.x].fineGroup.w);
}
'''
(out/'audit.wgsl').write_text(shader)
manifest={'kind':'prepared-narrow-cloud-raw-gpu-audit','gpuStatus':'not-run','sourcePin':expected,'macroSha256':sha(raw),'macroBytes':len(raw),'narrowBytes':128**3,
 'narrowSha256':expected['narrow-r8.bin'],'shaderSha256':sha(shader.encode()),'guardExact':guard,'warpExact':warp,'macroExact':macro,'groups':groups,'datasets':[real,fixture],
 'scope':'Pure post-flow coord guard and original macro sampler/warp. No flow compute, ray sequence, material erosion, radiance, Three.js pipeline or FPS equivalence. Real original data plus sparse synthetic fixture reuses same GPU textures.',
 'textureMemoryBytes':len(raw)+128**3,'newBakes':0,'realPositiveMacroVertices':count,'boundarySelectionCount':len(boundary)}
(out/'inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'prepare-audit.py').write_bytes(Path(__file__).read_bytes())
print(json.dumps({'directory':str(out),'realQueries':real['queryCount'],'fixtureQueries':fixture['queryCount'],'groups':groups,'gpuStatus':'not-run','newBakes':0}))
