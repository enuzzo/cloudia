"""Saved F64 streams only; no builder import/model/GPU. Root analysis, frozen before A/B."""
from pathlib import Path
import array,bisect,gzip,hashlib,json,math,struct,sys
root=Path(__file__).resolve().parents[1]; audit=root/'terrain-grid-audit'; out=audit/'run'
freeze=json.loads((audit/'PRE-RUN-FREEZE.json').read_text());points=json.loads((audit/'POINTS.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
rows={};streams={}
for mode in ['A','B']:
 p=out/mode; r=json.loads((p/'result.json').read_text());b=(p/'errors.f64le.gz').read_bytes();assert sha(b)==r['errorStream']['gzipSHA256'];raw=gzip.decompress(b);assert len(raw)==points['streamRawBytes'] and sha(raw)==r['errorStream']['rawSHA256']
 values=array.array('d');values.frombytes(raw)
 if sys.byteorder!='little':values.byteswap()
 assert len(values)==points['totalCount'];streams[mode]=values;rows[mode]=r
blob=Path(freeze['demPath']).read_bytes();assert sha(blob)==freeze['expectedDemSHA256'];side=struct.unpack_from('<I',blob,4)[0];assert side==1025
coast=array.array('h');coast.frombytes(blob[32+side*side*2:])
if sys.byteorder!='little':coast.byteswap()
assert len(coast)==side*side
bounds=points['fixedPhysicalBandsForIndependentAnalysis']['outerHalfExtentsKm']
def stats(values):
 if not values:return None
 v=sorted(abs(x) for x in values);return {'count':len(v),'rmsM':math.sqrt(math.fsum(x*x for x in values)/len(v)),'p99AbsM':v[math.floor(.99*(len(v)-1))],'maxAbsM':v[-1],'minSignedM':min(values),'maxSignedM':max(values),'above5m':sum(x>5 for x in v)}
report={'scope':'Saved identical physical-point F64 errors only. Same GLO90 bilinear+sphere reference, material coast>=0 mask. No model/GPU rerun or continuous accuracy.','pointPlanSHA256':sha((audit/'POINTS.json').read_bytes()),'preResultGateSHA256':sha((root/'run/NATIVE-GATE-BEFORE-NUMERIC.json').read_bytes()),'sets':{}}
offset=0;passes={}
for name in ['fit','holdout']:
 spec=points[name];count=spec['count'];a=streams['A'][offset:offset+count];b=streams['B'][offset:offset+count];groups={}
 improved=worse=equal=0;max_reg=-math.inf;max_reg_index=-1;cross_up=cross_down=0
 for i,(x,y) in enumerate(zip(a,b)):
  iz,ix=divmod(i,spec['side']);source=(iz+128)*side+ix+128
  land=coast[source]>=0 if name=='fit' else coast[source]+coast[source+1]+coast[source+side]+coast[source+side+1]>=0
  px=-48+(ix+(0 if name=='fit' else .5))*.125;pz=-48+(iz+(0 if name=='fit' else .5))*.125;band=bisect.bisect_left(bounds,max(abs(px),abs(pz)))
  for group in [('all',),('land' if land else 'sea',),('band',band),('bandLand',band) if land else ('bandSea',band)]:
   key='/'.join(map(str,group));pair=groups.setdefault(key,([],[]));pair[0].append(x);pair[1].append(y)
  d=abs(y)-abs(x);improved+=d<0;worse+=d>0;equal+=d==0;cross_up+=abs(x)<=5<abs(y);cross_down+=abs(y)<=5<abs(x)
  if d>max_reg:max_reg=d;max_reg_index=i
 result={'groups':{key:{'A':stats(pair[0]),'B':stats(pair[1])} for key,pair in groups.items()},'absoluteErrorChanges':{'improved':improved,'worse':worse,'equal':equal,'maxRegressionM':max_reg,'maxRegressionIndexWithinSet':max_reg_index,'crossAbove5m':cross_up,'crossBelow5m':cross_down}}
 allgroup=result['groups']['all'];landgroup=result['groups']['land'];p={'landRmsLower':landgroup['B']['rmsM']<landgroup['A']['rmsM'],'allP99NotGreater':allgroup['B']['p99AbsM']<=allgroup['A']['p99AbsM'],'allMaxNotGreater':allgroup['B']['maxAbsM']<=allgroup['A']['maxAbsM']}
 result['frozenGate']=p;passes[name]=all(p.values());report['sets'][name]=result;offset+=count
report['geometryCapsPassed']=all(r['meshStats']['vertices']<=1000000 and r['meshStats']['triangles']<=2000000 and r['meshStats']['geometryBytes']<=64*1024*1024 for r in rows.values())
report['AAuthenticated']=rows['A']['historicalAAuthenticated'];report['status']='PASS_DISCRETE_NUMERIC_GATE_ONLY' if all(passes.values()) and report['geometryCapsPassed'] and report['AAuthenticated'] else 'FAIL_FROZEN_NUMERIC_GATE_NO_GPU'
(root/'run/SAVED-GRID-ANALYSIS.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':report['status'],'sets':{k:{'all':v['groups']['all'],'land':v['groups']['land'],'changes':v['absoluteErrorChanges'],'gate':v['frozenGate']} for k,v in report['sets'].items()}},indent=2))
