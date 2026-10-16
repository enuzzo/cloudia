import {TerrainBounds,nextF32,type Rect,type I} from './bounds.ts';
import {gradientBound,counters,NUMERIC_CONTRACT} from './gradient.ts';
import {terrainHeight} from './landscape.source.ts';
export interface Node {index:number;rect:Rect;height:I;gx:I;gz:I;errorKm:number;level:number;firstChild:number}
export interface Pack {nodes:Node[];data:Float32Array;bytes:number;coarseKm:number;fineKm:number;outerFineKm:number;preparationMs:number;contract:typeof NUMERIC_CONTRACT;work:any}
const down=(v:number)=>nextF32(v,-1),up=(v:number)=>nextF32(v,1);
/** Three RGBA32F records per node. Heights and gradients are analytical
 * metadata; no sampled height map substitutes for the authored field.
 * record0 = Hmin,Hmax,firstChild,level
 * record1 = x,z,size,E
 * record2 = gxMin,gxMax,gzMin,gzMax
 */
export function build(options:{coarseKm?:number;fineKm?:number;localKm?:number;outerFineKm?:number;outerLocalKm?:number;centeredHeight?:boolean}={}):Pack{
 const began=performance.now(),coarseKm=options.coarseKm??32,fineKm=options.fineKm??1,localKm=options.localKm??32,outerFineKm=options.outerFineKm??coarseKm,outerLocalKm=options.outerLocalKm??128;
 if(![coarseKm,fineKm,outerFineKm].every(s=>s>0&&s<=1024&&Number.isInteger(Math.log2(1024/s))))throw Error('Positive power-of-two cell spacing required');
 const height=new TerrainBounds(64,'unknown-outside-wgsl-range'),nodes:Node[]=[];let centerEvaluations=0;
 for(const key of Object.keys(counters))counters[key as keyof typeof counters]=0;
 const alloc=(rect:Rect,level:number)=>{const index=nodes.length;nodes.push({index,rect,height:[0,3.25],gx:[-5.72,5.72],gz:[-5.72,5.72],errorKm:Infinity,level,firstChild:0});return index;};
 function fill(index:number){
  const n=nodes[index],r=n.rect,s=r.x1-r.x0,g=gradientBound(r),h=height.evaluate(r).height;
  n.height=[Math.max(0,down(Math.max(g.height[0],h[0]))),up(Math.min(g.height[1],h[1]))];
  n.gx=[down(g.gx[0]),up(g.gx[1])];n.gz=[down(g.gz[0]),up(g.gz[1])];n.errorKm=up(g.errorKm);
  if(options.centeredHeight!==false){
   // A central point is an anchor for an analytical derivative enclosure,
   // never the min/max of a sampled height map or a replacement surface.
   const center=terrainHeight((r.x0+r.x1)/2,(r.z0+r.z1)/2);centerEvaluations++;
   const spread=(Math.max(Math.abs(n.gx[0]),Math.abs(n.gx[1]))+Math.max(Math.abs(n.gz[0]),Math.abs(n.gz[1])))*s/2+2*n.errorKm+1e-10;
   n.height=[Math.max(n.height[0],down(Math.max(0,center-spread))),Math.min(n.height[1],up(center+spread))];
  }
  const intersects=r.x1>-localKm&&r.x0<localKm&&r.z1>-localKm&&r.z0<localKm;
  const outerIntersects=r.x1>-outerLocalKm&&r.x0<outerLocalKm&&r.z1>-outerLocalKm&&r.z0<outerLocalKm;
  if(s>coarseKm||(intersects&&s>fineKm)||(outerIntersects&&s>outerFineKm)){
   n.firstChild=nodes.length;const q=s/2;
   for(let z=0;z<2;z++)for(let x=0;x<2;x++)alloc({x0:r.x0+x*q,x1:r.x0+(x+1)*q,z0:r.z0+z*q,z1:r.z0+(z+1)*q},n.level+1);
   for(let c=n.firstChild;c<n.firstChild+4;c++)fill(c);
   const children=nodes.slice(n.firstChild,n.firstChild+4);
   n.height=[Math.max(n.height[0],Math.min(...children.map(c=>c.height[0]))),Math.min(n.height[1],Math.max(...children.map(c=>c.height[1])))];
   n.gx=[Math.max(n.gx[0],Math.min(...children.map(c=>c.gx[0]))),Math.min(n.gx[1],Math.max(...children.map(c=>c.gx[1])))];
   n.gz=[Math.max(n.gz[0],Math.min(...children.map(c=>c.gz[0]))),Math.min(n.gz[1],Math.max(...children.map(c=>c.gz[1])))];
   n.errorKm=Math.min(n.errorKm,Math.max(...children.map(c=>c.errorKm)));
  }
 }
 alloc({x0:-512,x1:512,z0:-512,z1:512},0);fill(0);
 const data=new Float32Array(nodes.length*12);
 for(const n of nodes)data.set([n.height[0],n.height[1],n.firstChild,n.level,n.rect.x0,n.rect.z0,n.rect.x1-n.rect.x0,n.errorKm,n.gx[0],n.gx[1],n.gz[0],n.gz[1]],n.index*12);
 return{nodes,data,bytes:data.byteLength,coarseKm,fineKm,outerFineKm,preparationMs:performance.now()-began,contract:NUMERIC_CONTRACT,work:{gradient:{...counters},height:{...height.counters},centerEvaluations}};
}
export class Lookup {
 loads=0;
 constructor(public pack:Pack){}
 get(index:number):Node{
  this.loads++;const i=index*12,d=this.pack.data,x=d[i+4],z=d[i+5],s=d[i+6];
  return{index,rect:{x0:x,x1:x+s,z0:z,z1:z+s},height:[d[i],d[i+1]],firstChild:d[i+2],level:d[i+3],errorKm:d[i+7],gx:[d[i+8],d[i+9]],gz:[d[i+10],d[i+11]]};
 }
}
