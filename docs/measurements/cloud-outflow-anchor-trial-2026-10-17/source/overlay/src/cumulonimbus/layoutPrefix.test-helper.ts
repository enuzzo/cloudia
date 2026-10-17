/** TEST/AUDIT ONLY. Read the actual generator prefix; never call its raster/bake.
 * Intentionally fails closed if the bounded extraction contract changes.
 */
import assert from 'node:assert/strict';
import * as ts from 'typescript';
import * as light from './light';
import * as sun from './sun';
import * as motion from './motion';
import * as shoulder from './inclinedShoulder';
import * as outflow from './outflowAnchor';

type Lobe=[number,number,number,number,number,number,number?];
type Rng={initialSeed:number;calls:number};
export interface LayoutTrace {
 family:'congestus'|'multicell'|'sheared';before:Lobe[];lobes:Lobe[];
 beforeRng:Rng[];afterRng:Rng[];uniqueLobes:number;
 summits:number[];foundations:number[];sharedBody:number|null;
 shoulders:{core:number;top:number;foundation:number;ordinal:number}[];
 groups:{core:number;ids:number[]}[];
}
export interface JointLayoutCheck {
 mode:'unmodified-family'|'inward-projected'|'outward-unchanged';projection:number|null;
 oldRoof?:number;attachmentY?:number;scale?:number;selectedCore?:number;
 inwardUnitXZ?:[number,number];signedAfter?:number;
 offsetBeforeXZ?:[number,number];perpendicularBeforeXZ?:[number,number];perpendicularAfterXZ?:[number,number];
 recenterDeltaXZ?:[number,number];recenterKm?:number;bodyExact?:boolean;outsideSelectedExact?:boolean;allNonXZExact?:boolean;
}

export function createLayoutPrefix(source:string):(seed:number)=>LayoutTrace {
 const once=(text:string,needle:string)=>{assert.equal(text.split(needle).length,2,'Extraction anchor changed: '+needle);};
 const marker='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.';
 once(source,marker);let prefix=source.slice(0,source.indexOf(marker));
 const header='export function generateVolume(size = VOLUME_RESOLUTION, seed = 71, progress?: (fraction: number) => void): CloudVolume {';
 once(prefix,header);prefix=prefix.replace(header,'export function traceLayout(seed = 71) {\n  __layoutRng=[];');
 const allocation='  const n = size ** 3, field = new Float32Array(n), density = new Float32Array(n);\n  field.fill(-10);\n';
 once(prefix,allocation);prefix=prefix.replace(allocation,'');
 const cellular='  const cellular=cellularNoise(seed+137);\n';once(prefix,cellular);prefix=prefix.replace(cellular,'');
 const random='function random(seed: number) {\n  return () => { seed |= 0;';once(prefix,random);
 prefix=prefix.replace(random,'function random(seed: number) {\n  const counter={initialSeed:seed,calls:0};__layoutRng.push(counter);\n  return () => { counter.calls++; seed |= 0;');
 const joint=prefix.lastIndexOf("  if(shape.family==='sheared') {");
 assert(joint>0&&prefix.slice(joint).includes('authoredShoulders.filter'),'Joint block boundary changed');
 prefix=prefix.slice(0,joint)+'  const __beforeJoint=lobes.map(l=>l.slice());\n  const __beforeRng=__layoutRng.map(r=>({...r}));\n'+prefix.slice(joint);
 prefix='let __layoutRng:Array<{initialSeed:number;calls:number}>=[];\n'+prefix;
 prefix+=`  return {family:shape.family,before:__beforeJoint,lobes,beforeRng:__beforeRng,afterRng:__layoutRng,
    uniqueLobes:new Set(lobes).size,summits:summits.map(l=>lobes.indexOf(l)),foundations:foundations.map(l=>lobes.indexOf(l)),
    sharedBody:sharedBody?lobes.indexOf(sharedBody):null,
    shoulders:authoredShoulders.map(s=>({core:lobes.indexOf(s.core),top:lobes.indexOf(s.top),foundation:lobes.indexOf(s.foundation),ordinal:s.ordinal})),
    groups:[...trackedGroups].map(([core,refs])=>({core:lobes.indexOf(core),ids:[...refs].map(l=>lobes.indexOf(l))}))};\n}\n`;
 const emitted=ts.transpileModule(prefix,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
 assert(!emitted.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'Prefix TypeScript syntax changed');
 const modules:Record<string,unknown>={'./light':light,'./sun':sun,'./motion':motion,'./inclinedShoulder':shoulder,'./outflowAnchor':outflow};
 const requireLocal=(name:string)=>{assert(Object.hasOwn(modules,name),'Unexpected prefix import: '+name);return modules[name];};
 const module={exports:{} as Record<string,unknown>};
 // Only trusted local source is compiled; no fixture geometry or duplicate generator.
 new Function('require','module','exports',emitted.outputText)(requireLocal,module,module.exports);
 const trace=module.exports.traceLayout as (seed:number)=>LayoutTrace;assert.equal(typeof trace,'function');
 for(const forbidden of ['new Float32Array','new Uint8Array','generateDetail(','bakeOccupancy('])assert(!trace.toString().includes(forbidden),forbidden);
 return trace;
}

/** Observe projection/perpendicular invariants, never replay a translation formula. */
export function assertJointLayoutContract(t:LayoutTrace):JointLayoutCheck {
 const a=t.before,b=t.lobes;assert.equal(a.length,b.length);assert.equal(t.uniqueLobes,b.length);assert.deepEqual(t.beforeRng,t.afterRng);
 const close=(x:number,y:number,message:string)=>assert(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<1e-12,message);
 if(t.family!=='sheared'){assert.deepEqual(a,b);return {mode:'unmodified-family',projection:null};}
 const mature=t.summits.reduce((i,j)=>a[i][1]>a[j][1]?i:j),foot=t.foundations[t.summits.indexOf(mature)],others=t.foundations.filter(i=>i!==foot);
 assert.equal(others.length,1);
 const m=a[mature],f=a[foot],young=a[others[0]],axis=[m[0]-f[0],m[1]-f[1],m[2]-f[2]];
 const direction=[young[0]-f[0],young[2]-f[2]],length=Math.hypot(...direction);assert(axis[1]>0&&length>0);
 const unit:[number,number]=[direction[0]/length,direction[1]/length];
 const offset=(l:Lobe):[number,number]=>{const h=(l[1]-f[1])/axis[1];return [l[0]-f[0]-axis[0]*h,l[2]-f[2]-axis[2]*h];};
 const signed=(v:[number,number])=>v[0]*unit[0]+v[1]*unit[1];
 const perpendicular=(v:[number,number],p:number):[number,number]=>[v[0]-unit[0]*p,v[1]-unit[1]*p];
 const choices=t.shoulders.filter(s=>s.top===mature).map(s=>({...s,projection:signed(offset(a[s.core]))}));assert(choices.length>0);
 const selected=choices.reduce((x,y)=>x.projection>y.projection?x:y),groups=new Map(t.groups.map(g=>[g.core,g.ids]));
 const body=groups.get(t.sharedBody!)!,inner=groups.get(selected.core)!;
 assert.equal(body.length,91);assert.equal(inner.length,91);assert.equal(new Set([...body,...inner]).size,182);
 // Check the body first, so a restored R3/R4 body lift is rejected for its real cause.
 for(const id of body)assert.deepEqual(b[id],a[id],'Shared body must remain byte-exact');
 const core=a[t.sharedBody!],oldRoof=core[1]+core[4],attachmentY=a[selected.core][1];
 if(!(selected.projection>0)){
  assert.deepEqual(b,a,'Outward layouts must remain byte-exact');
  return {mode:'outward-unchanged',projection:selected.projection,oldRoof,attachmentY,scale:1,recenterDeltaXZ:[0,0],recenterKm:0,bodyExact:true,outsideSelectedExact:true,allNonXZExact:true};
 }
 const selectedIds=new Set(inner);
 for(let id=0;id<a.length;id++)if(!selectedIds.has(id))assert.deepEqual(b[id],a[id],'Nonselected primitive must remain byte-exact');
 const beforeCore=a[selected.core],afterCore=b[selected.core],beforeOffset=offset(beforeCore),afterOffset=offset(afterCore);
 const beforeSigned=signed(beforeOffset),afterSigned=signed(afterOffset),beforePerp=perpendicular(beforeOffset,beforeSigned),afterPerp=perpendicular(afterOffset,afterSigned);
 close(afterSigned,0,'Inward component must be removed');
 close(afterPerp[0],beforePerp[0],'Perpendicular X offset must be preserved');close(afterPerp[1],beforePerp[1],'Perpendicular Z offset must be preserved');
 for(const id of inner){
  assert.equal(b[id].length,a[id].length);
  for(const coordinate of [1,3,4,5,6])assert.equal(b[id][coordinate],a[id][coordinate],'Y/radii/blend must remain byte-exact');
  close(b[id][0]-afterCore[0],a[id][0]-beforeCore[0],'Child core-relative X offset must be preserved');
  close(b[id][2]-afterCore[2],a[id][2]-beforeCore[2],'Child core-relative Z offset must be preserved');
 }
 const delta:[number,number]=[afterCore[0]-beforeCore[0],afterCore[2]-beforeCore[2]];
 return {mode:'inward-projected',projection:beforeSigned,oldRoof,attachmentY,scale:b[t.sharedBody!][4]/core[4],selectedCore:selected.core,inwardUnitXZ:unit,signedAfter:afterSigned,
  offsetBeforeXZ:beforeOffset,perpendicularBeforeXZ:beforePerp,perpendicularAfterXZ:afterPerp,recenterDeltaXZ:delta,recenterKm:Math.hypot(...delta),bodyExact:true,outsideSelectedExact:true,allNonXZExact:true};
}
