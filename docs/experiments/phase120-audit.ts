/** CPU mathematics audit only; no volume generation, GPU, browser or dependencies.
 * Usage: bun cloudia-phase120-audit.ts [output.json] [parent-shader.ts] [candidate.patch]
 * Parent snapshot: git show d4c01ac:src/cumulonimbus/cloudShader.ts (read only).
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const output=resolve(process.argv[2]??'/private/tmp/cloudia-phase120-audit.json');
const shaderParentPath=resolve(process.argv[3]??'/private/tmp/cloudia-phase120-parent.ts');
const patchPath=resolve(process.argv[4]??'/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-15-phase/phase120-v32.patch');
const shaderParent=readFileSync(shaderParentPath,'utf8'),patch=readFileSync(patchPath,'utf8');
const sha=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const gitBlob=(s:string)=>createHash('sha1').update(`blob ${Buffer.byteLength(s)}\0`).update(s).digest('hex');
/** Reconstruct only cloudShader in memory. Every removed/context line must match. */
function applyRecordedShaderPatch(parent:string,diff:string){
 const marker='diff --git a/src/cumulonimbus/cloudShader.ts b/src/cumulonimbus/cloudShader.ts';
 const section=diff.slice(diff.indexOf(marker)).split('\ndiff --git ')[0];
 if(!section.startsWith(marker))throw new Error('Shader diff is absent from recorded patch');
 const index=section.match(/^index ([a-f0-9]+)\.\.([a-f0-9]+) /m);
 if(!index||!gitBlob(parent).startsWith(index[1]))throw new Error('Live parent is not the parent recorded by the patch');
 const input=parent.split('\n'),lines=section.split('\n'),result:string[]=[];
 let cursor=0,hunks=0;
 for(let line=0;line<lines.length;line++){
  const header=lines[line].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if(!header)continue;
  const start=Number(header[1])-1,oldCount=Number(header[2]??1),newCount=Number(header[4]??1);
  result.push(...input.slice(cursor,start));cursor=start;
  if(result.length!==Number(header[3])-1)throw new Error('New hunk position differs');
  let read=0,written=0;hunks++;
  for(line++;line<lines.length;line++){
   const row=lines[line],prefix=row[0];
   if(![' ','+','-'].includes(prefix)){line--;break;}
   const content=row.slice(1);
   if(prefix!=='+'&&input[cursor]!==content)throw new Error(`Patch context differs at parent line ${cursor+1}`);
   if(prefix!=='-'){result.push(content);written++;}
   if(prefix!=='+'){cursor++;read++;}
  }
  if(read!==oldCount||written!==newCount)throw new Error('Patch hunk counts differ');
 }
 result.push(...input.slice(cursor));const candidate=result.join('\n');
 if(!hunks||!gitBlob(candidate).startsWith(index[2]))throw new Error('Reconstructed candidate hash differs from patch');
 return {candidate,hunks,parentGitBlob:gitBlob(parent),candidateGitBlob:gitBlob(candidate),expectedParentPrefix:index[1],expectedCandidatePrefix:index[2]};
}
const reconstructed=applyRecordedShaderPatch(shaderParent,patch),shader=reconstructed.candidate;
const parameters={lengthKm:.12,amplitude:.30,baselineAnisotropicWeight:.55,forwardG:.68,backG:-.25,forwardWeight:.82,backWeight:.18,liquidExtinctionPerKm:18,iceExtinctionPerKm:6.5};
const mix=(a:number,b:number,t:number)=>a*(1-t)+b*t;
const extinction=(ice:number)=>mix(18,6.5,ice);
const hg=(mu:number,g:number)=>(1-g*g)/Math.max(1+g*g-2*g*mu,.04)**1.5;
const anisotropic=(mu:number)=>.82*hg(mu,.68)+.18*hg(mu,-.25);
const weight=(rho:number,ice:number,amplitude=.30,lengthKm=.12)=>.55+amplitude*(1-ice)*Math.exp(-rho*extinction(ice)*lengthKm);
const phase=(mu:number,rho:number,ice:number,amplitude=.30,lengthKm=.12)=>mix(1,anisotropic(mu),weight(rho,ice,amplitude,lengthKm));
const originalPhase=(mu:number)=>.45+.55*anisotropic(mu);
const failures:string[]=[];
const check=(condition:boolean,message:string)=>{if(!condition)failures.push(message);};

/** Gauss-Legendre nodes and weights on [-1,1], Newton iteration in float64. */
function quadrature(n:number){
 const points:Array<{mu:number;weight:number}>=[];
 for(let i=0;i<Math.ceil(n/2);i++){
  let x=Math.cos(Math.PI*(i+.75)/(n+.5)),derivative=0;
  for(let iteration=0;iteration<32;iteration++){
   let p0=1,p1=x;
   for(let j=2;j<=n;j++){const p=((2*j-1)*x*p1-(j-1)*p0)/j;p0=p1;p1=p;}
   derivative=n*(x*p1-p0)/(x*x-1);
   const next=x-p1/derivative;if(Math.abs(next-x)<2e-16){x=next;break;}x=next;
  }
  let p0=1,p1=x;
  for(let j=2;j<=n;j++){const p=((2*j-1)*x*p1-(j-1)*p0)/j;p0=p1;p1=p;}
  derivative=n*(x*p1-p0)/(x*x-1);
  const w=2/((1-x*x)*derivative*derivative);
  points.push({mu:-x,weight:w});if(n-1-i!==i)points.push({mu:x,weight:w});
 }
 return points.sort((a,b)=>a.mu-b.mu);
}
const rhoValues=[0,.01,.05,.1,.25,.5,.75,1],iceValues=[0,.25,.5,.75,1];
const orders=[64,128],angularNormalization=orders.map(order=>{
 const points=quadrature(order),weightSum=points.reduce((s,p)=>s+p.weight,0);
 const cases=rhoValues.flatMap(rho=>iceValues.map(ice=>{
  // Isotropic-relative phase: average over the sphere is (1/2) integral P dmu.
  const mean=points.reduce((s,p)=>s+.5*p.weight*phase(p.mu,rho,ice),0);
  return {rho,ice,phaseWeight:weight(rho,ice),sphericalMean:mean,absoluteError:Math.abs(mean-1)};
 }));
 const maxError=Math.max(...cases.map(c=>c.absoluteError));
 check(Math.abs(weightSum-2)<1e-12,`Quadrature weights fail at order ${order}`);
 check(maxError<1e-11,`Normalization fails at order ${order}`);
 return {order,weightSum,maximumAbsoluteError:maxError,cases};
});

let minimum=Infinity,maximum=-Infinity,minimumWeight=Infinity,maximumWeight=-Infinity;
let maxIceEndpointError=0,maxZeroAmplitudeError=0;
const angularGridIntervals=8192;
for(let i=0;i<=angularGridIntervals;i++){
 const mu=-1+2*i/angularGridIntervals;
 for(const rho of rhoValues)for(const ice of iceValues){
  const value=phase(mu,rho,ice),a=weight(rho,ice);
  minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);
  minimumWeight=Math.min(minimumWeight,a);maximumWeight=Math.max(maximumWeight,a);
  check(Number.isFinite(value)&&value>=0,`Invalid phase at ${mu}/${rho}/${ice}`);
 }
 for(const rho of rhoValues){
  maxIceEndpointError=Math.max(maxIceEndpointError,Math.abs(phase(mu,rho,1)-originalPhase(mu)));
  maxZeroAmplitudeError=Math.max(maxZeroAmplitudeError,Math.abs(phase(mu,rho,0,0)-originalPhase(mu)));
 }
}
check(minimumWeight>=.55&&maximumWeight<=.85+1e-14,'Non-convex phase mixture');
check(maxIceEndpointError<1e-13,'Fully icy endpoint differs from original phase');
check(maxZeroAmplitudeError<1e-13,'Zero amplitude differs from original phase');
check(Math.abs(.5*18*.12-1.08)<1e-14,'Kilometre / inverse-kilometre unit mismatch');

/** Exact exponential segment recurrence in a homogeneous scalar medium.
 * No early cutoff/jitter: this proves only constant-source integration algebra. */
const distanceKm=.413,stepMetres=[1.5,3,6,12,24,48],background=.16;
function integrate(rho:number,ice:number,mu:number,stepKm:number,wrongStepDependentPhase=false){
 const sigma=extinction(ice)*rho;
 const fixedPhase=phase(mu,rho,ice,.30,wrongStepDependentPhase?stepKm:.12);
 const source=1.65*Math.exp(-2)*fixedPhase+.08+.13;
 let position=0,transmittance=1,radiance=0,segments=0;
 while(position<distanceKm-1e-14){
  const ds=Math.min(stepKm,distanceKm-position),opacity=-Math.expm1(-sigma*ds);
  radiance+=transmittance*opacity*source;transmittance*=1-opacity;
  position+=ds;segments++;
 }
 const actual=radiance+background*transmittance,exactT=Math.exp(-sigma*distanceKm);
 const exact=(1-exactT)*source+exactT*background;
 return {stepMetres:stepKm*1000,segments,phase:fixedPhase,source,transmittance,radianceWithBackground:actual,analyticRadiance:exact,absoluteRadianceError:Math.abs(actual-exact),absoluteTransmittanceError:Math.abs(transmittance-exactT)};
}
const homogeneous=rhoValues.filter(r=>[0,.1,.5,1].includes(r)).flatMap(rho=>[0,.5,1].flatMap(ice=>[-.21380050955106467,.8].map(mu=>{
 const steps=stepMetres.map(m=>integrate(rho,ice,mu,m/1000));
 const values=steps.map(s=>s.radianceWithBackground),phases=steps.map(s=>s.phase);
 return {rho,ice,mu,sigmaPerKm:extinction(ice)*rho,tauReference:extinction(ice)*rho*.12,steps,stepRadianceSpread:Math.max(...values)-Math.min(...values),phaseSpread:Math.max(...phases)-Math.min(...phases)};
})));
const maxIntegrationError=Math.max(...homogeneous.flatMap(c=>c.steps.map(s=>s.absoluteRadianceError)));
const maxTransmittanceError=Math.max(...homogeneous.flatMap(c=>c.steps.map(s=>s.absoluteTransmittanceError)));
const maxStepSpread=Math.max(...homogeneous.map(c=>c.stepRadianceSpread));
check(maxIntegrationError<1e-12&&maxTransmittanceError<1e-12&&maxStepSpread<1e-12,'Homogeneous integration depends on step');
check(homogeneous.every(c=>c.phaseSpread===0),'Material phase depends on step');
const wrongSteps=stepMetres.map(m=>integrate(.5,0,-.21380050955106467,m/1000,true));
const wrongSpread=Math.max(...wrongSteps.map(s=>s.radianceWithBackground))-Math.min(...wrongSteps.map(s=>s.radianceWithBackground));
check(wrongSpread>1e-3,'Negative control did not detect a segment-length-dependent phase');

const excerpts={phaseWeight:shader.split('\n').find(l=>l.includes('let phaseWeight='))?.trim(),phaseDensity:shader.split('\n').find(l=>l.includes('let phaseDensity='))?.trim(),phaseErosion:shader.split('\n').find(l=>l.includes('let phaseErosion='))?.trim()};
const expectedSourceForm=Boolean(excerpts.phaseWeight?.includes('0.55+0.30*(1.0-ice)*exp(-phaseDensity*mix(extinction,iceExtinction,ice)*0.12)'));
const densityBeforeMicro=shader.indexOf('let phaseDensity=')>=0&&shader.indexOf('let phaseDensity=')<shader.indexOf('let microWeight=');
const provenanceFailures:string[]=[];
if(!expectedSourceForm)provenanceFailures.push('Recorded shader weight is not the audited formula');
if(!densityBeforeMicro)provenanceFailures.push('Recorded phase density does not precede camera micro erosion');
const report={date:new Date().toISOString(),method:'Deterministic float64 CPU mathematics audit. Hand port of the recorded v32 formula, not WGSL execution/readback, volume sampling, real GPU integration, image quality or performance evidence. Candidate shader is reconstructed in memory from the immutable patch and its verified parent, not claimed to be the current production source. All patch context and Git blob hashes must match. Gauss-Legendre integrates axisymmetric phase with solid-angle factor 1/2; positivity also has an analytic convex-mixture proof. Homogeneous recurrence uses constant density/source, clipped final segments, no early cutoff, no jitter and no camera micro erosion. The negative control deliberately replaces fixed120m by march segment length.',parameters,provenance:{shaderParentPath,shaderParentSha256:sha(shaderParent),patchPath,patchSha256:sha(patch),shaderCandidateSha256:sha(shader),shaderParentGitBlob:reconstructed.parentGitBlob,shaderCandidateGitBlob:reconstructed.candidateGitBlob,expectedParentGitPrefix:reconstructed.expectedParentPrefix,expectedCandidateGitPrefix:reconstructed.expectedCandidatePrefix,verifiedPatchHunks:reconstructed.hunks,scriptSha256:sha(readFileSync(import.meta.filename)),sourceExcerpts:excerpts,expectedSourceForm,densityBeforeMicro,failures:provenanceFailures,passed:provenanceFailures.length===0,source:'https://pbr-book.org/3ed-2018/Volume_Scattering/Phase_Functions',primaryMotivation:'https://www.glowybits.com/talks/real-time_samurai_cinema/real-time_samurai_cinema.pdf#page=97'},angularNormalization,positivity:{angularGridIntervals,rhoValues,iceValues,minimumSampledPhase:minimum,maximumSampledPhase:maximum,minimumWeight,maximumWeight,analytic:'For rho>=0, ice in[0,1], a in[.55,.85]; HG(g) positive for |g|<1. Convex mixture therefore positive and normalized for every outgoing angle, not only quadrature samples. The denominator clamps do not activate: minima are (1-.68)^2=.1024 and (1-.25)^2=.5625, both>.04.'},endpoints:{maximumFullyIcyErrorAgainstOriginal:maxIceEndpointError,maximumZeroAmplitudeErrorAgainstOriginal:maxZeroAmplitudeError,interpretation:'Analytic identity; reported rounding uses float64 only and does not prove bit identity on the GPU.'},homogeneous:{distanceKm,stepMetres,background,maximumAbsoluteRadianceError:maxIntegrationError,maximumAbsoluteTransmittanceError:maxTransmittanceError,maximumAcrossStepRadianceSpread:maxStepSpread,cases:homogeneous},negativeControl:{method:'Incorrect phase uses the current step length in tauLocal instead of .12km; density/source are homogeneous.',rho:.5,ice:0,mu:-.21380050955106467,radianceSpread:wrongSpread,steps:wrongSteps},mathematicalFailures:failures,mathematicsPassed:failures.length===0,passed:failures.length===0&&provenanceFailures.length===0};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,passed:report.passed,quadratureMaximumError:Math.max(...angularNormalization.map(q=>q.maximumAbsoluteError)),minimumPhase:minimum,maximumPhase:maximum,iceEndpointError:maxIceEndpointError,homogeneousMaximumError:maxIntegrationError,homogeneousStepSpread:maxStepSpread,negativeControlStepSpread:wrongSpread,failures}));
if(!report.passed)process.exitCode=1;
