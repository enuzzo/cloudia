import { describe,expect,it } from 'vitest';
import { conservativeEmptyStep,EMPTY_REFERENCE_MARGIN } from './emptyTraversal';
import { motionState,referencePosition,sourcePosition,THERMAL_DISPLACEMENT } from './motion';
import { bakeOccupancy,sampleDetail,BOUNDS_MIN,BOUNDS_SIZE,iceHeights } from './volume';

describe('conservative empty traversal',()=>{
  it('keeps the reference segment inside the proven halo through growth, shear and gusts',()=>{
    const step=7/384;
    for(const seed of [72,73,74,1571198069])for(const time of [0,8,20,28,32,37,52]){
      const state=motionState(time,seed),range=iceHeights(seed);
      for(const wind of [[0,0],[.75,.26],[-.75,-.26]]){
        const stride=conservativeEmptyStep(step,state,wind,range,6.3);
        expect(stride/step).toBeCloseTo(Math.round(stride/step),12);
        if(stride<=step)continue;
        // Probe the fast-changing ice transition, the full x extent and oblique rays.
        for(const x of [-6.3,-3,0,3,6.3])for(let y=range[0]-.2;y<range[1]+.2;y+=.073)
          for(const direction of [[1,0,0],[0,1,0],[.7,.7,.15],[-.2,.95,.25]]){
            const length=Math.hypot(...direction),p=[x,y,1.2];
            const a=referencePosition(p,state,range,wind);
            const b=referencePosition(p.map((v,i)=>v+direction[i]/length*(stride-step)),state,range,wind);
            for(let axis=0;axis<3;axis++)expect(Math.abs(b[axis]-a[axis])).toBeLessThan(EMPTY_REFERENCE_MARGIN[axis]);
          }
      }
    }
  });
  it('does not skip occupied baseline samples in sparse displaced volumes',()=>{
    const size=256,coarse=128,envelope={size,data:new Uint8Array(size**3*4)},detail={size:coarse,data:new Uint8Array(coarse**3*4)};
    const sites=[[128,80,128],[75,135,110],[166,155,168],[195,177,100],[40,119,55]];
    for(const [x,y,z] of sites)envelope.data[((z*size+y)*size+x)*4]=255;
    bakeOccupancy(envelope,detail,THERMAL_DISPLACEMENT);
    const coord=(p:readonly number[])=>p.map((v,i)=>(v-BOUNDS_MIN[i])/BOUNDS_SIZE[i]);
    const step=7/384,seed=1571198069,range=iceHeights(seed);let skips=0,occupied=0;
    for(const time of [28,32,52])for(const wind of [[.75,.26],[-.75,-.26]])for(const dispersion of [0,1]){
      const state={...motionState(time,seed),dispersion};
      const multiple=Math.round(conservativeEmptyStep(step,state,wind,range,6.3)/step);
      for(const [sx,sy,sz] of sites)for(const direction of [[1,.1,.2],[.2,.9,.1],[.2,.2,.95]]){
        const target=[sx,sy,sz].map((v,i)=>BOUNDS_MIN[i]+(v+.5)/size*BOUNDS_SIZE[i]);
        const length=Math.hypot(...direction),ray=direction.map(v=>v/length);
        for(let i=0;i<180;){
          const point=(j:number)=>target.map((v,a)=>v+ray[a]*(j-90)*step);
          const ref=coord(referencePosition(point(i),state,range,wind));
          const mask=sampleDetail(detail,ref[0],ref[1],ref[2],3,false);
          if(mask>0){const p=coord(sourcePosition(point(i),state,range,wind));if(sampleDetail(envelope,p[0],p[1],p[2],0,false)>0)occupied++;i++;continue;}
          for(let j=1;j<multiple&&i+j<180;j++){
            const p=coord(sourcePosition(point(i+j),state,range,wind));
            // Include the worst fine warp as well as the actual analytic flow.
            for(const sign of [-1,0,1]){
              const q=p.map((v,a)=>v+sign*[.08,.06,.08][a]/BOUNDS_SIZE[a]);
              expect(sampleDetail(envelope,q[0],q[1],q[2],0,false)).toBe(0);
            }
            skips++;
          }
          i+=multiple;
        }
      }
    }
    expect(skips).toBeGreaterThan(1000);expect(occupied).toBeGreaterThan(0);
  });
  it('accelerates mature windy clouds while retaining ordinary early and coarse sampling',()=>{
    const state=motionState(52,74),range=iceHeights(74);
    expect(conservativeEmptyStep(7/384,state,[.75,.26],range,6.3)).toBeCloseTo(3*7/384);
    expect(conservativeEmptyStep(7/384,motionState(0,74),[.75,.26],range,6.3)).toBeCloseTo(7/384);
    expect(conservativeEmptyStep(7/128,state,[.75,.26],range,6.3)).toBeCloseTo(7/128);
  });
});
