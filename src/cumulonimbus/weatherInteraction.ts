export type WeatherImpulse={type:'gust'|'disperse'|'condense'|'lightning';strength?:number};
export function nextMorphologySeed(random:number,previous:number,family=(previous%3+1)%3):number{
 const value=Math.max(0,Math.min(0xfffffffc,Math.floor(random)));
 return Math.floor(value/3)*3+Math.max(0,Math.min(2,Math.floor(family)));
}
/** Smooth, bounded forcing shared by pointer controls and future hand input. */
export class DispersalState {
 amount=0;private target=0;private releaseAt:number|null=null;
 set(strength:number){if(!Number.isFinite(strength))return;this.target=Math.max(0,Math.min(1,strength));this.releaseAt=null;}
 burst(now:number,strength=1){this.set(strength);this.releaseAt=now+3.5;}
 recover(){this.target=0;this.releaseAt=null;}
 step(dt:number,now:number){
  if(this.releaseAt!==null&&now>=this.releaseAt)this.recover();
  const step=Math.max(0,Math.min(1,dt));this.amount+=(this.target-this.amount)*(1-Math.exp(-step*(this.target>this.amount?1.9:.65)));
 }
}
