import {afterEach,describe,expect,it} from 'vitest';
import {CumulonimbusApp} from './CumulonimbusApp';
import {installPanelDismissal,refreshRangeOutputs} from './panels';
let app:CumulonimbusApp|undefined;
afterEach(()=>{app?.destroy();document.body.innerHTML='';history.replaceState(null,'','/');});
function setup(){const root=document.createElement('main');document.body.append(root);app=new CumulonimbusApp(root);return root;}
describe('observatory inspector',()=>{
 it('labels a pinned comparison camera even with complete shading and ignores it in ordinary mode',()=>{
  history.replaceState(null,'','/?profile=1&surface=.6045067691&target=.4296875,2.9365234375,0');const root=setup();
  const warning=root.querySelector<HTMLElement>('[data-testid=probe-warning]')!;
  expect(warning.hidden).toBe(false);expect(warning.textContent).toContain('Camera di confronto');
  expect(warning.textContent).toContain('mira fissa');
  app!.destroy();history.replaceState(null,'','/?surface=.6045067691');
  const ordinary=setup();expect(ordinary.querySelector<HTMLElement>('[data-testid=probe-warning]')!.hidden).toBe(true);
 });
 it('resets diagnostic slider readouts with the fixed reference state',()=>{
  history.replaceState(null,'','/?profile=1');const root=setup();
  for(const name of ['wind','dispersion','rain']){
   const input=root.querySelector<HTMLInputElement>(`[name=${name}]`)!;input.value='83';input.dispatchEvent(new Event('input',{bubbles:true}));
  }
  root.querySelector<HTMLButtonElement>('[data-action="probe-reference"]')!.click();
  for(const [name,value] of [['wind','55%'],['dispersion','0%'],['rain','0%']])expect(root.querySelector(`[name=${name}]`)!.closest('label')!.querySelector('output')!.textContent).toBe(value);
 });
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
 it('moves focus out of the previous panel when a tab is activated by click',()=>{
  const root=setup(),details=root.querySelector<HTMLDetailsElement>('.sky-inspector')!;details.open=true;
  root.querySelector<HTMLInputElement>('[name=wind]')!.focus();
  const next=root.querySelector<HTMLButtonElement>('#tab-atmosphere')!;next.click();
  expect(document.activeElement).toBe(next);
  expect(root.querySelector<HTMLElement>('#panel-cloud')!.hidden).toBe(true);
  expect(next.tabIndex).toBe(0);expect(root.querySelector<HTMLButtonElement>('#tab-cloud')!.tabIndex).toBe(-1);
 });
 it('lets a nested control handle Escape before dismissing the inspector',()=>{
  const root=setup(),details=root.querySelector<HTMLDetailsElement>('.sky-inspector')!;details.open=true;
  const input=root.querySelector<HTMLInputElement>('[name=wind]')!;input.focus();
  input.addEventListener('keydown',event=>event.preventDefault(),{once:true});
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  expect(details.open).toBe(true);expect(document.activeElement).toBe(input);
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  expect(details.open).toBe(false);expect(document.activeElement).toBe(details.querySelector('summary'));
 });
 it('closes the peer disclosure before opening another',()=>{
  const root=setup(),inspector=root.querySelector<HTMLDetailsElement>('.sky-inspector')!,hands=root.querySelector<HTMLDetailsElement>('.hands-guide')!;
  inspector.open=true;hands.querySelector('summary')!.click();
  expect(inspector.open).toBe(false);expect(hands.open).toBe(true);
  inspector.querySelector('summary')!.click();
  expect(hands.open).toBe(false);expect(inspector.open).toBe(true);
 });
 it('removes global disclosure dismissal listeners on teardown',()=>{
  const root=setup(),details=root.querySelector<HTMLDetailsElement>('.sky-inspector')!;details.open=true;
  app!.destroy();
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  expect(details.open).toBe(true);
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
 it('keeps every range explicitly associated with its label after repeated readout updates',()=>{
  const root=setup(),ranges=Array.from(root.querySelectorAll<HTMLInputElement>('input[type=range]'));
  const ids=ranges.map(input=>input.id);
  for(let refresh=0;refresh<3;refresh++){
   for(const input of ranges)input.value=String(20+refresh);
   refreshRangeOutputs(root);
   ranges.forEach((input,index)=>{
    const label=input.closest('label')!;
    expect(label.control).toBe(input);expect(label.htmlFor).toBe(input.id);expect(input.id).toBe(ids[index]);
    expect(Array.from(input.labels!)).toContain(label);
    expect(label.querySelectorAll('output')).toHaveLength(1);
    expect(label.querySelector('output')!.getAttribute('aria-hidden')).toBe('true');
    expect(label.querySelector('output')!.textContent).toBe(`${20+refresh}%`);
   });
  }
 });
 it('gives range controls distinct label targets across app instances',()=>{
  const root=setup(),otherRoot=document.createElement('main');document.body.append(otherRoot);
  const other=new CumulonimbusApp(otherRoot);
  try{
   const ranges=Array.from(document.querySelectorAll<HTMLInputElement>('input[type=range]'));
   expect(ranges).toHaveLength(root.querySelectorAll('input[type=range]').length*2);
   expect(new Set(ranges.map(input=>input.id)).size).toBe(ranges.length);
   for(const input of ranges)expect(input.closest('label')!.control).toBe(input);
  }finally{other.destroy();}
 });
 it('preserves one of every existing scene action and restricts ordinary quality to ultra',()=>{
  const root=setup();
  for(const action of ['pause','orbit','light','reset','new-cloud','center','gust','disperse','condense','mature','lightning','storm-auto','audio','flash-preview','benchmark','sustained','export'])expect(root.querySelectorAll(`[data-action="${action}"]`),action).toHaveLength(1);
  expect(root.querySelectorAll('[name=quality] option')).toHaveLength(1);
  expect(root.querySelector<HTMLSelectElement>('[name=quality]')!.value).toBe('ultra');
 });
});


describe('outside dismissal focus destination',()=>{
 function fixture(outside:string){
  const root=document.createElement('main');
  root.innerHTML=`<details open><summary>Regola</summary><input aria-label="Vento"></details><nav>${outside}</nav>`;
  document.body.append(root);
  const events=new AbortController();installPanelDismissal(root,events.signal);
  const panel=root.querySelector('details')!,summary=panel.querySelector('summary')!,input=panel.querySelector('input')!;
  input.focus();
  return {root,panel,summary,input,events};
 }
 it.each([
  '<span data-outside class="dock-divider"></span>',
  '<nav data-outside class="dock-padding"></nav>',
  '<button data-outside disabled>Misura</button>',
  '<fieldset disabled><button data-outside>Misura</button></fieldset>',
 ])('restores the disclosure trigger when the clicked surface cannot receive focus: %s',outside=>{
  const {root,panel,summary,events}=fixture(outside);
  try{
   const down=new Event('pointerdown',{bubbles:true,cancelable:true});
   root.querySelector('[data-outside]')!.dispatchEvent(down);
   expect(panel.open).toBe(false);expect(document.activeElement).toBe(summary);
   expect(down.defaultPrevented).toBe(true);
  }finally{events.abort();}
 });
 it.each([
  '<button data-outside>Sole</button>',
  '<button><svg data-outside aria-hidden="true"><path d="M0 0h1"/></svg></button>',
  '<a data-outside href="?legacy">Laboratorio</a>',
  '<input data-outside aria-label="Altro controllo">',
  '<select data-outside><option>Schermo</option></select>',
  '<details><summary data-outside>Mani</summary></details>',
  '<canvas data-outside tabindex="0"></canvas>',
  '<div data-outside tabindex="-1">Destinazione programmatica</div>',
 ])('leaves pointer focus to the actual interactive target without an intermediate jump: %s',outside=>{
  const {root,panel,summary,input,events}=fixture(outside);
  const originalFocus=summary.focus;let summaryFocusCalls=0;
  summary.focus=()=>{summaryFocusCalls++;};
  try{
   const down=new Event('pointerdown',{bubbles:true,cancelable:true});
   root.querySelector('[data-outside]')!.dispatchEvent(down);
   expect(panel.open).toBe(false);expect(summaryFocusCalls).toBe(0);
   expect(down.defaultPrevented).toBe(false);
   // dispatchEvent does not run native pointer focus; this asserts no competing focus call.
   expect(document.activeElement).toBe(input);
  }finally{summary.focus=originalFocus;events.abort();}
 });
 it('does not move focus that already belongs to another part of the interface',()=>{
  const {root,panel,events}=fixture('<input data-other aria-label="Altro"><span data-outside></span>');
  const other=root.querySelector<HTMLInputElement>('[data-other]')!;other.focus();
  try{
   const down=new Event('pointerdown',{bubbles:true,cancelable:true});
   root.querySelector('[data-outside]')!.dispatchEvent(down);
   expect(panel.open).toBe(false);expect(document.activeElement).toBe(other);
   expect(down.defaultPrevented).toBe(false);
  }finally{events.abort();}
 });
 it('does not dismiss or change focus after its listener is aborted',()=>{
  const {root,panel,input,events}=fixture('<span data-outside></span>');events.abort();
  root.querySelector('[data-outside]')!.dispatchEvent(new Event('pointerdown',{bubbles:true}));
  expect(panel.open).toBe(true);expect(document.activeElement).toBe(input);
 });
});
