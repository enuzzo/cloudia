import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OrbitView} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/camera.ts';
import {clampCameraAboveLandscape,terrainHeight} from '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/landscape.ts';
import {TerrainBounds} from '../terrain-bounds/bounds.ts';
import {tracePacked} from './packed-trace.ts';
import {PackedLookup,type PackedTerrain} from './data.ts';
const dir=new URL('./',import.meta.url),sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const desc=JSON.parse(readFileSync(new URL('terrain-32km-descriptor.json',dir),'utf8')),binary=readFileSync(new URL(desc.binary,dir));if(sha(binary)!==desc.binarySha256)throw Error('Metadata hash mismatch');
const bytes=new Uint8Array(binary),floats=new Float32Array(bytes.buffer),nodes=new Array(desc.nodeCount).fill(null),pack={...desc,nodes,data:floats} as unknown as PackedTerrain,lookup=new PackedLookup(pack),builder=new TerrainBounds();
const matrix=JSON.parse(readFileSync(new URL('../terrain-bounds/matrix14.json',dir),'utf8'));
const norm=(a:number[])=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const rows=27,cols=48,aspect=16/9,tanFov=.2867;
const configs=[{name:'home-down',target:[-.28995623264629566,2.4981598424383944,-.02734375],yaw:Math.PI/2,pitch:.2,approach:0},{name:'level-sea-miss',target:[0,-3,0],yaw:Math.PI/2,pitch:0,approach:0},{name:'low-clamped-up',target:[-.28995623264629566,2.4981598424383944,-.02734375],yaw:0,pitch:-.92,approach:0},{name:'coastal-horizon',target:[0,2.5,0],yaw:Math.PI/2,pitch:0,approach:0}];
const rays:any[]=matrix.poses.map((p:any)=>({...p,group:'matrix14'}));
for(const c of configs){const view=new OrbitView();view.yaw=c.yaw;view.pitch=c.pitch;view.approach=c.approach;const frame=view.frame(c.target,aspect,0,.4),origin=clampCameraAboveLandscape(frame.origin),forward=norm(c.target.map((v,i)=>v-origin[i])),right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward));
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const uv=[(x+.5)/cols,(y+.5)/rows],sx=uv[0]*2-1,sy=1-uv[1]*2-.16,ray=norm(forward.map((v,i)=>v+right[i]*sx*aspect*tanFov+up[i]*sy*tanFov));rays.push({name:`${c.name}-${x}-${y}`,group:c.name,grid:[x,y],uv,origin,ray});}
}
// CPU oracle at exactly the f32 ray inputs sent to GPU. No cloud bake.
let i=0;for(const r of rays){r.index=i++;r.origin=r.origin.map(Math.fround);r.ray=r.ray.map(Math.fround);const result=tracePacked(r,builder,lookup,{budget:256,maxHeightEvaluations:16,stackCapacity:48});r.cpu={status:result.status,interval:result.interval??null,enclosureKm:result.enclosureKm??null,visits:result.visits,heightCalls:result.heightEvaluations,witness:result.witness??null,relief:result.relief,sea:result.sea};}
const rectangles:any[]=[];
function rect(x:number,z:number,size:number,label:string){const q={x0:Math.fround(x),x1:Math.fround(x+size),z0:Math.fround(z),z1:Math.fround(z+size)};const raw=builder.evaluate(q).height;const points=[];for(let j=0;j<9;j++){const xx=Math.fround(q.x0+(q.x1-q.x0)*(j%3)/2),zz=Math.fround(q.z0+(q.z1-q.z0)*Math.floor(j/3)/2);points.push({x:xx,z:zz,h:terrainHeight(xx,zz)});}rectangles.push({...q,label,cpuBounds:raw,metadataEnvelope:[Math.max(0,raw[0]-.02),raw[1]+.02],cpuPoints:points});}
for(const r of rays.slice(0,14))if(r.cpu.interval){const t=r.cpu.interval[0],x=r.origin[0]+r.ray[0]*t,z=r.origin[2]+r.ray[2]*t;for(const s of [0,.001,.0625,1])rect(x,z,s,`matrix-hit-${r.index}-${s}`);}
for(const x of [-32,-24,-16,-1,0,1,2,16,24,32])for(const z of [-128,-70,-69.8131700798,-1,0,1,69.8131700798,70,128])for(const s of [.0001,.25])rect(x,z,s,'negative-coast-boundary');
for(const x of [-512,-256,-32,0,32,256])for(const z of [-512,-128,0,128,256])rect(x,z,32,'coarse-world');
const rayData=new Float32Array(rays.length*8);rays.forEach((r,i)=>rayData.set([...r.origin,1,...r.ray,0],i*8));const rectData=new Float32Array(rectangles.length*4);rectangles.forEach((r,i)=>rectData.set([r.x0,r.x1,r.z0,r.z1],i*4));
writeFileSync(new URL('audit-rays.f32.bin',dir),new Uint8Array(rayData.buffer));writeFileSync(new URL('audit-rectangles.f32.bin',dir),new Uint8Array(rectData.buffer));
const result={sourceSha256:desc.sourceSha256,metadataDescriptor:'terrain-32km-descriptor.json',matrixCount:14,grid:{cols,rows,aspect,tanFov,inspection:0,configs},rays,rectangles,rayBinary:{path:'audit-rays.f32.bin',bytes:rayData.byteLength,sha256:sha(new Uint8Array(rayData.buffer))},rectangleBinary:{path:'audit-rectangles.f32.bin',bytes:rectData.byteLength,sha256:sha(new Uint8Array(rectData.buffer))},CPUStatuses:rays.reduce((a:any,r:any)=>{a[r.cpu.status]=(a[r.cpu.status]??0)+1;return a;},{}),perGroupCPU:rays.reduce((a:any,r:any)=>{a[r.group]??={};a[r.group][r.cpu.status]=(a[r.group][r.cpu.status]??0)+1;return a;},{})};
writeFileSync(new URL('audit-cases.json',dir),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({rays:rays.length,rectangles:rectangles.length,CPUStatuses:result.CPUStatuses,perGroupCPU:result.perGroupCPU},null,2));
