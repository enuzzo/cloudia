/** CPU-only lazy A/s reconstruction audit. Never generates a CloudVolume. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sampleDetail} from '/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle16/rain-amplitude-only/source-runtime/src/cumulonimbus/volume.ts';
import {precipitationSurvival,RAIN_EXTINCTION} from '/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle16/rain-amplitude-only/source-runtime/src/cumulonimbus/precipitation.ts';
const f=Math.fround,add=(a:number,b:number)=>f(f(a)+f(b)),sub=(a:number,b:number)=>f(f(a)-f(b)),mul=(a:number,b:number)=>f(f(a)*f(b)),div=(a:number,b:number)=>f(f(a)/f(b));
const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a:number,b:number,x:number)=>{const t=f(clamp(div(sub(x,a),sub(b,a))));return mul(mul(t,t),sub(3,mul(2,t)));};
const sha=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const bits=new Uint32Array(1),floats=new Float32Array(bits.buffer);
/** Finite f32 -> IEEE binary16, round-to-nearest/ties-to-even. */
export function toHalf(v:number):number{
 floats[0]=v;const b=bits[0],sign=(b>>>16)&0x8000,e=((b>>>23)&255)-127+15,m=b&0x7fffff;
 if(e>=31)return sign|0x7c00|(m?0x200:0);
 if(e<=0){if(e< -10)return sign;const t=m|0x800000,shift=14-e,base=t>>>shift,remainder=t&((1<<shift)-1),half=1<<(shift-1);return sign|(base+(remainder>half||(remainder===half&&(base&1))?1:0));}
 let h=(e<<10)|(m>>>13);const r=m&8191;if(r>4096||(r===4096&&(h&1)))h++;return sign|h;
}
export function fromHalf(h:number):number{const sign=h&0x8000?-1:1,e=(h>>>10)&31,m=h&1023;return sign*(e===0?m*2**-24:e===31?(m?NaN:Infinity):(1+m/1024)*2**(e-15));}
type Model={A:number;s:number;guessBase:number;xz:number[];uv:number[];R:number;base:number|null;attached:number;evaporation:number;sheets:number};
type Point={t:number;ds:number;p:number[];rp:number[];rainRegion:boolean;cloudSigma:number;rainExt:number;beforeT:number;afterT:number;originalRain:Model|null};
type Params={detail:{size:number;data:Uint8Array};rain:Uint8Array;wind:number[];drift:number[];growth:number[];rainAmount:number;rainTime:number;rainMin:number[];rainMax:number[];out:string};
class Metric{
 values:number[]=[];sum=0;sum2=0;weightedSum=0;weightedSum2=0;weight=0;max=0;
 add(x:number,w=0){if(!Number.isFinite(x))throw new Error('Non-finite metric');this.values.push(x);this.sum+=x;this.sum2+=x*x;this.max=Math.max(this.max,x);this.weightedSum+=x*w;this.weightedSum2+=x*x*w;this.weight+=w;}
 report(){this.values.sort((a,b)=>a-b);const n=this.values.length,q=(p:number)=>n?this.values[Math.min(n-1,Math.ceil(n*p)-1)]:null;return {n,mean:n?this.sum/n:null,rms:n?Math.sqrt(this.sum2/n):null,p50:q(.5),p95:q(.95),p99:q(.99),max:n?this.max:null,opacityWeightedMean:this.weight?this.weightedSum/this.weight:null,opacityWeight:this.weight,opacityWeightedRms:this.weight?Math.sqrt(this.weightedSum2/this.weight):null};}
}
type Cache={size:number;nodes:Map<number,number>;requestedCorners:number;uniqueNodes:number;zeroANodes:number;zeroANonzeroSNodes:number;A:Metric;mapping:Metric;mappingUnion:Metric;mappingAll:Metric;mappingA01:Metric;mappingA1:Metric;sigma:Metric;wrongZeroMapping:Metric;rayTau:Metric;rayT:Metric;rayMaxT:Metric;rayMaxTError:number;rayMaxTAt:number;rayMaxOriginalA:number;candidateT:number;candidateTau:number;baselineTau:number;falsePositiveA:number;falseNegativeA:number;mixedZeroCorners:number;worstMapping:any;worstA:any;worstWrongZero:any;rays:any[];nodeEvalMs:number;firstCutoff:number|null};
export class RainCacheAudit{
 p:Params;caches:Cache[];rayId=-1;serial=0;started=performance.now();factorChecks=0;factorFailures=0;factorizationRoundoffMax=0;points=0;baselineRainTau=0;baselineTotalTau=0;baselineCutoffT=0;pointKinds:Record<string,number>={};
 constructor(p:Params){this.p=p;this.caches=[128,256].map(size=>({size,nodes:new Map(),requestedCorners:0,uniqueNodes:0,zeroANodes:0,zeroANonzeroSNodes:0,A:new Metric(),mapping:new Metric(),mappingUnion:new Metric(),mappingAll:new Metric(),mappingA01:new Metric(),mappingA1:new Metric(),sigma:new Metric(),wrongZeroMapping:new Metric(),rayTau:new Metric(),rayT:new Metric(),rayMaxT:new Metric(),rayMaxTError:0,rayMaxTAt:0,rayMaxOriginalA:0,candidateT:1,candidateTau:0,baselineTau:0,falsePositiveA:0,falseNegativeA:0,mixedZeroCorners:0,worstMapping:null,worstA:null,worstWrongZero:null,rays:[],nodeEvalMs:0,firstCutoff:null}));
  const tests=[[0,0],[1,0x3c00],[2,0x4000],[2**-24,1],[1+2**-11,0x3c00],[1+3*2**-11,0x3c02]];
  if(tests.some(([v,h])=>toHalf(v)!==h||!Number.isFinite(fromHalf(h))))throw new Error('Half RTE unit cases failed');
 }
 rain(u:number,v:number){const x=clamp(u)*64-.5,z=clamp(v)*64-.5,x0=Math.floor(x),z0=Math.floor(z),fx=x-x0,fz=z-z0;let r=0,g=0;for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){const at=(clamp(z0+dz,0,63)*64+clamp(x0+dx,0,63))*2,w=(dx?fx:1-fx)*(dz?fz:1-fz);r+=this.p.rain[at]/255*w;g+=this.p.rain[at+1]/255*w;}return [f(r),f(g)];}
 model(rp:number[],worldY?:number):Model{
  const {wind,growth,drift,detail,rainTime,rainAmount}=this.p;
  const guessXZ=[sub(rp[0],mul(mul(wind[0],Math.max(0,sub(1,rp[1]))),.32)),sub(rp[2],mul(mul(wind[1],Math.max(0,sub(1,rp[1]))),.32))];
  const guessUV=[div(sub(mul(guessXZ[0],growth[1]),-5),10),div(sub(mul(guessXZ[1],growth[1]),-3.5),7)];
  const guess=this.rain(guessUV[0],guessUV[1])[1],guessBase=add(.72,div(sub(sub(mul(guess,3),.5),.72),growth[0]));
  const descent=Math.max(0,sub(guessBase,rp[1])),shear=f(clamp(div(sub(guessBase,.72),6.2))**1.5),s=add(mul(descent,.32),shear);
  const xz=[sub(rp[0],mul(wind[0],s)),sub(rp[2],mul(wind[1],s))],uv=[div(sub(mul(xz[0],growth[1]),-5),10),div(sub(mul(xz[1],growth[1]),-3.5),7)];
  const o:Model={A:0,s,guessBase,xz,uv,R:0,base:null,attached:0,evaporation:0,sheets:0};
  if(!uv.every(v=>v>0&&v<1))return o;
  const column=this.rain(uv[0],uv[1]);o.R=column[0];if(o.R<=0)return o;
  const b=add(.72,div(sub(sub(mul(column[1],3),.5),.72),growth[0]));o.base=b;
  o.attached=sub(1,smooth(sub(b,.08),add(b,.3),rp[1]));
  o.sheets=f(sampleDetail(detail,mul(xz[0],.20),mul(xz[1],.20),mul(add(b,mul(rainTime,.012)),.025),1));
  o.evaporation=f(precipitationSurvival(worldY??add(rp[1],drift[1]),add(b,drift[1]),rainAmount,o.R,o.sheets));
  o.A=mul(mul(mul(o.R,o.attached),o.evaporation),add(.15,mul(1.85,mul(o.sheets,o.sheets))));return o;
 }
 node(c:Cache,x:number,y:number,z:number){const key=(z*c.size+y)*c.size+x;let packed=c.nodes.get(key);if(packed===undefined){const start=performance.now(),rp=[x,y,z].map((v,k)=>f(this.p.rainMin[k]+(v+.5)/c.size*(this.p.rainMax[k]-this.p.rainMin[k]))),m=this.model(rp),a=toHalf(m.A),s=toHalf(m.s);packed=(a|(s<<16))>>>0;c.nodes.set(key,packed);c.uniqueNodes++;if(m.A===0){c.zeroANodes++;if(m.s!==0)c.zeroANonzeroSNodes++;}c.nodeEvalMs+=performance.now()-start;}return {key,A:fromHalf(packed&65535),s:fromHalf(packed>>>16),packed};}
 cached(c:Cache,rp:number[],includeCorners=false){
  const coord=rp.map((v,k)=>div(sub(v,this.p.rainMin[k]),sub(this.p.rainMax[k],this.p.rainMin[k]))),tex=coord.map(v=>clamp(v)*c.size-.5),i=tex.map(Math.floor),fract=tex.map((v,k)=>v-i[k]);
  let A=0,s=0,wrongS=0,zero=0,positive=0;const corners:any[]=[];
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
   const ids=[x,y,z].map((v,k)=>clamp(i[k]+v,0,c.size-1)),n=this.node(c,ids[0],ids[1],ids[2]),w=(x?fract[0]:1-fract[0])*(y?fract[1]:1-fract[1])*(z?fract[2]:1-fract[2]);
   c.requestedCorners++;A+=n.A*w;s+=n.s*w;wrongS+=(n.A===0?0:n.s)*w;if(w>0){if(n.A===0)zero++;else positive++;}if(includeCorners)corners.push({index:ids,weight:w,A:n.A,s:n.s,packed:n.packed});
  }
  return {A:f(A),s:f(s),wrongS:f(wrongS),mixed:zero>0&&positive>0,coord,corners};
 }
 sigma(rp:number[],A:number,s:number){if(A<=0)return 0;const {wind,detail,rainTime,rainAmount}=this.p,xz=[sub(rp[0],mul(wind[0],s)),sub(rp[2],mul(wind[1],s))];
  const streak=f(sampleDetail(detail,mul(xz[0],2.6),mul(xz[1],2.6),mul(add(rp[1],mul(rainTime,.018)),.16),0));
  return mul(mul(rainAmount,mul(A,add(.35,mul(1.3,streak)))),RAIN_EXTINCTION);
 }
 beginRay(id:number){if(performance.now()-this.started>45000){writeFileSync(this.p.out+'/incomplete.json',JSON.stringify({status:'stopped-before-60s',lastCompletedRay:this.rayId,elapsedMs:performance.now()-this.started}));throw new Error('Wall budget45s reached; do not present incomplete results as qualification');}
  this.rayId=id;this.baselineRainTau=0;this.baselineTotalTau=0;for(const c of this.caches){c.candidateT=1;c.rayMaxTError=0;c.rayMaxTAt=0;c.rayMaxOriginalA=0;c.candidateTau=0;c.baselineTau=0;c.firstCutoff=null;}if(id%96===0)console.error(JSON.stringify({phase:'replay',ray:id,elapsedMs:performance.now()-this.started,nodes:this.caches.map(c=>[c.size,c.uniqueNodes])}));
 }
 sample(p:Point){this.serial++;this.baselineTotalTau+=(p.cloudSigma+p.rainExt)*p.ds;this.baselineRainTau+=p.rainExt*p.ds;
  const m=p.originalRain;if(m){this.points++;const kind=m.R===0?'R0':m.attached===0?'attachment0':m.evaporation===0?'evaporation0':'positiveA';this.pointKinds[kind]=(this.pointKinds[kind]??0)+1;
   if((this.points&127)===0){this.factorChecks++;const independent=this.model(p.rp,p.p[1]);if(independent.A!==m.A||independent.s!==m.s){this.factorFailures++;if(this.factorFailures<3)console.error(JSON.stringify({factorMismatch:{independent,original:m,rp:p.rp}}));}}
   this.factorizationRoundoffMax=Math.max(this.factorizationRoundoffMax,Math.abs(this.sigma(p.rp,m.A,m.s)-p.rainExt));
  }
  for(const c of this.caches){let sigma=0;if(m){const q=this.cached(c,p.rp);sigma=this.sigma(p.rp,q.A,q.s);const map=Math.hypot(...this.p.wind)*Math.abs(q.s-m.s)*1000,wrongMap=Math.hypot(...this.p.wind)*Math.abs(q.wrongS-m.s)*1000;
    const total=p.cloudSigma+p.rainExt,w=total>0?p.beforeT*(1-Math.exp(-total*p.ds))*p.rainExt/total:0;
    c.A.add(Math.abs(q.A-m.A),w);c.mappingAll.add(map,w);c.sigma.add(Math.abs(sigma-p.rainExt),w);
    c.rayMaxOriginalA=Math.max(c.rayMaxOriginalA,m.A);if(m.A>=.01)c.mappingA01.add(map,w);if(m.A>=.1)c.mappingA1.add(map,w);if(m.A>0)c.mapping.add(map,w);if(m.A>0||q.A>0)c.mappingUnion.add(map,w);if(q.mixed)c.mixedZeroCorners++;
    if(m.A===0&&q.A>0)c.falsePositiveA++;if(m.A>0&&q.A===0)c.falseNegativeA++;if(q.mixed&&q.A>0)c.wrongZeroMapping.add(wrongMap,w);
    const witness={ray:this.rayId,t:p.t,ds:p.ds,rp:p.rp,beforeT:p.beforeT,opacityWeight:w,original:m,candidate:{A:q.A,s:q.s,wrongS:q.wrongS,sigma},baselineSigma:p.rainExt,mappingErrorM:map,zeroedSMappingErrorM:wrongMap,corners:q.corners};
    const maxMapping=m.A>0&&(!c.worstMapping||map>c.worstMapping.mappingErrorM),maxA=!c.worstA||Math.abs(q.A-m.A)>Math.abs(c.worstA.candidate.A-c.worstA.original.A),maxWrong=q.mixed&&q.A>0&&(!c.worstWrongZero||wrongMap>c.worstWrongZero.zeroedSMappingErrorM);
    if(maxMapping||maxA||maxWrong){witness.corners=this.cached(c,p.rp,true).corners;if(maxMapping)c.worstMapping=witness;if(maxA)c.worstA=witness;if(maxWrong)c.worstWrongZero=witness;}
   }
   c.candidateTau+=(p.cloudSigma+sigma)*p.ds;c.baselineTau+=(p.cloudSigma+p.rainExt)*p.ds;
   const extinction=add(p.cloudSigma,sigma);if(extinction>0){const opacity=sub(1,f(Math.exp(-mul(extinction,p.ds))));c.candidateT=mul(c.candidateT,sub(1,opacity));}
   const pointTError=Math.abs(c.candidateT-p.afterT);if(pointTError>c.rayMaxTError){c.rayMaxTError=pointTError;c.rayMaxTAt=p.t+p.ds;}
   if(c.firstCutoff===null&&c.candidateT<f(.006))c.firstCutoff=p.t+p.ds;
  }
 }
 endRay(r:{exit:string;baselineT:number;lastT:number}){for(const c of this.caches){const deltaTau=c.candidateTau-c.baselineTau,deltaT=c.candidateT-r.baselineT;c.rayTau.add(Math.abs(deltaTau));c.rayT.add(Math.abs(deltaT));c.rayMaxT.add(c.rayMaxTError);c.rays.push({ray:this.rayId,exit:r.exit,lastTKm:r.lastT,baselineRainTau:this.baselineRainTau,baselineTotalTau:c.baselineTau,candidateTotalTau:c.candidateTau,deltaTau,baselineT:r.baselineT,candidateTFixedPath:c.candidateT,deltaT,firstCandidateCutoffKm:c.firstCutoff,maximumPointwiseTError:c.rayMaxTError,maximumPointwiseTErrorAtKm:c.rayMaxTAt,maxOriginalAOnRay:c.rayMaxOriginalA,candidateWouldContinueBeyondBaseline:r.exit==='opacity'&&c.candidateT>=f(.006)});}}
 capAndBoundary(c:Cache){const result:any[]=[];const {rainMin:lo,rainMax:hi}=this.p;for(let i=0;i<64;i++){const u=(i+.5)/64,v=(((i*37)%64)+.5)/64;const p=[f(lo[0]+u*(hi[0]-lo[0])),f(hi[1]),f(lo[2]+v*(hi[2]-lo[2]))];const m=this.model(p),q=this.cached(c,p);result.push({kind:'upper-cap-y2.8',p,original:m,candidate:{A:q.A,s:q.s},zeroedS:q.wrongS,mappingErrorM:Math.hypot(...this.p.wind)*Math.abs(q.s-m.s)*1000});}
  for(let axis of [0,2])for(let side of [0,1])for(let i=0;i<16;i++){const p=[f((lo[0]+hi[0])*.5),f(lo[1]+(i+.5)/16*(hi[1]-lo[1])),f((lo[2]+hi[2])*.5)];p[axis]=f(side?hi[axis]:lo[axis]);const m=this.model(p),q=this.cached(c,p);result.push({kind:'lateral-cache-domain-face',axis,side,p,original:m,candidate:{A:q.A,s:q.s},zeroedS:q.wrongS,mappingErrorM:Math.hypot(...this.p.wind)*Math.abs(q.s-m.s)*1000});}
  return result;
 }
 finish(replay:any){
  const original=JSON.parse(readFileSync('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work/work-32x18.json','utf8'));
  const baselineMatch=replay.sequenceSha256===original.sequenceSha256&&replay.counts.iterations===246399&&replay.counts.rainRegion===206466;
  const reports=this.caches.map(c=>{const metrics={absoluteA:c.A.report(),mappingMOriginalContributors:c.mapping.report(),mappingMContributorUnion:c.mappingUnion.report(),mappingMAllRainRegion:c.mappingAll.report(),mappingMOriginalAAtLeast01:c.mappingA01.report(),mappingMOriginalAAtLeast1:c.mappingA1.report(),maximumRayPointwiseTError:c.rayMaxT.report(),absoluteSigmaPerKm:c.sigma.report(),wronglyZeroingSAtZeroACornersMappingM:c.wrongZeroMapping.report(),absoluteRayTau:c.rayTau.report(),absoluteRayT:c.rayT.report()};
   const gates={mappingP99:metrics.mappingMOriginalContributors.p99!<=.75,mappingMax:metrics.mappingMOriginalContributors.max!<=1.5,mappingUnionP99:metrics.mappingMContributorUnion.p99!<=.75,mappingUnionMax:metrics.mappingMContributorUnion.max!<=1.5,tauMax:metrics.absoluteRayTau.max!<=.01,tauMean:metrics.absoluteRayTau.mean!<=.002};
   const boundary=this.capAndBoundary(c);return {size:c.size,cellM:this.p.rainMin.map((v,k)=>(this.p.rainMax[k]-v)/c.size*1000),fullRG16FBytes:c.size**3*4,lazyUniqueNodes:c.uniqueNodes,lazyRequestedCorners:c.requestedCorners,zeroANodes:c.zeroANodes,zeroANonzeroSNodes:c.zeroANonzeroSNodes,nodeEvaluationMs:c.nodeEvalMs,mixedZeroCornerQueries:c.mixedZeroCorners,originalAZeroCandidatePositive:c.falsePositiveA,originalAPositiveCandidateZero:c.falseNegativeA,metrics,gates,engineeringGatePass:Object.values(gates).every(Boolean),worstMapping:c.worstMapping,worstA:c.worstA,worstWrongZero:c.worstWrongZero,boundaryProbes:boundary,rays:c.rays};});
  const report={kind:'lazy-half-rg16f-rain-cache-audit',phase:2,phasePurpose:'Additional metric collection only; unchanged cache/model/inputs/ray sequence and unchanged engineering gates. Phase1 frozen separately.',date:new Date().toISOString(),status:baselineMatch&&this.factorFailures===0?'completed':'invalid',runtime:{bun:process.versions.bun,architecture:process.arch,wallMs:performance.now()-this.started},bakesPerformed:0,gpuExecuted:false,baselineMatch,baselineSequenceSha256:replay.sequenceSha256,originalReportSha256:sha(readFileSync('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work/work-32x18.json')),parameters:{...replay.parameters,cacheMinRP:this.p.rainMin,cacheMaxRP:this.p.rainMax,cacheLayout:'texel-centred RG16F(A,s), clamp-to-edge, ideal trilinear after independent per-node IEEE binary16 RNE',gateContributorDefinition:'Original A>0; separate stricter original-or-candidate union gate. Unweighted p99/max; opacity-weighted mean additionally reported.'},checks:{baselineSequenceExact:baselineMatch,independentFactorPointChecks:this.factorChecks,independentFactorPointFailures:this.factorFailures,halfRteUnitCases:6},factorizationRoundoffSigmaMax:this.factorizationRoundoffMax,rainPoints:this.points,pointKinds:this.pointKinds,scope:'One historical576-ray pose, original baseline governs trajectory/cutoff; both candidates evaluated on identical points only. Candidate T beyond a baseline opacity exit is censored; no actual candidate ray-path or timing claim. No rendering sourceRGB/pixel/photographic acceptance or native sampler qualification.',differencesFromWGSL:replay.differencesFromWGSL,cacheSpecificLimits:['Half conversion RNE explicitly modelled; GPU writes/uploads not executed. CPU ideal trilinear weights, output rounded f32; native filtering precision unqualified.','Cache node world positions use JS coordinate construction rounded f32; no WGSL FMA/reassociation equivalence.','A/s reconstruction is a changed material model; positive A can interpolate into originally A0 regions. s is retained at every A0 node.','All data from historical cached256/128/16 CPU input, not native GPU flow readback. No new cloud generation or real-time cache rebuild cost measurement.','Rain factorization changes floating point grouping before reconstruction; maximum sigma residual separately measured.','Boundary probes are bounded finite cap/domain checks at this fixed state; not a sweep of all growth/wind/amount/time or a continuous support proof.'],payloadHashes:{replay:sha(readFileSync(this.p.out+'/replay.ts')),auditCore:sha(readFileSync(import.meta.path)),snapshotManifest:sha(readFileSync(this.p.out+'/snapshot-manifest.json'))},grids:reports};
  writeFileSync(this.p.out+'/result.json',JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify({phase:'audit-complete',status:report.status,wallMs:report.runtime.wallMs,baselineMatch,factorFailures:this.factorFailures,grids:reports.map(c=>({size:c.size,nodes:c.lazyUniqueNodes,metrics:c.metrics,gates:c.gates}))}));
  if(!baselineMatch||this.factorFailures)throw new Error('Audit provenance/baseline checks failed');
 }
}
