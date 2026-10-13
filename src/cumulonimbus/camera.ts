/** Camera state is independent of the cloud clock and meteorological forcing. */
export class OrbitView {
 yaw=0;pitch=0;
 drag(dx:number,dy:number,width:number,height:number){
  if(![dx,dy,width,height].every(Number.isFinite)||width<=0||height<=0)return;
  const yaw=this.yaw-dx/width*3.4;
  this.yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
  this.pitch=Math.max(-.92,Math.min(.92,this.pitch+dy/height*2.4));
 }
 reset(){this.yaw=0;this.pitch=0;}
 frame(target:readonly number[],aspect:number,autoYaw:number){
  const distance=16*Math.max(1,.85/Math.max(.1,aspect)),yaw=this.yaw+autoYaw,c=Math.cos(this.pitch);
  return {distance,origin:[target[0]+Math.sin(yaw)*c*distance,target[1]+Math.sin(this.pitch)*distance,target[2]+Math.cos(yaw)*c*distance]};
 }
}
export class OrbitPointerController {
 private events=new AbortController();
 private active:number|null=null;
 private x=0;private y=0;
 constructor(private canvas:HTMLCanvasElement,private rotate:(dx:number,dy:number,width:number,height:number)=>void,private center:()=>void){
  canvas.addEventListener('pointerdown',this.down,{signal:this.events.signal});
  canvas.addEventListener('pointermove',this.move,{signal:this.events.signal});
  canvas.addEventListener('pointerup',this.end,{signal:this.events.signal});
  canvas.addEventListener('pointercancel',this.end,{signal:this.events.signal});
  canvas.addEventListener('lostpointercapture',this.end,{signal:this.events.signal});
  canvas.addEventListener('keydown',this.key,{signal:this.events.signal});
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
 private key=(e:KeyboardEvent)=>{
  const steps:Record<string,number[]>={ArrowLeft:[-36,0],ArrowRight:[36,0],ArrowUp:[0,-36],ArrowDown:[0,36]};
  if(e.key==='Home'){e.preventDefault();this.center();return;}
  if(steps[e.key]){e.preventDefault();const r=this.canvas.getBoundingClientRect();this.rotate(steps[e.key][0],steps[e.key][1],r.width,r.height);}
 };
 cancel(){const id=this.active;this.active=null;this.canvas.classList.remove('dragging');if(id!==null)try{if(this.canvas.hasPointerCapture?.(id))this.canvas.releasePointerCapture(id);}catch{/* Pointer ended elsewhere. */}}
 destroy(){this.cancel();this.events.abort();}
}
