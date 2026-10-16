/** External CPU prototype only. Base records and leaf gradients remain f32.
 * Runtime rectangles are derived from one dyadic key, never fetched as data.
 * This format does not change the final original terrain point evaluator. */
import {nextF32,TerrainBounds,type Rect,type I} from './baseline/bounds.ts';
import {gradientBound,NUMERIC_CONTRACT,counters} from './baseline/gradient.ts';
import {terrainHeight} from './baseline/landscape.source.ts';
import type {Node,Pack} from './baseline/data.ts';
export const SOURCE_SHA='72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99';
export const LEDGER_VERSION='gradient-cpu-local-ledger-cycle10-f3aaa082';
export const MAX_BYTES=8*1024*1024,MAX_LEVEL=14,MAX_EXACT_INDEX=2**24-1;
export type Key=number;
export function encodeKey(level:number,x:number,z:number):Key{
 if(!Number.isInteger(level)||level<0||level>MAX_LEVEL||!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0||x>=2**level||z>=2**level)throw Error('Invalid dyadic key');
 return ((level<<28)|(z<<14)|x)>>>0;
}
export function decodeKey(key:Key){
 if(!Number.isInteger(key)||key<0||key>0xffffffff)throw Error('Invalid unsigned key');
 const level=key>>>28,x=key&0x3fff,z=(key>>>14)&0x3fff;
 if(level>MAX_LEVEL||x>=2**level||z>=2**level)throw Error('Invalid encoded key');
 const size=1024/2**level,x0=-512+x*size,z0=-512+z*size;
 return{level,x,z,size,rect:{x0,x1:x0+size,z0,z1:z0+size}};
}
export function childKey(key:Key,child:number):Key{const k=decodeKey(key);if(!Number.isInteger(child)||child<0||child>3)throw Error('Invalid child');return encodeKey(k.level+1,k.x*2+(child&1),k.z*2+(child>>>1));}
export function keyForRect(r:Rect,level:number):Key{
 const size=1024/2**level,key=encodeKey(level,(r.x0+512)/size,(r.z0+512)/size),actual=decodeKey(key).rect;
 if(actual.x0!==r.x0||actual.x1!==r.x1||actual.z0!==r.z0||actual.z1!==r.z1)throw Error('Original rectangle is not exactly dyadic');return key;
}
export interface CompactNode {index:number;key:Key;rect:Rect;level:number;height:I;errorKm:number;firstChild:number;gradientIndex:number;gradient?:{gx:I;gz:I}}
export interface CompactPack {base:Float32Array;gradients:Float32Array;nodeCount:number;leafCount:number;bytes:number;sourceSha256:string;ledgerVersion:string;contract:typeof NUMERIC_CONTRACT}
export class CompactLookup {
 loads=0;baseLoads=0;gradientLoads=0;childClips=0;
 constructor(public pack:CompactPack){}
 get(index:number,key:Key):CompactNode{
  if(!Number.isInteger(index)||index<0||index>=this.pack.nodeCount)throw Error('Node index out of bounds');
  this.loads++;this.baseLoads++;const i=index*4,d=this.pack.base,k=decodeKey(key),ptr=d[i+2];
  if(!Number.isInteger(ptr)||ptr===0)throw Error('Invalid compact pointer');
  return{index,key,rect:k.rect,level:k.level,height:[d[i],d[i+1]],firstChild:ptr>0?ptr:0,gradientIndex:ptr<0?-ptr-1:-1,errorKm:ptr<0?d[i+3]:0};
 }
 getGradient(node:CompactNode){
  if(node.firstChild)throw Error('Gradient fetch is only valid for a leaf');
  if(!node.gradient){this.loads++;this.gradientLoads++;const i=node.gradientIndex*4,d=this.pack.gradients;if(i<0||i+3>=d.length)throw Error('Gradient index out of bounds');node.gradient={gx:[d[i],d[i+1]],gz:[d[i+2],d[i+3]]};}return node.gradient;
 }
}
export function repack(nodes:Node[]):CompactPack{
 if(!nodes.length||nodes.length>MAX_EXACT_INDEX)throw Error('Node count exceeds exact f32 pointer contract');
 const leafCount=nodes.reduce((s,n)=>s+Number(!n.firstChild),0);if(leafCount>MAX_EXACT_INDEX)throw Error('Gradient count exceeds exact f32 pointer contract');
 const bytes=16*(nodes.length+leafCount);if(bytes>MAX_BYTES)throw Error('Compact metadata exceeds the fixed 8 MiB residency budget');
 const base=new Float32Array(nodes.length*4),gradients=new Float32Array(leafCount*4);let leaf=0;
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i];if(n.index!==i)throw Error('Noncontiguous node index');keyForRect(n.rect,n.level);
  if(!n.height.every(Number.isFinite)||n.height[0]>n.height[1])throw Error('Invalid height enclosure');
  let ptr:number,E=0;
  if(n.firstChild){if(!Number.isInteger(n.firstChild)||n.firstChild<=i||n.firstChild+3>=nodes.length)throw Error('Invalid contiguous children');ptr=n.firstChild;for(let c=0;c<4;c++)if(keyForRect(nodes[ptr+c].rect,nodes[ptr+c].level)!==childKey(keyForRect(n.rect,n.level),c))throw Error('Child geometry does not match its implicit key');}
  else{if(![...n.gx,...n.gz,n.errorKm].every(Number.isFinite)||n.gx[0]>n.gx[1]||n.gz[0]>n.gz[1]||n.errorKm<0)throw Error('Invalid leaf gradient or ledger');ptr=-(leaf+1);E=n.errorKm;gradients.set([...n.gx,...n.gz],leaf++*4);}
  base.set([n.height[0],n.height[1],ptr,E],i*4);
  if(base[i*4+2]!==ptr)throw Error('Pointer lost precision during f32 encoding');
 }
 return{base,gradients,nodeCount:nodes.length,leafCount,bytes,sourceSha256:SOURCE_SHA,ledgerVersion:LEDGER_VERSION,contract:NUMERIC_CONTRACT};
}
/** Verify every stored value and every implicit rectangle before replay. */
export function verifyRepack(nodes:Node[],pack:CompactPack){
 const look=new CompactLookup(pack);let heightValues=0,gradientValues=0,rectangles=0,pointers=0;
 for(const n of nodes){const key=keyForRect(n.rect,n.level),q=look.get(n.index,key);if(JSON.stringify(q.rect)!==JSON.stringify(n.rect))throw Error('Rectangle mismatch');rectangles++;if(q.firstChild!==n.firstChild)throw Error('Pointer mismatch');pointers++;for(let i=0;i<2;i++){if(q.height[i]!==n.height[i])throw Error('Height value changed');heightValues++;}if(!n.firstChild){const g=look.getGradient(q);if(q.errorKm!==n.errorKm)throw Error('Error ledger changed');for(let i=0;i<2;i++)for(const k of ['gx','gz'] as const){if(g[k][i]!==n[k][i])throw Error('Gradient value changed');gradientValues++;}}}
 return{rectangles,pointers,heightValues,gradientValues,bytes:pack.bytes,nodeCount:pack.nodeCount,leafCount:pack.leafCount,exactValues:true};
}
export interface PageRequest {key:Key;targetKm:number;sourceSha256:string;ledgerVersion:string;kind:'blocker'|'neighbor-prefetch';from?:string}
export interface PageLog {request:PageRequest;status:string;bytesBefore:number;bytesAfter:number;addedNodes:number;addedLeaves:number;preparationMs?:number}
/** The mutable CPU builder is not the runtime format and is never a render-loop query.
 * Its peak heap is separate from the <=8 MiB serialized residency limit. */
export class PageBuilder {
 nodes:Node[];logs:PageLog[]=[];
 constructor(nodes:Node[]){this.nodes=nodes.map(n=>({...n,rect:{...n.rect},height:[...n.height],gx:[...n.gx],gz:[...n.gz]}));}
 get bytes(){return 16*(this.nodes.length+this.nodes.reduce((s,n)=>s+Number(!n.firstChild),0));}
 locate(key:Key):Node|undefined{const k=decodeKey(key);let n=this.nodes[0];while(n.level<k.level&&n.firstChild){const r=decodeKey(keyForRect(n.rect,n.level)),shift=k.level-n.level-1,child=((k.z>>>shift)&1)*2+((k.x>>>shift)&1);n=this.nodes[n.firstChild+child];}return n&&keyForRect(n.rect,n.level)===key?n:undefined;}
 leafAt(x:number,z:number):Node|undefined{if(x< -512||x>512||z< -512||z>512)return;let n=this.nodes[0];while(n.firstChild){const mx=(n.rect.x0+n.rect.x1)/2,mz=(n.rect.z0+n.rect.z1)/2;n=this.nodes[n.firstChild+Number(x>=mx)+2*Number(z>=mz)];}return n;}
 neighbors(key:Key):Key[]{const k=decodeKey(key),out=new Set<Key>();for(const[dx,dz]of[[-1,0],[1,0],[0,-1],[0,1]]){const n=this.leafAt((k.rect.x0+k.rect.x1)/2+dx*k.size,(k.rect.z0+k.rect.z1)/2+dz*k.size);if(n&&!n.firstChild)out.add(keyForRect(n.rect,n.level));}out.delete(key);return [...out].sort((a,b)=>a-b);}
 prepare(request:PageRequest):PageLog{
  const bytesBefore=this.bytes,log:PageLog={request,status:'pending',bytesBefore,bytesAfter:bytesBefore,addedNodes:0,addedLeaves:0};this.logs.push(log);
  if(request.sourceSha256!==SOURCE_SHA||request.ledgerVersion!==LEDGER_VERSION)throw Error('Page request field or ledger mismatch');
  const n=this.locate(request.key),k=decodeKey(request.key),targetLevel=Math.log2(1024/request.targetKm);
  if(!Number.isInteger(targetLevel)||targetLevel<0||targetLevel>MAX_LEVEL)throw Error('Page target outside the exact dyadic key contract');
  if(!n){log.status='missing-or-stale-key';return log;}if(n.firstChild){log.status='already-resident';return log;}if(n.level>=targetLevel){log.status='already-at-target';return log;}
  const depth=targetLevel-n.level,addedNodes=(4**(depth+1)-1)/3-1,addedLeaves=4**depth-1,projected=bytesBefore+16*(addedNodes+addedLeaves);
  if(projected>MAX_BYTES||this.nodes.length+addedNodes>MAX_EXACT_INDEX){log.status='budget-rejected';return log;}
  const began=performance.now(),height=new TerrainBounds(64,'unknown-outside-wgsl-range'),newNodes:Node[]=[],start=this.nodes.length;
  const alloc=(key:Key):number=>{const q=decodeKey(key),index=start+newNodes.length;newNodes.push({index,rect:q.rect,height:[0,3.25],gx:[-5.72,5.72],gz:[-5.72,5.72],errorKm:Infinity,level:q.level,firstChild:0});return index;};
  const get=(index:number)=>index===n.index?replacement:newNodes[index-start];
  const down=(v:number)=>nextF32(v,-1),up=(v:number)=>nextF32(v,1);
  const replacement:Node={...n,rect:{...n.rect},height:[...n.height],gx:[...n.gx],gz:[...n.gz]};
  const fill=(index:number,key:Key)=>{const node=get(index),q=decodeKey(key),r=q.rect,s=q.size;
   if(index!==n.index){const g=gradientBound(r),h=height.evaluate(r).height;node.height=[Math.max(0,down(Math.max(g.height[0],h[0]))),up(Math.min(g.height[1],h[1]))];node.gx=[down(g.gx[0]),up(g.gx[1])];node.gz=[down(g.gz[0]),up(g.gz[1])];node.errorKm=up(g.errorKm);const center=terrainHeight((r.x0+r.x1)/2,(r.z0+r.z1)/2),spread=(Math.max(Math.abs(node.gx[0]),Math.abs(node.gx[1]))+Math.max(Math.abs(node.gz[0]),Math.abs(node.gz[1])))*s/2+2*node.errorKm+1e-10;node.height=[Math.max(node.height[0],down(Math.max(0,center-spread))),Math.min(node.height[1],up(center+spread))];}
   if(q.level<targetLevel){node.firstChild=start+newNodes.length;for(let c=0;c<4;c++)alloc(childKey(key,c));for(let c=0;c<4;c++)fill(node.firstChild+c,childKey(key,c));const children=Array.from({length:4},(_,c)=>get(node.firstChild+c));node.height=[Math.max(node.height[0],Math.min(...children.map(c=>c.height[0]))),Math.min(node.height[1],Math.max(...children.map(c=>c.height[1])))];node.gx=[Math.max(node.gx[0],Math.min(...children.map(c=>c.gx[0]))),Math.min(node.gx[1],Math.max(...children.map(c=>c.gx[1])))];node.gz=[Math.max(node.gz[0],Math.min(...children.map(c=>c.gz[0]))),Math.min(node.gz[1],Math.max(...children.map(c=>c.gz[1])))];node.errorKm=Math.min(node.errorKm,Math.max(...children.map(c=>c.errorKm)));}
  };
  fill(n.index,request.key);
  if(newNodes.length!==addedNodes)throw Error('Page reservation mismatch');
  // Commit the page atomically only after all analytical bounds are available.
  this.nodes[n.index]=replacement;this.nodes.push(...newNodes);log.status='resident';log.bytesAfter=this.bytes;log.addedNodes=addedNodes;log.addedLeaves=addedLeaves;log.preparationMs=performance.now()-began;
  if(log.bytesAfter!==projected||log.bytesAfter>MAX_BYTES)throw Error('Page residency accounting mismatch');return log;
 }
 serialize(){return repack(this.nodes);}
}
