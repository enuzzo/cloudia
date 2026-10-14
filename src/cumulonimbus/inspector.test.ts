import {afterEach,describe,expect,it} from 'vitest';
import {CumulonimbusApp} from './CumulonimbusApp';
let app:CumulonimbusApp|undefined;
afterEach(()=>{app?.destroy();document.body.innerHTML='';});
function setup(){const root=document.createElement('main');document.body.append(root);app=new CumulonimbusApp(root);return root;}
describe('observatory inspector',()=>{
 it('supports tab keys, isolates inactive controls and preserves the tab when reopened',()=>{
  const root=setup(),details=root.querySelector<HTMLDetailsElement>('.sky-inspector')!;
  details.open=true;
  const tabs=Array.from(root.querySelectorAll<HTMLButtonElement>('[role=tab]'));
  tabs[0].focus();tabs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  expect(document.activeElement).toBe(tabs[1]);expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  expect(root.querySelector<HTMLElement>('#panel-cloud')!.hidden).toBe(true);
  expect(root.querySelector<HTMLElement>('#panel-atmosphere')!.hidden).toBe(false);
  tabs[1].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));expect(document.activeElement).toBe(tabs[2]);
  tabs[2].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));expect(document.activeElement).toBe(tabs[0]);
  tabs[2].click();root.querySelector<HTMLButtonElement>('[aria-label="Chiudi regolazioni"]')!.click();
  expect(details.open).toBe(false);expect(document.activeElement).toBe(details.querySelector('summary'));
  details.open=true;expect(tabs[2].getAttribute('aria-selected')).toBe('true');
 });
 it('does not close on inspector controls, dismisses on canvas and supports global Escape',()=>{
  const root=setup(),details=root.querySelector<HTMLDetailsElement>('.sky-inspector')!;details.open=true;
  root.querySelector('[name=wind]')!.dispatchEvent(new Event('pointerdown',{bubbles:true}));expect(details.open).toBe(true);
  root.querySelector('canvas')!.dispatchEvent(new Event('pointerdown',{bubbles:true}));expect(details.open).toBe(false);
  details.open=true;document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(details.open).toBe(false);expect(document.activeElement).toBe(details.querySelector('summary'));
 });
 it('keeps visible range values in sync after input and weather selection',()=>{
  const root=setup(),wind=root.querySelector<HTMLInputElement>('[name=wind]')!;
  wind.value='73';wind.dispatchEvent(new Event('input',{bubbles:true}));
  expect(wind.closest('label')!.querySelector('output')!.textContent).toBe('73%');
  root.querySelector<HTMLButtonElement>('[data-scene=rain]')!.click();
  const rain=root.querySelector<HTMLInputElement>('[name=rain]')!;
  expect(rain.closest('label')!.querySelector('output')!.textContent).toBe(`${Math.round(Number(rain.value))}%`);
  expect(root.querySelector('[data-scene=rain]')!.getAttribute('aria-pressed')).toBe('true');
 });
 it('preserves one of every existing scene action and restricts ordinary quality to ultra',()=>{
  const root=setup();
  for(const action of ['pause','orbit','light','reset','new-cloud','center','gust','disperse','condense','mature','lightning','storm-auto','audio','flash-preview','benchmark','sustained','export'])expect(root.querySelectorAll(`[data-action="${action}"]`),action).toHaveLength(1);
  expect(root.querySelectorAll('[name=quality] option')).toHaveLength(1);
  expect(root.querySelector<HTMLSelectElement>('[name=quality]')!.value).toBe('ultra');
 });
});
