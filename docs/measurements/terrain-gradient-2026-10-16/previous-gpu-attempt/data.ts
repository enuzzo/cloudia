import {TerrainBounds,nextF32,type I,type Rect} from '../terrain-bounds/bounds.ts';
export interface PackedNode {index:number;bounds:I;rect:Rect;level:number;firstChild:number}
export interface PackedTerrain {nodes:PackedNode[];data:Float32Array;width:number;height:number;domainKm:Rect;coarseKm:number;fineKm:number;refinedKm:Rect;heightGuardKm:number;preparationMs:number;builderCounters:TerrainBounds['counters']}
/** Metadata bounds, never sampled surface heights. Children occupy 4 contiguous
 * node records; each record has two RGBA32F texels (8 floats / 32 bytes).
 * texel0 = [Hlo,Hhi,firstChildOr0,level]
 * texel1 = [minX,minZ,sizeKm,0]
 * The original procedural function remains the only final terrain evaluator.
 */
export function buildTerrainMetadata(options:{coarseKm?:number;fineKm?:number;refinedKm?:Rect;heightGuardKm?:number}={}):PackedTerrain{
 const began=performance.now(),coarseKm=options.coarseKm??32,fineKm=options.fineKm??1,refinedKm=options.refinedKm??{x0:-32,x1:32,z0:-32,z1:32},heightGuardKm=options.heightGuardKm??.02;
 if(!Number.isInteger(Math.log2(1024/coarseKm))||!Number.isInteger(Math.log2(coarseKm/fineKm)))throw Error('Power-of-two cell sizes required');
 const builder=new TerrainBounds(64,'unknown-outside-wgsl-range'),nodes:PackedNode[]=[],domainKm={x0:-512,x1:512,z0:-512,z1:512};
 function allocate(rect:Rect,level:number):number{const index=nodes.length;nodes.push({index,bounds:[0,3.25],rect,level,firstChild:0});return index;}
 function fill(index:number){
  const n=nodes[index],r=n.rect,size=r.x1-r.x0,raw=builder.evaluate(r).height;
  n.bounds=[Math.max(0,nextF32(raw[0]-heightGuardKm,-1)),nextF32(raw[1]+heightGuardKm,1)];
  const intersects=r.x1>refinedKm.x0&&r.x0<refinedKm.x1&&r.z1>refinedKm.z0&&r.z0<refinedKm.z1;
  if(size>coarseKm||(size>fineKm&&intersects)){
   const half=size/2,first=nodes.length;n.firstChild=first;
   for(let z=0;z<2;z++)for(let x=0;x<2;x++)allocate({x0:r.x0+x*half,x1:r.x0+(x+1)*half,z0:r.z0+z*half,z1:r.z0+(z+1)*half},n.level+1);
   for(let child=first;child<first+4;child++)fill(child);
   // Both the direct analytical interval and union of all closed child rectangles
   // enclose the same field. Intersect these two valid intervals for tighter parents.
   const children=nodes.slice(first,first+4);n.bounds=[Math.max(n.bounds[0],Math.min(...children.map(v=>v.bounds[0]))),Math.min(n.bounds[1],Math.max(...children.map(v=>v.bounds[1])))];
  }
 }
 allocate(domainKm,0);fill(0);
 const width=256,height=Math.ceil(nodes.length*2/width),data=new Float32Array(width*height*4);
 for(const n of nodes)data.set([n.bounds[0],n.bounds[1],n.firstChild,n.level,n.rect.x0,n.rect.z0,n.rect.x1-n.rect.x0,0],n.index*8);
 return {nodes,data,width,height,domainKm,coarseKm,fineKm,refinedKm,heightGuardKm,preparationMs:performance.now()-began,builderCounters:{...builder.counters}};
}
export class PackedLookup {
 loads=0;misses=0;
 constructor(public pack:PackedTerrain){}
 root(){return this.get(0);}
 get(index:number):PackedNode{
  this.loads++;if(!Number.isInteger(index)||index<0||index>=this.pack.nodes.length)throw Error('Invalid metadata index');
  // Read the serialized Float32 buffer, not the builder's object tree, so this
  // validates the actual texture ABI and outward quantization used by the shader.
  const o=index*8,d=this.pack.data,x=d[o+4],z=d[o+5],s=d[o+6];
  return {index,bounds:[d[o],d[o+1]],firstChild:d[o+2],level:d[o+3],rect:{x0:x,x1:x+s,z0:z,z1:z+s}};
 }
}
