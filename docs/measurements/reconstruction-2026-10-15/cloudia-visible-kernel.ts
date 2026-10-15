/** Planar CPU opacity-kernel model, no volume/GPU/source-light generation.
 * Usage: bun /private/tmp/cloudia-visible-kernel.ts [output.json]
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const output=process.argv[2]??'/private/tmp/cloudia-visible-kernel.json';
const modulation=.8,oldOuterFieldKm=.025,originalGainPerKm=10,originalCentreDepthKm=.05;
const cutoff=1e-6,stepsMetres=[.25,.5],failures:string[]=[];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const check=(condition:boolean,message:string)=>{if(!condition)failures.push(message);};
// All required arguments are <=sqrt(2.4); the convergent entire power series
// avoids depending on a platform erf approximation or an extra package.
function erf(z:number){
  let power=z,sum=z;
  for(let n=1;n<100;n++){
    power*=-z*z/n;const term=power/(2*n+1);sum+=term;
    if(Math.abs(term)<1e-18)break;
  }
  return 2/Math.sqrt(Math.PI)*sum;
}
function model(gainPerKm:number,betaPerKm:number){
  const width=1/gainPerKm,a=originalCentreDepthKm-width/2,b=originalCentreDepthKm+width/2,lambda=betaPerKm*modulation;
  const u=(depthKm:number)=>.5+(depthKm*originalGainPerKm-.5)*(gainPerKm/originalGainPerKm);
  const rho=(depthKm:number)=>modulation*clamp(u(depthKm));
  const tau=(depthKm:number)=>depthKm<=a?0:depthKm<b?lambda*(depthKm-a)**2/(2*width):lambda*(depthKm-originalCentreDepthKm);
  const tauEnd=lambda*width/2;
  const distanceAtTau=(value:number)=>value<=tauEnd?a+Math.sqrt(2*width*value/lambda):originalCentreDepthKm+value/lambda;
  // E[D]=integral T(d)dd; E[D²]=2 integral d*T(d)dd for the full normalized
  // absorption kernel k=-(d/dd)T. Split into empty lead, ramp and constant tail.
  const c=lambda/(2*width),A0=Math.sqrt(Math.PI)/(2*Math.sqrt(c))*erf(Math.sqrt(c)*width);
  const rampTransmission=Math.exp(-tauEnd),A1=(1-rampTransmission)/(2*c);
  const mean=a+A0+rampTransmission/lambda;
  const second=a*a+2*a*A0+2*A1+2*rampTransmission*(b/lambda+1/lambda**2);
  const variance=second-mean*mean;
  check(a>=0&&variance>=0,'Invalid planar model');
  const tau1=distanceAtTau(1);
  check(Math.abs(tau(tau1)-1)<1e-12,'Analytic tau1 identity failed');
  return {gainPerKm,betaPerKm,width,a,b,lambda,tauEnd,u,rho,tau,distanceAtTau,fullMean:mean,fullSecondMoment:second,fullStandardDeviation:Math.sqrt(variance),tau1};
}
function integrate(m:ReturnType<typeof model>,stepMetres:number){
  const step=stepMetres/1000;let mass=0,first=0,second=0,exactMassSum=0,end=0,tau1Numeric:number|null=null,segments=0;
  for(let entry=0;Math.exp(-m.tau(entry))>=cutoff;entry+=step){
    end=entry+step;const midpoint=entry+step*.5,tauStart=m.tau(entry),tauEnd=m.tau(end);
    const sigma=m.betaPerKm*m.rho(midpoint),kernel=sigma*Math.exp(-m.tau(midpoint)),weight=kernel*step;
    mass+=weight;first+=weight*midpoint;second+=weight*midpoint*midpoint;
    exactMassSum+=Math.exp(-tauStart)-Math.exp(-tauEnd);segments++;
    if(tau1Numeric===null&&tauStart<=1&&tauEnd>=1)tau1Numeric=entry+(1-tauStart)/(tauEnd-tauStart)*step;
    if(segments>100000)throw new Error('Planar integration exceeded its bound');
  }
  const tailTransmission=Math.exp(-m.tau(end)),exactMass=1-tailTransmission;
  // The cutoff lies in the constant-density tail for all six cases.
  check(end>m.b,'Cutoff did not reach the constant-density tail');
  const exactFirst=m.fullMean-tailTransmission*(end+1/m.lambda);
  const exactSecond=m.fullSecondMoment-tailTransmission*(end*end+2*end/m.lambda+2/m.lambda**2);
  const exactMean=exactFirst/exactMass,exactStd=Math.sqrt(exactSecond/exactMass-exactMean*exactMean);
  const mean=first/mass,std=Math.sqrt(second/mass-mean*mean);
  check(tau1Numeric!==null,'Numerical tau1 crossing was not found');
  check(Math.abs(exactMassSum-exactMass)<1e-12,'Segment transmission differences fail mass identity');
  check(Math.abs(mass-exactMass)<1e-4,'Midpoint kernel mass did not converge');
  check(Math.abs(mean-exactMean)*1000<.01&&Math.abs(std-exactStd)*1000<.01,'Midpoint kernel moments differ from analytic reference by >=1cm');
  check(Math.abs(tau1Numeric!-m.tau1)*1000<.002,'Numerical tau1 differs from analytic reference by >=2mm');
  return {stepMetres,segments,cutoffDepthMetres:end*1000,cutoffFieldCoordinateKm:oldOuterFieldKm+end,tailTransmission,
    numericalKernelMass:mass,exactMassBeforeCutoff:exactMass,transmissionDifferenceMass:exactMassSum,massAbsoluteError:Math.abs(mass-exactMass),
    meanDepthMetres:mean*1000,standardDeviationDepthMetres:std*1000,tau1DepthMetres:tau1Numeric!*1000,
    analyticConditionalBeforeCutoff:{meanDepthMetres:exactMean*1000,standardDeviationDepthMetres:exactStd*1000},
    errorAgainstAnalytic:{meanMetres:(mean-exactMean)*1000,standardDeviationMetres:(std-exactStd)*1000,tau1Metres:(tau1Numeric!-m.tau1)*1000}};
}
const cases=[10,32].flatMap(gain=>[18,50,60].map(beta=>{
  const m=model(gain,beta),numerical=stepsMetres.map(step=>integrate(m,step));
  return {gainPerKm:gain,betaPerKm:beta,maximumDensity:modulation,interiorExtinctionPerKm:m.lambda,interiorMeanFreePathMetres:1000/m.lambda,
    profile:{originalCentreFieldKm:oldOuterFieldKm+originalCentreDepthKm,centreDepthMetres:originalCentreDepthKm*1000,outerDepthMetres:m.a*1000,innerDepthMetres:m.b*1000,transitionWidthMetres:m.width*1000,tauAtEndOfRamp:m.tauEnd},
    analyticFullKernel:{mass:1,meanDepthMetres:m.fullMean*1000,standardDeviationDepthMetres:m.fullStandardDeviation*1000,tau1DepthMetres:m.tau1*1000,tau1FieldCoordinateKm:oldOuterFieldKm+m.tau1,tau1Region:m.tauEnd>=1?'linear-density ramp':'constant-density interior',tau1MeasuredFromOwnOuterMetres:(m.tau1-m.a)*1000,quantileDepthMetres:Object.fromEntries([.1,.5,.9,.99].map(q=>[String(q),m.distanceAtTau(-Math.log1p(-q))*1000]))},
    numerical,convergence:{meanDifferenceMetres:numerical[1].meanDepthMetres-numerical[0].meanDepthMetres,standardDeviationDifferenceMetres:numerical[1].standardDeviationDepthMetres-numerical[0].standardDeviationDepthMetres,tau1DifferenceMetres:numerical[1].tau1DepthMetres-numerical[0].tau1DepthMetres}};
}));
const report={date:new Date().toISOString(),method:'Analytic planar opacity-kernel model and CPU float64 midpoint quadrature only. All depths are measured from the OLD outer field coordinate F=.025km (d=F-.025km), including the empty lead of the sharp profile. F is treated as an affine physical distance with unit gradient solely in this model. rho=M*clamp(U), sigma=beta*rho, T=exp(-tau), kernel=sigma*T. Integration uses exact piecewise tau evaluated at segment midpoints with0.25/0.5m steps until endpoint T<1e-6. Numeric moments are normalized by integrated midpoint mass. Analytic full moments and separately conditioned cutoff moments distinguish quadrature error from discarded tail. tau1 numeric uses linear interpolation of exact endpoint depths. No volume generation, half quantization, trilinear/voxel reconstruction, camera, scene source variation, GPU/rendering, tone mapping or pixel-sharpness prediction.',
  parameters:{modulation,oldOuterFieldKm,originalGainPerKm,originalCentreFieldKm:oldOuterFieldKm+originalCentreDepthKm,gainsPerKm:[10,32],betasPerKm:[18,50,60],stepsMetres,transmissionCutoff:cutoff},
  formula:{originalU:'Uold=(F-.025km)*10/km',sharpU:'Unew=.5+(Uold-.5)*(gain/10)',density:'rho=.8*clamp(Unew,0,1)',lambda:'lambda=beta*.8 [km^-1]',depth:'d=F-.025km; centre=.05km; a=centre-.5/gain; b=centre+.5/gain; w=1/gain',tau:'0 when d<=a; lambda*(d-a)^2/(2w) for a<d<b; lambda*(d-centre) for d>=b',tau1:'a+sqrt(2w/lambda) if lambda*w/2>=1; centre+1/lambda otherwise',kernel:'k(d)=beta*rho(d)*exp(-tau(d)); integral[0,infinity] k(d) dd=1'},
  scriptSha256:createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),cases,failures,passed:failures.length===0};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,passed:report.passed,summary:cases.map(c=>({gain:c.gainPerKm,beta:c.betaPerKm,meanMetres:c.analyticFullKernel.meanDepthMetres,stdMetres:c.analyticFullKernel.standardDeviationDepthMetres,tau1Metres:c.analyticFullKernel.tau1DepthMetres,tau1Region:c.analyticFullKernel.tau1Region,stepConvergence:c.convergence})),failures}));
if(failures.length)process.exitCode=1;
