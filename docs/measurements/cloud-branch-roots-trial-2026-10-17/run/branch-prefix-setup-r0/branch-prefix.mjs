import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const own=dirname(fileURLToPath(import.meta.url)),start=performance.now(),cpu=process.cpuUsage();
const h=b=>createHash('sha256').update(b).digest('hex');
const pins=JSON.parse(readFileSync(resolve(own,'BRANCH-PREFIX-INPUTS.json'))),p=pins.root;
assert(process.argv.includes('--execute-reviewed-once'));
assert.equal(process.version,'v26.11.0');assert.equal(process.arch,'arm64');
const runtime=()=>{const c=process.cpuUsage(cpu);return {wallSeconds:(performance.now()-start)/1000,cpuSeconds:(c.user+c.system)/1e6,rssBytes:process.memoryUsage().rss};};
const guard=()=>{const r=runtime();assert(r.wallSeconds<=pins.wallCap&&r.cpuSeconds<=pins.cpuCap&&r.rssBytes<=pins.rssCap,'Budget exceeded');};
let status='FAIL',result=null,error=null;
try{
 for(const [f,sha] of Object.entries(pins.inputs)){assert.equal(h(readFileSync(f)),sha,f);guard();}
 const manifestBytes=readFileSync(pins.sourceManifest);assert.equal(h(manifestBytes),pins.sourceManifestSHA256);const manifest=JSON.parse(manifestBytes);assert.equal(Object.keys(manifest).length,141);
 for(const [f,sha] of Object.entries(manifest)){assert.equal(h(readFileSync(resolve(p,'branched-source',f))),sha,f);guard();}
 const req=createRequire(resolve(p,'branched-source/package.json')),ts=req('typescript'),cache=new Map();
 const helper=resolve(p,'branched-source/src/cumulonimbus/layoutPrefix.test-helper.ts');
 const allowed=new Map([['../branched-source/src/cumulonimbus/layoutPrefix.test-helper',helper],...['light','sun','motion','inclinedShoulder'].map(n=>['./'+n,resolve(p,'branched-source/src/cumulonimbus',n+'.ts')])]);
 const compile=f=>{
  if(cache.has(f))return cache.get(f).exports;guard();
  const text=readFileSync(f,'utf8'),emitted=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
  assert(!emitted.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'Transpile syntax');
  const module={exports:{}};cache.set(f,module);
  const local=n=>{if(n==='typescript')return ts;if(['node:assert/strict','node:crypto'].includes(n))return req(n);assert(allowed.has(n),'Unexpected import '+n);return compile(allowed.get(n));};
  new Function('require','module','exports',emitted.outputText)(local,module,module.exports);return module.exports;
 };
 const api=compile(resolve(p,'review/compareBranchLayouts.ts'));
 result=api.compareBranchLayouts(readFileSync(resolve(p,'section64-diagnostic/sources/A/volume.ts'),'utf8'),readFileSync(resolve(p,'branched-source/src/cumulonimbus/volume.ts'),'utf8'));
 guard();status='PASS_THREE_ACTUAL_PREFIX_CONTRACTS';
}catch(e){error={message:String(e.message??e),stack:e.stack};process.exitCode=1;}
const report={status,error,runtime:runtime(),sourceFreezeSHA256:pins.sourceManifestSHA256,result,scope:pins.scope};
writeFileSync(resolve(own,'BRANCH-PREFIX-RESULT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,result:result?.rows.map(r=>({seed:r.seed,primitiveCount:r.primitiveCount,branch:r.branch,joint:r.joint,canonicalJoint:r.canonicalJoint}))}));
