from pathlib import Path
import json,hashlib,math,time
P=Path(__file__).resolve().parent
started=time.process_time()
protocol=json.loads((P/'PROTOCOL.json').read_text())
raw=(P/protocol['input']).read_bytes()
assert hashlib.sha256(raw).hexdigest()==protocol['inputSHA256']
x=json.loads(raw);rows=x['rows']
assert [r['id'] for r in rows]==protocol['rowsExactly']
L=x['frame']['light'];C=L['center'];S=L['sun'];R=L['right'];U=L['up'];N=L['resolution'];radius=L['radiusKm'];bias=.001
assert N==2048 and radius==64 and L['constants']['baseBiasKm']==bias
EPS=protocol['consistencyToleranceKm']
def dot(a,b):return sum(i*j for i,j in zip(a,b))
def project(p):
 v=[p[i]-C[i] for i in range(3)]
 return [.5+dot(v,R)/(2*radius),.5-dot(v,U)/(2*radius),dot(v,S)]
def planeQ(tri,u,v):
 a,b,c=tri
 den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
 assert abs(den)>0
 wa=((b[1]-c[1])*(u-c[0])+(c[0]-b[0])*(v-c[1]))/den
 wb=((c[1]-a[1])*(u-c[0])+(a[0]-c[0])*(v-c[1]))/den
 return wa*a[2]+wb*b[2]+(1-wa-wb)*c[2],[wa,wb,1-wa-wb]
def clip(poly,axis,bound,sign):
 if not poly:return []
 out=[];a=poly[-1];da=sign*(a[axis]-bound);ia=da>=0
 for b in poly:
  db=sign*(b[axis]-bound);ib=db>=0
  if ia!=ib:
   t=da/(da-db);assert 0<=t<=1
   q=[a[k]+t*(b[k]-a[k]) for k in range(3)]
   q[axis]=bound
   out.append(q)
  if ib:out.append(b[:])
  a,da,ia=b,db,ib
 # Exact duplicate removal only; no epsilon changes of coverage or q.
 clean=[]
 for q in out:
  if not clean or q!=clean[-1]:clean.append(q)
 if len(clean)>1 and clean[0]==clean[-1]:clean.pop()
 return clean
def area(poly):return .5*abs(sum(poly[i][0]*poly[(i+1)%len(poly)][1]-poly[(i+1)%len(poly)][0]*poly[i][1] for i in range(len(poly))))
result=[]
for row in rows:
 tri=[project(v) for v in row['caster']['vertices']]
 i,j=row['baselineLookup']['pixel'];u0,u1=i/N,(i+1)/N;v0,v1=j/N,(j+1)/N
 lookup=row['baselineLookup']['heightKm'];old=row['caster']['storedMinimumKm']
 fullTriangleMin=min(p[2] for p in tri)-bias
 bounds1=max(old,fullTriangleMin)
 poly=tri;stages=[]
 for axis,bound,sign,name in [(0,u0,1,'u>=u0'),(0,u1,-1,'u<=u1'),(1,v0,1,'v>=v0'),(1,v1,-1,'v<=v1')]:
  poly=clip(poly,axis,bound,sign);stages.append({'plane':name,'vertices':len(poly)})
 assert len(poly)>=3 and area(poly)>0,row['id']
 assert all(all(math.isfinite(v) for v in p) for p in poly)
 for p in poly:
  assert u0-1e-15<=p[0]<=u1+1e-15 and v0-1e-15<=p[1]<=v1+1e-15
  q,_=planeQ(tri,p[0],p[1]);assert abs(q-p[2])<=EPS,'q interpolation drift'
 exact=min(p[2] for p in poly)-bias
 cornerQ=[planeQ(tri,u,v)[0] for u,v in [(u0,v0),(u1,v0),(u1,v1),(u0,v1)]]
 wholeTexelPlane=min(cornerQ)-bias
 assert abs(wholeTexelPlane-old)<=EPS,'frozen affine minimum/corners mismatch'
 assert exact+EPS>=bounds1>=old
 centreQ,baryCentre=planeQ(tri,(i+.5)/N,(j+.5)/N)
 assert abs(centreQ-row['caster']['qCentreKm'])<=EPS
 assert min(baryCentre)>=-1e-9,'centre winner point not in caster triangle'
 lu,lv=row['baselineLookup']['uv'];lookupPlaneQ,lookupBary=planeQ(tri,lu,lv)
 physical=row['physicalSunRay']['blocker']
 blockerQ=project(physical['point'])[2] if physical else None
 receiverQ=project(row['receiver']['point'])[2]
 fade=row['shadow']['coverageFade']
 variants={}
 for name,stored in [('baselineAffineTexel',old),('fullTriangleClamp',bounds1),('clippedTriangleTexel',exact)]:
  rawVisibility=1 if lookup>=stored else 0
  variants[name]={'storedMinimumKm':stored,'deltaStoredVsBaselineM':(stored-old)*1000,'lookupMinusStoredM':(lookup-stored)*1000,
   'rawVisibility':rawVisibility,'finalVisibility':rawVisibility+(1-rawVisibility)*fade,
   'litDespiteSavedPhysicalBlocker':physical is not None and rawVisibility==1,
   'blockerQMinusStoredM':(blockerQ-stored)*1000 if blockerQ is not None else None}
 assert variants['fullTriangleClamp']['rawVisibility']<=variants['baselineAffineTexel']['rawVisibility']
 assert variants['clippedTriangleTexel']['rawVisibility']<=variants['fullTriangleClamp']['rawVisibility']
 result.append({'id':row['id'],'casterFace':row['caster']['faceIndex'],'receiverFace':row['receiver']['faceIndex'],
  'triangleUVQ':tri,'triangleVertexQKm':[p[2] for p in tri],'minimumTriangleVertexQKm':fullTriangleMin+bias,
  'addressedPixel':[i,j],'texelUVBounds':[u0,v0,u1,v1],'clippingStages':stages,'intersectionPolygonUVQ':poly,'polygonVertices':len(poly),'polygonAreaUV2':area(poly),'texelAreaCoverageFraction':area(poly)*N*N,
  'wholeTexelAffineReconstructedKm':wholeTexelPlane,'wholeTexelCornerQKm':cornerQ,'centreBarycentric':baryCentre,
  'lookup':{'qKm':lookup,'uv':[lu,lv],'casterPlaneQAtLookupKm':lookupPlaneQ,'barycentricInCasterTriangle':lookupBary,'insideCasterTriangle':min(lookupBary)>=0},
  'variants':variants,'physicalReference':{'blockerPresent':physical is not None,'blockerFace':physical['faceIndex'] if physical else None,'sameTriangleAsCaster':physical['faceIndex']==row['caster']['faceIndex'] if physical else None,
   'blockerQKm':blockerQ,'receiverQKm':receiverQ,'blockerQMinusReceiverQM':(blockerQ-receiverQ)*1000 if blockerQ is not None else None,'blockerQMinusLookupQM':(blockerQ-lookup)*1000 if blockerQ is not None else None,
   'qualification':'Saved physical ray follows original receiver line; q gaps do not compare identical UV rays and are not a physical-error bound of a texture sample.'}})
counts={name:{'shadowed':sum(r['variants'][name]['rawVisibility']==0 for r in result),'litWithPhysicalBlocker':sum(r['variants'][name]['litDespiteSavedPhysicalBlocker'] for r in result)} for name in ['baselineAffineTexel','fullTriangleClamp','clippedTriangleTexel']}
out={'status':'OFFLINE_SIX_RECORD_ANALYSIS_COMPLETE_NO_GPU_PROPOSAL','inputSHA256':protocol['inputSHA256'],'rowCount':len(result),'CPUSeconds':time.process_time()-started,
 'scope':'Float64 minimum of saved winning caster affine triangle restricted to its addressed texel; exact in real arithmetic with Float64 residual checks, not exact GPU raster visibility','biasKm':bias,'consistencyToleranceKm':EPS,'visibilityToleranceKm':0,'counts':counts,'rows':result}
print(json.dumps(out,indent=2))
