/** One authorized full CPU bake; reusable arrays remain outside Dropbox. No GPU. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateVolume,iceHeights,VOLUME_RESOLUTION,DETAIL_RESOLUTION} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/volume.ts';
import {precipitationFootprint,precipitationSourceBounds} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/precipitation.ts';
import {motionState} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/motion.ts';
import {fillMotionField,MOTION_FIELD_SIZE} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/motionField.ts';
const base='/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work';
const project='/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const names=['volume','light','motion','motionField','precipitation','emptyTraversal','medium','landscape','cloudShader','GPUSceneEngine'];
const hashes=()=>Object.fromEntries(names.map(n=>[n,sha(readFileSync(project+'/src/cumulonimbus/'+n+'.ts'))]));
if(existsSync(base+'/data/manifest.json'))throw new Error('Cache already exists; reuse it. No additional bake.');
if(existsSync(base+'/data/started.json'))throw new Error('A prior bake was started. Inspect its state; do not auto-regenerate.');
const input=readFileSync('/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle9/control-rain-30s.json');
const pose=JSON.parse(input.toString()),before=hashes(),started=performance.now();
if(pose.seed!==72||pose.simulationTimeStart!==60||pose.output[0]!==2560||pose.output[1]!==1440)throw new Error('Unexpected A/B/A pose.');
writeFileSync(base+'/input-control.json',input);
writeFileSync(base+'/data/started.json',JSON.stringify({date:new Date().toISOString(),seed:72,size:256,requestedBakes:1,sourceHashes:before},null,2)+'\n');
console.log('One authorized generateVolume(256,72); data saved for reuse outside Dropbox.');
let last=-1;
const v=generateVolume(256,72,p=>{
 const bucket=Math.floor(p*10);if(bucket>last){last=bucket;console.log(JSON.stringify({stage:'bake',fraction:p,elapsedSeconds:(performance.now()-started)/1000}));}
});
if(v.size!==VOLUME_RESOLUTION||v.detail.size!==DETAIL_RESOLUTION)throw new Error('Unexpected volume resolution.');
const generationMs=performance.now()-started,files:Record<string,unknown>={};
function save(name:string,bytes:Uint8Array|Uint16Array){
 const data=new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 writeFileSync(base+'/data/'+name,data);files[name]={bytes:data.byteLength,sha256:sha(data)};
}
save('macro-rgba8.bin',v.data);save('detail-rgba8.bin',v.detail.data);save('sunset-rg8.bin',v.sunsetLight);
const rain=precipitationFootprint(v);save('rain-rg8.bin',rain);
const state=motionState(60,72);state.dispersion=0;
const field=new Uint16Array(MOTION_FIELD_SIZE**3*4);fillMotionField(field,MOTION_FIELD_SIZE,state,iceHeights(72));save('flow-rgba16f.bin',field);
const after=hashes(),changedSources=names.filter(n=>before[n]!==after[n]);
const manifest={kind:'rain-work-reusable-cpu-inputs',date:new Date().toISOString(),seed:72,time:60,bakesPerformed:1,
 rootReportedCheckpoint:'ab2e122',volumeSize:v.size,detailSize:v.detail.size,flowSize:MOTION_FIELD_SIZE,
 supportBounds:v.supportBounds,iceRange:iceHeights(72),state,rainBounds:precipitationSourceBounds(rain),files,
 inputControlSha256:sha(input),sourceHashesBefore:before,sourceHashesAfter:after,changedSources,
 prepareScriptSha256:sha(readFileSync(import.meta.path)),generationMs,
 caveat:'Generated CPU baseline, not GPU readback. Flow is CPU analytic evaluation packed half at t60, not actual GPU compute output. Sunset cache retained for future reuse; source radiance is not needed for opacity/work counts.'};
writeFileSync(base+'/data/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({status:'completed',generationMs,changedSources,files,bakesPerformed:1}));
