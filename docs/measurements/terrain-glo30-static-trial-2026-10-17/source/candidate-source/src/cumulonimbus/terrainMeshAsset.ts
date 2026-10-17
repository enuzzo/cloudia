import type {TerrainMeshData} from './terrainMesh';

/** TMA1 v1 is a static mesh resource, never a per-frame cache. All byte fields
 * are little endian; geometry is neither quantized nor regenerated. */
export const TERRAIN_MESH_ASSET_LIMITS=Object.freeze({maxVertices:1_000_000,maxTriangles:2_000_000,
 maxGeometryBytes:64*1024*1024,maxCellsPerSide:256,maxLevels:9,maxMetadataBytes:65_536});
const HEADER_BYTES=128,ARRAYS=6,MAGIC=0x31414d54,VERSION=1,HOLE=0xffffffff;
const MAX_LOOKUP=256*256*9;
export const TERRAIN_MESH_ASSET_MAX_BYTES=HEADER_BYTES+65_536+3+64*1024*1024+MAX_LOOKUP*5+3;
const align4=(n:number)=>(n+3)&~3;
const littleEndian=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
function fail(message:string):never{throw new RangeError(`Terrain mesh asset: ${message}`);}
function integer(value:unknown,min:number,max:number,label:string):number{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)fail(label);
 return value as number;
}
function finite(value:unknown,label:string):number{if(typeof value!=='number'||!Number.isFinite(value))fail(label);return value as number;}
function object(value:unknown,label:string):Record<string,unknown>{
 if(value===null||typeof value!=='object'||Array.isArray(value))fail(label);return value as Record<string,unknown>;
}
function jsonShape(value:unknown,depth=0,budget={nodes:0}):void{
 if(depth>12||++budget.nodes>4096)fail('metadata complexity');
 if(typeof value==='number'&&!Number.isFinite(value))fail('nonfinite metadata');
 if(value===null||typeof value==='number'||typeof value==='boolean'||typeof value==='string')return;
 if(Array.isArray(value)){for(const entry of value)jsonShape(entry,depth+1,budget);return;}
 if(typeof value!=='object')fail('non-JSON metadata');
 for(const [key,entry] of Object.entries(value as object)){
  if(key==='__proto__'||key==='constructor'||key==='prototype')fail('reserved metadata key');
  jsonShape(entry,depth+1,budget);
 }
}
function baseTriangles(cells:number,levels:number):number{return 2*cells*cells+(levels-1)*(1.5*cells*cells+6*cells);}
function originalCellTriangles(x:number,z:number,level:number,cells:number):number{
 const h=cells/4;
 return level>0&&((x===h&&z>=-h&&z<h)||(z===-h-1&&x>=-h&&x<h)
  ||(x===-h-1&&z>=-h&&z<h)||(z===h&&x>=-h&&x<h))?5:2;
}
function validateStats(value:unknown):TerrainMeshData['stats']{
 jsonShape(value);const s=object(value,'stats object'),limit=TERRAIN_MESH_ASSET_LIMITS;
 const v=integer(s.vertices,1,limit.maxVertices,'vertex cap'),t=integer(s.triangles,1,limit.maxTriangles,'triangle cap');
 const c=integer(s.cellsPerSide,4,limit.maxCellsPerSide,'cellsPerSide'),l=integer(s.levels,1,limit.maxLevels,'levels');
 if(c%4!==0)fail('cellsPerSide must be divisible by four');
 if(s.geometryBytes!==32*v+12*t||32*v+12*t>limit.maxGeometryBytes)fail('geometryBytes');
 const spacing=finite(s.baseSpacingKm,'baseSpacingKm');if(spacing<=0)fail('baseSpacingKm');
 if(s.outerExtentKm!==c/2*spacing*2**(l-1))fail('outerExtentKm');
 if(s.stitchedCells!==2*c*(l-1))fail('stitchedCells');
 if(s.normalMode!=='geometry'&&s.normalMode!=='analytic-blend')fail('normalMode');
 if(s.normalBlendStartRadiusKm!==c*.256/2||s.normalBlendEndRadiusKm!==c*.512/2)fail('normal blend radii');
 const min=finite(s.minimumHeightKm,'minimumHeightKm'),max=finite(s.maximumHeightKm,'maximumHeightKm');
 if(min<0||max<min)fail('height range');
 const originalT=baseTriangles(c,l),originalV=originalT/2+2*c+1;
 if(s.refinement===undefined){if(v!==originalV||t!==originalT||s.sampleCalls!==v)fail('unrefined stats');}
 else{
  const r=object(s.refinement,'refinement stats');
  if(s.normalMode!=='geometry'||r.originalVertices!==originalV||r.originalTriangles!==originalT)fail('refinement base stats');
  const split=integer(r.splitEdgeCount,0,3*originalT,'splitEdgeCount');
  if(v!==originalV+split||r.addedVertices!==split||r.addedTriangles!==t-originalT||t>4*originalT
   ||r.addedGeometryBytes!==32*(v-originalV)+12*(t-originalT))fail('refinement geometry stats');
  const probes=integer(r.probeSampleCalls,1,10_000_000,'probeSampleCalls');
  if(r.vertexSampleCalls!==v||r.totalSampleCalls!==v+probes||s.sampleCalls!==v+probes
   ||integer(r.selectedNodeColumns,1,10_000_000,'selectedNodeColumns')*integer(r.selectedNodeRows,1,10_000_000,'selectedNodeRows')!==probes)
   fail('refinement sample stats');
  const classes=r.originalFacesBySplitEdgeCount;
  if(!Array.isArray(classes)||classes.length!==4||classes.some(n=>!Number.isSafeInteger(n)||n<0)
   ||classes.reduce((a,b)=>a+b,0)!==originalT||classes.reduce((a,b,i)=>a+b*(i+1),0)!==t)fail('refinement face stats');
  const marked=integer(r.markedRedFaces,0,originalT,'markedRedFaces'),eligible=integer(r.eligibleNodesAboveThreshold,marked,probes,'eligibleNodesAboveThreshold');
  integer(r.nodesAboveThreshold,eligible,probes,'nodesAboveThreshold');
  const green=integer(r.greenFaces,0,originalT,'greenFaces');
  if(marked>classes[3]||split>3*marked||t-originalT>2*split||(marked===0)!==(eligible===0)
   ||green!==classes[1]+classes[2]+classes[3]-marked||r.cellTriangleCountBytes!==c*c*l)fail('refinement lookup stats');
  integer(r.maximumCellTriangles,1,20,'maximumCellTriangles');
  integer(r.midpointVerticesOutsideDomain,0,split,'midpointVerticesOutsideDomain');
  const grid=object(r.sourceGrid,'sourceGrid'),domain=object(r.selectionDomain,'selectionDomain'),bounds=object(r.boundsKm,'boundsKm');
  const gx=finite(grid.minXKm,'grid minX'),gz=finite(grid.minZKm,'grid minZ'),gs=finite(grid.spacingKm,'grid spacing');
  const columns=integer(grid.columns,2,10_000_000,'grid columns'),rows=integer(grid.rows,2,10_000_000,'grid rows');
  const dx=finite(domain.minXKm,'domain minX'),dz=finite(domain.minZKm,'domain minZ'),ex=finite(domain.maxXKm,'domain maxX'),ez=finite(domain.maxZKm,'domain maxZ');
  if(gs<=0||dx>ex||dz>ez||dx<gx||dz<gz||ex>gx+(columns-1)*gs||ez>gz+(rows-1)*gs
   ||r.sourceSpacingKm!==gs||finite(r.maxErrorKm,'maxErrorKm')<=0)fail('refinement domain');
  const selectedColumns=Math.floor((ex-gx)/gs)-Math.ceil((dx-gx)/gs)+1,selectedRows=Math.floor((ez-gz)/gs)-Math.ceil((dz-gz)/gs)+1;
  if(selectedColumns<1||selectedRows<1||r.selectedNodeColumns!==selectedColumns||r.selectedNodeRows!==selectedRows)fail('refinement selected-node stats');
  for(const key of ['min','max'])if(!Array.isArray(bounds[key])||(bounds[key] as unknown[]).length!==3)fail('refinement bounds');
 }
 return s as unknown as TerrainMeshData['stats'];
}
function validateData(data:TerrainMeshData):void{
 const s=validateStats(data.stats),v=s.vertices,t=s.triangles,c=s.cellsPerSide,l=s.levels;
 const arrays=[data.positions,data.normals,data.surface,data.indices,data.cellFirstIndex,data.cellTriangleCount];
 const types=[Float32Array,Float32Array,Float32Array,Uint32Array,Uint32Array,Uint8Array];
 const counts=[v*3,v*3,v*2,t*3,c*c*l,data.cellTriangleCount===undefined?0:c*c*l];
 for(let i=0;i<ARRAYS;i++){
  const array=arrays[i];if(i===5&&array===undefined)continue;
  if(!(array instanceof types[i])||!(array.buffer instanceof ArrayBuffer)||array.length!==counts[i])fail(`array ${i} shape/type`);
 }
 if(s.refinement&&!data.cellTriangleCount)fail('refinement needs cellTriangleCount');
 let min=Infinity,max=-Infinity;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<v;i++){
  for(let a=0;a<3;a++){const p=data.positions[i*3+a];if(!Number.isFinite(p))fail('nonfinite position');lo[a]=Math.min(lo[a],p);hi[a]=Math.max(hi[a],p);}
  const nx=data.normals[i*3],ny=data.normals[i*3+1],nz=data.normals[i*3+2],length=Math.hypot(nx,ny,nz);
  if(!Number.isFinite(length)||ny<=0||Math.abs(length-1)>.001)fail('invalid normal');
  const height=data.surface[i*2];if(!Number.isFinite(height)||height<0||!Number.isFinite(data.surface[i*2+1]))fail('invalid surface');
  min=Math.min(min,height);max=Math.max(max,height);
 }
 if(Math.fround(s.minimumHeightKm)!==min||Math.fround(s.maximumHeightKm)!==max)fail('height stats mismatch');
 if(s.refinement)for(let a=0;a<3;a++)if(s.refinement.boundsKm.min[a]!==lo[a]||s.refinement.boundsKm.max[a]!==hi[a])fail('position bounds stats');
 for(const index of data.indices)if(index>=v)fail('vertex index out of range');
 let cursor=0,maximumCount=0;const half=c/2,hole=c/4;
 for(let cell=0;cell<c*c*l;cell++){
  const level=Math.floor(cell/(c*c)),x=cell%c-half,z=Math.floor(cell/c)%c-half,first=data.cellFirstIndex[cell];
  const absent=level>0&&x>=-hole&&x<hole&&z>=-hole&&z<hole;
  if(absent){if(first!==HOLE||(data.cellTriangleCount?.[cell]??0)!==0)fail('hole lookup');continue;}
  const original=originalCellTriangles(x,z,level,c),count=data.cellTriangleCount?.[cell]??original;
  if(first!==cursor||count<original||count>(s.refinement?4*original:original))fail('noncontiguous cell lookup/count');
  cursor+=count*3;maximumCount=Math.max(maximumCount,count);if(cursor>data.indices.length)fail('cell lookup exceeds indices');
 }
 if(cursor!==data.indices.length||s.refinement&&s.refinement.maximumCellTriangles!==maximumCount)fail('cell lookup coverage');
}
function bytesOf(input:ArrayBuffer|Uint8Array):Uint8Array<ArrayBuffer>{
 if(!littleEndian)fail('zero-copy decode requires a little-endian host');
 if(input instanceof ArrayBuffer)return new Uint8Array(input);
 if(!(input instanceof Uint8Array)||!(input.buffer instanceof ArrayBuffer))fail('ArrayBuffer resource required');
 if(input.byteOffset%4!==0)fail('resource byteOffset alignment');
 return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
}
function header(view:DataView):number{
 if(view.byteLength<HEADER_BYTES||view.getUint32(0,true)!==MAGIC||view.getUint16(4,true)!==VERSION
  ||view.getUint16(6,true)!==HEADER_BYTES||view.getUint32(16,true)!==ARRAYS||view.getUint32(20,true)!==0)fail('magic/version/header');
 const total=view.getUint32(8,true);if(total<HEADER_BYTES||total>TERRAIN_MESH_ASSET_MAX_BYTES)fail('total byte cap');return total;
}
/** Copies the input arrays once into a new owned binary resource. Stats use
 * JSON's original scalar representation; float array bits, including -0, survive. */
export function encodeTerrainMeshAsset(data:TerrainMeshData):ArrayBuffer{
 if(!littleEndian)fail('little-endian host required');validateData(data);
 const metadata=new TextEncoder().encode(JSON.stringify({stats:data.stats}));
 if(metadata.length>TERRAIN_MESH_ASSET_LIMITS.maxMetadataBytes)fail('metadata byte cap');
 const arrays=[data.positions,data.normals,data.surface,data.indices,data.cellFirstIndex,data.cellTriangleCount];
 let total=align4(HEADER_BYTES+metadata.length);for(const array of arrays)total=align4(total+(array?.byteLength??0));
 if(total>TERRAIN_MESH_ASSET_MAX_BYTES)fail('total byte cap');
 const output=new ArrayBuffer(total),bytes=new Uint8Array(output),view=new DataView(output);
 view.setUint32(0,MAGIC,true);view.setUint16(4,VERSION,true);view.setUint16(6,HEADER_BYTES,true);
 view.setUint32(8,total,true);view.setUint32(12,metadata.length,true);view.setUint32(16,ARRAYS,true);bytes.set(metadata,HEADER_BYTES);
 let offset=align4(HEADER_BYTES+metadata.length);
 for(let i=0;i<ARRAYS;i++){
  const array=arrays[i],d=24+i*16,length=array?.length??0,byteLength=array?.byteLength??0;
  view.setUint32(d,i+1,true);view.setUint32(d+4,offset,true);view.setUint32(d+8,length,true);view.setUint32(d+12,byteLength,true);
  if(array)bytes.set(new Uint8Array(array.buffer,array.byteOffset,byteLength),offset);offset=align4(offset+byteLength);
 }
 return output;
}
/** Ownership transfer by contract: caller relinquishes the entire backing
 * buffer (and all aliases). Returned arrays are exclusive mutable views of it;
 * JS cannot enforce this promise without copying. No per-array copies occur. */
export function decodeTerrainMeshAsset(input:ArrayBuffer|Uint8Array):TerrainMeshData{
 const bytes=bytesOf(input);if(bytes.byteLength>TERRAIN_MESH_ASSET_MAX_BYTES)fail('total byte cap');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),total=header(view);
 if(total!==bytes.byteLength)fail('trailing or truncated bytes');
 const metadataLength=integer(view.getUint32(12,true),1,TERRAIN_MESH_ASSET_LIMITS.maxMetadataBytes,'metadata byte length');
 if(HEADER_BYTES+metadataLength>total)fail('metadata bounds');
 for(let i=120;i<HEADER_BYTES;i++)if(bytes[i]!==0)fail('reserved header bytes');
 let metadata:unknown;try{metadata=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(HEADER_BYTES,HEADER_BYTES+metadataLength)));}catch{fail('metadata UTF-8/JSON');}
 const root=object(metadata,'metadata root');if(Object.keys(root).length!==1||!Object.hasOwn(root,'stats'))fail('metadata layout');
 const stats=validateStats(root.stats),counts=[stats.vertices*3,stats.vertices*3,stats.vertices*2,stats.triangles*3,stats.levels*stats.cellsPerSide**2];
 const descriptors:{offset:number;count:number}[]=[];let cursor=HEADER_BYTES+metadataLength;
 for(let i=0;i<ARRAYS;i++){
  const aligned=align4(cursor);for(;cursor<aligned;cursor++)if(bytes[cursor]!==0)fail('nonzero padding');
  const d=24+i*16,offset=view.getUint32(d+4,true),count=view.getUint32(d+8,true),length=view.getUint32(d+12,true);
  if(view.getUint32(d,true)!==i+1||offset!==aligned||offset%4||length!==count*(i===5?1:4)
   ||i<5&&count!==counts[i]||i===5&&count!==0&&count!==counts[4]||offset+length>total)fail('array layout/bounds');
  if(i===5&&stats.refinement&&count===0)fail('missing refined count array');
  descriptors.push({offset:bytes.byteOffset+offset,count});cursor=offset+length;
 }
 const end=align4(cursor);for(;cursor<end;cursor++)if(bytes[cursor]!==0)fail('nonzero final padding');if(end!==total)fail('unclaimed trailing bytes');
 const f=(i:number)=>new Float32Array(bytes.buffer,descriptors[i].offset,descriptors[i].count),u=(i:number)=>new Uint32Array(bytes.buffer,descriptors[i].offset,descriptors[i].count);
 const data:TerrainMeshData={positions:f(0),normals:f(1),surface:f(2),indices:u(3),cellFirstIndex:u(4),stats};
 if(descriptors[5].count)data.cellTriangleCount=new Uint8Array(bytes.buffer,descriptors[5].offset,descriptors[5].count);
 validateData(data);return data;
}
function aborted(signal?:AbortSignal):void{if(signal?.aborted)throw signal.reason??new DOMException('Aborted','AbortError');}
/** The only hash path. Fetch errors, cancellation, SHA mismatch or bad layout
 * reject explicitly; callers choose UI/retry policy, never a silent builder. */
export async function loadTerrainMeshAsset(url:string,expectedSHA:string,signal?:AbortSignal):Promise<TerrainMeshData>{
 if(!/^[a-fA-F0-9]{64}$/.test(expectedSHA))fail('expected SHA256');aborted(signal);
 const response=await fetch(url,{signal});if(!response.ok){try{await response.body?.cancel();}catch{/* preserve HTTP error */}throw new Error(`Terrain mesh asset HTTP ${response.status}`);}
 const contentLength=response.headers.get('content-length');
 if(contentLength!==null&&(!/^\d+$/.test(contentLength)||Number(contentLength)>TERRAIN_MESH_ASSET_MAX_BYTES)){
  try{await response.body?.cancel();}catch{/* preserve cap error */}fail('HTTP byte cap');
 }
 if(!response.body)throw new Error('Terrain mesh asset response has no stream');
 const reader=response.body.getReader(),prefix=new Uint8Array(HEADER_BYTES);let received=0,buffer:ArrayBuffer|undefined,output:Uint8Array<ArrayBuffer>|undefined;
 const cancel=()=>{void reader.cancel(signal?.reason).catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{
  for(;;){
   aborted(signal);const {done,value}=await reader.read();aborted(signal);if(done)break;
   if(!(value instanceof Uint8Array))fail('HTTP stream chunk');let at=0;
   if(!output){const n=Math.min(HEADER_BYTES-received,value.length);prefix.set(value.subarray(0,n),received);received+=n;at=n;
    if(received===HEADER_BYTES){const total=header(new DataView(prefix.buffer));buffer=new ArrayBuffer(total);output=new Uint8Array(buffer);output.set(prefix);}}
   if(output){const remaining=value.length-at;if(received+remaining>output.length)fail('HTTP trailing bytes');output.set(value.subarray(at),received);received+=remaining;}
  }
  if(!buffer||!output||received!==output.length)fail('HTTP truncated bytes');aborted(signal);
  const digest=await crypto.subtle.digest('SHA-256',buffer);aborted(signal);
  const actual=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  if(actual!==expectedSHA.toLowerCase())throw new Error('Terrain mesh asset SHA256 mismatch');return decodeTerrainMeshAsset(buffer);
 }catch(error){try{await reader.cancel(error);}catch{/* retain original failure */}throw error;}
 finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
}
