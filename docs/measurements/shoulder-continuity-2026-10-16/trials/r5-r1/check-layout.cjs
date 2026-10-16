const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const here=__dirname,protocol=JSON.parse(fs.readFileSync(path.join(here,'PROTOCOL.json'),'utf8'));
const roots={A:protocol.baseline,R3:protocol.r3,R5:path.join(here,'candidate-source')};
const ts=require(path.join(roots.R5,'node_modules/typescript'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const once=(s,n)=>assert.equal(s.split(n).length,2,'Extraction anchor changed: '+n);
const marker='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.';
const moduleNames=['light','sun','motion','inclinedShoulder'];
function factory(root,metadata){
 const filename=path.join(root,'src/cumulonimbus/volume.ts'),source=fs.readFileSync(filename,'utf8');once(source,marker);
 let prefix=source.slice(0,source.indexOf(marker));
 const header='export function generateVolume(size = VOLUME_RESOLUTION, seed = 71, progress?: (fraction: number) => void): CloudVolume {';
 once(prefix,header);prefix=prefix.replace(header,'export function traceLayout(seed = 71) {\n  __rng=[];');
 const allocation='  const n = size ** 3, field = new Float32Array(n), density = new Float32Array(n);\n  field.fill(-10);\n';
 once(prefix,allocation);prefix=prefix.replace(allocation,'');
 const cellular='  const cellular=cellularNoise(seed+137);\n';once(prefix,cellular);prefix=prefix.replace(cellular,'');
 const random='function random(seed: number) {\n  return () => { seed |= 0;';once(prefix,random);
 prefix=prefix.replace(random,'function random(seed: number) {\n const c={initialSeed:seed,calls:0};__rng.push(c);\n return () => { c.calls++; seed |= 0;');
 if(metadata){const joint=prefix.lastIndexOf("  if(shape.family==='sheared') {");assert(joint>0&&prefix.slice(joint).includes('authoredShoulders.filter'));
 prefix=prefix.slice(0,joint)+' const __before=lobes.map(l=>l.slice()),__rngBefore=__rng.map(r=>({...r}));\n'+prefix.slice(joint);}
 prefix='let __rng:Array<{initialSeed:number;calls:number}>=[];\n'+prefix;
 prefix+=metadata?' return {family:shape.family,before:__before,lobes,rngBefore:__rngBefore,rng:__rng,uniqueLobes:new Set(lobes).size,body:sharedBody?lobes.indexOf(sharedBody):null,groups:[...trackedGroups].map(([core,refs])=>({core:lobes.indexOf(core),ids:[...refs].map(l=>lobes.indexOf(l))}))};\n}\n':' return {family:shape.family,lobes,rng:__rng,uniqueLobes:new Set(lobes).size};\n}\n';
 const modules={};for(const name of moduleNames){const src=fs.readFileSync(path.join(root,'src/cumulonimbus/'+name+'.ts'),'utf8');
 const emitted=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const m={exports:{}};new Function('require','module','exports',emitted)(()=>{throw Error('Unexpected dependency import')},m,m.exports);modules['./'+name]=m.exports;}
 const emitted=ts.transpileModule(prefix,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert(!emitted.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error));
 const m={exports:{}};new Function('require','module','exports',emitted.outputText)(name=>{assert(Object.hasOwn(modules,name),'Unexpected import');return modules[name]},m,m.exports);
 for(const n of ['new Float32Array','new Uint8Array','generateDetail(','bakeOccupancy('])assert(!m.exports.traceLayout.toString().includes(n),'Unbounded trace '+n);
 return {trace:m.exports.traceLayout,sourceSHA256:sha(source),emittedPrefixSHA256:sha(emitted.outputText)};
}
function tupleSHA(lobes){const n=lobes.reduce((n,l)=>n+1+l.length*8,0),b=Buffer.alloc(n);let offset=0;for(const l of lobes){b.writeUInt8(l.length,offset++);for(const v of l){assert(Number.isFinite(v));b.writeDoubleLE(v,offset);offset+=8;}}return sha(b);}
const f={A:factory(roots.A,false),R3:factory(roots.R3,true),R5:factory(roots.R5,true)};
// Named regression witnesses only. No 1024 scanner or raster/bake is called.
const rows=[];for(const seed of [2,74,77,80,104,119,617,72,73]){
 const a=f.A.trace(seed),b=f.R3.trace(seed),c=f.R5.trace(seed);
 assert.deepEqual(b.before,a.lobes,'Bookkeeping prefix must be baseline geometry');assert.deepEqual(c.before,a.lobes);
 for(const t of [a,b,c])assert.equal(t.uniqueLobes,t.lobes.length);
 assert.deepEqual(a.rng,b.rngBefore);assert.deepEqual(b.rngBefore,b.rng);assert.deepEqual(a.rng,c.rngBefore);assert.deepEqual(c.rngBefore,c.rng);
 assert.equal(c.lobes.length,a.lobes.length);assert.deepEqual(b.groups,c.groups);
 // Oracle is the archived R3's actual X/Z changes, not a rewritten projection or pivot formula.
 const recentered=b.lobes.flatMap((l,i)=>Object.is(l[0],a.lobes[i][0])&&Object.is(l[2],a.lobes[i][2])?[]:[i]);
 const allow=new Set(recentered),body=b.body===null?[]:b.groups.find(g=>g.core===b.body).ids;
 if(recentered.length)assert.equal(recentered.length,91);if(body.length)assert.equal(body.length,91);
 for(let i=0;i<c.lobes.length;i++)assert.deepEqual(c.lobes[i],allow.has(i)?b.lobes[i]:a.lobes[i],'R5 exact A/R3 tuple partition seed '+seed+' lobe '+i);
 for(const id of body)assert.deepEqual(c.lobes[id],a.lobes[id],'Shared body must never lift');
 const changed=c.lobes.flatMap((l,i)=>{try{assert.deepEqual(l,a.lobes[i]);return []}catch{return [i]}});
 assert.deepEqual(changed,recentered);
 rows.push({seed,family:a.family,lobes:a.lobes.length,recenteredLobes:recentered.length,bodyGroup:body.length,bodyExactA:true,rngExactA:true,tupleSHA256:{A:tupleSHA(a.lobes),R3:tupleSHA(b.lobes),R5:tupleSHA(c.lobes)},r3BodyChanged:body.some(i=>!Object.is(b.lobes[i][1],a.lobes[i][1])||!Object.is(b.lobes[i][4],a.lobes[i][4]))});
}
assert(rows.find(r=>r.seed===2).recenteredLobes===91&&!rows.find(r=>r.seed===2).r3BodyChanged,'Seed2 catches recenter incorrectly conditioned on lift');
for(const seed of [104,119,617])assert(rows.find(r=>r.seed===seed).r3BodyChanged&&rows.find(r=>r.seed===seed).recenteredLobes===0);
const result={status:'PASS',scope:'9 named actual layout prefixes, no raster/full bake; not a new exhaustive 1024 run',runtime:{node:process.version,arch:process.arch},factories:Object.fromEntries(Object.entries(f).map(([k,v])=>[k,{sourceSHA256:v.sourceSHA256,emittedPrefixSHA256:v.emittedPrefixSHA256}])),oracle:'A tuple values and archived R3 actual X/Z-changed tuple subset; exact deep equality includes signed zero, array length and optional blend',checks:['body91 all tuple values baseline A','only R3 X/Z changes inherited','all nonselected and outward/other-family tuples baseline A','RNG calls/initial seeds identical A','no alias lobe references','seed2 recenter survives when body roof already sufficient'],rows};
fs.writeFileSync(path.join(here,'expected-report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,cases:rows.map(({seed,recenteredLobes,r3BodyChanged})=>({seed,recenteredLobes,r3BodyChanged}))},null,2));
