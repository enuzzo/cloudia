/** Tiny structural checks only: no fixture replay, analytical builder, or benchmark. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {encodeKey,decodeKey,childKey,keyForRect,repack,verifyRepack,CompactLookup,PageBuilder,SOURCE_SHA,LEDGER_VERSION} from './compact.ts';
import type {Node} from './baseline/data.ts';
let checks=0;const ok=(condition:boolean)=>{checks++;assert.ok(condition);},reject=(fn:()=>unknown)=>{checks++;assert.throws(fn);};
for(const level of[0,1,5,9,12,14])for(const [x,z]of[[0,0],[2**level-1,2**level-1],[0,2**level-1]]){const key=encodeKey(level,x,z),d=decodeKey(key);ok(d.level===level&&d.x===x&&d.z===z);ok(keyForRect(d.rect,level)===key);if(level<14)for(let c=0;c<4;c++){const q=decodeKey(childKey(key,c));ok(q.level===level+1&&q.x===2*x+(c&1)&&q.z===2*z+(c>>>1));}}
for(const args of[[-1,0,0],[15,0,0],[1,2,0],[1,0,2],[1,.5,0]] as const)reject(()=>encodeKey(...args));
for(const key of[-1,0x100000000,0x10000002])reject(()=>decodeKey(key));
const node=(index:number,key:number,firstChild=0):Node=>({index,rect:decodeKey(key).rect,height:[Math.fround(.1),Math.fround(2.1)],gx:[Math.fround(-.3),Math.fround(.4)],gz:[Math.fround(-.2),Math.fround(.6)],errorKm:Math.fround(.00002),level:decodeKey(key).level,firstChild});
const nodes=[node(0,0,1),...Array.from({length:4},(_,c)=>node(c+1,childKey(0,c)))],packed=repack(nodes),proof=verifyRepack(nodes,packed);
ok(packed.nodeCount===5&&packed.leafCount===4&&packed.bytes===144);ok(proof.gradientValues===16&&proof.rectangles===5);
const lookup=new CompactLookup(packed),root=lookup.get(0,0);ok(lookup.loads===1&&lookup.gradientLoads===0&&root.firstChild===1);reject(()=>lookup.getGradient(root));
const leaf=lookup.get(1,childKey(0,0));ok(lookup.loads===2&&lookup.gradientLoads===0);lookup.getGradient(leaf);lookup.getGradient(leaf);ok(lookup.loads===3&&lookup.gradientLoads===1);
reject(()=>repack([{...nodes[0],firstChild:2},...nodes.slice(1)]));
reject(()=>repack([{...nodes[0],firstChild:1},...nodes.slice(1).map(n=>({...n,rect:{...n.rect,x0:n.rect.x0+.1}}))]));
const builder=new PageBuilder([node(0,0)]),request={key:0,targetKm:.25,sourceSha256:SOURCE_SHA,ledgerVersion:LEDGER_VERSION,kind:'blocker' as const};
const log=builder.prepare(request);ok(log.status==='budget-rejected'&&builder.nodes.length===1&&builder.bytes===32);reject(()=>builder.prepare({...request,ledgerVersion:'different'}));
const terminal=new PageBuilder([node(0,0)]).prepare({...request,targetKm:1024});ok(terminal.status==='already-at-target');
const result={checks,passed:true,fixtureLoaded:false,terrainPointQueries:0,analyticBoundQueries:0,fullReplayExecuted:false,pageBuilderExecuted:false,syntheticBudgetPreflightOnly:true};
await writeFile(new URL('./structural-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
