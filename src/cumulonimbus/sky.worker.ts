import {buildSky} from './skyModel';
import type {WeatherScene} from './weatherState';
self.onmessage=(event:MessageEvent<{key:string;scene:WeatherScene;side:number}>)=>{
 const {key,scene,side}=event.data;
 try{const result=buildSky(scene,side);self.postMessage({key,result},{transfer:[result.data.buffer]});}
 catch(error){self.postMessage({key,error:error instanceof Error?error.message:String(error)});}
};
