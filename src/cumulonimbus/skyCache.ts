import {buildSky,type SkyResult} from './skyModel';
import type {WeatherScene} from './weatherState';
export type {SkyResult} from './skyModel';
/** Exactly ten preset/side combinations; immutable CPU cache, lazy worker, no unbounded history. */
export class SkyCache {
 private cache=new Map<string,SkyResult>();
 private pending=new Map<string,{promise:Promise<SkyResult>;resolve:(v:SkyResult)=>void;reject:(e:Error)=>void}>();
 private worker:Worker|null=null;private closed=false;
 prime(scene:WeatherScene,side:number){const result=buildSky(scene,side);this.cache.set(`${scene}:${side}`,result);return result;}
 request(scene:WeatherScene,side:number):Promise<SkyResult>{
  if(this.closed)return Promise.reject(new Error('Sky cache closed'));
  const key=`${scene}:${side}`,hit=this.cache.get(key);if(hit)return Promise.resolve(hit);
  const running=this.pending.get(key);if(running)return running.promise;
  try{
   if(!this.worker){
    this.worker=new Worker(new URL('./sky.worker.ts',import.meta.url),{type:'module'});
    this.worker.onmessage=(e:MessageEvent<{key:string;result?:SkyResult;error?:string}>)=>{
     const item=this.pending.get(e.data.key);if(!item||this.closed)return;
     this.pending.delete(e.data.key);
     if(e.data.result){this.cache.set(e.data.key,e.data.result);item.resolve(e.data.result);}
     else item.reject(new Error(e.data.error??'Calcolo del cielo fallito'));
    };
    this.worker.onerror=()=>this.fail(new Error('Calcolo del cielo interrotto. Riprova lo scenario.'));
   }
   let resolve!:(v:SkyResult)=>void,reject!:(e:Error)=>void;
   const promise=new Promise<SkyResult>((yes,no)=>{resolve=yes;reject=no;});
   this.pending.set(key,{promise,resolve,reject});
   try{this.worker.postMessage({key,scene,side});}catch(error){this.fail(error instanceof Error?error:new Error(String(error)));}
   return promise;
  }catch(error){return Promise.reject(error);}
 }
 private fail(error:Error){this.worker?.terminate();this.worker=null;for(const p of this.pending.values())p.reject(error);this.pending.clear();}
 destroy(){this.closed=true;this.fail(new Error('Sky cache closed'));this.cache.clear();}
}
