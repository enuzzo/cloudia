from pathlib import Path
q=Path(__file__).resolve().parent;s=q/'difference-source/src/cumulonimbus';p=s/'GPUSceneEngine.ts';text=p.read_text()
def swap(old,new):
 global text
 assert text.count(old)==1,(old[:80],text.count(old));text=text.replace(old,new)
swap("import {packRGBA32FReadback} from './rgba32fReadback';","import {packRGBA32FReadback} from './rgba32fReadback';\nimport {comparePackedRGBA32F} from './packedRGBA32FDifference';")
swap("const RENDERER_VERSION='experiment-v60-glo30-static-mesh';","const RENDERER_VERSION='experiment-v60-glo30-cache-difference';")
swap('  private readonly terrainAudit:boolean;','  private readonly terrainAudit:boolean;\n  private readonly terrainDifferenceAudit:boolean;')
swap("this.terrainAudit=this.profiling&&params.get('terrainAudit')==='1';","this.terrainAudit=this.profiling&&params.get('terrainAudit')==='1';this.terrainDifferenceAudit=this.profiling&&params.get('cacheDifference')==='1';")
swap("      return {width,height,sha256:hash,returnedBytes:values.byteLength,packedBytes:packed.byteLength,format:'rgba32float',scope:'All returned pixel bits packed row-wise, excluding r186 inter-row256-byte padding; no colour conversion or quantization.'};","      return {report:{width,height,sha256:hash,returnedBytes:values.byteLength,packedBytes:packed.byteLength,format:'rgba32float',scope:'All returned pixel bits packed row-wise, excluding r186 inter-row256-byte padding; no colour conversion or quantization.'},packed:this.terrainDifferenceAudit?packed:undefined};")
swap('''    try{
      const cached=await digestTarget();
      if(this.destroyed||this.deviceLost||this.releasingGPU)return;
      terrain.invalidate();this.renderTerrain();
      const fresh=await digestTarget();
      if(this.destroyed||this.deviceLost||this.releasingGPU)return;''','''    const digestShadow=async()=>{
      const shadow=terrain.shadow.target,width=shadow.width,height=shadow.height;
      if(width!==2048||height!==2048||shadow.texture.format!==RedFormat||shadow.texture.type!==FloatType)throw new Error('Expected existing2048x2048R32F shadow target');
      const values=await renderer.readRenderTargetPixelsAsync(shadow,0,0,width,height);
      if(!(values instanceof Float32Array)||values.byteLength!==width*height*4)throw new Error('Shadow audit differs from pinned Three186R32F layout');
      const memory=values.buffer;if(!(memory instanceof ArrayBuffer))throw new Error('Expected owned shadow readback memory');
      const bytes=new Uint8Array(memory,values.byteOffset,values.byteLength);
      const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
      return {width,height,bytes:bytes.byteLength,sha256,scope:'Entire existing R32F shadow colour attachment; no depth readback, conversion, padding or extra target'};
    };
    try{
      const cachedRead=await digestTarget(),cached=cachedRead.report;
      if(this.destroyed||this.deviceLost||this.releasingGPU)return;
      const cachedShadow=this.terrainDifferenceAudit?await digestShadow():null;
      if(this.destroyed||this.deviceLost||this.releasingGPU)return;
      terrain.invalidate();this.renderTerrain();
      const freshRead=await digestTarget(),fresh=freshRead.report;
      if(this.destroyed||this.deviceLost||this.releasingGPU)return;
      const freshShadow=this.terrainDifferenceAudit?await digestShadow():null;
      if(this.destroyed||this.deviceLost||this.releasingGPU)return;
      const difference=this.terrainDifferenceAudit?{rgba:comparePackedRGBA32F(cachedRead.packed!,freshRead.packed!,cached.width,cached.height),shadow:{cached:cachedShadow,fresh:freshShadow,identical:cachedShadow!.sha256===freshShadow!.sha256}}:undefined;''')
swap("reportKind:'terrain-raster-cache-full-f32-v1',status:!stable?","reportKind:this.terrainDifferenceAudit?'terrain-cache-difference-v1':'terrain-raster-cache-full-f32-v1',status:!stable?")
swap("cached,fresh,identical,stable,cacheStateQualified,statsBefore,statsAfter,elapsedMs:performance.now()-start,readbackRequests:2,temporaryMemoryScope:'Two sequential full readbacks and packed CPU buffers; allocator/GC/staging residency unmeasured. Only small digests retained in the report.'","cached,fresh,identical,stable,cacheStateQualified,difference,statsBefore,statsAfter,elapsedMs:performance.now()-start,readbackRequests:this.terrainDifferenceAudit?4:2,temporaryMemoryScope:this.terrainDifferenceAudit?'Two existing-target RGBA32F readbacks; both packed CPU arrays retained for bytewise difference, plus two sequential16MiBR32F shadow readbacks. No new GPU target. GC/staging/residency/peak unmeasured; only bounded differences and hashes emitted.':'Two sequential full readbacks and packed CPU buffers; allocator/GC/staging residency unmeasured. Only small digests retained in the report.'")
p.write_text(text)
p=s/'lifecycle.test.ts';p.write_text(p.read_text().replace('experiment-v60-glo30-static-mesh','experiment-v60-glo30-cache-difference'))
print('Separate one-shot difference audit integrated; helper/test still to copy, no GPU or model executed')
