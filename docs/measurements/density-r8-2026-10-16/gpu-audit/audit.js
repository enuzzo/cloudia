const ui={button:document.querySelector('#run'),status:document.querySelector('#status'),json:document.querySelector('#audit-json'),downloads:document.querySelector('#downloads')};
const STRIDE=48, PIN_MACRO='72e3f360b81f3c8f812800cc309a174ce893d96c80e666c9bf98fca178187b9f', PIN_SHADER='b24ce50ad82609723b1f083a2195c07baf388309a3e3cfa102d9b8abef953e3d';
let report={kind:'density-r8-raw-sampler-audit',status:'not-run',gpuStatus:'not-run'},active=null,urls=[];
const publish=()=>{ui.json.textContent=JSON.stringify(report,null,2);};publish();
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
const encode=s=>new TextEncoder().encode(s), decode=b=>new TextDecoder().decode(b);
function destroyDevice(run){if(run.device&&!run.destroyCalled){run.device.destroy();run.destroyCalled=true;}}
function cancel(){if(!active)return;active.cancelled=true;active.controller.abort();destroyDevice(active);active.rejectCancel(new Error('Audit annullato'));ui.status.textContent='Annullamento e rilascio device…';}
ui.button.addEventListener('click',()=>active?cancel():runAudit());
addEventListener('keydown',e=>{if(e.key==='Escape')cancel();});addEventListener('pagehide',cancel);
function download(name,blob){const a=document.createElement('a'),url=URL.createObjectURL(blob);urls.push(url);a.href=url;a.download=name;a.textContent='Scarica '+name;ui.downloads.append(a);}
function summarize(d,qbytes,raw){
 const q=new Float32Array(qbytes.buffer,qbytes.byteOffset,qbytes.byteLength/4),f=new Float32Array(raw.buffer),u=new Uint32Array(raw.buffer),counter=new Uint32Array(raw.buffer,d.queryCount*STRIDE,4);
 const s={queries:d.queryCount,bitMismatches:0,nonfinite:0,outsideUnit:0,echoMismatches:0,gpuFlagMismatches:0,constantFixtureMismatches:0,zeroPairs:0,positivePairs:0,fractionalPairs:0,maxAbsDifference:0,maxULPDifference:0,groups:{},firstDifferences:[]};
 for(let i=0;i<d.queryCount;i++){
  const o=i*12,j=i*4,a=f[o],b=f[o+1],bitsA=u[o],bitsB=u[o+1],bad=bitsA!==bitsB,nf=!Number.isFinite(a)||!Number.isFinite(b),outside=a<0||a>1||b<0||b>1,group=String(q[j+3]);
  const g=s.groups[group]??={queries:0,bitMismatches:0,zeroPairs:0,positivePairs:0,fractionalPairs:0};g.queries++;
  if(bad){s.bitMismatches++;g.bitMismatches++;}if(nf)s.nonfinite++;if(outside)s.outsideUnit++;
  if(a===0&&b===0){s.zeroPairs++;g.zeroPairs++;}if(a>0&&b>0){s.positivePairs++;g.positivePairs++;}if(a>0&&a<1&&b>0&&b<1){s.fractionalPairs++;g.fractionalPairs++;}
  const echoMismatch=[0,1,2,3].some(k=>u[o+8+k]!==new Uint32Array(qbytes.buffer,qbytes.byteOffset+j*4,4)[k]);if(echoMismatch)s.echoMismatches++;
  if(u[o+4]!==bitsA||u[o+5]!==bitsB||u[o+6]!==Number(bad)||u[o+7]!==Number(nf))s.gpuFlagMismatches++;
  if(d.expectedConstant!==null&&(a!==d.expectedConstant||b!==d.expectedConstant))s.constantFixtureMismatches++;
  if(!nf){s.maxAbsDifference=Math.max(s.maxAbsDifference,Math.abs(a-b));s.maxULPDifference=Math.max(s.maxULPDifference,Math.abs(bitsA-bitsB));}
  if((bad||nf||outside||echoMismatch)&&s.firstDifferences.length<24)s.firstDifferences.push({index:i,uv:Array.from(q.subarray(j,j+3)),group:q[j+3],rgbaR:a,r8R:b,rgbaBits:bitsA.toString(16).padStart(8,'0'),r8Bits:bitsB.toString(16).padStart(8,'0'),absDifference:Math.abs(a-b),echoMismatch});
 }
 s.gpuCounters={processed:counter[0],mismatches:counter[1],nonfinite:counter[2],outside:counter[3]};
 s.counterAgreement=counter[0]===d.queryCount&&counter[1]===s.bitMismatches&&counter[2]===s.nonfinite&&counter[3]===s.outsideUnit;
 s.coverage=d.expectedConstant===0?s.zeroPairs===d.queryCount:d.expectedConstant===1?s.positivePairs===d.queryCount:s.zeroPairs>0&&s.positivePairs>0&&s.fractionalPairs>0;
 s.passed=s.bitMismatches===0&&s.nonfinite===0&&s.outsideUnit===0&&s.echoMismatches===0&&s.gpuFlagMismatches===0&&s.constantFixtureMismatches===0&&s.counterAgreement&&s.coverage;
 return s;
}
async function runAudit(){
 for(const u of urls)URL.revokeObjectURL(u);urls=[];ui.downloads.replaceChildren();
 const run={controller:new AbortController(),device:null,destroyCalled:false,cancelled:false,finished:false};
 run.cancelPromise=new Promise((_,reject)=>{run.rejectCancel=reject;});run.cancelPromise.catch(()=>{});active=run;
 ui.button.textContent='Annulla';const started=performance.now(),phases=[],errors=[],buffers=new Set(),textures=new Set(),results=[],readbacks=[];
 function phase(name){report.phase=name;phases.push({name,atMs:performance.now()-started});ui.status.textContent=name;publish();}
 async function timed(name,fn){phase(name);let timer;try{return await Promise.race([Promise.resolve().then(()=>{if(run.cancelled)throw new Error('Audit annullato');return fn();}),run.cancelPromise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Timeout 30 s: '+name)),30000);})]);}finally{clearTimeout(timer);}}
 async function fetchBytes(path){const r=await fetch('./'+path,{cache:'no-store',signal:run.controller.signal});if(!r.ok)throw new Error(path+': HTTP '+r.status);return new Uint8Array(await r.arrayBuffer());}
 report={kind:'density-r8-raw-sampler-audit',status:'running',gpuStatus:'running',startedAt:new Date().toISOString(),phases};publish();
 try{
  const metadata=await timed('Lettura manifest e sorgenti',()=>Promise.all(['inputs.json','audit.js','index.html'].map(fetchBytes)));
  const input=JSON.parse(decode(metadata[0]));if(input.source.macroSHA256!==PIN_MACRO||input.source.v46ShaderSHA256!==PIN_SHADER)throw new Error('Pin baseline inatteso');
  const files={};for(const name of Object.keys(input.files))files[name]=await timed('Input: '+name,()=>fetchBytes(name));
  const fileHashes={};for(const [name,b]of Object.entries(files)){const digest=await hash(b);fileHashes[name]=digest;if(b.byteLength!==input.files[name].bytes||digest!==input.files[name].sha256)throw new Error('Hash o byteLength errato: '+name);}
  if(fileHashes['macro-rgba8.bin']!==PIN_MACRO||fileHashes['cloudShader.v46.ts']!==PIN_SHADER)throw new Error('Baseline hash diverso');
  if(!decode(files['cloudShader.v46.ts']).includes('let warped=textureSampleLevel(volume,volumeSampler,coord+warp/vec3<f32>(10.0,8.5,7.0),0.0).r;'))throw new Error('Legacy sampler fragment assente');
  for(const d of input.datasets){
   if(!Number.isInteger(d.size)||d.size<1||!Number.isInteger(d.queryCount)||d.queryCount<1||files[d.rgbaFile].byteLength!==4*d.size**3||files[d.r8File].byteLength!==d.size**3||files[d.queryFile].byteLength!==16*d.queryCount)throw new Error('Dimensioni/stride errati: '+d.name);
   const rgba=files[d.rgbaFile],r8=files[d.r8File];for(let i=0;i<r8.length;i++)if(r8[i]!==rgba[4*i])throw new Error('R non esatto: '+d.name+' '+i);
   const q=new Float32Array(files[d.queryFile].buffer);if(!q.every(Number.isFinite))throw new Error('Query non finita');
  }
  report.provenance={inputsSHA256:await hash(metadata[0]),runnerSHA256:await hash(metadata[1]),htmlSHA256:await hash(metadata[2]),fileHashes,pins:{macro:PIN_MACRO,legacyShader:PIN_SHADER},newBakes:0};report.input={datasets:input.datasets,groups:input.groups,fixtureGroups:input.fixtureGroups,textureContract:input.textureContract,queryLayout:input.queryLayout,outputLayout:input.outputLayout,memory:input.memory};publish();
  if(!navigator.gpu)throw new Error('WebGPU non disponibile; richiede localhost o contesto sicuro');
  const adapter=await timed('Richiesta adapter',()=>navigator.gpu.requestAdapter({powerPreference:'high-performance'}));if(!adapter)throw new Error('Nessun adapter');
  const devicePromise=adapter.requestDevice();devicePromise.then(d=>{if(run.finished||run.cancelled)d.destroy();},()=>{});
  const device=await timed('Richiesta device',()=>devicePromise);run.device=device;
  device.addEventListener('uncapturederror',e=>errors.push(e.error.message));device.lost.then(info=>{if(info.reason!=='destroyed')errors.push('device lost: '+info.message);},e=>errors.push(String(e)));
  report.adapter={vendor:adapter.info?.vendor??null,architecture:adapter.info?.architecture??null,device:adapter.info?.device??null,description:adapter.info?.description??null,isFallbackAdapter:adapter.isFallbackAdapter??null};
  report.device={features:[...device.features],limits:{maxTextureDimension3D:device.limits.maxTextureDimension3D,maxStorageBufferBindingSize:device.limits.maxStorageBufferBindingSize,maxComputeWorkgroupsPerDimension:device.limits.maxComputeWorkgroupsPerDimension}};
  const module=device.createShaderModule({label:'R8 vs RGBA8 same-UV audit',code:decode(files['audit.wgsl'])});
  const compilation=await timed('Compilazione modulo',()=>module.getCompilationInfo());report.compilationMessages=compilation.messages.map(m=>({type:m.type,line:m.lineNum,message:m.message}));if(compilation.messages.some(m=>m.type==='error'))throw new Error('WGSL compilation failed');
  const pipeline=await timed('Pipeline compute',()=>device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'auditDensity'}}));
  const sampler=device.createSampler({addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge',magFilter:'linear',minFilter:'linear',mipmapFilter:'nearest'});
  for(const d of input.datasets){
   const n=d.size,qbytes=files[d.queryFile],outBytes=STRIDE*d.queryCount;
   phase('Upload e submit: '+d.name);device.pushErrorScope('validation');
   const makeTexture=format=>{const t=device.createTexture({label:d.name+' '+format,dimension:'3d',size:[n,n,n],mipLevelCount:1,format,usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});textures.add(t);return t;};
   const rgbaTexture=makeTexture('rgba8unorm'),r8Texture=makeTexture('r8unorm');
   const makeBuffer=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.add(b);return b;};
   const ib=makeBuffer(qbytes.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),ob=makeBuffer(outBytes,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),counter=makeBuffer(16,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST),rb=makeBuffer(outBytes+16,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
   device.queue.writeTexture({texture:rgbaTexture},files[d.rgbaFile],{bytesPerRow:n*4,rowsPerImage:n},[n,n,n]);device.queue.writeTexture({texture:r8Texture},files[d.r8File],{bytesPerRow:n,rowsPerImage:n},[n,n,n]);device.queue.writeBuffer(ib,0,qbytes);
   const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:rgbaTexture.createView({dimension:'3d'})},{binding:1,resource:r8Texture.createView({dimension:'3d'})},{binding:2,resource:sampler},{binding:3,resource:{buffer:ib}},{binding:4,resource:{buffer:ob}},{binding:5,resource:{buffer:counter}}]});
   const enc=device.createCommandEncoder();enc.clearBuffer(counter);const pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(d.queryCount/64));pass.end();enc.copyBufferToBuffer(ob,0,rb,0,outBytes);enc.copyBufferToBuffer(counter,0,rb,outBytes,16);device.queue.submit([enc.finish()]);
   // Await error scopes only after submit; compilation/pipeline promises handle pre-submit failures.
   const validation=device.popErrorScope();validation.catch(()=>{});
   await timed('Readback: '+d.name,()=>rb.mapAsync(GPUMapMode.READ));const raw=new Uint8Array(rb.getMappedRange().slice(0));rb.unmap();
   const validationError=await timed('Validation: '+d.name,()=>validation);if(validationError)throw new Error(validationError.message);
   phase('Conteggi: '+d.name);const summary=summarize(d,qbytes,raw);const pairs=new Float32Array(d.queryCount*2),f=new Float32Array(raw.buffer);for(let i=0;i<d.queryCount;i++){pairs[i*2]=f[i*12];pairs[i*2+1]=f[i*12+1];}
   const record={name:d.name,size:n,queryCount:d.queryCount,querySHA256:fileHashes[d.queryFile],rgbaSHA256:fileHashes[d.rgbaFile],r8SHA256:fileHashes[d.r8File],outputSHA256:await hash(raw),pairsSHA256:await hash(pairs),summary};results.push(record);readbacks.push({name:d.name,raw,pairs});report.datasets=results;publish();
   for(const b of [ib,ob,counter,rb]){b.destroy();buffers.delete(b);}for(const t of [rgbaTexture,r8Texture]){t.destroy();textures.delete(t);}
  }
  await timed('Coda finale completata',()=>device.queue.onSubmittedWorkDone());
  report.status=results.every(d=>d.summary.passed)&&errors.length===0?'PASS':'FAIL';report.gpuStatus='completed';
 }catch(e){report.status=run.cancelled?'CANCELLED':'FAIL';report.gpuStatus=run.cancelled?'cancelled':'failed';report.error=e instanceof Error?e.message:String(e);
 }finally{
  run.finished=true;run.controller.abort();for(const b of buffers){if(b.mapState==='mapped')b.unmap();b.destroy();}for(const t of textures)t.destroy();destroyDevice(run);
  report.uncapturedErrors=errors;report.wallMs=performance.now()-started;report.cleanup={allCreatedBufferDestroyCalled:true,allCreatedTextureDestroyCalled:true,deviceDestroyCalled:run.destroyCalled,lateDevicePromiseCleanupInstalled:true};
  report.qualification='Finite raw WebGPU compute comparison of exact extracted R8 and original RGBA8.r at identical input f32 UV, shared linear/clamp/mip0 sampler. Initial acceptance requires identical output f32 bits. No Three.js pipeline/binding, renderer frame, lifecycle, throughput, arbitrary UV/backend or universal equivalence claim.';
  report.integrity={algorithm:'SHA-256',payloadWithoutIntegritySHA256:await hash(encode(JSON.stringify(report)))};
  if(active===run){active=null;publish();ui.status.textContent=report.status+': '+(report.error??'conteggi e limiti nel JSON');ui.button.textContent='Avvia';for(const r of readbacks){download(r.name+'-readback.bin',new Blob([r.raw]));download(r.name+'-pairs-f32.bin',new Blob([r.pairs]));}download('density-r8-sampler-result.json',new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));}
 }
}
