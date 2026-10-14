import {BOUNDS_MIN,BOUNDS_SIZE,type DetailVolume} from './volume';
export const RAIN_MAP_SIZE=64;
/** Column source strength and actual lowest macro-cloud height, not a fixed ellipse. */
export function precipitationFootprint(volume:DetailVolume,size=RAIN_MAP_SIZE):Uint8Array{
 const data=new Uint8Array(size*size*2),raw=new Float32Array(size*size);
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const xx=Math.min(volume.size-1,Math.floor((x+.5)/size*volume.size)),zz=Math.min(volume.size-1,Math.floor((z+.5)/size*volume.size));
  let mass=0,base=2.5;
  for(let y=0;y<volume.size;y++){
   const height=BOUNDS_MIN[1]+(y+.5)/volume.size*BOUNDS_SIZE[1];if(height>2.5)break;
   const d=volume.data[((zz*volume.size+y)*volume.size+xx)*4]/255;
   if(d>.05)base=Math.min(base,height);
   mass+=d*BOUNDS_SIZE[1]/volume.size;
  }
  raw[z*size+x]=Math.min(1,mass*.85);
  data[(z*size+x)*2+1]=Math.round(Math.max(0,Math.min(1,(base+.5)/3))*255);
 }
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  let sum=0,weight=0;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
   const xx=x+dx,zz=z+dz,w=Math.exp(-(dx*dx+dz*dz)/2);
   if(xx>=0&&xx<size&&zz>=0&&zz<size)sum+=raw[zz*size+xx]*w;
   weight+=w;
  }
  data[(z*size+x)*2]=Math.round(sum/weight*255);
 }
 return data;
}
