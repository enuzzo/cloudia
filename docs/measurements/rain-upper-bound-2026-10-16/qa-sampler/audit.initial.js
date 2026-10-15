const GUARD_KM=3/255+2**-15;
const FILTER_ALLOWANCE=1/255;
const GROWTH=[1,1.25,Math.fround(1/.68)];
const RESULT_FLOATS=20; // sampled vec4 + three endpoint vec4 + envelope vec4
const UI={
  run:document.querySelector('#run'),
  download:document.querySelector('#download'),
  status:document.querySelector('#status'),
  pre:document.querySelector('[data-testid="sampler-audit-json"]')
};
let report={kind:'rain-rg8-sampler-audit',status:'not-run',gpuStatus:'not-run',guardKm:GUARD_KM};
let activeDevice=null;
const publish=()=>{UI.pre.textContent=JSON.stringify(report,null,2);};
publish();
addEventListener('pagehide',()=>{activeDevice?.destroy();activeDevice=null;});
UI.download.addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='rain-rg8-sampler-gpu-audit.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
  .map(byte=>byte.toString(16).padStart(2,'0')).join('');
const utf8=text=>new TextEncoder().encode(text);
async function fetchBytes(path){
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw new Error('Fetch '+path+': '+response.status);
  return new Uint8Array(await response.arrayBuffer());
}
async function checked(device,operation){
  device.pushErrorScope('out-of-memory');device.pushErrorScope('internal');device.pushErrorScope('validation');
  let pending;try{pending=Promise.resolve(operation());}catch(error){pending=Promise.reject(error);}
  const scopes=Promise.all([device.popErrorScope(),device.popErrorScope(),device.popErrorScope()]);
  const [result,captured]=await Promise.allSettled([pending,scopes]);
  if(result.status==='rejected')throw result.reason;
  if(captured.status==='rejected')throw captured.reason;
  const errors=captured.value.filter(Boolean);
  if(errors.length)throw new Error(errors.map(error=>error.message).join('; '));
  return result.value;
}
function haloMaximum(data,size){
  let max=-1,positive=0;
  const halo=new Uint8Array(size*size);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    if(data[(z*size+x)*2]===0)continue;positive++;
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const xx=x+dx,zz=z+dz;
      if(xx>=0&&zz>=0&&xx<size&&zz<size)halo[zz*size+xx]=1;
    }
  }
  let haloCount=0;
  for(let i=0;i<halo.length;i++)if(halo[i]){haloCount++;max=Math.max(max,data[i*2+1]);}
  return {maximumGByte:max<0?null:max,maximumGNormalized:max<0?null:max/255,
    maxBaseReferenceKm:max<0?null:max/255*3-.5,positiveTexels:positive,haloTexels:haloCount};
}
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
function idealSample(data,size,u,v){
  const x=u*size-.5,z=v*size-.5,x0=Math.floor(x),z0=Math.floor(z),fx=x-x0,fz=z-z0;
  const corners=[];let r=0,g=0;
  for(let dz=0;dz<2;dz++)for(let dx=0;dx<2;dx++){
    const xx=clamp(x0+dx,0,size-1),zz=clamp(z0+dz,0,size-1),at=(zz*size+xx)*2;
    const weight=(dx?fx:1-fx)*(dz?fz:1-fz),rb=data[at],gb=data[at+1];
    r+=weight*rb/255;g+=weight*gb/255;
    corners.push({x:xx,z:zz,RByte:rb,GByte:gb,weight});
  }
  return {r,g,corners,cornerMaximumG:Math.max(...corners.map(p=>p.GByte))/255};
}
const floatView=new DataView(new ArrayBuffer(4));
function bits(value){floatView.setFloat32(0,value,true);return floatView.getUint32(0,true);}
function fromBits(value){floatView.setUint32(0,value,true);return floatView.getFloat32(0,true);}
function adjacent(value,direction){
  value=Math.fround(value);
  if(value===0)return fromBits(direction>0?1:0x80000001);
  const b=bits(value);return fromBits(b+((value>0)===(direction>0)?1:-1));
}
function radicalInverse(n,base){
  let result=0,weight=1/base;
  while(n){result+=(n%base)*weight;n=Math.floor(n/base);weight/=base;}
  return result;
}
function queriesFor(data,size){
  const list=[],seen=new Set();
  function add(u,v,group){
    u=Math.fround(u);v=Math.fround(v);const key=bits(u)+':'+bits(v);
    if(seen.has(key))return;seen.add(key);
    list.push({u,v,group,strictProductionDomain:u>0&&u<1&&v>0&&v<1});
  }
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(z+.5)/size;add(u,v,'texel-centres');
    for(const du of [-1,1])for(const dv of [-1,1])
      add(adjacent(u,du),adjacent(v,dv),'f32-around-centres-and-footprint-ends');
  }
  for(let z=0;z<=size;z++)for(let x=0;x<=size;x++)add(x/size,z/size,'half-cell-grid');
  for(let i=1;i<=(size===64?1024:512);i++)add(radicalInverse(i,2),radicalInverse(i,3),'halton-interior');
  for(let i=0;i<size;i++){
    const along=(i+.5)/size;
    for(const edge of [-1/size,0,2**-24,adjacent(1,-1),1,1+1/size]){
      add(edge,along,'clamp-edge-and-outside');add(along,edge,'clamp-edge-and-outside');
    }
  }
  const packed=new Float32Array(list.length*4);
  list.forEach((q,i)=>packed.set([q.u,q.v,0,0],i*4));
  return {list,packed};
}
function fixture(name,size,r,g,setup){
  const data=new Uint8Array(size*size*2);
  for(let i=0;i<size*size;i++){data[i*2]=r;data[i*2+1]=g;}
  const put=(x,z,rr,gg)=>{const at=(z*size+x)*2;data[at]=rr;data[at+1]=gg;};
  setup?.(put,data);return {name,size,data,kind:'synthetic-fixture'};
}
function fixtures(){
  const maps=[];
  for(const g of [0,1,103,104,127,254,255])maps.push(fixture('constant-G'+g+'-R1',8,1,g));
  maps.push(fixture('single-R1-G0-neighbours-G255',8,0,255,put=>put(3,3,1,0)));
  maps.push(fixture('corner-edge-R1-sentinel',8,0,255,put=>{
    put(0,0,1,0);put(7,0,1,32);put(0,7,1,128);put(7,7,1,254);
  }));
  maps.push(fixture('checkerboard-R1-G0-vs-R0-G255',8,0,255,put=>{
    for(let z=0;z<8;z++)for(let x=0;x<8;x++)if((x+z)%2===0)put(x,z,1,0);
  }));
  maps.push(fixture('finite-G80-halo-vs-remote-G255',8,0,255,put=>{
    for(let z=2;z<=4;z++)for(let x=2;x<=4;x++)put(x,z,0,80);
    put(3,3,1,64);
  }));
  maps.push(fixture('all-R0-varying-G',8,0,0,put=>{
    for(let z=0;z<8;z++)for(let x=0;x<8;x++)put(x,z,0,(x*37+z*71)%256);
  }));
  maps.push(fixture('all-R0-G255',8,0,255));
  return maps;
}
function roundTripWitness(q,cpu,values,index){
  const o=index*RESULT_FLOATS;
  return {queryIndex:index,uvF32:[q.u,q.v],queryGroup:q.group,
    strictProductionDomain:q.strictProductionDomain,cpuIdeal:cpu,
    gpu:{R:values[o],G:values[o+1],uvEcho:[values[o+2],values[o+3]],
      endpoints:GROWTH.map((growth,j)=>({growthF32:growth,basePlusPoint3:values[o+4+j*4],
        guardedCeiling:values[o+5+j*4],attachedAtCeiling:values[o+6+j*4],
        attachedAtFirstSkippedF32:values[o+7+j*4]})),
      envelope:{minimumSlackKm:values[o+16],maximumAttachedAtCeiling:values[o+17],maximumAttachedAtFirstSkippedF32:values[o+18]}}};
}
function summarize(map,queries,values,halo){
  const s={queryCount:queries.length,strictProductionDomainQueries:0,outsideOrEndpointQueries:0,
    actualGpuPositiveR:0,allZeroMapFalsePositiveR:0,nonFiniteQueries:0,negativeOrAboveOneRG:0,
    uvEchoMismatches:0,maxAbsoluteRErrorVsIdeal:0,maxAbsoluteGErrorVsIdeal:0,
    maximumGAboveCpuFourCornerMaximum:0,maximumPositiveRGAboveHaloMaximum:null,
    positiveRFilterAllowanceViolations:0,positiveRGuardAttachmentViolations:0,
    positiveRNegativeCeilingSlack:0,envelopeAttachmentViolations:0,envelopeNegativeSlack:0,
    minimumPositiveRCeilingSlackKm:null,minimumEnvelopeCeilingSlackKm:null,
    cpuIdealRZeroButGpuPositiveR:0,groups:{},worstIdealG:null,worstHaloG:null,
    worstEndpoint:null,firstViolations:[]};
  for(let i=0;i<queries.length;i++){
    const q=queries[i],o=i*RESULT_FLOATS,r=values[o],g=values[o+1],cpu=idealSample(map.data,map.size,q.u,q.v);
    s.groups[q.group]=(s.groups[q.group]??0)+1;
    q.strictProductionDomain?s.strictProductionDomainQueries++:s.outsideOrEndpointQueries++;
    const finite=Array.from(values.subarray(o,o+RESULT_FLOATS)).every(Number.isFinite);
    if(!finite)s.nonFiniteQueries++;
    if(r<0||r>1||g<0||g>1)s.negativeOrAboveOneRG++;
    if(values[o+2]!==q.u||values[o+3]!==q.v)s.uvEchoMismatches++;
    const rError=Math.abs(r-cpu.r),gError=Math.abs(g-cpu.g);
    s.maxAbsoluteRErrorVsIdeal=Math.max(s.maxAbsoluteRErrorVsIdeal,rError);
    if(gError>s.maxAbsoluteGErrorVsIdeal||s.worstIdealG===null){
      s.maxAbsoluteGErrorVsIdeal=gError;s.worstIdealG=roundTripWitness(q,cpu,values,i);
    }
    s.maximumGAboveCpuFourCornerMaximum=Math.max(s.maximumGAboveCpuFourCornerMaximum,g-cpu.cornerMaximumG);
    const failures=[];
    if(!finite)failures.push('non-finite');
    if(r<0||r>1||g<0||g>1)failures.push('RG-outside-UNORM-range');
    if(values[o+2]!==q.u||values[o+3]!==q.v)failures.push('UV-echo');
    if(r>0){
      s.actualGpuPositiveR++;
      if(cpu.r===0)s.cpuIdealRZeroButGpuPositiveR++;
      if(halo.positiveTexels===0){s.allZeroMapFalsePositiveR++;failures.push('false-positive-R-on-all-zero-map');}
      else{
        const excess=g-halo.maximumGNormalized;
        if(s.maximumPositiveRGAboveHaloMaximum===null||excess>s.maximumPositiveRGAboveHaloMaximum){
          s.maximumPositiveRGAboveHaloMaximum=excess;s.worstHaloG=roundTripWitness(q,cpu,values,i);
        }
        if(excess>FILTER_ALLOWANCE){s.positiveRFilterAllowanceViolations++;failures.push('G-more-than-one-code-above-halo');}
        for(let j=0;j<3;j++){
          const at=o+4+j*4,slack=values[at+1]-values[at];
          if(s.minimumPositiveRCeilingSlackKm===null||slack<s.minimumPositiveRCeilingSlackKm){
            s.minimumPositiveRCeilingSlackKm=slack;s.worstEndpoint=roundTripWitness(q,cpu,values,i);
          }
          if(slack<0){s.positiveRNegativeCeilingSlack++;failures.push('negative-guard-slack');}
          if(values[at+2]!==0||values[at+3]!==0){s.positiveRGuardAttachmentViolations++;failures.push('nonzero-attachment-at-or-after-guard');}
        }
      }
    }
    if(s.minimumEnvelopeCeilingSlackKm===null||values[o+16]<s.minimumEnvelopeCeilingSlackKm)s.minimumEnvelopeCeilingSlackKm=values[o+16];
    if(values[o+17]!==0||values[o+18]!==0){s.envelopeAttachmentViolations++;failures.push('one-code-envelope-attachment');}
    if(values[o+16]<0){s.envelopeNegativeSlack++;failures.push('one-code-envelope-negative-slack');}
    if(failures.length&&s.firstViolations.length<16)s.firstViolations.push({failures,...roundTripWitness(q,cpu,values,i)});
  }
  // Four-corner/ideal errors expose coordinate/weight precision; their magnitude
  // alone is not the halo-maximum pass criterion.
  s.passed=s.nonFiniteQueries===0&&s.negativeOrAboveOneRG===0&&s.uvEchoMismatches===0&&
    s.allZeroMapFalsePositiveR===0&&s.positiveRFilterAllowanceViolations===0&&
    s.positiveRGuardAttachmentViolations===0&&s.positiveRNegativeCeilingSlack===0&&
    s.envelopeAttachmentViolations===0&&s.envelopeNegativeSlack===0;
  return s;
}
async function auditMap(device,pipeline,sampler,map){
  const qs=queriesFor(map.data,map.size),halo=haloMaximum(map.data,map.size),count=qs.list.length;
  const resources=[],outBytes=count*RESULT_FLOATS*4;
  let texture=null,readback=null,mapped=false;
  try{
    texture=device.createTexture({label:map.name,dimension:'2d',size:[map.size,map.size,1],
      mipLevelCount:1,format:'rg8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
    const input=device.createBuffer({size:qs.packed.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});resources.push(input);
    const uniform=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});resources.push(uniform);
    const output=device.createBuffer({size:outBytes,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});resources.push(output);
    readback=device.createBuffer({size:outBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});resources.push(readback);
    device.queue.writeTexture({texture},map.data,{bytesPerRow:map.size*2,rowsPerImage:map.size},[map.size,map.size,1]);
    device.queue.writeBuffer(input,0,qs.packed);
    const uniformFloats=new Float32Array([halo.maxBaseReferenceKm??-.5,GUARD_KM,count,halo.maximumGNormalized??0,...GROWTH,0]);
    device.queue.writeBuffer(uniform,0,uniformFloats);
    const binding=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:texture.createView({dimension:'2d',baseMipLevel:0,mipLevelCount:1})},
      {binding:1,resource:sampler},{binding:2,resource:{buffer:input}},
      {binding:3,resource:{buffer:uniform}},{binding:4,resource:{buffer:output}}]});
    const encoder=device.createCommandEncoder({label:'rain sampler '+map.name}),pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,binding);pass.dispatchWorkgroups(Math.ceil(count/64));pass.end();
    encoder.copyBufferToBuffer(output,0,readback,0,outBytes);device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);mapped=true;
    const bytes=new Uint8Array(readback.getMappedRange().slice(0)),values=new Float32Array(bytes.buffer);
    readback.unmap();mapped=false;
    return {name:map.name,kind:map.kind,size:map.size,mapSha256:await digest(map.data),
      mapBytes:map.data.byteLength,queryInputSha256:await digest(new Uint8Array(qs.packed.buffer)),
      gpuOutputSha256:await digest(bytes),halo,uploadedUniformF32:Array.from(uniformFloats),
      results:summarize(map,qs.list,values,halo)};
  }finally{
    if(mapped)readback?.unmap();
    for(const buffer of resources)buffer.destroy();texture?.destroy();
  }
}
UI.run.addEventListener('click',async()=>{
  UI.run.disabled=true;UI.download.disabled=true;UI.status.textContent='Audit GPU in corso; nessuna misura FPS.';
  const started=performance.now(),uncapturedErrors=[];
  let device=null,cleanup={deviceDestroyed:false,perMapResourcesDestroyed:false};
  try{
    const [shaderBytes,scriptBytes,htmlBytes,manifestBytes,realBytes]=await Promise.all([
      fetchBytes('./sampler.wgsl'),fetchBytes('./audit.js'),fetchBytes('./index.html'),
      fetchBytes('./real-map-provenance.json'),fetchBytes('./real-map-rg8.bin')]);
    const provenance=JSON.parse(new TextDecoder().decode(manifestBytes));
    const realSha=await digest(realBytes);
    if(realSha!==provenance.mapSha256||realBytes.length!==64*64*2)throw new Error('Real map byte/SHA mismatch.');
    if(!navigator.gpu)throw new Error('WebGPU non disponibile; usare localhost in browser compatibile.');
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter)throw new Error('Nessun adattatore WebGPU.');
    device=await adapter.requestDevice();activeDevice=device;
    device.addEventListener('uncapturederror',event=>uncapturedErrors.push(event.error.message));
    const shader=new TextDecoder().decode(shaderBytes);
    const module=await checked(device,()=>device.createShaderModule({label:'rain sampler audit',code:shader}));
    const compilation=await module.getCompilationInfo(),compileErrors=compilation.messages.filter(m=>m.type==='error');
    if(compileErrors.length)throw new Error(compileErrors.map(m=>m.lineNum+':'+m.linePos+' '+m.message).join('; '));
    const pipeline=await checked(device,()=>device.createComputePipelineAsync({label:'rain sampler audit',layout:'auto',compute:{module,entryPoint:'auditSampler'}}));
    const sampler=device.createSampler({addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge',
      magFilter:'linear',minFilter:'linear',mipmapFilter:'nearest',lodMinClamp:0,lodMaxClamp:0,maxAnisotropy:1});
    const maps=fixtures();maps.push({name:'actual-seed72-64x64',kind:'existing-real-map',size:64,data:realBytes});
    const results=[];
    for(let i=0;i<maps.length;i++){
      UI.status.textContent='Audit '+(i+1)+'/'+maps.length+': '+maps[i].name;
      results.push(await checked(device,()=>auditMap(device,pipeline,sampler,maps[i])));
    }
    cleanup.perMapResourcesDestroyed=true;
    report={kind:'rain-rg8-sampler-audit',status:'completed',gpuStatus:'completed',date:new Date().toISOString(),
      method:'Standalone raw WebGPU compute, one RG8UNORM 2D plane per dataset, explicit textureSampleLevel mip0, dynamic storage UV; linear clamp sampler. No Three.js integration or renderer-pipeline equivalence claim.',
      guard:{guardKm:GUARD_KM,filterAllowanceNormalized:1/255,filterHeightAllowanceKm:3/255,aluGuardKm:2**-15,
        growthInputsF32:GROWTH,condition:'Execute original optical branch when rainRegion && rp.y <= guardedCeiling; first skipped height is nextUp(guardedCeiling).'},
      provenance:{shaderSha256:await digest(shaderBytes),scriptSha256:await digest(scriptBytes),htmlSha256:await digest(htmlBytes),
        realMapSha256:realSha,realMapProvenanceSha256:await digest(manifestBytes),realMap:provenance},
      adapter:{vendor:adapter.info?.vendor??'',architecture:adapter.info?.architecture??'',device:adapter.info?.device??'',
        description:adapter.info?.description??'',isFallbackAdapter:adapter.info?.isFallbackAdapter??null},
      datasetCount:results.length,totalQueries:results.reduce((n,r)=>n+r.results.queryCount,0),
      totalActualPositiveR:results.reduce((n,r)=>n+r.results.actualGpuPositiveR,0),
      uncapturedErrors,passed:results.every(r=>r.results.passed)&&uncapturedErrors.length===0,
      interpretation:'Finite device/driver samples only. Ideal CPU R/G error reports weight/coordinate differences; the tested certificate instead requires no false positive R on zero maps, G not more than one code above the encoded emission-halo maximum for actual GPU R>0, and zero attachment at/after the guarded ceiling. This is not a universal sampler error bound, all-UV proof, performance result, cloud bake or photographic acceptance.',
      results};
  }catch(error){
    report={kind:'rain-rg8-sampler-audit',status:'failed',gpuStatus:'failed',date:new Date().toISOString(),
      error:error instanceof Error?error.message:String(error),uncapturedErrors,passed:false};
  }finally{
    if(device){device.destroy();cleanup.deviceDestroyed=true;}
    activeDevice=null;
    report.cleanup=cleanup;
    report.elapsedAuditWallMs=performance.now()-started;
    // Hash this canonical compact payload before adding the integrity field.
    const payload=JSON.stringify(report);
    report.integrity={algorithm:'SHA-256',scope:'UTF-8 JSON.stringify(report) before adding integrity',
      payloadSha256:await digest(utf8(payload))};
    publish();UI.download.disabled=false;UI.run.disabled=false;
    UI.status.textContent=report.status==='completed'?
      'Audit completato: '+(report.passed?'campioni passati.':'violazioni: leggere JSON.')+' Risorse GPU rilasciate.':
      'Audit fallito: leggere JSON. Risorse GPU rilasciate.';
  }
});
