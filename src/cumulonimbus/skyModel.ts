import {fillSkyLUT,SKY_LUT_SIZE,atmosphereLighting} from './atmosphere';
import {WEATHER_SCENES,type WeatherScene} from './weatherState';
import {solarDirection} from './sun';
export interface SkyResult {data:Float32Array;solar:number[];ambient:number[];sunset:number;haze:number;overcast:number;side:number}
export function buildSky(scene:WeatherScene,side:number):SkyResult {
 const p=WEATHER_SCENES[scene],sun=solarDirection(side,!!p.sunset),data=new Float32Array(SKY_LUT_SIZE**2*4);
 fillSkyLUT(data,sun,p.haze,p.overcast);
 return {data,...atmosphereLighting(sun,p.haze,p.overcast),sunset:p.sunset,haze:p.haze,overcast:p.overcast,side};
}
