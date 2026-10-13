/** Optical depth toward any finite nonzero light direction. Sweep the dominant
 * voxel-space axis, keeping the sheared ray plane bounded near the horizon.
 * Integrate parallel rays in a sheared light-space grid. Resample the accumulated
 * depth only when writing the world-space cache, rather than blurring it each row.
 */
export function bakeOpticalDepth(density:Float32Array,size:number,dimensions:readonly number[],direction:readonly number[],extinction:number): Float32Array {
  if(!Number.isInteger(size)||size<1||density.length!==size**3||dimensions.length!==3||dimensions.some(v=>!Number.isFinite(v)||v<=0)||direction.length!==3||direction.some(v=>!Number.isFinite(v))||!Number.isFinite(extinction)||extinction<0) throw new Error('Invalid optical-depth grid');
  const rates=direction.map((v,i)=>Math.abs(v)/dimensions[i]);
  const axis=rates.indexOf(Math.max(...rates));
  if(rates[axis]===0) throw new Error('Light direction must be nonzero');
  const others=[0,1,2].filter(i=>i!==axis),u=others[0],v=others[1];
  const major=Math.abs(direction[axis]),positive=direction[axis]>0;
  const strides=[1,size,size*size];
  const index=(x:number,y:number,z:number)=>x*strides[u]+(positive?y:size-1-y)*strides[axis]+z*strides[v];
  const dy=dimensions[axis]/size;
  const dx=direction[u]/major*dimensions[axis]/dimensions[u];
  const dz=direction[v]/major*dimensions[axis]/dimensions[v];
  const ds=dy*Math.hypot(...direction)/major*extinction;
  const offsetX=-Math.max(0,dx*size),offsetZ=-Math.max(0,dz*size);
  const width=Math.ceil(size+Math.abs(dx)*size)+2;
  const depth=Math.ceil(size+Math.abs(dz)*size)+2;
  const rays=new Float32Array(width*depth), result=new Float32Array(size**3);
  const plane=(x:number,z:number)=>x<0||x>=width||z<0||z>=depth?0:rays[z*width+x];
  for(let y=size-1;y>=0;y--) {
    const shiftX=offsetX+dx*(y+.5),shiftZ=offsetZ+dz*(y+.5);
    // Current rays contain only layers above this voxel center.
    for(let z=0;z<size;z++) for(let x=0;x<size;x++) {
      const u=x-shiftX,v=z-shiftZ,ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz;
      const upstream=plane(ix,iz)*(1-fx)*(1-fz)+plane(ix+1,iz)*fx*(1-fz)+plane(ix,iz+1)*(1-fx)*fz+plane(ix+1,iz+1)*fx*fz;
      const idx=index(x,y,z);
      result[idx]=upstream+density[idx]*ds*.5;
    }
    const sample=(x:number,z:number)=>x<0||x>=size||z<0||z>=size?0:density[index(x,y,z)];
    // Only rays overlapping this density layer need updating. Outside it, their
    // accumulated depth remains unchanged instead of disappearing or diffusing.
    const x0=Math.max(0,Math.floor(-shiftX)-1),x1=Math.min(width-1,Math.ceil(size-shiftX));
    const z0=Math.max(0,Math.floor(-shiftZ)-1),z1=Math.min(depth-1,Math.ceil(size-shiftZ));
    for(let z=z0;z<=z1;z++) for(let x=x0;x<=x1;x++) {
      const xx=x+shiftX,zz=z+shiftZ,ix=Math.floor(xx),iz=Math.floor(zz),fx=xx-ix,fz=zz-iz;
      const d=sample(ix,iz)*(1-fx)*(1-fz)+sample(ix+1,iz)*fx*(1-fz)+sample(ix,iz+1)*(1-fx)*fz+sample(ix+1,iz+1)*fx*fz;
      rays[z*width+x]+=d*ds;
    }
  }
  return result;
}
