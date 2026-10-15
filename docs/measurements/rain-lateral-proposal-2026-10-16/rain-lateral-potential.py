"""Cheap geometric potential only: no volume bake, GPU, density integration or renderer."""
from pathlib import Path
import json,math,hashlib,time
ROOT=Path('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle9')
started=time.perf_counter()
data=(ROOT/'rainmap-seed72-rg8.bin').read_bytes()
meta=json.loads((ROOT/'rainmap-seed72-audit.json').read_text())
control=json.loads((ROOT/'control-rain-30s.json').read_text())
assert len(data)==8192 and hashlib.sha256(data).hexdigest()==meta['mapSha256']
size=64;dx,dz=10/size,7/size
state=meta['motionAt60'];width=state['state']['width'];wind=state['wind'];drift=state['drift']
points=[]
for z in range(size):
 for x in range(size):
  if data[(z*size+x)*2]==0:continue
  centre=(-5+(x+.5)*dx,-3.5+(z+.5)*dz)
  # Closed rectangles are a superset of every ideally positive bilinear footprint.
  for sx in [-1,1]:
   for sz in [-1,1]:
    source=(centre[0]+sx*dx,centre[1]+sz*dz)
    for endpoint in [0,2.5]:
     points.append((source[0]*width+wind[0]*endpoint,source[1]*width+wind[1]*endpoint))
normals=[(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]
planes=[(nx,nz,max(nx*x+nz*z for x,z in points)) for nx,nz in normals]
xmin=-planes[1][2];xmax=planes[0][2];zmin=-planes[3][2];zmax=planes[2][2]
def clip(poly,plane):
 nx,nz,c=plane;out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=nx*a[0]+nz*a[1]-c;db=nx*b[0]+nz*b[1]-c
  insideA=da<=0;insideB=db<=0
  if insideA:out.append(a)
  if insideA!=insideB:
   t=da/(da-db);out.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
 return out
def area(poly):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1])))/2
poly=[(xmin,zmin),(xmax,zmin),(xmax,zmax),(xmin,zmax)]
for p in planes[4:]:poly=clip(poly,p)
def hull(points):
 pts=sorted(set(points))
 def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
 lo=[]
 for p in pts:
  while len(lo)>=2 and cross(lo[-2],lo[-1],p)<=0:lo.pop()
  lo.append(p)
 hi=[]
 for p in pts[::-1]:
  while len(hi)>=2 and cross(hi[-2],hi[-1],p)<=0:hi.pop()
  hi.append(p)
 return lo[:-1]+hi[:-1]
def raybox(origin,ray,lo,hi):
 near=0;far=math.inf
 for o,d,a,b in zip(origin,ray,lo,hi):
  if d==0:
   if o<a or o>b:return None
  else:
   aa=(a-o)/d;bb=(b-o)/d;near=max(near,min(aa,bb));far=min(far,max(aa,bb))
   if far<=near:return None
 return near,far
def intersect_planes(origin,ray,interval):
 near,far=interval
 for nx,nz,c in planes[4:]:
  o=nx*origin[0]+nz*origin[2];d=nx*ray[0]+nz*ray[2]
  if d==0:
   if o>c:return None
  elif d>0:far=min(far,(c-o)/d)
  else:near=max(near,(c-o)/d)
  if far<=near:return None
 return near,far
def normalize(v):
 n=math.sqrt(sum(x*x for x in v));return [x/n for x in v]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
camera=control['camera'];worldorigin=camera['origin'];target=camera['target']
fwd=normalize([b-a for a,b in zip(worldorigin,target)]);right=normalize(cross(fwd,[0,1,0]));up=normalize(cross(right,fwd))
origin=[o-d for o,d in zip(worldorigin,drift)]
lo=[xmin,-4.75,zmin];hi=[xmax,2.8,zmax]
cloudlo=control['supportBounds']['min'];cloudhi=control['supportBounds']['max']
screenW,screenH=64,36;aspect=control['output'][0]/control['output'][1];tanFov=.2867;inspection=camera['approach']
total=excluded=outsideCloudProxy=0;hit=whole=partial=0;examples=[]
for y in range(screenH):
 for x in range(screenW):
  sx=((x+.5)/screenW*2-1)*aspect*tanFov
  sy=(1-(y+.5)/screenH*2-.16*(1-inspection))*tanFov
  ray=normalize([fwd[i]+right[i]*sx+up[i]*sy for i in range(3)])
  interval=raybox(origin,ray,lo,hi)
  if interval is None:continue
  hit+=1;length=interval[1]-interval[0];total+=length
  inner=intersect_planes(origin,ray,interval)
  gaps=[]
  if inner is None:whole+=1;gaps=[interval]
  else:
   if inner[0]>interval[0]:gaps.append((interval[0],inner[0]))
   if inner[1]<interval[1]:gaps.append((inner[1],interval[1]))
   if gaps:partial+=1
  e=sum(b-a for a,b in gaps);excluded+=e
  c=raybox(origin,ray,cloudlo,cloudhi)
  out=0
  for a,b in gaps:
   overlap=0 if c is None else max(0,min(b,c[1])-max(a,c[0]))
   out+=b-a-overlap
  outsideCloudProxy+=out
  if e>0:examples.append({'grid':[x,y],'ray':ray,'oldRainIntervalKm':interval,'octagonIntervalKm':inner,'lateralEmptyKm':e,'outsideCloudAabbProxyKm':out})
result={'kind':'rain-lateral-cheap-geometric-potential','dateSource':'existing seed72/time60/wind.55',
 'mapSha256':hashlib.sha256(data).hexdigest(),'bakesPerformedByThisScript':0,'gpu':'not-run',
 'method':'Closed full-linear-footprint rectangles of Rbyte>0 nodes, Minkowski extruded by [0,2.5]*wind, support planes for x,z,x+z,x-z. Float64 geometry only; no GPU numerical guard, cloud mask, optical termination or terrain clipping.',
 'planesLocalXZ':planes,'octagonVertices':poly,
 'areasKm2':{'oldAabb':(xmax-xmin)*(zmax-zmin),'eightPlanePrism':area(poly),'exactConvexHullOfFootprintsAndWindSegment':area(hull(points))},
 'fixedPose':{'camera':camera,'wind':wind,'drift':drift,'growthWidth':width,'tanFov':tanFov,'inspection':inspection,'rayGrid':[screenW,screenH],
 'rainBoxIntersectingRays':hit,'wholeRainIntervalExcludedRays':whole,'partialExclusionRays':partial,
 'oldRainLengthSumKm':total,'lateralEmptyLengthSumKm':excluded,'fractionOldRainLengthOutsideOctagon':excluded/total if total else 0,
 'lateralEmptyLengthOutsideCloudAabbProxyKm':outsideCloudProxy,'fractionOldRainLengthOutsideOctagonAndCloudAabbProxy':outsideCloudProxy/total if total else 0,
 'equivalent6mEvaluationsBeforeOpacityOld':total/.006,'equivalent6mEvaluationsBeforeOpacityPotentiallyRainEmpty':excluded/.006,
 'limits':'Geometric opportunity, not actual saved samples. Real batch requires fresh cloud-zero continuous certificate. Existing support AABB only supplies a coarse proxy; actual mask may certify more. Finite grid, no pixel/GPU/FPS qualification.'},
 'examplesLargestGeometricExclusion':sorted(examples,key=lambda e:e['lateralEmptyKm'],reverse=True)[:5],
 'runtimeMs':(time.perf_counter()-started)*1000}
a=result['areasKm2'];a['eightPlaneAreaReductionFraction']=1-a['eightPlanePrism']/a['oldAabb'];a['bestConvexAreaReductionFraction']=1-a['exactConvexHullOfFootprintsAndWindSegment']/a['oldAabb']
(ROOT/'rain-lateral-potential.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'areasKm2':a,'fixedPose':{k:v for k,v in result['fixedPose'].items() if k not in ['camera','limits']},'runtimeMs':result['runtimeMs']},indent=2))
