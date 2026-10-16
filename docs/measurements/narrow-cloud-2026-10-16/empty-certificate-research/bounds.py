"""Light arithmetic only: endpoint-bound flow Jacobian, no volume/cache read or GPU."""
from pathlib import Path
import math,json,itertools,hashlib
p=Path(__file__).parent
# Fixed baseline pose metadata, already preserved in work-32x18.json.
wind=[0.2642000615596771,0.09009438008069992];growth=[1,1,1]
extent=[10,8.5,7];Nflow=16;Nmask=128
A=[.42,.82,.34]
# Two binary16 ulps at the component cap: leaves room beyond round-to-nearest
# half conversion for a small pre-write arithmetic overshoot. No sampler-error claim.
halfULP=[2**-12,2**-11,2**-12];Aguard=[a+2*u for a,u in zip(A,halfULP)]
B=[[2*Aguard[i]*Nflow/extent[j] for j in range(3)] for i in range(3)]
kmax=1.5/6.2
# Below iceStart, J_reference is affine in shear derivative k, 0<=k<=kmax.
def referenceJ(k):
 gx,gy,ga=growth
 return [[gy,-gy*wind[0]*k,0],[0,gx,0],[0,-gy*wind[1]*k,gy]]
def rowTimes(v,J):return [sum(v[j]*J[j][k] for j in range(3)) for k in range(3)]
rows=[];witness=[]
for i in range(3):
 best=-1;case=None
 # ||(e_i-gradFlow_i)J||2 is convex in each box component and k; maximum
 # is attained among these vertices. Each possible actual trilinear derivative
 # lies inside the endpoint-derived box, so independent signs are pessimistic.
 for k in [0,kmax]:
  J=referenceJ(k)
  for signs in itertools.product([-1,1],repeat=3):
   v=[(1 if j==i else 0)-signs[j]*B[i][j] for j in range(3)]
   row=rowTimes(v,J);norm=math.sqrt(sum(t*t for t in row))
   if norm>best:best=norm;case={'shearSlope':k,'gradientSigns':signs,'worldDerivativeRow':row}
 rows.append(best);witness.append(case)
Jinf=max(sum(abs(v) for v in row) for row in referenceJ(kmax))
LinfLoose=(1+max(sum(row) for row in B))*Jinf
L=max(rows);hmin=min(v/Nmask for v in extent)
localGuard=.001
radii=[{'D':d,'emptyLocalRadiusKm':(d-1)*hmin,'worldHWith1mGuardKm':max(0,((d-1)*hmin-localGuard)/L),
 'following6mPointsPossibleUpper':max(0,math.ceil(max(0,((d-1)*hmin-localGuard)/L)/.006)-1)} for d in [1,2,3,4,8,16]]
report={'kind':'pessimistic-trilinear-flow-empty-certificate-bound','newBakes':0,'gpuExecuted':False,
 'windF32':wind,'growthF32':growth,'thermalCapsKm':A,'halfULPKm':halfULP,'endpointCapsWithGuardKm':Aguard,
 'flowCellKm':[v/Nflow for v in extent],'componentPartialDerivativeBounds':B,
 'localWorldRowNormBounds':rows,'rowWitnesses':witness,'LinfLoose':LinfLoose,'selectedL_worldL2_to_localLinf':L,
 'minimumMaskCellKm':hmin,'radiusExamples':radii,
 'scope':'Analytic endpoint-bound ideal clamped trilinear sampler, constant frame, below iceStart. No claim of a numerical bound for native filtered flow or its GPU compute half endpoints. No real-point counter or BFS performed by this script.'}
report['scriptSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(p/'bounds.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
