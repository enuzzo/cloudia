/** TEST/AUDIT ONLY. Read the actual generator prefix; never call its raster/bake.
 * Intentionally fails closed if the bounded extraction contract changes.
 */
import assert from 'node:assert/strict';
import * as ts from 'typescript';
import * as light from './light';
import * as sun from './sun';
import * as motion from './motion';
import * as shoulder from './inclinedShoulder';

type Lobe=[number,number,number,number,number,number,number?];
type Rng={initialSeed:number;calls:number};
type TraceGroup={core:number;ids:number[]};
type TraceTurret={foundation:number;top:number;coreIds:number[];buried:number|null};
export interface BranchLayoutTrace {
 applied:boolean;before:Lobe[];after:Lobe[];beforeRng:Rng[];afterRng:Rng[];
 turrets:TraceTurret[];groups:TraceGroup[];iceCores:number[];
 declaredTurrets:TraceTurret[]|null;declaredGroups:TraceGroup[]|null;dominantTop:number|null;
}
export interface BranchLayoutCheck {dominantTop:number;turretCount:number;coreGroupCount:number;movedGroups:number;movedRoots:number;maxTranslationKm:number}
export interface LayoutTrace {
 family:'congestus'|'multicell'|'sheared';before:Lobe[];lobes:Lobe[];
 beforeRng:Rng[];afterRng:Rng[];uniqueLobes:number;
 summits:number[];foundations:number[];sharedBody:number|null;
 shoulders:{core:number;top:number;foundation:number;ordinal:number}[];
 groups:{core:number;ids:number[]}[];
 branch:BranchLayoutTrace;
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
 // Observe actual append ownership independently of the branch Map. No lobe
 // coordinates or generator expressions are recreated by these hooks.
 const turretHeader='  const turret=(x:number,z:number,height:number,width:number,lean:number) => {';
 once(prefix,turretHeader);prefix=prefix.replace(turretHeader,
  '  const __observedTurrets:Array<{foundation:Lobe;top:Lobe;cores:Lobe[];buried:Lobe|null}>=[];\n'+
  turretHeader+'\n    const __turretFirst=liquid.length;');
 const turretEnd="    }\n  };\n  if(shape.family==='congestus') {";
 once(prefix,turretEnd);prefix=prefix.replace(turretEnd,
  "    }\n    __observedTurrets.push({foundation,top,cores:liquid.slice(__turretFirst),buried:null});\n  };\n  if(shape.family==='congestus') {");
 const buried="  if(shape.family!=='sheared') for(let i=0;i<summits.length;i++) {";
 once(prefix,buried);prefix=prefix.replace(buried,'  const __buriedFirst=liquid.length;\n'+buried);
 const transform='  const transform=(c:Lobe,isIce:boolean) => {';once(prefix,transform);
 prefix=prefix.replace(transform,`  if(shape.family!=='sheared') {
    const added=liquid.slice(__buriedFirst);
    if(added.length!==summits.length)throw new Error('Buried append ownership changed');
    for(let i=0;i<added.length;i++) {
      const owner=__observedTurrets.find(t=>t.top===summits[i]);
      if(!owner||owner.foundation!==foundations[i])throw new Error('Buried source-cell ownership changed');
      owner.buried=added[i];owner.cores.push(added[i]);
    }
  }
`+transform);
 const append='  [...liquid,...iceCores].forEach((c,i) => {';once(prefix,append);
 prefix=prefix.replace(append,'  const __observedGroups=new Map<Lobe,Lobe[]>();\n'+append+'\n    const __descendantFirst=lobes.length;');
 const appendEnd='  });\n  // Unequal overlapping outflow billows give the cap a three-dimensional shoulder.';
 once(prefix,appendEnd);prefix=prefix.replace(appendEnd,
  '    __observedGroups.set(c,[c,...lobes.slice(__descendantFirst)]);\n'+appendEnd);
 const beforeBranch='  // Apply the branch hierarchy to actual core groups after horizontal contraction.';
 const afterBranch='  // The existing inward shoulder joint reads the moved young foundations.';
 const hasBranches=[beforeBranch,afterBranch,'branchGroups'].some(anchor=>prefix.includes(anchor));
 if(hasBranches) {
  once(prefix,beforeBranch);once(prefix,afterBranch);
  prefix=prefix.replace(beforeBranch,'  const __beforeBranch=lobes.map(l=>l.slice());\n  const __beforeBranchRng=__layoutRng.map(r=>({...r}));\n'+beforeBranch);
  prefix=prefix.replace(afterBranch,'  const __afterBranch=lobes.map(l=>l.slice());\n  const __afterBranchRng=__layoutRng.map(r=>({...r}));\n'+afterBranch);
 }
 const joint=prefix.lastIndexOf("  if(shape.family==='sheared') {");
 assert(joint>0&&prefix.slice(joint).includes('authoredShoulders.filter'),'Joint block boundary changed');
 const baselineBranch=hasBranches?'':'  const __beforeBranch=lobes.map(l=>l.slice()),__afterBranch=lobes.map(l=>l.slice());\n  const __beforeBranchRng=__layoutRng.map(r=>({...r})),__afterBranchRng=__layoutRng.map(r=>({...r}));\n';
 prefix=prefix.slice(0,joint)+baselineBranch+'  const __beforeJoint=lobes.map(l=>l.slice());\n  const __beforeRng=__layoutRng.map(r=>({...r}));\n'+prefix.slice(joint);
 prefix='let __layoutRng:Array<{initialSeed:number;calls:number}>=[];\n'+prefix;
 const declaredTurrets=hasBranches?'turrets.map(t=>({foundation:lobes.indexOf(t.foundation),top:lobes.indexOf(t.top),coreIds:turretCores(t).map(c=>lobes.indexOf(c)),buried:t.buried?lobes.indexOf(t.buried):null}))':'null';
 const declaredGroups=hasBranches?'[...branchGroups].map(([core,refs])=>({core:lobes.indexOf(core),ids:[...refs].map(l=>lobes.indexOf(l))}))':'null';
 prefix+=`  return {family:shape.family,before:__beforeJoint,lobes,beforeRng:__beforeRng,afterRng:__layoutRng,
    uniqueLobes:new Set(lobes).size,summits:summits.map(l=>lobes.indexOf(l)),foundations:foundations.map(l=>lobes.indexOf(l)),
    sharedBody:sharedBody?lobes.indexOf(sharedBody):null,
    shoulders:authoredShoulders.map(s=>({core:lobes.indexOf(s.core),top:lobes.indexOf(s.top),foundation:lobes.indexOf(s.foundation),ordinal:s.ordinal})),
    groups:[...trackedGroups].map(([core,refs])=>({core:lobes.indexOf(core),ids:[...refs].map(l=>lobes.indexOf(l))})),
    branch:{applied:${hasBranches},before:__beforeBranch,after:__afterBranch,beforeRng:__beforeBranchRng,afterRng:__afterBranchRng,
      turrets:__observedTurrets.map(t=>({foundation:lobes.indexOf(t.foundation),top:lobes.indexOf(t.top),coreIds:t.cores.map(c=>lobes.indexOf(c)),buried:t.buried?lobes.indexOf(t.buried):null})),
      groups:[...__observedGroups].map(([core,refs])=>({core:lobes.indexOf(core),ids:refs.map(l=>lobes.indexOf(l))})),
      iceCores:iceCores.map(l=>lobes.indexOf(l)),declaredTurrets:${declaredTurrets},declaredGroups:${declaredGroups},
      dominantTop:${hasBranches?'lobes.indexOf(dominant.top)':'null'}}};\n}\n`;
 const emitted=ts.transpileModule(prefix,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
 assert(!emitted.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'Prefix TypeScript syntax changed');
 const modules:Record<string,unknown>={'./light':light,'./sun':sun,'./motion':motion,'./inclinedShoulder':shoulder};
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


/** Check geometric endpoint/rigidity properties from observed deltas.
 * This does not replay the runtime's X/Z update or copy its transform function.
 * Canonical before-layout identity is a separate external preflight obligation.
 */
export function assertBranchLayoutContract(t:LayoutTrace):BranchLayoutCheck {
 const q=t.branch,a=q.before,b=q.after;
 assert(q.applied,'The branch rule must actually be present');
 assert(a.length>0&&a.length<=4096,'Prefix primitive budget changed');
 assert.equal(a.length,b.length);assert.equal(b.length,t.lobes.length);assert.equal(t.uniqueLobes,a.length);
 assert.deepEqual(q.beforeRng,q.afterRng,'Branch rule must not consume RNG');
 assert.deepEqual(q.beforeRng,t.afterRng,'Later joint must not consume RNG');
 assert.deepEqual(q.declaredTurrets,q.turrets,'Declared turret refs must match actual append ownership');
 const close=(x:number,y:number,message:string)=>assert(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<1e-12,message);
 const groups=new Map(q.groups.map(g=>[g.core,g.ids]));assert.equal(groups.size,q.groups.length);
 const coreIds=q.turrets.flatMap(v=>v.coreIds),coreSet=new Set(coreIds),owned=new Set<number>();
 assert.equal(coreSet.size,coreIds.length,'A core cannot belong to multiple cells');
 assert.equal(q.turrets.length,t.summits.length);assert(q.turrets.length>=2&&q.turrets.length<=3);
 assert.deepEqual(q.turrets.map(v=>v.top),t.summits);assert.deepEqual(q.turrets.map(v=>v.foundation),t.foundations);
 const expectedGroups=coreIds.map(core=>({core,ids:groups.get(core)!}));
 assert.deepEqual(q.declaredGroups,expectedGroups,'Declared groups must match independently observed generic appends');
 for(const {core,ids} of expectedGroups) {
  assert(ids&&ids.length===91&&ids[0]===core,'A core needs all90 actual generic descendants');
  for(const id of ids){assert(id>=0&&id<a.length&&!owned.has(id),'Each actual primitive needs unique branch ownership');owned.add(id);}
 }
 for(let id=0;id<a.length;id++) {
  assert.equal(b[id].length,a[id].length);assert(a[id].every(Number.isFinite)&&b[id].every(Number.isFinite),'Observed tuples must stay finite');
  for(const radius of [3,4,5] as const)assert(a[id][radius]>0&&b[id][radius]>0,'Observed radii must stay positive');
  for(const k of [1,3,4,5,6])assert.equal(b[id][k],a[id][k],'Y/radii/blend must remain exact');
  if(!owned.has(id))assert.deepEqual(b[id],a[id],'Common base/pulse/shared body/collars/ice must stay fixed');
 }
 const dominant=q.turrets.find(v=>v.top===q.dominantTop);assert(dominant,'Dominant must be an actual source-cell head');
 assert.equal(a[dominant.top][1],Math.max(...t.summits.map(id=>a[id][1])),'Dominant must be the highest actual head');
 let movedGroups=0,movedRoots=0,maxTranslationKm=0;
 for(const cell of q.turrets) {
  assert(cell.coreIds.includes(cell.foundation)&&cell.coreIds.includes(cell.top));
  if(t.family==='sheared')assert.equal(cell.buried,null);else assert(cell.buried!==null&&cell.coreIds.includes(cell.buried),'Existing per-cell buried body must be owned');
  const f=a[cell.foundation],root=b[cell.foundation],parent=a[dominant.foundation];
  const old=[f[0]-parent[0],f[2]-parent[2]],now=[root[0]-parent[0],root[2]-parent[2]];
  const oldDistance=Math.hypot(...old),distance=Math.hypot(...now),delta=[root[0]-f[0],root[2]-f[2]],delta2=delta[0]**2+delta[1]**2;
  const rise=a[cell.top][1]-f[1];assert(rise>0);
  if(cell===dominant){assert.deepEqual(root,f,'Dominant root must remain fixed');}
  else if(oldDistance>0) {
   const ux=old[0]/oldDistance,uz=old[1]/oldDistance;
   const radial=(l:Lobe)=>1/Math.hypot(ux/l[3],uz/l[5]);
   const boundary=(radial(f)+radial(parent))*.5;
   close(now[0]*uz-now[1]*ux,0,'Root must remain on the original parent ray');
   assert(now[0]*ux+now[1]*uz>=-1e-12,'Root must not cross through its parent');
   assert(distance<=oldDistance+1e-12&&distance<=boundary+1e-12,'Root must neither spread nor exceed the overlap boundary');
   if(delta2===0)assert(oldDistance<=boundary+1e-12,'A separated root must move');
   else{close(distance,boundary,'Moved root must meet the half-sum directional-radius boundary');movedRoots++;}
  } else assert.deepEqual(root,f,'Coincident roots must stay fixed');
  for(const core of cell.coreIds) {
   const ids:number[]=groups.get(core)!,beforeCore:Lobe=a[core],afterCore:Lobe=b[core],d:[number,number]=[afterCore[0]-beforeCore[0],afterCore[2]-beforeCore[2]];
   if(cell===dominant||delta2===0)assert.deepEqual(afterCore,beforeCore,'A stationary root cannot move its cores');
   else {
    close(d[0]*delta[1]-d[1]*delta[0],0,'Core displacement must follow its actual root displacement');
    const observed=(d[0]*delta[0]+d[1]*delta[1])/delta2;
    assert(observed>=-1e-12&&observed<=1+1e-12,'Observed taper must stay between pinned endpoints');
    if(beforeCore[1]<=f[1])close(observed,1,'Cores below the foundation follow the root');
    else if(beforeCore[1]>=a[cell.top][1])close(observed,0,'Cores at/above the head stay pinned');
    else close(observed*rise,a[cell.top][1]-beforeCore[1],'Observed displacement must taper linearly with actual core height');
   }
   for(const id of ids)for(const axis of [0,1,2] as const)
    close(b[id][axis]-afterCore[axis],a[id][axis]-beforeCore[axis],'Core-relative descendant offsets must remain rigid');
   if(d[0]===0&&d[1]===0)for(const id of ids)assert.deepEqual(b[id],a[id],'Stationary core groups must remain bit-exact');
   else movedGroups++;
   maxTranslationKm=Math.max(maxTranslationKm,Math.hypot(...d));
  }
  for(const id of groups.get(cell.top)!){assert.deepEqual(b[id],a[id],'Every head and its relief must stay fixed');assert.deepEqual(t.lobes[id],a[id],'The later joint cannot move a head');}
 }
 for(const core of q.iceCores)for(const id of groups.get(core)!)assert.deepEqual(t.lobes[id],a[id],'Every cap and generic ice relief must stay fixed');
 for(const [axis,radius,limit] of [[0,3,4.35],[2,5,2.8]] as const) {
  const extent=(lobes:Lobe[])=>Math.max(...lobes.map(l=>Math.abs(l[axis])+l[radius]));
  const cap=Math.max(limit,extent(a));
  assert(extent(b)<=cap,'Post-branch extent may not exceed the canonical/preexisting ULP cap');
  assert(extent(t.lobes)<=cap,'Post-joint extent may not exceed the same cap');
 }
 assert(movedRoots>0&&movedGroups>0,'Selected actual recipe must exercise the branch rule');
 return {dominantTop:dominant.top,turretCount:q.turrets.length,coreGroupCount:coreIds.length,movedGroups,movedRoots,maxTranslationKm};
}
