import {GPUSceneEngine} from './GPUSceneEngine';
import type {RenderCommand,RenderEvent} from './renderProtocol';
let engine:GPUSceneEngine|null=null;
const emit=(event:RenderEvent)=>self.postMessage(event);
self.onmessage=(event:MessageEvent<RenderCommand>)=>{
  const message=event.data;
  if(message.type==='init'){
    if(typeof requestAnimationFrame!=='function'){emit({type:'text',field:'status',text:'Il worker non espone requestAnimationFrame. Usa la versione ordinaria senza ?worker=1.'});emit({type:'statusState',state:'failed'});return;}
    engine=new GPUSceneEngine({canvas:message.canvas,search:message.search,viewport:message.viewport,visible:message.visible,thread:'worker',emit});void engine.start();return;
  }
  if(message.type==='action')engine?.action(message.action);
  if(message.type==='change')engine?.change(message.name,message.value);
  if(message.type==='rotate')engine?.rotate(message.dx,message.dy,message.width,message.height);
  if(message.type==='impulse')engine?.impulse(message.impulse);
  if(message.type==='resize')engine?.resize(message.viewport);
  if(message.type==='visibility')engine?.visibility(message.visible);
  if(message.type==='stop'){const closing=engine;engine=null;void (closing?.destroy()??Promise.resolve()).finally(()=>{emit({type:'closed'});self.close();});}
};
