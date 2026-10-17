/** One CPU diagnostic; root executor only. No UI, renderer, new dependency or volume serialization. */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url)),out=process.argv[2];
if(!out)throw new Error('Use launch.py --bun <existing Bun executable>; do not launch a second case.');
const output=resolve(out),seed=74,resolution=64,mapSize=64,texels=mapSize**2;
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const bytes=(a:ArrayBufferView)=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
const json=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n');
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}

async function main(){
  const freezeBytes=readFileSync(resolve(root,'FREEZE.json')),freeze=JSON.parse(freezeBytes.toString());
  for(const entry of freeze.files){
    assert(typeof entry.path==='string'&&!entry.path.startsWith('/')&&!entry.path.split('/').includes('..'),'Invalid frozen path');
    const raw=readFileSync(resolve(root,entry.path));
    assert(raw.byteLength===entry.bytes&&sha(raw)===entry.sha256,`Frozen input drift: ${entry.path}`);
  }
  const protocol=JSON.parse(readFileSync(resolve(root,'PROTOCOL.json'),'utf8'));
  assert(protocol.singleCase.seed===seed&&protocol.singleCase.macroResolution===resolution&&protocol.singleCase.rainMapResolution===mapSize,'Fixed case drift');
  const canonical=await import('./baseline/src/cumulonimbus/precipitation');
  const volumeModule=await import('./instrumented/volume');
  const derived=await import('./instrumented/precipitation');
  const {BOUNDS_MIN,BOUNDS_SIZE,iceHeights}=volumeModule;
  assert(iceHeights(seed)[0]>2.5,'Optical F32 and liquid source are not comparable without a phase conversion; stop, do not rescale');
  const start=performance.now(),progress:Array<{fraction:number;elapsedMs:number}>=[];
  let hookCalls=0,hook:Record<string,unknown>|undefined,comparison:Record<string,unknown>|undefined;
  const generationStart=performance.now();
  const generated=volumeModule.generateVolume(resolution,seed,fraction=>{
    const row={fraction,elapsedMs:performance.now()-start};progress.push(row);console.log(JSON.stringify({stage:'original-progress',...row}));
  },(fine,envelope)=>{
    assert(++hookCalls===1,'More than one fine-density callback');
    assert(fine instanceof Float32Array&&fine.length===resolution**3&&envelope.size===resolution&&envelope.data.byteLength===resolution**3*4,'Unexpected borrowed buffer shape');
    const entered=performance.now()-start;
    const before={fineF32:sha(bytes(fine)),macroRGBA:sha(envelope.data)};
    let fineMin=Infinity,fineMax=-Infinity;
    for(const value of fine){assert(Number.isFinite(value),'Nonfinite optical density');fineMin=Math.min(fineMin,value);fineMax=Math.max(fineMax,value);}
    const t=performance.now(),reference=canonical.precipitationFootprint(envelope,mapSize),canonicalMs=performance.now()-t;
    const tMacro=performance.now(),macro=derived.precipitationFootprintFromScalarDensity(resolution,i=>envelope.data[i*4]/255,mapSize),derivedMacroMs=performance.now()-tMacro;
    assert(reference.byteLength===8192&&macro.byteLength===8192&&reference.every((v,i)=>v===macro[i]),'STOP: same-reducer macro result differs from the original canonical reducer');
    const tFine=performance.now(),candidate=derived.precipitationFootprintFromScalarDensity(resolution,i=>fine[i],mapSize),fineMs=performance.now()-tFine;
    const after={fineF32:sha(bytes(fine)),macroRGBA:sha(envelope.data)};
    assert(before.fineF32===after.fineF32&&before.macroRGBA===after.macroRGBA,'Reducer mutated a borrowed generator buffer');
    writeFileSync(resolve(output,'macro-rg.bin'),macro);writeFileSync(resolve(output,'fine-rg.bin'),candidate);
    const q=(values:number[])=>{
      if(!values.length)return null;values.sort((a,b)=>a-b);
      return {count:values.length,min:values[0],p50:values[Math.floor((values.length-1)*.5)],p95:values[Math.floor((values.length-1)*.95)],max:values.at(-1)};
    };
    const profiles=()=>Array.from({length:mapSize},()=>({macroR:0,fineR:0,macroPositive:0,finePositive:0}));
    const rows=profiles(),columns=profiles();
    const transition={bothZero:0,bothPositive:0,macroOnly:0,fineOnly:0};
    let sumA=0,sumB=0,sumAA=0,sumBB=0,sumAB=0,sumAbsR=0,sumAbsG=0,differentR=0,differentG=0,maxAbsR=0,maxAbsG=0;
    let ax=0,az=0,bx=0,bz=0,macroBaseMoment=0,fineBaseMoment=0;
    const ratios:number[]=[],baseBoth:number[]=[],baseUnion:number[]=[],baseHalo:number[]=[];
    const csv=['x,z,worldXKm,worldZKm,macroR,fineR,deltaR,macroG,fineG,decodedBaseDeltaKm,supportClass'];
    const ppm=new Uint8Array(mapSize*4*mapSize*3);
    const isUnion=(x:number,z:number)=>x>=0&&x<mapSize&&z>=0&&z<mapSize&&(macro[(z*mapSize+x)*2]>0||candidate[(z*mapSize+x)*2]>0);
    for(let z=0;z<mapSize;z++)for(let x=0;x<mapSize;x++){
      const i=z*mapSize+x,a=macro[i*2],b=candidate[i*2],g0=macro[i*2+1],g1=candidate[i*2+1],dr=b-a,dg=g1-g0;
      const wx=BOUNDS_MIN[0]+(x+.5)/mapSize*BOUNDS_SIZE[0],wz=BOUNDS_MIN[2]+(z+.5)/mapSize*BOUNDS_SIZE[2];
      const kind=a?(b?'bothPositive':'macroOnly'):(b?'fineOnly':'bothZero');transition[kind]++;
      sumA+=a;sumB+=b;sumAA+=a*a;sumBB+=b*b;sumAB+=a*b;sumAbsR+=Math.abs(dr);sumAbsG+=Math.abs(dg);
      differentR+=Number(dr!==0);differentG+=Number(dg!==0);maxAbsR=Math.max(maxAbsR,Math.abs(dr));maxAbsG=Math.max(maxAbsG,Math.abs(dg));
      ax+=a*wx;az+=a*wz;bx+=b*wx;bz+=b*wz;macroBaseMoment+=a*(g0/255*3-.5);fineBaseMoment+=b*(g1/255*3-.5);
      if(a&&b){ratios.push(b/a);baseBoth.push(dg*3/255);}
      if(a||b)baseUnion.push(dg*3/255);
      else{
        let halo=false;
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)halo ||= isUnion(x+dx,z+dz);
        if(halo)baseHalo.push(dg*3/255);
      }
      for(const profile of [rows[z],columns[x]]){profile.macroR+=a;profile.fineR+=b;profile.macroPositive+=Number(a>0);profile.finePositive+=Number(b>0);}
      csv.push([x,z,wx,wz,a,b,dr,g0,g1,dg*3/255,kind].join(','));
      const colors=[[a,a,a],[b,b,b],[Math.abs(dr),Math.abs(dr),Math.abs(dr)],[Math.max(0,dr),0,Math.max(0,-dr)]];
      for(let panel=0;panel<4;panel++)ppm.set(colors[panel],(z*mapSize*4+panel*mapSize+x)*3);
    }
    let spatialTV=0;
    if(sumA&&sumB)for(let i=0;i<texels;i++)spatialTV+=Math.abs(macro[i*2]/sumA-candidate[i*2]/sumB)*.5;
    const varianceA=sumAA/texels-(sumA/texels)**2,varianceB=sumBB/texels-(sumB/texels)**2;
    comparison={mapSize,texels,encodedUnit:'R/G UNORM8 codes; G decoded as 3*(G/255)-.5 km',
      macroSHA256:sha(macro),fineSHA256:sha(candidate),transition,
      r:{sumMacroCodes:sumA,sumFineCodes:sumB,meanMacro:sumA/texels/255,meanFine:sumB/texels/255,
        differentTexels:differentR,maxAbsoluteCodeDelta:maxAbsR,meanAbsoluteCodeDelta:sumAbsR/texels,
        coefficientVariationMacro:sumA?Math.sqrt(Math.max(0,varianceA))/(sumA/texels):null,
        coefficientVariationFine:sumB?Math.sqrt(Math.max(0,varianceB))/(sumB/texels):null,
        pearsonAllTexels:varianceA>0&&varianceB>0?(sumAB/texels-sumA*sumB/texels**2)/Math.sqrt(varianceA*varianceB):null,
        spatialDistributionTV:sumA&&sumB?spatialTV:null,sharedPositiveFineToMacroRatios:q(ratios)},
      g:{differentTexels:differentG,maxAbsoluteCodeDelta:maxAbsG,meanAbsoluteCodeDelta:sumAbsG/texels,
        baseDeltaKmBothPositive:q(baseBoth),baseDeltaKmPositiveUnion:q(baseUnion),baseDeltaKmZeroRUnionHalo:q(baseHalo)},
      macro:{supportBoundsKm:canonical.precipitationSourceBounds(macro,mapSize),centroidXZKm:sumA?[ax/sumA,az/sumA]:null,rWeightedDecodedBaseKm:sumA?macroBaseMoment/sumA:null},
      fine:{supportBoundsKm:canonical.precipitationSourceBounds(candidate,mapSize),centroidXZKm:sumB?[bx/sumB,bz/sumB]:null,rWeightedDecodedBaseKm:sumB?fineBaseMoment/sumB:null},
      rowProfilesZIncreasing:rows,columnProfilesXIncreasing:columns,
      interpretation:'Normalized spatial TV/correlation/ratios are diagnostic comparisons only. Neither generated map is normalized or fitted. Code >0 defines support; no extra artistic threshold.'};
    writeFileSync(resolve(output,'spatial.csv'),csv.join('\n')+'\n');
    writeFileSync(resolve(output,'comparison.ppm'),Buffer.concat([Buffer.from(`P6\n# macroR | fineR | absDeltaR | positiveDeltaRed-negativeDeltaBlue; z increases down\n${mapSize*4} ${mapSize}\n255\n`),ppm]));
    hook={status:'COMPLETE_BORROWED_FINE_DENSITY',calls:hookCalls,enteredElapsedMs:entered,completedElapsedMs:performance.now()-start,
      location:'After reused density F32 is replaced with sampleCloudDensity*materialExtinction/18; before first original light bake',
      units:{macro:'R8/255',fine:'relative optical density normalized by liquid extinction18/km',iceStartKm:iceHeights(seed)[0],sourceTopKm:2.5,lowerSourcePhase:'liquid; no conversion or artistic scale applied'},
      borrowed:{fineElements:fine.length,fineBytes:fine.byteLength,fineMin,fineMax,macroRGBABytes:envelope.data.byteLength,beforeSHA256:before,afterSHA256:after,unchanged:true},
      macroReducerByteEquality:{pass:true,bytes:macro.length,canonicalSHA256:sha(reference),sameReducerSHA256:sha(macro)},
      durationsMs:{canonicalReducer:canonicalMs,sameReducerMacro:derivedMacroMs,sameReducerFine:fineMs},
      retainedInputsAfterCallback:false,comparison};
    json('hook.json',hook);console.log(JSON.stringify({stage:'fine-hook-complete',calls:hookCalls,macroEquality:true,macro:sha(macro),fine:sha(candidate)}));
  });
  assert(hookCalls===1&&hook&&comparison,'Missing complete fine-density hook');
  assert(generated.size===64&&generated.detail.size===64&&generated.data.byteLength===64**3*4&&generated.sunsetLight.byteLength===64**3*2,'Original generator did not complete with expected payloads');
  const expectedLightFractions=[.55+.09,.55+.09*2,.55+.09*3,.82+.09,.82+.09*2];
  const firstAfterHook=progress.filter(row=>row.elapsedMs>=Number(hook.completedElapsedMs));
  let cursor=0;
  for(const fraction of expectedLightFractions){
    const found=firstAfterHook.findIndex((row,i)=>i>=cursor&&row.fraction===fraction);
    assert(found>=cursor,'Missing original post-hook light-bake progress');cursor=found+1;
  }
  json('result.json',{status:'COMPLETE_CPU_SOURCE_DIAGNOSTIC_ONLY',seed,macroResolution:64,detailResolution:64,rainMapResolution:64,
    runtime:{name:'Bun',version:process.versions.bun??null},
    originalGenerateVolumeCalls:1,allOriginalLightBakeProgressObserved:true,generationIncludingHookMs:performance.now()-generationStart,
    progress,sourceFreezeSHA256:sha(freezeBytes),protocolSHA256:sha(readFileSync(resolve(root,'PROTOCOL.json'))),
    completedVolume:{macroRGBABytes:generated.data.byteLength,macroRGBASHA256:sha(generated.data),sunsetRGBytes:generated.sunsetLight.byteLength,sunsetRGSHA256:sha(generated.sunsetLight),detailRGBABytes:generated.detail.data.byteLength,detailRGBASHA256:sha(generated.detail.data),supportBounds:generated.supportBounds},
    hook,comparison,limits:'One seed at64/64; not product256/128, native image, GPU equality, terrain coupling, motion, worker integration, physical rain or FPS evidence.'});
  console.log(JSON.stringify({status:'COMPLETE_CPU_SOURCE_DIAGNOSTIC_ONLY',generationMs:performance.now()-generationStart}));
}
await main().catch(error=>{json('failure.json',{status:'FAIL_TERMINAL_NO_RETRY',name:error?.name,message:String(error?.message??error),stack:String(error?.stack??'')});console.error(error);process.exitCode=1;});
