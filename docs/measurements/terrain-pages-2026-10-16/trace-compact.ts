import {terrainHeight,EARTH_RADIUS,GROUND_LEVEL} from './baseline/landscape.source.ts';
import {CompactLookup,childKey,decodeKey,type CompactNode as Node} from './compact.ts';
import {mulI,subI,type I,type Rect} from './baseline/gradient.ts';
export interface Pose{name:string;origin:number[];ray:number[]}
const R=EARTH_RADIUS,CY=R-GROUND_LEVEL,HMAX=3.25;
const dot=(a:number[],b:number[])=>a.reduce((s,x,i)=>s+x*b[i],0),norm=(a:number[])=>Math.hypot(...a);
const smooth=(a:number,b:number,x:number)=>{const u=Math.max(0,Math.min(1,(x-a)/(b-a)));return u*u*(3-2*u);};
export function trace(pose:Pose,metadata:CompactLookup,options:{budget?:number;maxHeightEvaluations?:number;toleranceKm?:number;minimumIntervalKm?:number;stackCapacity?:number;errorScale?:number;sampleAtFront?:boolean}={}){
 const budget=options.budget??256,heightCap=options.maxHeightEvaluations??16,tol=options.toleranceKm??.001,minWidth=options.minimumIntervalKm??1e-7,stackCap=options.stackCapacity??48,errorScale=options.errorScale??1;
 if(errorScale<1)throw Error('A qualified trace cannot shrink the analytical error ledger');
 const o=pose.origin,d=pose.ray,speed=norm(d),d2=dot(d,d),radial=[o[0],o[1]+CY,o[2]],b=dot(radial,d),tc=-b/d2;
 if(o.length!==3||d.length!==3||![...o,...d].every(Number.isFinite)||!Number.isFinite(d2)||d2<=0)throw Error('Finite nonzero three-component ray required');
 if(heightCap<2)throw Error('At least two point samples required');
 const h0=o[1]-GROUND_LEVEL,c=o[0]**2+o[2]**2+h0*(2*R+h0),seaDisc=b*b-d2*c;
 let sea:number|null=null;if(seaDisc>=0){const root=Math.sqrt(seaDisc),q=-b-(b<0?-root:root),roots=[q/d2,q===0?Infinity:c/q].sort((a,b)=>a-b);if(roots[0]>0&&Number.isFinite(roots[0]))sea=roots[0];}
 const relief=1-smooth(90,180,(sea??Math.max(0,tc))*speed),boundR=R+HMAX*relief,disc=b*b-d2*(c-(boundR-R)*(boundR+R));
 let visits=0,heightEvaluations=0,discarded=0,maxStack=0,gradientQueries=0,gradientAdvances=0,knownNonpositive=Infinity,front=0;
 let blockerKey:number|null=null;
 const loadsBefore=metadata.loads,baseBefore=metadata.baseLoads,gradientBefore=metadata.gradientLoads,clipsBefore=metadata.childClips,radialError=1e-9,pointCache=new Map<number,{h:number;clear:number}>(),HEIGHT_BUDGET=Symbol('height-budget');
 const finish=(status:string,extra:any={})=>({name:pose.name,status,sea,relief,visits,heightEvaluations,discarded,maxStack,gradientQueries,gradientAdvances,metadataLoads:metadata.loads-loadsBefore,baseRecordLoads:metadata.baseLoads-baseBefore,gradientRecordLoads:metadata.gradientLoads-gradientBefore,childClips:metadata.childClips-clipsBefore,blockerKey,errorScale,roundingQualified:false,...extra});
 if(disc<0||tc+Math.sqrt(Math.max(0,disc))/d2<=0)return finish('outer-envelope-miss');
 // A guarded occupancy witness at the numerical sea root itself may be
 // inconclusive. Extend only by a quarter of the requested geometric band;
 // the original field supplies the witness just inside the same sea surface.
 // Every earlier interval still requires the ordinary positive-prefix proof.
 const half=Math.sqrt(disc)/d2,start=Math.max(0,tc-half),end=sea===null?tc+half:sea+tol/(4*speed);
 if(end<start)return finish('outer-envelope-miss');
 const at=(t:number)=>{if(pointCache.has(t))return pointCache.get(t)!;if(heightEvaluations>=heightCap)throw HEIGHT_BUDGET;heightEvaluations++;
  const p=o.map((v,i)=>v+d[i]*t),h=terrainHeight(p[0],p[2]),clear=norm([p[0],p[1]+CY,p[2]])-R-relief*h,value={h,clear};pointCache.set(t,value);if(clear+radialError<=0)knownNonpositive=Math.min(knownNonpositive,t);return value;};
 if(relief===0){
  if(sea===null){const initial=at(0);if(initial.clear+radialError<=0)return finish('hit',{interval:[0,0],enclosureKm:0,certifiedPrefixEnd:0,witness:{t:0,clearance:initial.clear,upperClearance:initial.clear+radialError},seaOnly:true});return finish(initial.clear-radialError>0?'miss':'unresolved-contact',{seaOnly:true});}
  // The analytic sea root supplies a geometric enclosure, but numerical CPU
  // occupancy still needs a real witness. A tiny bracket can include the
  // rounded root without invoking continuity of the terrain field.
  const lo=Math.max(0,sea-tol/(4*speed)),hi=sea+tol/(4*speed),before=at(lo),after=at(hi);
  if(lo<=tc&&before.clear-2*radialError>0&&after.clear+radialError<=0)return finish('hit',{interval:[lo,hi],enclosureKm:(hi-lo)*speed,certifiedPrefixEnd:lo,witness:{t:hi,clearance:after.clear,upperClearance:after.clear+radialError},search:[start,hi],seaOnly:true});
  return finish('unresolved-contact',{interval:[lo,hi],seaOnly:true,reason:'analytic sea root lacks guarded CPU occupied witness or positive prefix'});
 }
 const radialMin=(a:number,b:number)=>{const t=Math.max(a,Math.min(b,tc)),p=o.map((v,i)=>v+d[i]*t);return norm([p[0],p[1]+CY,p[2]])-R-radialError;};
 const radialSlope=(t:number)=>{const p=[o[0]+d[0]*t,o[1]+CY+d[1]*t,o[2]+d[2]*t];return dot(p,d)/norm(p);};
 const clip=(r:Rect,a:number,b:number):[number,number]|null=>{let lo=a,hi=b;for(const[axis,rlo,rhi]of[[0,r.x0,r.x1],[2,r.z0,r.z1]]){if(d[axis]===0){if(o[axis]<rlo||o[axis]>rhi)return null;}else{const p=(rlo-o[axis])/d[axis],q=(rhi-o[axis])/d[axis];lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));}}return hi>=lo?[lo,hi]:null;};
 type Sample={t:number;clear:number};type Work={a:number;b:number;node:Node;anchor?:Sample};const stack:Work[]=[];
 const root=metadata.get(0,0),range=clip(root.rect,start,end);if(!range||range[0]>start+1e-9||range[1]<end-1e-9)return finish('unresolved-metadata-domain',{search:[start,end]});stack.push({a:start,b:end,node:root});
 const hit=(a:number)=>{const witness=at(knownNonpositive);return finish('hit',{interval:[a,knownNonpositive],enclosureKm:(knownNonpositive-a)*speed,certifiedPrefixEnd:a,witness:{t:knownNonpositive,clearance:witness.clear,upperClearance:witness.clear+radialError},search:[start,end]});};
 // On one metadata cell the ideal clearance derivative is enclosed by D. A
 // CPU sample differs from the ideal at each endpoint by E, so ±2E bridges
 // the discontinuous CPU field. The segment to the anchor stays in this cell.
 const derivative=(w:Work,s:Sample)=>{const span:[number,number]=[Math.min(w.a,s.t),Math.max(w.b,s.t)],n=w.node;
  const gradient=metadata.getGradient(n),gh:I=mulI(gradient.gx,[d[0],d[0]]),gz:I=mulI(gradient.gz,[d[2],d[2]]),terrain:I=[relief*(gh[0]+gz[0]),relief*(gh[1]+gz[1])];
  return subI([radialSlope(span[0])-1e-12,radialSlope(span[1])+1e-12],terrain);};
 const margin=(n:Node)=>2*relief*n.errorKm*errorScale+2*radialError+1e-11;
 const lower=(w:Work,s:Sample)=>{gradientQueries++;return s.clear+mulI(derivative(w,s),[w.a-s.t,w.b-s.t])[0]-margin(w.node);};
 try{at(start);at(end);
  while(stack.length&&visits<budget){
   if(stack.length>stackCap){const pending=stack.at(-1)!.node;blockerKey=pending.firstChild?null:pending.key;return finish('unresolved-stack',{remaining:stack.length});}
   const w=stack.pop()!,{a,b,node}=w,split=(a+b)/2,m=options.sampleAtFront?a:split;front=a;blockerKey=node.firstChild?null:node.key;visits++;maxStack=Math.max(maxStack,stack.length+1);
   if(knownNonpositive>=a&&(knownNonpositive-a)*speed<=tol)return hit(a);if(a>=knownNonpositive)continue;
   if(radialMin(a,b)-relief*node.height[1]>0){discarded++;continue;}
   if(node.firstChild){const children:Work[]=[];for(let i=0;i<4;i++){const key=childKey(node.key,i);metadata.childClips++;const r=clip(decodeKey(key).rect,a,b);if(r){const child=metadata.get(node.firstChild+i,key);children.push({a:r[0],b:r[1],node:child});}}children.sort((p,q)=>q.a-p.a||q.b-p.b);for(const child of children)stack.push(child);continue;}
   if(w.anchor&&lower(w,w.anchor)>0){discarded++;continue;}
   const center=at(m),anchor={t:m,clear:center.clear};if(lower(w,anchor)>0){discarded++;continue;}
   // The signed derivative gives a piecewise linear lower inclusion. Solve
   // its first descending zero to discard a proved-positive prefix directly,
   // rather than spend a new height query at every binary subdivision.
   const D=derivative(w,anchor),S=center.clear-margin(node);
   let cut=S>=0?(D[0]<0?m+S/(-D[0]):b):(D[1]<0?m+S/(-D[1]):a);
   cut=Math.max(a,Math.min(b,cut-1e-9));
   if((cut-a)*speed>minWidth&&lower({...w,b:cut},anchor)>0){
    gradientAdvances++;discarded++;
    // The upper inclusion predicts a possible occupied witness. It never
    // establishes occupancy by itself: evaluate the original field there.
    // This avoids binary subdivisions once both inclusions fit within 1 m.
    const T=center.clear+margin(node),upperT=T>=0?(D[1]<0?m+T/(-D[1]):Infinity):(D[0]<0?m+T/(-D[0]):m);
    if(upperT>=cut&&upperT<=b&&(upperT-cut)*speed<=tol){at(upperT);if(knownNonpositive>=cut&&(knownNonpositive-cut)*speed<=tol)return hit(cut);}
    stack.push({a:cut,b,node,anchor});continue;
   }
   if((b-a)*speed<=tol&&knownNonpositive-a>tol/speed)at(Math.min(end,a+tol/speed));
   if(knownNonpositive>=a&&(knownNonpositive-a)*speed<=tol)return hit(a);
   if((b-a)*speed<=minWidth)return finish('unresolved-contact',{interval:[a,b],knownNonpositive:Number.isFinite(knownNonpositive)?knownNonpositive:null,search:[start,end],errorKm:node.errorKm});
   stack.push({a:split,b,node,anchor});stack.push({a,b:split,node,anchor});
  }
  if(stack.length){const pending=stack.at(-1)!.node;blockerKey=pending.firstChild?null:pending.key;}else blockerKey=null;
  return finish(stack.length?'unresolved-budget':'miss',{search:[start,end],remaining:stack.length,earliestPending:stack.length?stack[stack.length-1].a:null,knownNonpositive:Number.isFinite(knownNonpositive)?knownNonpositive:null});
 }catch(error){if(error!==HEIGHT_BUDGET)throw error;return finish('unresolved-height-budget',{search:[start,end],remaining:stack.length+1,earliestPending:front,knownNonpositive:Number.isFinite(knownNonpositive)?knownNonpositive:null});}
}
