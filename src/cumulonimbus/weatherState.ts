/** The same bounded intent model is used by manual controls and future tracking. */
export const WEATHER_SCENES = {
  clear: {label:'Sole',haze:1,overcast:0,rain:0,sunset:0},
  sunset: {label:'Tramonto',haze:1.6,overcast:0,rain:0,sunset:1},
  rain: {label:'Pioggia',haze:2.6,overcast:.85,rain:.8,sunset:0},
  storm: {label:'Temporale',haze:1.8,overcast:1,rain:.3,sunset:0},
  haze: {label:'Velato',haze:2.4,overcast:.15,rain:0,sunset:0},
} as const;
export type WeatherScene=keyof typeof WEATHER_SCENES;
export type AtmosphereIntent={type:'scene';scene:WeatherScene}|{type:'rain';amount:number};
export class WeatherState {
  scene:WeatherScene='storm';rain=0;targetRain:number=0;
  apply(intent:AtmosphereIntent){
    if(intent.type==='scene'&&intent.scene in WEATHER_SCENES){this.scene=intent.scene;this.targetRain=WEATHER_SCENES[intent.scene].rain;}
    if(intent.type==='rain'&&Number.isFinite(intent.amount))this.targetRain=Math.max(0,Math.min(1,intent.amount));
  }
  step(dt:number){this.rain+=(this.targetRain-this.rain)*(1-Math.exp(-Math.max(0,Math.min(1,dt))*1.2));}
}
