import {describe,it,expect,afterEach} from 'vitest';
import {groundIntersection} from './landscape';
import {approachDistance,OrbitView} from './camera';
import {precipitationFootprint} from './precipitation';
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
