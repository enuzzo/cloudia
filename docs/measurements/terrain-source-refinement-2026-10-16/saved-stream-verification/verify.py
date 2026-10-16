"""Independent saved-stream arithmetic. No Bun/TS, mesh, DEM interpolation or query."""
from pathlib import Path
from array import array
import json,hashlib,math,heapq,struct,sys,time
P=Path(__file__).resolve().parent
START=time.monotonic(); CHECKS=0

def need(v,msg):
 global CHECKS
 CHECKS+=1
 if not v:raise ValueError(msg)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def close(a,b,msg):need(math.isfinite(a) and math.isfinite(b) and math.isclose(a,b,rel_tol=2e-12,abs_tol=1e-8),msg)
def rms(a,n):return math.sqrt(a/n)
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
freeze=load(P/'PRE-RUN-FREEZE.json')
for x in freeze['inputs']:
 q=Path(x['path']);need(q.stat().st_size==x['bytes'] and sha(q)==x['sha256'],'Frozen verification input drift: '+str(q))
W=Path(freeze['witnessDirectory']);source=Path(freeze['candidateSourceDirectory'])
old=load(W.parent/'geometry-preflight/run/result.json');decision=load(W.parent/'refine-decision-protocol.json')
results={m:load(W/('run-'+m)/'result.json') for m in ['off','on']}
runs={m:load(W/('run-'+m)/'run.json') for m in ['off','on']}
streams={}
for mode in ['off','on']:
 result,run=results[mode],runs[mode];folder=W/('run-'+mode);path=folder/'errors.f64le'
 need(path.stat().st_size==591361*8==result['errorStream']['bytes']==run['validation']['retainedStreamBytes'],'Stream size')
 need(sha(path)==result['errorStream']['sha256']==run['validation']['retainedStreamSHA256'],'Stream hash')
 need(sha(folder/'result.json')==run['resultSHA256']==run['validation']['resultSHA256'],'Result hash')
 need(run['status']=='PASS' and run['terminalObserved'] is True and run['exitCode']==0 and run['budgetPASS'] is True and not run['wallKilled'] and run['error'] is None,'Run terminal status')
 b=run['budget'];close(b['combinedCPUSeconds'],b['childCPUSeconds']+b['wrapperCPUSeconds'],'Combined CPU')
 need(b['combinedCPUSeconds']<=20 and b['wallSeconds']<=40 and b['conservativeSumOfPeakRSSBytes']==b['childPeakRSSBytes']+b['wrapperPeakRSSBytes']<=2**31,'Saved resources')
 data=array('d');data.frombytes(path.read_bytes())
 if sys.byteorder!='little':data.byteswap()
 need(len(data)==591361 and all(math.isfinite(x) for x in data),'Finite stream elements')
 streams[mode]=data
 need(result['measurementQueries']==591361 and result['plan']['nodes']==591361 and result['sourceManifestSHA256']==decision['candidateSourceManifestSHA256'],'Node/source identity')
 need(run['preflight']['sourceFilesVerified']==run['preflight']['sourceFilesReverifiedAfter']==126,'Saved source checks')
 need(run['preflight']['dependencyIgnoreValue']==run['preflight']['dependencyIgnoreValueAfter']=='1','Saved ignored deps')
 need(run['preflight']['freezeSHA256']==sha(W/'PRE-RUN-FREEZE.json') and run['preflight']['decisionProtocolSHA256']==sha(W.parent/'refine-decision-protocol.json'),'Run freeze/decision binding')
need(results['off']['identity']['meshHashes']==old['baselineIdentity']['meshHashes'] and results['off']['meshStats']==old['meshStats'],'OFF all5hashes/stats')
need(results['off']['aggregate']==old['aggregate'] and results['off']['rings']==old['rings'],'OFF saved aggregates/rings exact')
need(results['off']['errorStream']['sha256']==old['errorStream']['sha256'],'OFF historical error digest')
need(results['on']['identity']['prefixHashes']=={k:old['baselineIdentity']['meshHashes'][k] for k in ['positions','surface']},'ON original prefixes')
on=results['on'];stats=on['meshStats'];ref=stats['refinement']
need(stats['vertices']<=1000000 and stats['triangles']<=2000000 and stats['geometryBytes']==32*stats['vertices']+12*stats['triangles']<=64*1024**2,'ON geometry budget')
need(ref['probeSampleCalls']==591361 and ref['totalSampleCalls']==ref['vertexSampleCalls']+591361==stats['sampleCalls'],'ON sample accounting')
need(ref['addedVertices']==ref['splitEdgeCount']==stats['vertices']-old['meshStats']['vertices'] and ref['addedTriangles']==stats['triangles']-old['meshStats']['triangles'],'Added geometry accounting')
need(ref['maximumCellTriangles']<=20 and on['identity']['cellRanges']['completeContiguous'] is True and on['identity']['indicesInRange'] is True and on['identity']['attributesFinite'] is True,'Recorded topology gates')
for dep in [runs['on']['preflight']['offDependency'],on['pairedComparison']['offProvenance']]:
 need(dep['runSHA256']==sha(W/'run-off/run.json') and dep['resultSHA256']==sha(W/'run-off/result.json') and dep['bytes']==591361*8,'Paired OFF record binding')
raw=(source/'src/cumulonimbus/assets/liguria-apuane-dem.bin').read_bytes()
need(hashlib.sha256(raw).hexdigest()==old['assetSHA256'] and raw[:4]==b'CDM1' and struct.unpack_from('<Iddd',raw,4)==(1025,.125,-64,-64),'CDM1 mask byte mapping')
# Only integer coast-code addressing: no heights, interpolation or DEM sampler.
groups=[[] for _ in range(18)];rings=array('B');masks=array('B')
for order in range(591361):
 iz,ix=divmod(order,769);iz+=128;ix+=128
 coast=struct.unpack_from('<h',raw,32+2*1025**2+2*(iz*1025+ix))[0]
 radius=max(abs(ix-512),abs(iz-512))*.125
 ring=next(k for k in range(5) if radius<=f32(128*.032*2**k));mask=1 if coast>=0 else 2
 rings.append(ring);masks.append(mask)
 for group in [0,mask,3+3*ring,3+3*ring+mask]:groups[group].append(order)
def saved_group(j,g):return j['aggregate'][['all','landMask','seaMask'][g]] if g<3 else j['rings'][(g-3)//3][['all','landMask','seaMask'][(g-3)%3]]
def ids_top(ids,key):return heapq.nsmallest(8,ids,key=key)
def validate_point(p,order,mode=None):
 iz,ix=divmod(order,769);iz+=128;ix+=128
 need(p['order']==order and p['grid']==[ix,iz] and p['xzKm']==[-64+ix*.125,-64+iz*.125] and p['ring']==rings[order] and p['category']==('coast>=0' if masks[order]==1 else 'coast<0'),'Saved point addresses')
 if mode:need(p['errorMetres']==streams[mode][order],'Saved point error versus stream')
for mode in ['off','on']:
 values=streams[mode];j=results[mode]
 for g,ids in enumerate(groups):
  saved=saved_group(j,g);need(saved['count']==len(ids),'Stream category count')
  total=math.fsum(values[i] for i in ids);squares=math.fsum(values[i]*values[i] for i in ids)
  close(total,saved['sumErrorMetres'],'Stream sum vs Kahan saved');close(squares,saved['sumSquaredErrorMetres2'],'Stream squares vs Kahan saved')
  close(total/len(ids),saved['signedMeanMetres'],'Stream mean');close(rms(squares,len(ids)),saved['rmsMetres'],'Stream RMS')
  hist=[0]*10002
  for i in ids:
   e=values[i];hist[0 if e< -5000 else 10001 if e>=5000 else math.floor(e+5000)+1]+=1
  need(hist==saved['histogramCounts'],'Full saved-stream histogram')
  lo=min(ids,key=lambda i:(values[i],i));hi=min(ids,key=lambda i:(-values[i],i));ab=min(ids,key=lambda i:(-abs(values[i]),i))
  for key,index in [('minimum',lo),('maximum',hi),('maximumAbs',ab)]:
   validate_point(saved[key],index,mode)
   count=sum((abs(values[i])==abs(values[index])) if key=='maximumAbs' else (values[i]==values[index]) for i in ids)
   need(count==saved[key+'Ties'],'Stream extremum tie count')
  selections={'top8Absolute':ids_top(ids,lambda i:(-abs(values[i]),i)),
    'top8Positive':ids_top((i for i in ids if values[i]>0),lambda i:(-values[i],i)),
    'top8Negative':ids_top((i for i in ids if values[i]<0),lambda i:(values[i],i))}
  for key,expected in selections.items():
   need([p['order'] for p in saved[key]]==expected,'Independent heap top8 order')
   for point,index in zip(saved[key],expected):validate_point(point,index,mode)
O,N=streams['off'],streams['on'];paired=on['pairedComparison'];pair_derived=[]
for g,ids in enumerate(groups):
 saved=saved_group(paired,g)
 counts={k:0 for k in ['improved','worsened','equalAbsoluteError','signFlips','offAbove5m','onAbove5m','enteredAbove5m','leftAbove5m']}
 for i in ids:
  off,onv=O[i],N[i];a,b=abs(off),abs(onv)
  counts['improved' if b<a else 'worsened' if b>a else 'equalAbsoluteError']+=1
  counts['signFlips']+=(off<0<onv or onv<0<off)
  counts['offAbove5m']+=a>5;counts['onAbove5m']+=b>5
  counts['enteredAbove5m']+=a<=5<b;counts['leftAbove5m']+=b<=5<a
 need(saved['count']==len(ids) and all(saved[k]==v for k,v in counts.items()),'Independent paired counts')
 offsq=math.fsum(O[i]*O[i] for i in ids);onsq=math.fsum(N[i]*N[i] for i in ids);delta=math.fsum(abs(N[i])-abs(O[i]) for i in ids)
 for value,key in [(offsq,'sumOffSquaredErrorMetres2'),(onsq,'sumOnSquaredErrorMetres2'),(delta,'sumAbsoluteErrorDeltaMetres'),(rms(offsq,len(ids)),'offRMSMetres'),(rms(onsq,len(ids)),'onRMSMetres')]:close(value,saved[key],'Independent paired '+key)
 for field,sign in [('top8Regressions',1),('top8Improvements',-1)]:
  expected=ids_top((i for i in ids if sign*(abs(N[i])-abs(O[i]))>0),lambda i:(-sign*(abs(N[i])-abs(O[i])),i))
  need([p['order'] for p in saved[field]]==expected,'Independent paired heap top8')
  for point,index in zip(saved[field],expected):
   validate_point(point,index)
   need(point['offErrorMetres']==O[index] and point['onErrorMetres']==N[index] and point['absoluteErrorDeltaMetres']==abs(N[index])-abs(O[index]),'Paired saved witness values')
 pair_derived.append(counts)
gates={
 'globalRMSStrictlyLower':on['aggregate']['all']['rmsMetres']<old['aggregate']['all']['rmsMetres'],
 'landRMSStrictlyLower':on['aggregate']['landMask']['rmsMetres']<old['aggregate']['landMask']['rmsMetres'],
 'globalMaxAbsNoMoreThanBaselinePlus1mm':abs(on['aggregate']['all']['maximumAbs']['errorMetres'])<=abs(old['aggregate']['all']['maximumAbs']['errorMetres'])+.001}
for ring in [2,3,4]:gates[f'landRing{ring}RMSStrictlyLower']=on['rings'][ring]['landMask']['rmsMetres']<old['rings'][ring]['landMask']['rmsMetres']
need(gates==runs['on']['validation']['predeclaredNumericalGate'] and all(gates.values()) and runs['on']['selectionFitGatePASS'] is True and runs['off']['selectionFitGatePASS'] is True,'Frozen fit decision')
for x in freeze['inputs']:need(sha(Path(x['path']))==x['sha256'],'Post-verification input drift')
print(json.dumps({'status':'SAVED_STREAM_EVIDENCE_PASS','checks':CHECKS,'scope':'Independent Python Float64 math over retained errors and integer coast labels only; no mesh/query/model replay.',
 'streamNodesPerMode':591361,'streamBytesPerMode':4730888,'groupsPerMode':18,'pairedGroups':18,
 'source126ManifestSHA256':decision['candidateSourceManifestSHA256'],'historicalOFFParity':True,'fitGates':gates,
 'globalPairs':pair_derived[0],'landPairs':pair_derived[1],'seaPairs':pair_derived[2],
 'landRMSByRing':{'off':[r['landMask']['rmsMetres'] for r in results['off']['rings']],'on':[r['landMask']['rmsMetres'] for r in on['rings']]},
 'globalRMS':{'off':old['aggregate']['all']['rmsMetres'],'on':on['aggregate']['all']['rmsMetres']},
 'landRMS':{'off':old['aggregate']['landMask']['rmsMetres'],'on':on['aggregate']['landMask']['rmsMetres']},
 'ONExtremaMetres':[on['aggregate']['all']['minimum']['errorMetres'],on['aggregate']['all']['maximum']['errorMetres']],
 'geometry':{'off':results['off']['meshStats'],'on':on['meshStats']},'elapsedVerificationSeconds':time.monotonic()-START,
 'limits':['Selection-node fit, not holdout/continuous bound, native art, shadow or FPS proof.','OFF buffer hashes and ON topology remain saved run declarations; arrays not regenerated.','Coast codes classify original nodes directly; no height query/interpolation was performed.','Tiny fsum/Kahan rounding residuals use predeclared2e-12relative/1e-8absolute tolerance.']},indent=2))
