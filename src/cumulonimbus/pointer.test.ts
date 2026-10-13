import {it,expect,vi} from 'vitest';
import {OrbitPointerController} from './camera';
function pointer(canvas:HTMLCanvasElement,type:string,id:number,x:number,y:number){const e=new Event(type);Object.assign(e,{pointerId:id,button:0,clientX:x,clientY:y,isPrimary:true});canvas.dispatchEvent(e);}
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
