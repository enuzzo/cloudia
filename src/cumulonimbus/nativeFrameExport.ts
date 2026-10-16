export const NATIVE_FRAME_MAX_PIXELS=8_388_608;
export const NATIVE_FRAME_MAX_PNG_BYTES=32*1024*1024;
export const NATIVE_FRAME_TIMEOUT_MS=20_000;

export interface NativeFrameInfo {
 readonly mime:'image/png';readonly width:number;readonly height:number;
 readonly byteLength:number;readonly sha256:string;
}
type EventBase={readonly type:'frameExport';readonly requestId:number;readonly busy:boolean};
export type NativeFrameExportEvent=
 | EventBase&{readonly state:'pending'|'cleared'}
 | EventBase&{readonly state:'error';readonly message:string}
 | EventBase&{readonly state:'ready';readonly metadata:Record<string,unknown>;readonly png:Blob;readonly info:NativeFrameInfo};
/** Structural API: works in the canvas owner without DOM globals/instanceof. */
export interface NativeCanvasLike {
 readonly width:number;readonly height:number;
 toBlob?:(callback:(blob:Blob|null)=>void,type?:string)=>void;
 convertToBlob?:(options:{type:string})=>Promise<Blob>;
}
interface Request {
 readonly id:number;phase:'waiting'|'physical';timer:ReturnType<typeof setTimeout>|null;
}

/** One encoder/validation slot per owner. Logical cancellation cannot abort it. */
export class NativeFrameExporter {
 private active:Request|null=null;
 private physical:Request|null=null;
 private disposed=false;
 constructor(
  private readonly emit:(event:NativeFrameExportEvent)=>void,
  private readonly availabilityChanged:()=>void,
 ){}
 get busy():boolean{return this.active!==null||this.physical!==null;}
 get waiting():boolean{return this.active?.phase==='waiting';}
 request(id:number):boolean{
  this.checkId(id);
  if(this.disposed)return false;
  if(this.busy){this.emit({type:'frameExport',requestId:id,state:'error',busy:true,message:'A native PNG export is already in progress.'});return false;}
  const before=this.availability();
  const request:Request={id,phase:'waiting',timer:null};this.active=request;
  // One deadline includes both waiting for the draw and physical encoding.
  request.timer=setTimeout(()=>this.fail(request,'Native PNG export timed out after 20 seconds.'),NATIVE_FRAME_TIMEOUT_MS);
  this.notify(before);
  this.emit({type:'frameExport',requestId:id,state:'pending',busy:this.busy});
  return true;
 }
 /** Called synchronously after draw: clone state and invoke the encoder before returning. */
 capture(canvas:NativeCanvasLike,metadata:Record<string,unknown>):void{
  const request=this.active;
  if(this.disposed||request?.phase!=='waiting'||this.physical)return;
  let width:number,height:number,snapshot:Record<string,unknown>;
  try{
   width=canvas.width;height=canvas.height;
   if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||width*height>NATIVE_FRAME_MAX_PIXELS)throw new Error(`Canvas dimensions exceed the native PNG limit (${width}×${height}; max ${NATIVE_FRAME_MAX_PIXELS} pixels).`);
   if(typeof canvas.convertToBlob!=='function'&&typeof canvas.toBlob!=='function')throw new Error('This canvas cannot encode a PNG.');
   if(metadata===null||typeof metadata!=='object'||Array.isArray(metadata))throw new Error('Frame metadata must be a DTO record.');
   snapshot=structuredClone(metadata);
  }catch(error){this.fail(request,this.message(error));return;}
  const before=this.availability();request.phase='physical';this.physical=request;this.notify(before);
  let encoded:Promise<Blob|null>;
  try{
   if(typeof canvas.convertToBlob==='function')encoded=Promise.resolve(canvas.convertToBlob({type:'image/png'}));
   else encoded=new Promise<Blob|null>(resolve=>canvas.toBlob!(resolve,'image/png'));
  }catch(error){encoded=Promise.reject(error);}
  void encoded.then(blob=>this.current(request)?this.validate(blob,width,height):null)
   .then(result=>{
    if(result===null||!this.current(request))return;
    this.endLogical(request);
    // The physical slot remains busy through this callback; finally releases it.
    this.emit({type:'frameExport',requestId:request.id,state:'ready',busy:this.busy,metadata:snapshot,png:result.png,info:result.info});
   })
   .catch(error=>this.fail(request,this.message(error)))
   .finally(()=>{
    const previous=this.availability();
    if(this.physical===request)this.physical=null;
    this.notify(previous);
   });
 }
 /** Scene changes before draw cancel waiting only; an acquired frame keeps its DTO. */
 cancelPending(reason:string):void{
  if(!this.disposed&&this.active?.phase==='waiting')this.fail(this.active,reason);
 }
 /** A new UI command ID clears any logical result/request, including physical callbacks. */
 clear(requestId:number):void{
  this.checkId(requestId);if(this.disposed)return;
  const before=this.availability();if(this.active)this.endLogical(this.active);
  this.notify(before);
  this.emit({type:'frameExport',requestId,state:'cleared',busy:this.busy});
 }
 dispose():void{
  if(this.disposed)return;
  this.disposed=true;
  if(this.active)this.endLogical(this.active);
  // No events/availability callbacks after disposal; physical completion is still drained.
 }
 private checkId(id:number):void{if(!Number.isSafeInteger(id)||id<0)throw new RangeError('Invalid frame export request ID.');}
 private availability():string{return `${this.busy}:${this.waiting}`;}
 private notify(before:string):void{if(!this.disposed&&this.availability()!==before)this.availabilityChanged();}
 private current(request:Request):boolean{return !this.disposed&&this.active===request;}
 private endLogical(request:Request):void{
  if(request.timer!==null){clearTimeout(request.timer);request.timer=null;}
  if(this.active===request)this.active=null;
 }
 private fail(request:Request,message:string):void{
  if(!this.current(request))return;
  const before=this.availability();this.endLogical(request);this.notify(before);
  this.emit({type:'frameExport',requestId:request.id,state:'error',busy:this.busy,message});
 }
 private message(error:unknown):string{return error instanceof Error?error.message:String(error);}
 private async validate(blob:Blob|null,width:number,height:number):Promise<{png:Blob;info:NativeFrameInfo}>{
  if(blob===null||typeof blob!=='object'||typeof blob.arrayBuffer!=='function')throw new Error('Canvas PNG encoding returned no Blob.');
  if(blob.type!=='image/png')throw new Error('Canvas export MIME is not image/png.');
  if(!Number.isSafeInteger(blob.size)||blob.size<33||blob.size>NATIVE_FRAME_MAX_PNG_BYTES)throw new Error('Encoded PNG is empty, incomplete or exceeds 32 MiB.');
  const buffer=await blob.arrayBuffer();
  if(buffer.byteLength!==blob.size)throw new Error('PNG byte length does not match Blob metadata.');
  const bytes=new Uint8Array(buffer),signature=[137,80,78,71,13,10,26,10];
  if(signature.some((value,i)=>bytes[i]!==value))throw new Error('Invalid PNG signature.');
  const header=new DataView(buffer);
  if(header.getUint32(8)!==13||bytes[12]!==73||bytes[13]!==72||bytes[14]!==68||bytes[15]!==82)throw new Error('PNG does not begin with an IHDR chunk.');
  if(header.getUint32(16)!==width||header.getUint32(20)!==height)throw new Error('PNG dimensions do not match the captured canvas.');
  const digest=await crypto.subtle.digest('SHA-256',buffer);
  const sha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
  return {png:blob,info:{mime:'image/png',width,height,byteLength:blob.size,sha256}};
 }
}
