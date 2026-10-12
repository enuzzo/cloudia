export interface Viewport {width:number;height:number;dpr:number}
export type RenderEvent=
 |{type:'text';field:'status'|'metrics'|'result';text:string}
 |{type:'statusState';state:'loading'|'loaded'|'failed'}
 |{type:'enabled';action:string;enabled:boolean}
 |{type:'layout';fixed:boolean}
 |{type:'state';paused:boolean;orbit:boolean;side:number}
 |{type:'report';report:Record<string,unknown>|null}
 |{type:'flash';seed:number;distance:number;delay:number;emittedAt:number}|{type:'silence'}|{type:'stormState';auto:boolean}
 |{type:'ready'}|{type:'closed'};
export type RenderCommand=
 |{type:'init';canvas:OffscreenCanvas;search:string;viewport:Viewport;visible:boolean}
 |{type:'action';action:string}|{type:'change';name:string;value:string}
 |{type:'resize';viewport:Viewport}|{type:'visibility';visible:boolean}|{type:'stop'};
export interface RenderHost {canvas:HTMLCanvasElement|OffscreenCanvas;search:string;viewport:Viewport;visible:boolean;thread:'main'|'worker';emit:(event:RenderEvent)=>void}
