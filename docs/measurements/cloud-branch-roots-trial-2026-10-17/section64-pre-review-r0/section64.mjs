import assert from 'node:assert/strict';
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Preparation only. The separate reviewed launcher is the sole intended entry.
assert(process.argv.includes('--execute-once-reviewed'), 'Not authorized: use the frozen run.py after review');
const own=dirname(fileURLToPath(import.meta.url)),start=performance.now(),cpu0=process.cpuUsage();
const pins=JSON.parse(readFileSync(resolve(own,'input-pins.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const limits={cpuSeconds:20,wallSeconds:30,rssBytes:384*1024*1024};
const output={kind:'fixed-section64-source-diagnostic-v1',status:'INCOMPLETE',seed:74,size:64,
  section:{x:.5609226029381325,y:4.0458440042043025,zCount:96},variants:[],scope:'CPU Node, fixed64 only; original full bakes retained. No256/GPU/art acceptance.'};
let phase='verify-inputs',activeVariant=null;
function runtime(){
  const cpu=process.cpuUsage(cpu0);
  return {cpuSeconds:(cpu.user+cpu.system)/1e6,wallSeconds:(performance.now()-start)/1000,
    currentRssBytes:process.memoryUsage().rss,node:process.version,arch:process.arch};
}
function budget(){
  const r=runtime();
  assert(r.cpuSeconds<=limits.cpuSeconds&&r.wallSeconds<=limits.wallSeconds&&r.currentRssBytes<=limits.rssBytes,'DIAGNOSTIC_BUDGET_EXCEEDED');
}
function progress(label){phase=label;process.stderr.write(JSON.stringify({phase,activeVariant,...runtime()})+'\n');budget();}
function once(source,needle,value){
  assert.equal(source.split(needle).length,2,'Observer anchor changed: '+needle);
  return source.replace(needle,value);
}
function instrument(source){
  assert(!source.includes('__sectionObserver')&&!source.includes('__sectionFinal'),'Observer identifier collision');
  const prune='  const supportMargin=.13+Math.hypot(...BOUNDS_SIZE)/size;\n  for(let z=1;z<size-1;z++) for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {';
  source=once(source,prune,'  const supportMargin=.13+Math.hypot(...BOUNDS_SIZE)/size;\n  __sectionObserver.capture(field,density,size);\n  for(let z=1;z<size-1;z++) for(let y=1;y<size-1;y++) for(let x=1;x<size-1;x++) {');
  const final='  return erodeDensity(warped,Math.min(.92,erosion+additionalErosion))*material;';
  source=once(source,final,
    '  const __sectionFinal=erodeDensity(warped,Math.min(.92,erosion+additionalErosion))*material;\n'+
    '  if(__sectionObserver.active)__sectionObserver.sample({x,y,z,ice,additionalErosion,r,g,b,wx,wy,wz,warped,erosion,material,final:__sectionFinal});\n'+
    '  return __sectionFinal;');
  return source;
}
const scratch=new DataView(new ArrayBuffer(4));
function f32bits(value){scratch.setFloat32(0,value,true);return scratch.getUint32(0,true);}
function sampleStencil(api,volume,ctx,sample){
  const normalized=[(sample.x+sample.wx-api.BOUNDS_MIN[0])/10,(sample.y+sample.wy-api.BOUNDS_MIN[1])/8.5,(sample.z+sample.wz-api.BOUNDS_MIN[2])/7];
  const texel=normalized.map(v=>Math.max(0,Math.min(1,v))*64-.5),base=texel.map(Math.floor),fraction=texel.map((v,i)=>v-base[i]);
  const clampIndex=v=>Math.max(0,Math.min(63,v));
  let macro=0,raw=0,carved=0;const corners=[];
  for(let dz=0;dz<2;dz++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const requested=[base[0]+dx,base[1]+dy,base[2]+dz],stored=requested.map(clampIndex);
    const i=(stored[2]*64+stored[1])*64+stored[0],byteR=volume.data[i*4];
    const factors=[dx?fraction[0]:1-fraction[0],dy?fraction[1]:1-fraction[1],dz?fraction[2]:1-fraction[2]];
    // Same z/y/x order and left-associative products as actual sampleDetail.
    // Only this indexing/interpolation observer is repeated, not warp/carving.
    macro+=byteR/255*factors[0]*factors[1]*factors[2];
    raw+=ctx.field[i]*factors[0]*factors[1]*factors[2];
    carved+=ctx.beforePrune[i]*factors[0]*factors[1]*factors[2];
    corners.push({requested,stored,world:stored.map((v,axis)=>api.voxelCenter(v,axis,64)),factors,
      byteR,rawField:ctx.field[i],rawFieldBits:f32bits(ctx.field[i]),
      carvedBeforePrune:ctx.beforePrune[i],carvedBeforePruneBits:f32bits(ctx.beforePrune[i])});
  }
  assert.equal(macro,sample.warped,'Actual macro sampler / observed stencil mismatch');
  return {normalized,texel,base,fraction,actualMacroR:sample.warped,replayedMacroR:macro,
    rawFieldTrilinearReference:raw,carvedDensityTrilinearReference:carved,corners};
}
function summary(rows){
  const maximum=key=>rows.reduce((a,b)=>key(b)>key(a)?b:a);
  const pick=row=>({sampleIndex:row.sampleIndex,point:row.point,finalDensity:row.sample.final,
    macroR:row.stencil.actualMacroR,rawFieldTrilinearReference:row.stencil.rawFieldTrilinearReference,
    maxCornerRawField:Math.max(...row.stencil.corners.map(c=>c.rawField))});
  return {positiveFinalCount:rows.filter(r=>r.sample.final>0).length,
    sectionOccupied:rows.some(r=>r.sample.final>0),
    maximumFinal:pick(maximum(r=>r.sample.final)),maximumMacroR:pick(maximum(r=>r.stencil.actualMacroR)),
    maximumRawFieldReference:pick(maximum(r=>r.stencil.rawFieldTrilinearReference))};
}
try{
  assert.equal(process.version,'v26.11.0','Pinned Node runtime version changed');assert.equal(process.arch,'arm64');
  assert.equal(realpathSync(resolve(own,'node_modules')),realpathSync(pins.dependencyRoot),'Dependency symlink changed');
  const tsPin=pins.dependencies.find(d=>d.kind==='typescriptModule');
  assert.equal(hash(readFileSync(tsPin.path)),tsPin.sha256,'TypeScript dependency changed');
  const require=createRequire(resolve(own,'section64.mjs')),ts=require('typescript');
  for(const input of pins.variants){
    budget();activeVariant=input.label;progress('verify-'+input.label);
    const manifest=readFileSync(resolve(own,'sources/manifest-'+input.label+'.json'));
    assert.equal(hash(manifest),input.fullManifestSHA256);assert.equal(Object.keys(JSON.parse(manifest)).length,input.fullManifestCount);
    const texts=new Map(),digests=[];
    for(const record of input.files){
      const bytes=readFileSync(resolve(own,record.path));assert.equal(bytes.length,record.bytes);assert.equal(hash(bytes),record.sha256);
      texts.set('./'+record.path.split('/').at(-1).replace(/\.ts$/,''),bytes.toString('utf8'));
    }
    const ctx={active:false,captures:0,samples:0,field:null,beforePrune:null,last:null,fieldHashAtCapture:null,
      capture(field,density,size){
        assert.equal(size,64);assert.equal(++this.captures,1,'More than one generation capture');
        this.field=field;this.beforePrune=new Float32Array(density);
        this.fieldHashAtCapture=hash(Buffer.from(field.buffer,field.byteOffset,field.byteLength));budget();
      },
      sample(record){this.samples++;this.last=record;}
    };
    const modules=new Map();
    function compile(name){
      if(modules.has(name))return modules.get(name).exports;
      assert(texts.has(name),'Unexpected frozen-module import: '+name);
      const original=texts.get(name),source=name==='./volume'?instrument(original):original;
      const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
      assert(!emitted.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'Transpile syntax error: '+name);
      digests.push({module:name,originalSHA256:hash(original),instrumentedSHA256:hash(source),emittedJS_SHA256:hash(emitted.outputText)});
      const module={exports:{}};modules.set(name,module);
      new Function('require','module','exports','__sectionObserver',emitted.outputText)(compile,module,module.exports,ctx);
      return module.exports;
    }
    const api=compile('./volume');progress('generate64-'+input.label);
    // Exactly one original, full generateVolume call per frozen variant.
    const volume=api.generateVolume(64,74);progress('section96-'+input.label);
    assert.equal(ctx.captures,1);assert(ctx.field&&ctx.beforePrune);
    const [iceStart,iceEnd]=api.iceHeights(74),x=output.section.x,y=output.section.y;
    const t=Math.max(0,Math.min(1,(y-iceStart)/(iceEnd-iceStart))),ice=t*t*(3-2*t),rows=[];
    for(let i=0;i<96;i++){
      const z=api.BOUNDS_MIN[2]+(i+.5)/96*api.BOUNDS_SIZE[2];ctx.last=null;ctx.active=true;
      let final;try{final=api.sampleCloudDensity(volume,volume.detail,x,y,z,ice);}finally{ctx.active=false;}
      assert(ctx.last&&ctx.last.final===final&&Number.isFinite(final));assert.equal(ctx.samples,i+1);
      const stencil=sampleStencil(api,volume,ctx,ctx.last);
      rows.push({sampleIndex:i,point:[x,y,z],sample:ctx.last,stencil});
      if(i%8===0)budget();
    }
    const fieldHashAfter=hash(Buffer.from(ctx.field.buffer,ctx.field.byteOffset,ctx.field.byteLength));
    assert.equal(fieldHashAfter,ctx.fieldHashAtCapture,'Observed field mutated after capture');
    output.variants.push({label:input.label,originalManifestSHA256:input.fullManifestSHA256,fullBakeRetained:true,
      iceRange:[iceStart,iceEnd],ice,fieldSHA256:fieldHashAfter,
      carvedBeforePruneSHA256:hash(Buffer.from(ctx.beforePrune.buffer,ctx.beforePrune.byteOffset,ctx.beforePrune.byteLength)),
      moduleDigests:digests,summary:summary(rows),rows});
    progress('complete-'+input.label);
  }
  assert.equal(output.variants.length,2);assert.deepEqual(output.variants.map(v=>v.label),['A','B']);
  const a=output.variants[0],b=output.variants[1];
  let largest=0,where=0;
  for(let i=0;i<96;i++){const delta=Math.abs(b.rows[i].sample.final-a.rows[i].sample.final);if(delta>largest){largest=delta;where=i;}}
  output.comparison={largestAbsoluteFinalDelta:largest,sampleIndex:where,point:a.rows[where].point,
    a:a.summary,b:b.summary};
  output.status='COMPLETE_DIAGNOSTIC_ONLY';budget();
}catch(error){
  output.status='ERROR';output.error={message:String(error?.message??error),stack:error?.stack};process.exitCode=1;
}finally{
  output.phase=phase;output.activeVariant=activeVariant;output.runtime=runtime();
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}
