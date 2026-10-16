/** A-only candidate. Reuses frozen half A/s oracle numerically; s cache is NEVER used by the candidate. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {RainCacheAudit as OracleAudit} from './oracle-core';
const f=Math.fround,mul=(a:number,b:number)=>f(f(a)*f(b)),sub=(a:number,b:number)=>f(f(a)-f(b)),add=(a:number,b:number)=>f(f(a)+f(b));
const sha=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const HIST='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work/work-32x18.json';
export class RainCacheAudit extends OracleAudit{
 mappingChecks=0;mappingFailures=0;uvInvalidPoints=0;
 originalMappingHash=createHash('sha256');candidateMappingHash=createHash('sha256');
 constructor(p:any){super(p);for(const cache of this.caches){const c:any=cache;Object.assign(c,{rawAZeroCandidatePositive:0,rawAPositiveCandidateZero:0,rawPositiveOutsideUV:0,effectivePositiveOutsideUV:0,rawAErrorSum:0,rawAErrorMax:0,rawADiagnosticCount:0,worstSigma:null});}}
 sample(p:any){
  this.serial++;this.baselineTotalTau+=(p.cloudSigma+p.rainExt)*p.ds;this.baselineRainTau+=p.rainExt*p.ds;
  const m=p.originalRain;
  let map=0,validUV=false,candidateXZ:number[]=[];
  if(m){
   this.points++;const kind=m.R===0?'R0':m.attached===0?'attachment0':m.evaporation===0?'evaporation0':'positiveA';this.pointKinds[kind]=(this.pointKinds[kind]??0)+1;
   if((this.points&127)===0){this.factorChecks++;const independent=this.model(p.rp,p.p[1]);if(independent.A!==m.A||independent.s!==m.s){this.factorFailures++;}}
   this.factorizationRoundoffMax=Math.max(this.factorizationRoundoffMax,Math.abs(this.sigma(p.rp,m.A,m.s)-p.rainExt));
   // Actual mapping recomputation from ORIGINAL s, using the exact f32 operations.
   candidateXZ=[sub(p.rp[0],mul(this.p.wind[0],m.s)),sub(p.rp[2],mul(this.p.wind[1],m.s))];
   const phase=(xz:number[])=>[mul(xz[0],2.6),mul(xz[1],2.6),mul(add(p.rp[1],mul(this.p.rainTime,.018)),.16)];
   const originalPhase=phase(m.xz),candidatePhase=phase(candidateXZ);
   const originalCoordinates=[...m.xz,...originalPhase],candidateCoordinates=[...candidateXZ,...candidatePhase];
   this.mappingChecks++;if(candidateCoordinates.some((v,i)=>v!==originalCoordinates[i]))this.mappingFailures++;
   this.originalMappingHash.update(new Uint8Array(new Float32Array(originalCoordinates).buffer));
   this.candidateMappingHash.update(new Uint8Array(new Float32Array(candidateCoordinates).buffer));
   map=Math.hypot(...candidateXZ.map((v,i)=>v-m.xz[i]))*1000;
   validUV=m.uv.every((v:number)=>v>0&&v<1);if(!validUV)this.uvInvalidPoints++;
  }
  for(const cache of this.caches){const c:any=cache;let sigma=0;
   if(m){
    const q=this.cached(c,p.rp),effectiveA=validUV?q.A:0;
    sigma=this.sigma(p.rp,effectiveA,m.s); // Original mapping + original streak; cached s intentionally ignored.
    const total=p.cloudSigma+p.rainExt,w=total>0?p.beforeT*(1-Math.exp(-total*p.ds))*p.rainExt/total:0;
    c.A.add(Math.abs(effectiveA-m.A),w);c.mappingAll.add(map,w);c.sigma.add(Math.abs(sigma-p.rainExt),w);
    c.rayMaxOriginalA=Math.max(c.rayMaxOriginalA,m.A);
    if(m.A>=.01)c.mappingA01.add(map,w);if(m.A>=.1)c.mappingA1.add(map,w);
    if(m.A>0)c.mapping.add(map,w);if(m.A>0||effectiveA>0)c.mappingUnion.add(map,w);if(q.mixed)c.mixedZeroCorners++;
    if(m.A===0&&effectiveA>0)c.falsePositiveA++;if(m.A>0&&effectiveA===0)c.falseNegativeA++;
    if(m.A===0&&q.A>0)c.rawAZeroCandidatePositive++;if(m.A>0&&q.A===0)c.rawAPositiveCandidateZero++;
    if(!validUV&&q.A>0)c.rawPositiveOutsideUV++;if(!validUV&&effectiveA>0)c.effectivePositiveOutsideUV++;
    const rawError=Math.abs(q.A-m.A);c.rawAErrorSum+=rawError;c.rawAErrorMax=Math.max(c.rawAErrorMax,rawError);c.rawADiagnosticCount++;
    const witness:any={ray:this.rayId,t:p.t,ds:p.ds,rp:p.rp,beforeT:p.beforeT,opacityWeight:w,validUV,original:m,
     candidate:{rawA:q.A,effectiveA,s:m.s,xz:candidateXZ,sigma,unusedCachedSOracle:q.s},baselineSigma:p.rainExt,mappingErrorM:map,corners:[]};
    const maxMapping=m.A>0&&(!c.worstMapping||map>c.worstMapping.mappingErrorM);
    const maxA=!c.worstA||Math.abs(effectiveA-m.A)>Math.abs(c.worstA.candidate.effectiveA-c.worstA.original.A);
    const maxSigma=!c.worstSigma||Math.abs(sigma-p.rainExt)>Math.abs(c.worstSigma.candidate.sigma-c.worstSigma.baselineSigma);
    if(maxMapping||maxA||maxSigma){witness.corners=this.cached(c,p.rp,true).corners;if(maxMapping)c.worstMapping=witness;if(maxA)c.worstA=witness;if(maxSigma)c.worstSigma=witness;}
   }
   c.candidateTau+=(p.cloudSigma+sigma)*p.ds;c.baselineTau+=(p.cloudSigma+p.rainExt)*p.ds;
   const extinction=add(p.cloudSigma,sigma);if(extinction>0){const opacity=sub(1,f(Math.exp(-mul(extinction,p.ds))));c.candidateT=mul(c.candidateT,sub(1,opacity));}
   const pointTError=Math.abs(c.candidateT-p.afterT);if(pointTError>c.rayMaxTError){c.rayMaxTError=pointTError;c.rayMaxTAt=p.t+p.ds;}
   if(c.firstCutoff===null&&c.candidateT<f(.006))c.firstCutoff=p.t+p.ds;
  }
 }
 finish(replay:any){
  const original=JSON.parse(readFileSync(HIST,'utf8'));
  const originalMappingSha256=this.originalMappingHash.digest('hex'),candidateMappingSha256=this.candidateMappingHash.digest('hex');
  const checks={baselineSequenceExact:replay.sequenceSha256===original.sequenceSha256&&replay.sequenceSha256==='a0c2dfd79e1900dce9a677fceecbd5bfcfc138a2e94cd430938f4c4c7bf3ca7a',
   baselineAllCountsExact:JSON.stringify(replay.counts)===JSON.stringify(original.counts),
   baselineAllLookupCountsExact:JSON.stringify(replay.semanticTextureSampleCalls)===JSON.stringify(original.semanticTextureSampleCalls),
   expectedIterations:replay.counts.iterations===246399,expectedRainRegion:replay.counts.rainRegion===206466,expectedRainPositive:replay.counts.rainPositive===91572,
   allOriginalReplayChecks:Object.values(replay.checks).every(Boolean),allTenHistoricalSourcesExact:Object.keys(replay.sourceHashesBefore).length===10&&replay.changedSinceBake.length===0&&replay.changedDuringCount.length===0,
   independentFactorPointChecksPass:this.factorFailures===0,mappingCoordinatesExact:this.mappingChecks===this.points&&this.mappingFailures===0&&originalMappingSha256===candidateMappingSha256,
   candidateUVGuardApplied:this.caches.every((c:any)=>c.effectivePositiveOutsideUV===0)};
  const reports=this.caches.map((cache:any)=>{
   const c=cache,metrics={absoluteEffectiveA:c.A.report(),absoluteRawA:{n:c.rawADiagnosticCount,mean:c.rawAErrorSum/c.rawADiagnosticCount,max:c.rawAErrorMax},mappingMOriginalContributors:c.mapping.report(),mappingMContributorUnion:c.mappingUnion.report(),mappingMAllRainRegion:c.mappingAll.report(),maximumRayPointwiseTError:c.rayMaxT.report(),absoluteSigmaPerKm:c.sigma.report(),absoluteRayTau:c.rayTau.report(),absoluteRayT:c.rayT.report()};
   const gates={mappingP99:metrics.mappingMOriginalContributors.p99<=.75,mappingMax:metrics.mappingMOriginalContributors.max<=1.5,mappingUnionP99:metrics.mappingMContributorUnion.p99<=.75,mappingUnionMax:metrics.mappingMContributorUnion.max<=1.5,tauMax:metrics.absoluteRayTau.max<=.01,tauMean:metrics.absoluteRayTau.mean<=.002};
   const rainy=c.rays.filter((r:any)=>r.baselineRainTau>0),rainyMean=rainy.reduce((s:number,r:any)=>s+Math.abs(r.deltaTau),0)/rainy.length;
   return {size:c.size,cellM:this.p.rainMin.map((v,k)=>(this.p.rainMax[k]-v)/c.size*1000),hypotheticalScalarR16FBytes:c.size**3*2,actuallyStoredOracle:'Lazy JS Map of packed RG16F(A,s) from frozen evaluator; s storage/half never used by candidate. Not dense R16F and not GPU.',lazyUniqueNodes:c.uniqueNodes,lazyRequestedCorners:c.requestedCorners,zeroANodes:c.zeroANodes,nodeEvaluationMs:c.nodeEvalMs,mixedZeroCornerQueries:c.mixedZeroCorners,support:{effectiveOriginalAZeroCandidatePositive:c.falsePositiveA,effectiveOriginalAPositiveCandidateZero:c.falseNegativeA,rawOriginalAZeroCandidatePositive:c.rawAZeroCandidatePositive,rawOriginalAPositiveCandidateZero:c.rawAPositiveCandidateZero,rawPositiveOutsideUV:c.rawPositiveOutsideUV,effectivePositiveOutsideUV:c.effectivePositiveOutsideUV},metrics,gateContributorDefinition:'Original A>0; separate union original A>0 or A_eff>0. UV guard preserved; no column.R gate in candidate.',rainPositiveRayCount:rainy.length,absoluteRayTauMeanRainPositiveRays:rainyMean,censoredContinuationCount:c.rays.filter((r:any)=>r.candidateWouldContinueBeyondBaseline).length,gates,engineeringGatePass:Object.values(gates).every(Boolean),worstMapping:c.worstMapping,worstEffectiveA:c.worstA,worstSigma:c.worstSigma,rays:c.rays};
  });
  const report={kind:'amplitude-only-half-oracle-fixed-sequence-audit',date:new Date().toISOString(),status:Object.values(checks).every(Boolean)?'completed':'invalid',runtime:{bun:process.versions.bun,architecture:process.arch,wallMs:performance.now()-this.started},bakesPerformed:0,gpuExecuted:false,checks,baselineMatch:Object.values(checks).every(Boolean),baselineSequenceSha256:replay.sequenceSha256,mappingChecks:this.mappingChecks,mappingFailures:this.mappingFailures,originalMappingSha256,candidateMappingSha256,uvInvalidPoints:this.uvInvalidPoints,independentFactorChecks:this.factorChecks,independentFactorFailures:this.factorFailures,halfRteUnitCases:6,factorizationRoundoffSigmaMax:this.factorizationRoundoffMax,rainPoints:this.points,pointKinds:this.pointKinds,parameters:{...replay.parameters,cacheMinRP:this.p.rainMin,cacheMaxRP:this.p.rainMax,cacheLayout:'texel-centred half A, clamp-to-edge ideal trilinear; numerical oracle still lazily packs A+s, with s ignored by candidate',candidateSemantics:'validUV=m.uv.every(v>0&&v<1); A_eff=validUV?q.A:0; sigma from A_eff and original s/xz/streak. No candidate gate on original column.R.'},scope:'One historical576-ray pose only. Baseline governs t/ds/jitter/clip/cutoff; candidate transmittance integrated co-located cloud+rain on identical segments. Continuations beyond opacity-exit baseline are censored, not a new complete candidate rendering. No sourceRGB/image/FPS/native sampler/native flow/rebuild-cost claim.',differencesFromWGSL:replay.differencesFromWGSL,cacheSpecificLimits:['Reuses unchanged A evaluator from frozen phase2 oracle, including its node coordinate construction, half RNE and ideal CPU trilinear interpolation. Does not emulate native sampler or all GPU rounding.','Original mapping is recomputed with identical f32 operations from original s and independently hash-compared at every rainRegion point, including A0; cached s is never used.','A can become positive where original A=0; UV gate is preserved but no original column.R gate is allowed.','Original quantity/growth/clock/phase and all baseline trajectory/termination decisions retained. No additional boundary/growth/amount probes were executed.','Rain sigma factorization changes floating-point multiplication grouping; uncached-original residual is separately measured, not attributed to cache interpolation.','Timestamp is CPU diagnostic duration of a lazy Map oracle, not dense cache build, storage/copy or renderer performance.'],payloadHashes:{protocol:sha(readFileSync(this.p.out+'/PROTOCOL.md')),protocolUVAddendum:sha(readFileSync(this.p.out+'/PROTOCOL-UV-ADDENDUM.md')),preRunManifest:sha(readFileSync(this.p.out+'/pre-run-manifest.json')),replay:sha(readFileSync(this.p.out+'/replay.ts')),auditCore:sha(readFileSync(import.meta.path)),oracleCore:sha(readFileSync(this.p.out+'/oracle-core.ts')),preparation:sha(readFileSync(this.p.out+'/preparation.json'))},grids:reports};
  writeFileSync(this.p.out+'/result.json',JSON.stringify(report,null,2)+'\n');
  console.error(JSON.stringify({phase:'amplitude-audit-complete',status:report.status,wallMs:report.runtime.wallMs,checks,grids:reports.map(c=>({size:c.size,nodes:c.lazyUniqueNodes,gates:c.gates,metrics:c.metrics,censored:c.censoredContinuationCount}))}));
  if(!report.baselineMatch)throw new Error('Audit provenance/baseline/mapping verification failed; do not present as valid candidate qualification');
 }
}
