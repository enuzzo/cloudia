const UI={run:document.querySelector('#run'),download:document.querySelector('#download'),status:document.querySelector('#status'),json:document.querySelector('#audit-json')};
const BYTES_PER_RESULT=48,COMPONENTS_PER_RESULT=12;
const PINS={before:'d80225521258edb4beed2e713afe3c6b97fad5eca79d7dcdc657f9f47c1deddd',after:'b1dde880c8cc572dfebcf30825035c8c028925e75da52be05a64f214bbafbe93',macro:'72e3f360b81f3c8f812800cc309a174ce893d96c80e666c9bf98fca178187b9f',narrow:'ad38c2b581882a0686e3d81031e0972fbd1cc0fb4bb9dab09c43451387e418ad'};
let report={kind:'narrow-cloud-raw-gpu-audit',status:'not-run',gpuStatus:'not-run'},activeDevice=null,runID=0;
const publish=()=>{UI.json.textContent=JSON.stringify(report,null,2);};publish();
addEventListener('pagehide',()=>{runID++;activeDevice?.destroy();activeDevice=null;});
UI.download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='narrow-cloud-gpu-result.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
const utf8=s=>new TextEncoder().encode(s),clamp=v=>Math.max(0,Math.min(1,v));
async function fetchBytes(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(path+': HTTP '+r.status);return new Uint8Array(await r.arrayBuffer());}
function cpuIndex(q){return [0,1,2].map(a=>Math.min(127,Math.floor(clamp(q[a])*128)));}
function summarize(dataset,input,values,narrow){
 const s={queryCount:dataset.queryCount,gpuPositiveMacro:0,gpuAboveOriginalRawGate:0,narrowZero:0,narrowPositive:0,narrowZeroMacroPositive:0,narrowZeroMacroAboveGate:0,nonFinite:0,maskValueMismatches:0,indexMismatches:0,echoMismatches:0,macroOutOfRange:0,positiveCentreGateMisses:0,maximumMacroAtNarrowZero:0,groups:{},firstViolations:[]};
 for(let i=0;i<dataset.queryCount;i++){
  const q=input.subarray(i*8,i*8+8),o=i*COMPONENTS_PER_RESULT,mask=values[o],raw=values[o+1],ix=cpuIndex(q),expected=narrow[(ix[2]*128+ix[1])*128+ix[0]]/255;
  const group=String(q[7]);const g=s.groups[group]??={queries:0,narrowZero:0,macroPositive:0,violations:0};g.queries++;
  const errors=[];
  if(!Array.from(values.subarray(o,o+12)).every(Number.isFinite)){s.nonFinite++;errors.push('non-finite');}
  if(mask!==expected){s.maskValueMismatches++;errors.push('R8-load-vs-CPU-index');}
  if(ix.some((v,a)=>values[o+4+a]!==v)){s.indexMismatches++;errors.push('index');}
  if(values[o+7]!==q[3]||values[o+11]!==q[7]){s.echoMismatches++;errors.push('echo');}
  if(raw<0||raw>1)s.macroOutOfRange++;
  if(raw>0){s.gpuPositiveMacro++;g.macroPositive++;}if(raw>=Math.fround(.002))s.gpuAboveOriginalRawGate++;
  if(q[7]===0&&!(raw>=Math.fround(.002))){s.positiveCentreGateMisses++;errors.push('known-positive-centre-misses-original-gate');}
  if(mask===0){s.narrowZero++;g.narrowZero++;s.maximumMacroAtNarrowZero=Math.max(s.maximumMacroAtNarrowZero,raw);
   if(raw>0){s.narrowZeroMacroPositive++;g.violations++;errors.push('narrow-zero-but-macro-positive');}
   if(raw>=Math.fround(.002)){s.narrowZeroMacroAboveGate++;errors.push('narrow-zero-but-macro-above-original-gate');}
  }else s.narrowPositive++;
  if(values[o+2]!==Number(mask===0&&raw>0)||values[o+3]!==Number(mask===0&&raw>=Math.fround(.002))){s.echoMismatches++;errors.push('GPU-flag');}
  if(errors.length&&s.firstViolations.length<24)s.firstViolations.push({index:i,errors,coordF32:Array.from(q.subarray(0,3)),ice:q[3],fineRGB:Array.from(q.subarray(4,7)),group:q[7],expectedIndex:ix,expectedMask:expected,gpu:Array.from(values.subarray(o,o+12))});
 }
 s.passed=s.nonFinite===0&&s.maskValueMismatches===0&&s.indexMismatches===0&&s.echoMismatches===0&&s.narrowZeroMacroPositive===0&&s.narrowZeroMacroAboveGate===0&&s.positiveCentreGateMisses===0&&s.gpuAboveOriginalRawGate>0&&s.narrowZero>0&&s.narrowPositive>0;
 return s;
}
UI.run.addEventListener('click',async()=>{
 const thisRun=++runID;UI.run.disabled=true;UI.download.disabled=true;
 const started=performance.now(),phases=[],errors=[],buffers=[],textures=[];let device=null,mapped=null,finished=false;
 const phase=name=>{phases.push({name,atMs:performance.now()-started});UI.status.textContent=name;report.phase=name;report.phases=phases;publish();};
 async function timed(name,operation){phase(name);let timer;try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Timeout30s: '+name)),30000);})]);}finally{clearTimeout(timer);}}
 report={kind:'narrow-cloud-raw-gpu-audit',status:'running',gpuStatus:'running',date:new Date().toISOString(),phases};publish();
 try{
  const paths=['inputs.json','audit.wgsl','audit.js','index.html','cloudShader.before.ts','cloudShader.after.ts','macro-rgba8.bin','narrow-r8.bin'];
  const bytes=await timed('HTTP e hash degli input',()=>Promise.all(paths.map(fetchBytes)));
  const b=Object.fromEntries(paths.map((p,i)=>[p,bytes[i]])),input=JSON.parse(new TextDecoder().decode(b['inputs.json'])),shader=new TextDecoder().decode(b['audit.wgsl']);
  const hashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await hash(b[p])])));
  if(hashes['cloudShader.before.ts']!==PINS.before||hashes['cloudShader.after.ts']!==PINS.after||hashes['macro-rgba8.bin']!==PINS.macro||hashes['narrow-r8.bin']!==PINS.narrow||hashes['audit.wgsl']!==input.shaderSha256)throw new Error('Provenance SHA mismatch');
  const before=new TextDecoder().decode(b['cloudShader.before.ts']),after=new TextDecoder().decode(b['cloudShader.after.ts']);
  if(!after.includes(input.guardExact)||![input.warpExact,input.macroExact].every(s=>before.includes(s)&&after.includes(s)&&shader.includes(s))||!shader.includes(input.guardExact))throw new Error('Guard/warp/macrosample hard-pin mismatch');
  const queryBytes=await timed('Caricamento query f32 congelate',()=>Promise.all(input.datasets.map(d=>fetchBytes(d.queryFile))));
  for(let i=0;i<input.datasets.length;i++){const d=input.datasets[i];if(queryBytes[i].byteLength!==d.queryBytes||await hash(queryBytes[i])!==d.querySha256)throw new Error('Query hash mismatch: '+d.name);}
  report.input={kind:input.kind,queryCounts:input.datasets.map(d=>({name:d.name,count:d.queryCount,groups:d.groups})),groups:input.groups,sourcePins:PINS,sha256:hashes,textureMemoryBytes:input.textureMemoryBytes,newBakes:0,scope:input.scope};publish();
  if(!navigator.gpu)throw new Error('WebGPU non disponibile; usare localhost.');
  const adapter=await timed('Richiesta adapter',()=>navigator.gpu.requestAdapter({powerPreference:'high-performance'}));if(!adapter)throw new Error('Nessun adapter');
  const requested=adapter.requestDevice();requested.then(d=>{if(finished||thisRun!==runID)d.destroy();},()=>{});
  device=await timed('Richiesta device',()=>requested);activeDevice=device;
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.lost.then(info=>{if(info.reason!=='destroyed')errors.push('Device lost: '+info.message);},e=>errors.push(String(e)));
  report.adapter={vendor:adapter.info?.vendor??null,architecture:adapter.info?.architecture??null,device:adapter.info?.device??null,description:adapter.info?.description??null,isFallbackAdapter:adapter.isFallbackAdapter??null};
  const module=device.createShaderModule({label:'pinned narrow guard + original macro sampler',code:shader});
  const info=await timed('Compilazione modulo WGSL',()=>module.getCompilationInfo());report.compilationMessages=info.messages.map(m=>({type:m.type,line:m.lineNum,column:m.linePos,message:m.message}));
  if(info.messages.some(m=>m.type==='error'))throw new Error('WGSL compilation failed');
  const pipeline=await timed('Creazione pipeline compute',()=>device.createComputePipelineAsync({label:'narrow audit',layout:'auto',compute:{module,entryPoint:'auditNarrow'}}));
  // No popErrorScope await before the first submit: compilation promises handle their own failures.
  const sampler=device.createSampler({addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge',magFilter:'linear',minFilter:'linear',mipmapFilter:'nearest'});
  const macroTexture=device.createTexture({label:'frozen macro256 RGBA8',dimension:'3d',size:[256,256,256],mipLevelCount:1,format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});textures.push(macroTexture);
  const narrowTexture=device.createTexture({label:'frozen narrow128 R8',dimension:'3d',size:[128,128,128],mipLevelCount:1,format:'r8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});textures.push(narrowTexture);
  const datasets=[];
  for(let di=0;di<input.datasets.length;di++){
   const dataset=input.datasets[di],qbytes=queryBytes[di],query=new Float32Array(qbytes.buffer,qbytes.byteOffset,qbytes.byteLength/4);
   let macro=b['macro-rgba8.bin'],narrow=b['narrow-r8.bin'];
   if(dataset.name==='sparse-fixture'){
    // Reuse the same CPU arrays and the same 66MiB of GPU textures after real data readback.
    macro.fill(0);narrow.fill(0);
    for(const e of dataset.entries){macro[e.index*4]=e.R;const x=(e.index%256)>>1,y=((e.index>>>8)%256)>>1,z=(e.index>>>16)>>1;
     for(let zz=Math.max(0,z-2);zz<=Math.min(127,z+2);zz++)for(let yy=Math.max(0,y-2);yy<=Math.min(127,y+2);yy++)for(let xx=Math.max(0,x-2);xx<=Math.min(127,x+2);xx++)narrow[(zz*128+yy)*128+xx]=255;
    }
    if(await hash(macro)!==dataset.macroSha256||await hash(narrow)!==dataset.narrowSha256)throw new Error('Sparse fixture construction hash mismatch');
   }
   const outBytes=dataset.queryCount*BYTES_PER_RESULT;
   phase('Upload e submit: '+dataset.name);device.pushErrorScope('validation');
   const ib=device.createBuffer({label:'query f32',size:qbytes.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});buffers.push(ib);
   const ob=device.createBuffer({label:'audit output',size:outBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});buffers.push(ob);
   const rb=device.createBuffer({label:'audit readback',size:outBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});buffers.push(rb);
   device.queue.writeTexture({texture:macroTexture},macro,{bytesPerRow:1024,rowsPerImage:256},[256,256,256]);
   device.queue.writeTexture({texture:narrowTexture},narrow,{bytesPerRow:128,rowsPerImage:128},[128,128,128]);
   device.queue.writeBuffer(ib,0,qbytes);
   const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:macroTexture.createView({dimension:'3d'})},{binding:1,resource:sampler},{binding:2,resource:narrowTexture.createView({dimension:'3d'})},{binding:3,resource:{buffer:ib}},{binding:4,resource:{buffer:ob}}]});
   const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(dataset.queryCount/64));pass.end();enc.copyBufferToBuffer(ob,0,rb,0,outBytes);device.queue.submit([enc.finish()]);
   const validation=device.popErrorScope();validation.catch(()=>{});
   await timed('Readback: '+dataset.name,()=>rb.mapAsync(GPUMapMode.READ));mapped=rb;
   const output=new Uint8Array(rb.getMappedRange().slice(0));rb.unmap();mapped=null;
   const scopeError=await timed('Esito validation: '+dataset.name,()=>validation);if(scopeError)throw new Error(scopeError.message);
   phase('Classificazione risultati: '+dataset.name);
   datasets.push({name:dataset.name,queryInputSha256:dataset.querySha256,gpuOutputSha256:await hash(output),macroInputSha256:di===0?PINS.macro:dataset.macroSha256,narrowInputSha256:di===0?PINS.narrow:dataset.narrowSha256,results:summarize(dataset,query,new Float32Array(output.buffer),narrow)});
   ib.destroy();ob.destroy();rb.destroy();
  }
  await timed('Coda finale completata',()=>device.queue.onSubmittedWorkDone());
  report={...report,status:datasets.every(d=>d.results.passed)&&errors.length===0?'PASS':'FAIL',gpuStatus:'completed',datasets,uncapturedErrors:errors,wallMs:performance.now()-started,
   qualification:'Finite raw WebGPU compute audit of pinned post-flow coord guard and original linear/clamp/mip0 macro lookup. No Three.js binding/pipeline proof, flow compute, whole-frame parity, source/radiance/material integration, lifecycle proof or FPS measurement. Sparse fixture is synthetic, not a cloud bake. Real queries use selected macro-positive corners and volume probes; no claim of replaying actual visited counter points.',
   cleanup:{texturesDestroyed:false,buffersDestroyed:false,deviceDestroyed:false}};
 }catch(error){report={...report,status:'FAIL',gpuStatus:'failed',error:error instanceof Error?error.message:String(error),uncapturedErrors:errors,wallMs:performance.now()-started,cleanup:{texturesDestroyed:false,buffersDestroyed:false,deviceDestroyed:false}};
 }finally{
  finished=true;if(mapped?.mapState==='mapped')mapped.unmap();for(const buf of buffers)buf.destroy();for(const tex of textures)tex.destroy();device?.destroy();if(activeDevice===device)activeDevice=null;
  report.cleanup={texturesDestroyed:true,buffersDestroyed:true,deviceDestroyed:!!device};
  const payload=JSON.stringify(report);report.integrity={algorithm:'SHA-256',payloadWithoutIntegritySha256:await hash(utf8(payload))};
  if(thisRun===runID){publish();UI.status.textContent=report.status+': '+(report.error??'leggere conteggi e limiti nel JSON');UI.run.disabled=false;UI.download.disabled=false;}
 }
});
