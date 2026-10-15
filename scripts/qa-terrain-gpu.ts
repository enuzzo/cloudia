/** Generate a standalone, explicitly activated terrain GPU audit. No GPU/server is started by this script. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {LANDSCAPE_WGSL,TERRAIN_HASH_ID,EARTH_RADIUS,GROUND_LEVEL,CAMERA_TERRAIN_CLEARANCE_KM,
  terrainHeight,coastDistance,landscapeSurfaceY,clampCameraAboveLandscape} from '../src/cumulonimbus/landscape';

type Vec3=[number,number,number];
interface TerrainSample {
  index:number;group:'critical-pose'|'orbit'|'terrain'|'near-coast';originF32:Vec3;
  cpuHeightKm:number;cpuCoastDistanceKm:number;cpuSurfaceYKm:number;
  clampedOrigin:Vec3;clampedOriginF32:Vec3;
  originalRadialHeightKm:number;clampedRadialHeightKm:number;
}
interface TerrainInput {
  kind:string;gpuStatus:'not-run';date:string;queryCount:number;method:string;
  cpuPrecision:string;coordinatePrecision:string;units:string;
  source:{currentHashId:string;currentFileSha256:string;currentWgslSha256:string;legacyParent:string;legacyFileSha256:string;legacyWgslSha256:string;scriptSha256:string};
  clearanceKm:number;advisoryToleranceKm:number;groups:Record<string,number>;
  criticalPose:{originalRequested:Vec3;queryIndex:number};samples:TerrainSample[];
}
interface PagePayload {input:TerrainInput;currentWgsl:string;legacyWgsl:string}

function installAuditPage(payload:PagePayload){
  const run=document.querySelector<HTMLButtonElement>('#run')!,download=document.querySelector<HTMLButtonElement>('#download')!;
  const status=document.querySelector<HTMLElement>('#status')!,pre=document.querySelector<HTMLElement>('[data-testid="terrain-audit-json"]')!;
  let report:Record<string,unknown>={...payload.input};
  const publish=()=>{pre.textContent=JSON.stringify(report,null,2);};publish();
  download.addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download='terrain-gpu-audit-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  async function checked<T>(device:GPUDevice,operation:()=>T|Promise<T>):Promise<T>{
    device.pushErrorScope('out-of-memory');device.pushErrorScope('internal');device.pushErrorScope('validation');
    let pending:Promise<T>;try{pending=Promise.resolve(operation());}catch(error){pending=Promise.reject(error);}
    const scopes=Promise.all([device.popErrorScope(),device.popErrorScope(),device.popErrorScope()]);
    const [result,captured]=await Promise.allSettled([pending,scopes]);
    if(result.status==='rejected')throw result.reason;if(captured.status==='rejected')throw captured.reason;
    const errors=captured.value.filter((error):error is GPUError=>error!==null);
    if(errors.length)throw new Error(errors.map(error=>error.message).join('; '));return result.value;
  }
  run.addEventListener('click',async()=>{
    run.disabled=true;download.disabled=true;status.textContent='Audit GPU in corso; nessuna misura di prestazioni.';
    let device:GPUDevice|null=null;const buffers:GPUBuffer[]=[];let readback:GPUBuffer|null=null;
    try{
      if(!navigator.gpu)throw new Error('WebGPU non disponibile: aprire la pagina tramite localhost in un browser compatibile.');
      const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(!adapter)throw new Error('Nessun adattatore WebGPU disponibile.');
      device=await adapter.requestDevice();const gpu=device;
      const count=payload.input.queryCount,coordinates=new Float32Array(count*4),bytes=coordinates.byteLength;
      payload.input.samples.forEach((sample,index)=>coordinates.set([...sample.originF32,0],index*4));
      const resources=await checked(gpu,()=>{
        const input=gpu.createBuffer({label:'terrain audit positions',size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});buffers.push(input);
        const current=gpu.createBuffer({label:'terrain current heights',size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});buffers.push(current);
        const legacy=gpu.createBuffer({label:'terrain legacy heights',size:bytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});buffers.push(legacy);
        const output=gpu.createBuffer({label:'terrain audit readback',size:bytes*2,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});buffers.push(output);readback=output;
        return {input,current,legacy,output};
      });
      const kernel=`
@group(0) @binding(0) var<storage,read> positions:array<vec4<f32>>;
@group(0) @binding(1) var<storage,read_write> heights:array<vec4<f32>>;
@compute @workgroup_size(64)
fn auditTerrain(@builtin(global_invocation_id) id:vec3<u32>){
 if(id.x>=${count}u){return;}
 heights[id.x]=vec4<f32>(terrainHeight(positions[id.x].xz),0.0,0.0,0.0);
}`;
      async function pipeline(code:string,label:string){
        const module=await checked(gpu,()=>gpu.createShaderModule({label,code:code+'\n'+kernel}));
        const info=await module.getCompilationInfo(),errors=info.messages.filter(message=>message.type==='error');
        if(errors.length)throw new Error(label+': '+errors.map(message=>`${message.lineNum}:${message.linePos} ${message.message}`).join('; '));
        return checked(gpu,()=>gpu.createComputePipelineAsync({label,layout:'auto',compute:{module,entryPoint:'auditTerrain'}}));
      }
      // Separate modules/pipelines preserve each hash realization, including the old sin hash.
      const currentPipeline=await pipeline(payload.currentWgsl,'current terrain integer hash');
      const legacyPipeline=await pipeline(payload.legacyWgsl,'legacy terrain sin hash');
      await checked(gpu,()=>{
        gpu.queue.writeBuffer(resources.input,0,coordinates);const encoder=gpu.createCommandEncoder({label:'terrain audit'});
        for(const [program,output] of [[currentPipeline,resources.current],[legacyPipeline,resources.legacy]] as const){
          const bindings=gpu.createBindGroup({layout:program.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:resources.input}},{binding:1,resource:{buffer:output}}]});
          const pass=encoder.beginComputePass();pass.setPipeline(program);pass.setBindGroup(0,bindings);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();
        }
        encoder.copyBufferToBuffer(resources.current,0,resources.output,0,bytes);
        encoder.copyBufferToBuffer(resources.legacy,0,resources.output,bytes,bytes);gpu.queue.submit([encoder.finish()]);
      });
      await resources.output.mapAsync(GPUMapMode.READ);const values=new Float32Array(resources.output.getMappedRange().slice(0));resources.output.unmap();
      let maximum=0,squared=0,finitePairs=0,currentNonFinite=0,legacyNonFinite=0,cpuNonFinite=0;
      let worstIndex:number|null=null,minMargin=Infinity,outsideTolerance=0,clampShortfalls=0,legacyPenetrations=0;
      const json=(value:number)=>Number.isFinite(value)?value:null;
      const samples=payload.input.samples.map((sample,index)=>{
        const current=values[index*4],legacy=values[count*4+index*4],cpu=sample.cpuHeightKm;
        if(!Number.isFinite(current))currentNonFinite++;if(!Number.isFinite(legacy))legacyNonFinite++;if(!Number.isFinite(cpu))cpuNonFinite++;
        let error:number|null=null;
        if(Number.isFinite(current)&&Number.isFinite(cpu)){
          error=Math.abs(current-cpu);finitePairs++;squared+=error*error;
          if(worstIndex===null||error>maximum){maximum=error;worstIndex=index;}
          if(error>payload.input.advisoryToleranceKm)outsideTolerance++;
        }
        const margin=sample.clampedRadialHeightKm-current,legacyClearance=sample.originalRadialHeightKm-legacy;
        if(Number.isFinite(margin)){minMargin=Math.min(minMargin,margin);if(margin<payload.input.clearanceKm-payload.input.advisoryToleranceKm)clampShortfalls++;}
        if(Number.isFinite(legacyClearance)&&legacyClearance<0)legacyPenetrations++;
        return {...sample,gpuCurrentHeightKm:json(current),gpuLegacyRawHeightKm:json(legacy),currentAbsoluteErrorKm:error,
          currentClampedRadialClearanceKm:json(margin),legacyOriginalRadialClearanceKm:json(legacyClearance),
          legacyHeightAboveOriginalRadialPosition:Number.isFinite(legacyClearance)?legacyClearance<0:null};
      });
      report={kind:'terrain-gpu-audit',status:'completed',date:new Date().toISOString(),input:payload.input,
        adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description},
        method:'Standalone compute of the exact current and historical WGSL sources in separate pipelines. Current height compared with shared CPU implementation at identical f32 coordinates. Historical sin height is raw GPU output only; no old CPU accuracy claim. Radial clearances use CPU binary64 sphere geometry at quantized camera coordinates, not GPU intersection/length readback. No performance or photographic qualification.',
        queryCount:count,allFinite:currentNonFinite===0&&legacyNonFinite===0&&cpuNonFinite===0,
        current:{finitePairs,cpuNonFinite,gpuNonFinite:currentNonFinite,maxAbsoluteErrorKm:finitePairs?maximum:null,rmsAbsoluteErrorKm:finitePairs?Math.sqrt(squared/finitePairs):null,worstQueryIndex:worstIndex,
          outsideAdvisoryTolerance:outsideTolerance,minimumClampedRadialClearanceKm:json(minMargin),clampShortfalls},
        legacy:{parent:payload.input.source.legacyParent,shaderSha256:payload.input.source.legacyWgslSha256,gpuNonFinite:legacyNonFinite,originalRadialPenetratingSamples:legacyPenetrations},
        advisoryToleranceKm:payload.input.advisoryToleranceKm,toleranceQualification:'Inspection threshold only; not a universal GPU error bound or proof over unsampled terrain.',
        criticalPose:samples[payload.input.criticalPose.queryIndex],samples};
      publish();download.disabled=false;status.textContent='Audit completato. Vecchio shader: sola altezza GPU; nuovo shader: confronto CPU e margine del clamp.';
    }catch(error){
      report={kind:'terrain-gpu-audit',status:'failed',date:new Date().toISOString(),source:payload.input.source,error:error instanceof Error?error.message:String(error)};publish();status.textContent='Audit fallito: leggere il JSON.';download.disabled=false;
    }finally{
      const mapped=readback as GPUBuffer|null;
      if(mapped?.mapState==='mapped')mapped.unmap();for(const buffer of buffers)buffer.destroy();device?.destroy();run.disabled=false;
    }
  });
}

const argument=process.argv[2];
if(!argument)throw new Error('Usage: bun scripts/qa-terrain-gpu.ts <output-directory-under-/private/tmp-or-Documents/Codex>');
const requested=resolve(argument);let existing=requested;
while(!existsSync(existing)){const parent=dirname(existing);if(parent===existing)throw new Error('Cannot resolve output directory');existing=parent;}
const output=resolve(realpathSync(existing),relative(existing,requested));
const allowed=['/private/tmp','/Users/enuzzo/Documents/Codex'].map(path=>realpathSync(path));
if(!allowed.some(root=>output===root||output.startsWith(root+sep)))throw new Error('Output must stay under /private/tmp or Documents/Codex.');
const root=fileURLToPath(new URL('../',import.meta.url)),landscapePath=fileURLToPath(new URL('../src/cumulonimbus/landscape.ts',import.meta.url));
const sha=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
const currentSource=readFileSync(landscapePath),legacyParent=execFileSync('git',['rev-parse','--verify','b3270f9^{commit}'],{cwd:root,encoding:'utf8',timeout:30000}).trim();
const legacySource=execFileSync('git',['show',`${legacyParent}:src/cumulonimbus/landscape.ts`],{cwd:root,encoding:'utf8',timeout:30000});
const match=legacySource.match(/export const LANDSCAPE_WGSL\s*=\s*`([^`]*)`;/);
if(!match||match[1].includes('${'))throw new Error('Historical LANDSCAPE_WGSL is not the expected static template.');
const legacyWgsl=match[1],critical:Vec3=[.4296875,-3.8,9.6931225063],samples:TerrainSample[]=[];
const radial=(origin:readonly number[])=>Math.hypot(origin[0],origin[1]+EARTH_RADIUS-GROUND_LEVEL,origin[2])-EARTH_RADIUS;
function add(group:TerrainSample['group'],x:number,z:number){
  const originF32=[x,-3.8,z].map(Math.fround) as Vec3,clampedOrigin=clampCameraAboveLandscape(originF32,CAMERA_TERRAIN_CLEARANCE_KM),clampedOriginF32=clampedOrigin.map(Math.fround) as Vec3;
  samples.push({index:samples.length,group,originF32,cpuHeightKm:terrainHeight(originF32[0],originF32[2]),cpuCoastDistanceKm:coastDistance(originF32[0],originF32[2]),
    cpuSurfaceYKm:landscapeSurfaceY(originF32[0],originF32[2]),clampedOrigin,clampedOriginF32,
    originalRadialHeightKm:radial(originF32),clampedRadialHeightKm:radial(clampedOriginF32)});
}
for(const [dx,dz] of [[0,0],[.08,0],[-.08,0],[0,.08],[0,-.08],[2,0],[-2,0],[0,2],[0,-2],[8,0],[-8,0],[0,8],[0,-8],[-24,-24],[24,24],[24,-24]])add('critical-pose',critical[0]+dx,critical[2]+dz);
for(const radius of [4,12,24,64])for(let i=0;i<32;i++){const angle=i*Math.PI/16;add('orbit',critical[0]+Math.sin(angle)*radius,Math.cos(angle)*radius);}
const radicalInverse=(n:number,base:number)=>{let result=0,weight=1/base;while(n){result+=(n%base)*weight;n=Math.floor(n/base);weight/=base;}return result;};
for(let i=1;i<=256;i++)add('terrain',(radicalInverse(i,2)-.5)*48,(radicalInverse(i,3)-.5)*48);
for(let i=0;i<28;i++){
  const z=-24+48*i/27;let lo=-64,hi=64;
  if(coastDistance(lo,z)<=0||coastDistance(hi,z)>=0)throw new Error('Coast bracket failed.');
  for(let j=0;j<32;j++){const mid=(lo+hi)/2;if(coastDistance(mid,z)>0)lo=mid;else hi=mid;}
  for(const offset of [-.05,.05,-3,-12])add('near-coast',(lo+hi)/2+offset,z);
}
if(samples.length!==512||samples.some(sample=>!Number.isFinite(sample.cpuHeightKm)))throw new Error('Invalid deterministic terrain references');
if(sha(currentSource)!==sha(readFileSync(landscapePath)))throw new Error('Landscape source changed during audit generation.');
const groups:Record<string,number>={};for(const sample of samples)groups[sample.group]=(groups[sample.group]??0)+1;
const input:TerrainInput={kind:'terrain-gpu-audit-input',gpuStatus:'not-run',date:new Date().toISOString(),queryCount:samples.length,
  method:'512 deterministic positions: 16 critical-pose neighbours, 128 orbit points (4/12/24/64 km), 256 Halton terrain points in [-24,24] km, 112 coast probes (28 z values, x offsets -.05/.05/-3/-12 km). CPU references only; GPU requires the standalone page button.',
  cpuPrecision:'Shared CPU terrain implementation: explicit f32 arithmetic where implemented, integer hash, JavaScript Math.pow/transcendentals with binary64 evaluation. Not a pure Float64 terrain model or a promise of bitwise GPU equality. Radial sphere geometry is binary64.',
  coordinatePrecision:'All GPU input xyz values are quantized to f32 before CPU height evaluation; vec4 storage stride16 bytes. Clamp outputs are also quantized to f32 before the radial-clearance reference.',
  units:'Kilometres; terrainHeight is altitude above sea sphere, origin y is cloud-local with sea datum -4 km.',
  source:{currentHashId:TERRAIN_HASH_ID,currentFileSha256:sha(currentSource),currentWgslSha256:sha(LANDSCAPE_WGSL),legacyParent,legacyFileSha256:sha(legacySource),legacyWgslSha256:sha(legacyWgsl),scriptSha256:sha(readFileSync(fileURLToPath(import.meta.url)))},
  clearanceKm:CAMERA_TERRAIN_CLEARANCE_KM,advisoryToleranceKm:.001,groups,criticalPose:{originalRequested:critical,queryIndex:0},samples};
const payload:PagePayload={input,currentWgsl:LANDSCAPE_WGSL,legacyWgsl};
const script=`(${installAuditPage.toString()})(${JSON.stringify(payload).replaceAll('<','\\u003c')});`;
const html=`<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cloudia · audit terreno CPU/GPU</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:24px;max-width:1100px;color:#202a2d;background:#f6f3eb}button{font:inherit;padding:10px 16px;margin:0 8px 12px 0;min-height:44px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;padding:16px;border:1px solid #bbb}button:focus-visible{outline:3px solid #416a29;outline-offset:3px}</style>
<h1>Audit terreno CPU/GPU</h1><p>Pagina diagnostica autonoma. Due shader separati: hash corrente e vecchio hash sin. Nessun avvio GPU automatico, nessun benchmark.</p>
<button id="run">Esegui audit GPU</button><button id="download" disabled>Scarica JSON</button><p id="status" role="status">Pronto: GPU non eseguita.</p><details><summary>JSON completo</summary><pre data-testid="terrain-audit-json"></pre></details><script type="module">${script}</script></html>`;
mkdirSync(output,{recursive:true});writeFileSync(resolve(output,'terrain-audit.html'),html);writeFileSync(resolve(output,'terrain-audit-cpu.json'),JSON.stringify(input,null,2)+'\n');
console.log(JSON.stringify({output,files:['terrain-audit.html','terrain-audit-cpu.json'],queryCount:input.queryCount,groups,currentHashId:TERRAIN_HASH_ID,legacyParent,gpuStatus:'not-run'}));
