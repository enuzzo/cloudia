/** Camera state is independent of the cloud clock and meteorological forcing. */
export class OrbitView {
 yaw=0;pitch=0;approach=0;
 zoom(delta:number){if(Number.isFinite(delta))this.approach=Math.max(0,Math.min(1,this.approach+delta));}
 setApproach(value:number){if(Number.isFinite(value))this.approach=Math.max(0,Math.min(1,value));}
 drag(dx:number,dy:number,width:number,height:number){
  if(![dx,dy,width,height].every(Number.isFinite)||width<=0||height<=0)return;
  const yaw=this.yaw-dx/width*3.4;
  this.yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
  this.pitch=Math.max(-.92,Math.min(.92,this.pitch+dy/height*2.4));
 }
 reset(){this.yaw=0;this.pitch=0;this.approach=0;}
 frame(target:readonly number[],aspect:number,autoYaw:number,nearDistance=.25){
  const home=16*Math.max(1,.85/Math.max(.1,aspect));
  const distance=home*Math.pow(Math.max(.01,Math.min(home,nearDistance))/home,this.approach),yaw=this.yaw+autoYaw,c=Math.cos(this.pitch);
  return {distance,origin:[target[0]+Math.sin(yaw)*c*distance,target[1]+Math.sin(this.pitch)*distance,target[2]+Math.cos(yaw)*c*distance]};
 }
}
export class OrbitPointerController {
 private events=new AbortController();
 private active:number|null=null;
 private x=0;private y=0;
 constructor(private canvas:HTMLCanvasElement,private rotate:(dx:number,dy:number,width:number,height:number)=>void,private center:()=>void,private zoom:(delta:number)=>void=()=>{}){
  canvas.addEventListener('pointerdown',this.down,{signal:this.events.signal});
  canvas.addEventListener('pointermove',this.move,{signal:this.events.signal});
  canvas.addEventListener('pointerup',this.end,{signal:this.events.signal});
  canvas.addEventListener('pointercancel',this.end,{signal:this.events.signal});
  canvas.addEventListener('lostpointercapture',this.end,{signal:this.events.signal});
  canvas.addEventListener('keydown',this.key,{signal:this.events.signal});
  canvas.addEventListener('wheel',this.wheel,{passive:false,signal:this.events.signal});
 }
 private down=(e:PointerEvent)=>{
  if(e.button!==0||e.isPrimary===false||this.active!==null)return;
  this.active=e.pointerId;this.x=e.clientX;this.y=e.clientY;
  try{this.canvas.setPointerCapture?.(e.pointerId);}catch{/* Capture may be unavailable after interruption. */}
  this.canvas.classList.add('dragging');e.preventDefault();
 };
 private move=(e:PointerEvent)=>{
  if(e.pointerId!==this.active)return;
  const rect=this.canvas.getBoundingClientRect(),dx=e.clientX-this.x,dy=e.clientY-this.y;
  this.x=e.clientX;this.y=e.clientY;
  if(dx||dy)this.rotate(dx,dy,rect.width,rect.height);
 };
 private end=(e:PointerEvent)=>{if(e.pointerId===this.active)this.cancel();};
 private wheel=(e:WheelEvent)=>{e.preventDefault();this.zoom(Math.max(-.12,Math.min(.12,-e.deltaY*(e.deltaMode===1?.02:.0008))));};
 private key=(e:KeyboardEvent)=>{
  if(['+','=','-'].includes(e.key)){e.preventDefault();this.zoom(e.key==='-'?-.08:.08);return;}
  const steps:Record<string,number[]>={ArrowLeft:[-36,0],ArrowRight:[36,0],ArrowUp:[0,-36],ArrowDown:[0,36]};
  if(e.key==='Home'){e.preventDefault();this.center();return;}
  if(steps[e.key]){e.preventDefault();const r=this.canvas.getBoundingClientRect();this.rotate(steps[e.key][0],steps[e.key][1],r.width,r.height);}
 };
 cancel(){const id=this.active;this.active=null;this.canvas.classList.remove('dragging');if(id!==null)try{if(this.canvas.hasPointerCapture?.(id))this.canvas.releasePointerCapture(id);}catch{/* Pointer ended elsewhere. */}}
 destroy(){this.cancel();this.events.abort();}
}
export interface ApproachBounds {min:readonly number[];max:readonly number[]}
export interface ApproachProbe {distance:number;found:boolean;samples:number;spacingKm:number;spanKm:number}
const APPROACH_SPACING_KM=.0125,APPROACH_MAX_STEPS=2048,APPROACH_MARGIN_KM=.003;
/** CPU boundary estimate, not an exact physical/GPU surface. Clip the search to
 * conservative cloud support so portrait framing does not dilute sample density.
 * Features narrower than spacing or below the density threshold may still be missed. */
export function probeApproach(target:readonly number[],home:readonly number[],density:(p:number[])=>number,bounds?:ApproachBounds):ApproachProbe{
 const invalid={distance:.4,found:false,samples:0,spacingKm:0,spanKm:0};
 if(target.length!==3||home.length!==3||![...target,...home].every(Number.isFinite))return invalid;
 const delta=home.map((v,i)=>v-target[i]),length=Math.hypot(...delta);
 if(length<1e-9)return {...invalid,distance:0};
 const d=delta.map(v=>v/length);
 let start=0,end=length;
 if(bounds){
  if(bounds.min.length!==3||bounds.max.length!==3||![...bounds.min,...bounds.max].every(Number.isFinite))return invalid;
  for(let axis=0;axis<3;axis++){
   if(bounds.min[axis]>bounds.max[axis])return invalid;
   if(Math.abs(d[axis])<1e-12){
    if(target[axis]<bounds.min[axis]||target[axis]>bounds.max[axis])return {...invalid,distance:Math.min(length,.4)};
   }else{
    const a=(bounds.min[axis]-target[axis])/d[axis],b=(bounds.max[axis]-target[axis])/d[axis];
    start=Math.max(start,Math.min(a,b));end=Math.min(end,Math.max(a,b));
   }
  }
 }
 if(end<start)return {...invalid,distance:Math.min(length,.4)};
 const span=end-start,steps=Math.max(1,Math.min(APPROACH_MAX_STEPS,Math.ceil(span/APPROACH_SPACING_KM)));
 let samples=0;
 const sample=(t:number)=>{samples++;return density(target.map((v,i)=>v+d[i]*t))>.025;};
 const result=(distance:number,found:boolean):ApproachProbe=>({distance,found,samples,spacingKm:span/steps,spanKm:span});
 if(sample(end))return result(Math.min(length,end+APPROACH_MARGIN_KM),true);
 let outside=end;
 for(let i=1;i<=steps;i++){
  const inside=end-span*i/steps;
  if(sample(inside)){
   let lo=inside,hi=outside;
   for(let j=0;j<10;j++){const mid=(lo+hi)/2;if(sample(mid))lo=mid;else hi=mid;}
   return result(Math.min(length,hi+APPROACH_MARGIN_KM),true);
  }
  outside=inside;
 }
 return result(Math.min(length,.4),false);
}
export function approachDistance(target:readonly number[],home:readonly number[],density:(p:number[])=>number,bounds?:ApproachBounds):number{
 return probeApproach(target,home,density,bounds).distance;
}
