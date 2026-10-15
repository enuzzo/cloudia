import {it,expect,vi,afterEach} from 'vitest';
import {OrbitPointerController} from './camera';
import {installPanelDismissal} from './panels';
afterEach(()=>{vi.restoreAllMocks();document.body.replaceChildren();});
function pointer(canvas:HTMLCanvasElement,type:string,id:number,x:number,y:number,init:{button?:number;isPrimary?:boolean}={}){
 const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:id,button:0,clientX:x,clientY:y,isPrimary:true,...init});canvas.dispatchEvent(e);return e;
}
it('moves focus from a dismissed inspector to the canvas so the next key rotates the view',()=>{
 const root=document.createElement('main');root.innerHTML='<details open><summary>Regola</summary><input aria-label="Vento"></details><canvas tabindex="0"></canvas>';document.body.append(root);
 const panel=root.querySelector('details')!,input=root.querySelector('input')!,canvas=root.querySelector('canvas')!,rotate=vi.fn();
 const dismissal=new AbortController();installPanelDismissal(root,dismissal.signal);
 vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({width:800,height:600} as DOMRect);
 const focus=vi.spyOn(canvas,'focus'),controller=new OrbitPointerController(canvas,rotate,vi.fn());
 try{
  input.focus();expect(document.activeElement).toBe(input);
  const down=pointer(canvas,'pointerdown',4,10,20);pointer(canvas,'pointerup',4,10,20);
  expect(panel.open).toBe(false);expect(down.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(canvas);expect(focus).toHaveBeenCalledWith({preventScroll:true});
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
  expect(rotate).toHaveBeenCalledWith(-36,0,800,600);
 }finally{controller.destroy();dismissal.abort();}
});
it('does not steal focus for right, non-primary, already active or destroyed pointer input',()=>{
 const input=document.createElement('input'),canvas=document.createElement('canvas');canvas.tabIndex=0;document.body.append(input,canvas);
 const focus=vi.spyOn(canvas,'focus'),controller=new OrbitPointerController(canvas,vi.fn(),vi.fn());
 input.focus();
 pointer(canvas,'pointerdown',1,10,20,{button:2});pointer(canvas,'pointerdown',2,10,20,{isPrimary:false});
 expect(document.activeElement).toBe(input);expect(focus).not.toHaveBeenCalled();expect(canvas.classList.contains('dragging')).toBe(false);
 pointer(canvas,'pointerdown',3,10,20);expect(document.activeElement).toBe(canvas);expect(focus).toHaveBeenCalledOnce();
 input.focus();pointer(canvas,'pointerdown',4,10,20);expect(document.activeElement).toBe(input);expect(focus).toHaveBeenCalledOnce();
 controller.destroy();pointer(canvas,'pointerdown',5,10,20);
 expect(document.activeElement).toBe(input);expect(focus).toHaveBeenCalledOnce();expect(canvas.classList.contains('dragging')).toBe(false);
});
it('captures one drag, ignores foreign pointers and ends on cancellation',()=>{
 const canvas=document.createElement('canvas'),rotate=vi.fn(),center=vi.fn();
 vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({width:800,height:600} as DOMRect);
 const controller=new OrbitPointerController(canvas,rotate,center);
 pointer(canvas,'pointerdown',4,10,20);pointer(canvas,'pointermove',5,100,200);expect(rotate).not.toHaveBeenCalled();
 pointer(canvas,'pointermove',4,40,55);expect(rotate).toHaveBeenCalledWith(30,35,800,600);
 pointer(canvas,'pointercancel',4,40,55);pointer(canvas,'pointermove',4,100,200);expect(rotate).toHaveBeenCalledOnce();
 controller.destroy();
});
it('offers keyboard recenter and removes listeners during teardown',()=>{
 const canvas=document.createElement('canvas'),rotate=vi.fn(),center=vi.fn();
 vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({width:800,height:600} as DOMRect);
 const controller=new OrbitPointerController(canvas,rotate,center);
 canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp'}));canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Home'}));
 expect(rotate).toHaveBeenCalledWith(0,-36,800,600);expect(center).toHaveBeenCalledOnce();controller.destroy();
 canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft'}));expect(rotate).toHaveBeenCalledOnce();
});
