import {terrainHeight,groundIntersection,EARTH_RADIUS,GROUND_LEVEL} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts';
import {TerrainBounds,type Rect,type I} from '../terrain-bounds/bounds.ts';
import {PackedLookup,type PackedNode as Node} from './data.ts';
export interface Pose {name:string;origin:number[];ray:number[]}
export const HMAX=3.25,LH=5.72;
const R=EARTH_RADIUS,CY=R-GROUND_LEVEL;
const dot=(a:number[],b:number[])=>a.reduce((v,x,i)=>v+x*b[i],0);
const norm=(a:number[])=>Math.hypot(...a);
const smooth=(a:number,b:number,x:number)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
export type TraceMode='global'|'analytic'|'metadata';
export function tracePacked(pose:Pose,builder:TerrainBounds,metadata:PackedLookup,options:{budget?:number;toleranceKm?:number;minimumIntervalKm?:number;pointFieldErrorKm?:number;radialErrorKm?:number;maxHeightEvaluations?:number;stackCapacity?:number}={}){
 const mode:TraceMode='metadata',stackCapacity=options.stackCapacity??48;
 const budget=options.budget??256,toleranceKm=options.toleranceKm??.001,minWidth=options.minimumIntervalKm??1e-7,fieldError=options.pointFieldErrorKm??0,radialError=options.radialErrorKm??1e-9;
 const {origin:o,ray:d}=pose,speed=norm(d),d2=dot(d,d),radial=[o[0],o[1]+CY,o[2]],tc=-dot(radial,d)/d2;
 // General quadratic handles rays that are not exactly unit length. Keep the
 // old helper as a provenance diagnostic only; it assumes dot(ray,ray)==1.
 const h0=o[1]-GROUND_LEVEL,c=o[0]**2+o[2]**2+h0*(2*R+h0),b=dot(radial,d),seaDisc=b*b-d2*c;
 let sea:number|null=null;if(seaDisc>=0){const root=Math.sqrt(seaDisc),q=-b-(b<0?-root:root),roots=[q/d2,q===0?Infinity:c/q].sort((a,b)=>a-b);if(roots[0]>0&&Number.isFinite(roots[0]))sea=roots[0];}
 const relief=1-smooth(90,180,sea??Math.max(0,tc)),boundR=R+HMAX*relief;
 const cOuter=c-(boundR-R)*(boundR+R),disc=b*b-d2*cOuter;
 let visits=0,heightEvaluations=0,discarded=0,maxStack=0,dynamicBounds=0,tileLoads=0,metadataMisses=0,knownNonpositive=Infinity;
 const maxHeightEvaluations=options.maxHeightEvaluations??16;
 const before={...builder.counters},loadsBefore=metadata.loads,missesBefore=metadata.misses;
 const finish=(status:string,extra:any={})=>({name:pose.name,mode,status,origin:o,ray:d,rayLength:speed,sea,relief,visits,heightEvaluations,discarded,maxStack,dynamicBounds,tileLoads:metadata.loads-loadsBefore,metadataMisses:metadata.misses-missesBefore,builderWork:Object.fromEntries(Object.entries(builder.counters).map(([k,v])=>[k,v-before[k as keyof typeof before]])),roundingQualified:false,pointFieldErrorKm:fieldError,radialErrorKm:radialError,...extra});
 if(disc<0||tc+Math.sqrt(Math.max(0,disc))/d2<=0)return finish('outer-envelope-miss');
 const half=Math.sqrt(disc)/d2,start=Math.max(0,tc-half),end=sea??tc+half;
 if(end<start)return finish('outer-envelope-miss');
 if(relief===0)return finish(sea===null?'miss':'hit',{interval:sea===null?null:[sea,sea],enclosureKm:0});
 const pointCache=new Map<number,{h:number;alt:number;clear:number}>(),HEIGHT_BUDGET=Symbol('height-budget');let currentFront=start;
 const at=(t:number)=>{
  if(pointCache.has(t))return pointCache.get(t)!;if(heightEvaluations>=maxHeightEvaluations)throw HEIGHT_BUDGET;heightEvaluations++;
  const p=o.map((v,i)=>v+d[i]*t),h=terrainHeight(p[0],p[2]),alt=norm([p[0],p[1]+CY,p[2]])-R,clear=alt-relief*h;
  const value={h,alt,clear};pointCache.set(t,value);if(clear+fieldError+radialError<=0)knownNonpositive=Math.min(knownNonpositive,t);return value;
 };
 const radialMin=(a:number,b:number)=>{const t=Math.max(a,Math.min(b,tc)),p=o.map((v,i)=>v+d[i]*t);return norm([p[0],p[1]+CY,p[2]])-R-radialError;};
 const rectFor=(a:number,b:number):Rect=>({x0:Math.min(o[0]+d[0]*a,o[0]+d[0]*b),x1:Math.max(o[0]+d[0]*a,o[0]+d[0]*b),z0:Math.min(o[2]+d[2]*a,o[2]+d[2]*b),z1:Math.max(o[2]+d[2]*a,o[2]+d[2]*b)});
 const clipRect=(rect:Rect,a:number,b:number):[number,number]|null=>{
  let lo=a,hi=b;for(const [axis,rlo,rhi] of [[0,rect.x0,rect.x1],[2,rect.z0,rect.z1]]){
   if(d[axis]===0){if(o[axis]<rlo||o[axis]>rhi)return null;}
   else{const v0=(rlo-o[axis])/d[axis],v1=(rhi-o[axis])/d[axis];lo=Math.max(lo,Math.min(v0,v1));hi=Math.min(hi,Math.max(v0,v1));}
  }return hi>=lo?[lo,hi]:null;
 };
 type Work={a:number;b:number;node?:Node;stage:'metadata'|'dynamic'};
 const stack:Work[]=[];
 if(mode==='metadata'){
  const root=metadata.root(),range=clipRect(root.rect,start,end);
  if(!range||range[0]>start+1e-9||range[1]<end-1e-9)return finish('unresolved-metadata-domain',{search:[start,end],clipped:range});
  stack.push({a:start,b:end,node:root,stage:'metadata'});
 }else stack.push({a:start,b:end,stage:'dynamic'});
 let lastDiscardedEnd=start;try{at(start);at(end);
 while(stack.length&&visits<budget){
  if(stack.length>stackCapacity)return finish('unresolved-stack',{remaining:stack.length,earliestPending:stack[stack.length-1].a});
  const work=stack.pop()!,{a,b}=work,m=(a+b)/2;currentFront=a;visits++;maxStack=Math.max(maxStack,stack.length+1);
  // In ordered traversal every interval before a was discarded by bounds. A known
  // nonpositive point supplies existence; all first-entry candidates are in [a,B].
  if(knownNonpositive>=a&&(knownNonpositive-a)*speed<=toleranceKm){
   const witness=at(knownNonpositive);return finish('hit',{interval:[a,knownNonpositive],enclosureKm:(knownNonpositive-a)*speed,witness:{t:knownNonpositive,clearance:witness.clear,upperClearance:witness.clear+fieldError+radialError},certifiedPrefixEnd:a,search:[start,end]});
  }
  if(a>=knownNonpositive)continue;
  let upper:number;
  if(mode==='global'){
   const va=at(a),vb=at(b),vm=at(m),along=LH*Math.hypot(d[0],d[2]);
   upper=Math.min(HMAX,va.h+fieldError+along*(b-a),vb.h+fieldError+along*(b-a),vm.h+fieldError+along*(b-a)/2);
  }else if(work.stage==='metadata')upper=work.node!.bounds[1];
  else{dynamicBounds++;upper=builder.evaluate(rectFor(a,b),false).height[1];}
  if(radialMin(a,b)-relief*upper>0){discarded++;lastDiscardedEnd=Math.max(lastDiscardedEnd,b);continue;}
  if(work.stage==='metadata'&&work.node!.firstChild>0){
   const parent=work.node!,children:Work[]=[];
   for(let iz=0;iz<2;iz++)for(let ix=0;ix<2;ix++){
    const child=metadata.get(parent.firstChild+iz*2+ix),range=clipRect(child.rect,a,b);
    if(range&&range[1]>=range[0])children.push({a:range[0],b:range[1],node:child,stage:'metadata'});
   }
   // Boundary rays can overlap two cells. Those equal-t intervals are both visited;
   // their bounds are valid on closed rectangles. Any preceding discarded cell
   // already proves the common boundary outside. No single-cell tie shortcut.
   children.sort((a,b)=>b.a-a.a||b.b-a.b);for(const child of children)stack.push(child);continue;
  }
  if(work.stage==='metadata'){dynamicBounds++;upper=builder.evaluate(rectFor(a,b),false).height[1];if(radialMin(a,b)-relief*upper>0){discarded++;lastDiscardedEnd=Math.max(lastDiscardedEnd,b);continue;}}
  // Analytic metadata does not need an exact point probe to discard a wide
  // interval. Defer imported terrainHeight until the final 1m band; otherwise
  // redundant samples obscure the actual interval-query cost. Global Lipschitz
  // mode already needs midpoint heights to form its bound.
  if(mode==='global'||(b-a)*speed<=toleranceKm)at(m);
  // Existence-only lookahead never discards the unresolved interval. It can
  // establish a nonpositive witness within the requested 1m enclosure even
  // when a conservative bound starts becoming uncertain slightly before root.
  if((b-a)*speed<=toleranceKm&&knownNonpositive-a>toleranceKm/speed)at(Math.min(end,a+toleranceKm/speed));
  if(knownNonpositive>=a&&(knownNonpositive-a)*speed<=toleranceKm){
   const witness=at(knownNonpositive);return finish('hit',{interval:[a,knownNonpositive],enclosureKm:(knownNonpositive-a)*speed,witness:{t:knownNonpositive,clearance:witness.clear,upperClearance:witness.clear+fieldError+radialError},certifiedPrefixEnd:a,search:[start,end]});
  }
  if((b-a)*speed<=minWidth)return finish('unresolved-contact',{interval:[a,b],knownNonpositive:Number.isFinite(knownNonpositive)?knownNonpositive:null,search:[start,end]});
  stack.push({a:m,b,stage:'dynamic'});stack.push({a,b:m,stage:'dynamic'});
 }
 return finish(stack.length?'unresolved-budget':'miss',{search:[start,end],remaining:stack.length,earliestPending:stack.length?stack[stack.length-1].a:null,knownNonpositive:Number.isFinite(knownNonpositive)?knownNonpositive:null,lastDiscardedEnd});
 }catch(error){if(error!==HEIGHT_BUDGET)throw error;return finish('unresolved-height-budget',{search:[start,end],remaining:stack.length+1,earliestPending:currentFront,knownNonpositive:Number.isFinite(knownNonpositive)?knownNonpositive:null});}
}
