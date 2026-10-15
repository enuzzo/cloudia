import {describe,it,expect,afterEach} from 'vitest';
import {groundIntersection,GROUND_LEVEL} from './landscape';
import {approachDistance,OrbitView} from './camera';
import {precipitationFootprint,precipitationSourceBounds,precipitationSurvival,RAIN_WIND_DISPLACEMENT_BOUND,VIRGA_FALL_DISTANCE,EVAPORATION_FADE} from './precipitation';
import {installPanelDismissal} from './panels';
describe('altitude, approach and rain source',()=>{
 it('places terrain four kilometres below the cloud datum, with a geometric horizon',()=>{
  expect(groundIntersection([0,3,0],[0,-1,0])).toBeCloseTo(7,5);
  expect(groundIntersection([0,3,0],[0,0,-1])).toBeNull();
  expect(groundIntersection([0,3,0],[0,1,0])).toBeNull();
 });
 it('stops outside the first visible density boundary and bounds zoom',()=>{
  const distance=approachDistance([0,0,0],[0,0,16],p=>Math.hypot(...p)<2?1:0);
  expect(distance).toBeGreaterThan(2);expect(distance).toBeLessThan(2.004);
  const view=new OrbitView();view.zoom(100);expect(view.approach).toBe(1);
  expect(view.frame([0,0,0],1,0,distance).distance).toBeCloseTo(distance);
  view.zoom(NaN);expect(view.approach).toBe(1);view.reset();expect(view.approach).toBe(0);
 });
 it('does not emit rain from an empty cloud and anchors rain below dense columns',()=>{
  const size=24,data=new Uint8Array(size**3*4);
  const empty=precipitationFootprint({size,data},size);
  expect(empty.filter((_,i)=>i%2===0).every(v=>v===0)).toBe(true);
  for(let z=8;z<16;z++)for(let y=4;y<8;y++)for(let x=8;x<16;x++)data[((z*size+y)*size+x)*4]=255;
  const map=precipitationFootprint({size,data},size);
  expect(map[(12*size+12)*2]).toBeGreaterThan(100);
  expect(map[0]).toBe(0);expect(map[(12*size+12)*2+1]/255*3-.5).toBeCloseTo(1.09,1);
 });
 it('keeps the base attached where the rain source is spatially filtered',()=>{
  const size=24,data=new Uint8Array(size**3*4);
  for(let y=4;y<8;y++)data[((12*size+y)*size+12)*4]=255;
  const map=precipitationFootprint({size,data},size),base=(x:number)=>map[(12*size+x)*2+1]/255*3-.5;
  expect(map[(12*size+14)*2]).toBeGreaterThan(0);
  expect(base(14)).toBeCloseTo(base(12),5);
  // The transparent texel next to the source also participates in GPU linear filtering.
  expect(map[(12*size+15)*2]).toBe(0);
  expect(base(15)).toBeCloseTo(base(12),5);
 });
 it('area filters compact cores between rain-map texel centres',()=>{
  const size=48,data=new Uint8Array(size**3*4);
  // A nearest-centre 48→12 lookup samples x/z=18 here and misses this column.
  for(let y=0;y<17;y++)data[((17*size+y)*size+17)*4]=255;
  const map=precipitationFootprint({size,data},12);
  expect(map[(4*12+4)*2]).toBeGreaterThan(0);
  expect(Math.abs(map[(4*12+4)*2+1]/255*3-.5-(-.5+.5/size*8.5))).toBeLessThanOrEqual(1.5/255);
 });
 it('does not turn diffuse density without a qualifying cloud base into rain',()=>{
  const size=12,data=new Uint8Array(size**3*4);
  for(let i=0;i<data.length;i+=4)data[i]=8;
  const map=precipitationFootprint({size,data},size);
  expect(map.filter((_,i)=>i%2===0).every(v=>v===0)).toBe(true);
 });
 it('reports no rain support for an empty strength channel regardless of height padding',()=>{
  const size=8,map=new Uint8Array(size*size*2);
  for(let i=1;i<map.length;i+=2)map[i]=255;
  expect(precipitationSourceBounds(map,size)).toBeNull();
 });
 it('includes the entire bilinear support around sparse rain texel centres',()=>{
  const size=8,map=new Uint8Array(size*size*2);
  map[(5*size+3)*2]=1;
  const bounds=precipitationSourceBounds(map,size)!;
  expect(bounds).toEqual([-5+2.5/size*10,-3.5+4.5/size*7,-5+4.5/size*10,-3.5+6.5/size*7]);
  // Samples remain positive beyond the occupied texel cell, almost one texel
  // from its centre. Neither side may be removed by the ray interval bounds.
  for(const dx of [-.999,.999])for(const dz of [-.999,.999]){
   const x=-5+(3.5+dx)/size*10,z=-3.5+(5.5+dz)/size*7;
   expect((1-Math.abs(dx))*(1-Math.abs(dz))).toBeGreaterThan(0);
   expect(x).toBeGreaterThan(bounds[0]);expect(x).toBeLessThan(bounds[2]);
   expect(z).toBeGreaterThan(bounds[1]);expect(z).toBeLessThan(bounds[3]);
  }
  map[(2*size+1)*2]=200;
  expect(precipitationSourceBounds(map,size)).toEqual([-5+.5/size*10,-3.5+1.5/size*7,bounds[2],bounds[3]]);
 });
 it('clips filtered rain support at the source domain edges',()=>{
  const size=8,map=new Uint8Array(size*size*2);
  map[(7*size)*2]=255;map[7*2]=255;
  expect(precipitationSourceBounds(map,size)).toEqual([-5,-3.5,5,3.5]);
 });
 it('conservatively bounds authored rain transport for either wind sign and every growth endpoint',()=>{
  const maxShear=Math.pow((2.5-.72)/6.2,1.5);
  expect((2.5+4.75)*.32+maxShear).toBeLessThan(RAIN_WIND_DISPLACEMENT_BOUND);
  const size=8,map=new Uint8Array(size*size*2);map[(5*size+3)*2]=255;
  const [minX,minZ,maxX,maxZ]=precipitationSourceBounds(map,size)!;
  const sourceCorners=[[minX+1e-8,minZ+1e-8],[minX+1e-8,maxZ-1e-8],[maxX-1e-8,minZ+1e-8],[maxX-1e-8,maxZ-1e-8]];
  for(const growthX of [1,1/.68])for(const growthY of [1,1/.88])for(const canonicalBase of [-.5,1.1,2.5]){
   const base=.72+(canonicalBase-.72)/growthX;
   for(const y of [-4.75,-4.65,.72,base+.299]){
    const beta=Math.max(0,base-y)*.32+Math.pow(Math.max(0,Math.min(1,(base-.72)/6.2)),1.5);
    for(const [wx,wz] of [[-.75,-.26],[-.75,.26],[.75,-.26],[.75,.26],[0,0]])for(const driftY of [-.015,.015]){
     const windBounds=[minX/growthY+Math.min(0,wx*RAIN_WIND_DISPLACEMENT_BOUND),minZ/growthY+Math.min(0,wz*RAIN_WIND_DISPLACEMENT_BOUND),maxX/growthY+Math.max(0,wx*RAIN_WIND_DISPLACEMENT_BOUND),maxZ/growthY+Math.max(0,wz*RAIN_WIND_DISPLACEMENT_BOUND)];
     for(const [sx,sz] of sourceCorners){
      const x=sx/growthY+wx*beta,z=sz/growthY+wz*beta;
      expect(x).toBeGreaterThanOrEqual(windBounds[0]);expect(x).toBeLessThanOrEqual(windBounds[2]);
      expect(z).toBeGreaterThanOrEqual(windBounds[1]);expect(z).toBeLessThanOrEqual(windBounds[3]);
      expect(y+driftY).toBeGreaterThanOrEqual(-4.75+driftY);expect(y+driftY).toBeLessThanOrEqual(2.8+driftY);
     }
    }
   }
  }
 });
 it('lets strong rain reach sea level while weak virga evaporates below its source',()=>{
  const base=1.1;
  expect(precipitationSurvival(GROUND_LEVEL,base,1,1)).toBe(1);
  expect(precipitationSurvival(GROUND_LEVEL,base,.1,.4)).toBe(0);
  expect(precipitationSurvival(base-VIRGA_FALL_DISTANCE,base,.1,.4)).toBe(0);
  expect(precipitationSurvival(base-VIRGA_FALL_DISTANCE+EVAPORATION_FADE,base,.1,.4)).toBe(1);
  expect(precipitationSurvival(base,base,0,1)).toBe(0);
  expect(precipitationSurvival(base,base,1,0)).toBe(0);
 });
 it('moves weak virga with the cloud base but keeps saturated rain tied to the world sea datum',()=>{
  const base=1.1,y=base-VIRGA_FALL_DISTANCE+EVAPORATION_FADE*.5,drift=.35;
  expect(precipitationSurvival(y+drift,base+drift,.1,.4)).toBeCloseTo(precipitationSurvival(y,base,.1,.4),12);
  expect(precipitationSurvival(GROUND_LEVEL,base+drift,1,1)).toBe(1);
 });
});
describe('panel dismissal',()=>{
 afterEach(()=>{document.body.innerHTML='';});
 it('retains inside clicks, dismisses outside clicks and restores summary focus with global Escape',()=>{
  document.body.innerHTML='<main><details open><summary>Nube</summary><input></details><canvas tabindex="0"></canvas></main>';
  const root=document.querySelector('main')!,panel=root.querySelector('details')!,events=new AbortController();
  installPanelDismissal(root,events.signal);
  root.querySelector('input')!.dispatchEvent(new Event('pointerdown',{bubbles:true}));expect(panel.open).toBe(true);
  root.querySelector('canvas')!.dispatchEvent(new Event('pointerdown',{bubbles:true}));expect(panel.open).toBe(false);
  panel.open=true;root.querySelector('canvas')!.focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(panel.open).toBe(false);expect(document.activeElement).toBe(root.querySelector('summary'));
  events.abort();panel.open=true;document.dispatchEvent(new Event('pointerdown',{bubbles:true}));expect(panel.open).toBe(true);
 });
});
