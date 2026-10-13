export interface Flash {seed:number;distance:number;start:number;position:number[];channel:number[][];branch:number[];pulses:Array<{at:number;width:number;strength:number}>;duration:number}
function random(seed:number){return ()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
export function createFlash(seed:number,distance:number,start:number,geometry:{height:number;centerX:number}={height:1,centerX:0}):Flash{
  const rng=random(seed),pulses:Flash['pulses']=[];let at=0;
  const count=3+Math.floor(rng()*3);
  for(let i=0;i<count;i++){
    pulses.push({at,width:.025+rng()*.055,strength:i===0?1:.35+rng()*.6});
    at+=.065+rng()*.13;
  }
  const height=Math.max(.4,Math.min(1.2,geometry.height));
  const position=[geometry.centerX-.65+rng()*1.2,.72+(2.5+rng()*1.8-.72)*height,.25+rng()*.55];
  const bend=.23+rng()*.24;
  const channel=[
    [position[0]-.35,position[1]+.85*height,position[2]-.15],
    [...position],
    [position[0]+bend,position[1]-.45*height,position[2]-.18],
    [position[0]-.24,position[1]-1.1*height,position[2]+.12],
  ];
  const branch=[channel[2][0]+.55+rng()*.3,channel[2][1]+.18*height,channel[2][2]+.2];
  return {seed,distance,start,position,channel,branch,pulses,duration:at+.22};
}
export function flashIntensity(f:Flash,time:number):number{
  const age=time-f.start;if(age<0||age>f.duration)return 0;
  let light=0;
  for(const p of f.pulses){const t=age-p.at;if(t>=0&&t<p.width+.12)light+=p.strength*(1-Math.exp(-t/.002))*Math.exp(-t/(p.width*.4));}
  return Math.min(1.4,light);
}
export function thunderPlan(distance:number,seed:number){
  const d=Math.max(.1,Math.min(12,distance)),rng=random(seed);
  return {delay:d*1000/343,cutoff:Math.max(240,2200/(1+d*.7)),gain:.55/(1+d*.2),pan:(rng()-.5)*.65};
}
/** Ten-second stereo procedural source: distributed channel arrivals, low-frequency
 * resonances and decorrelated filtered noise. Distance filtering happens in Web Audio. */
export function generateThunder(sampleRate:number,seed:number):[Float32Array,Float32Array]{
  const length=Math.round(sampleRate*10),channels:[Float32Array,Float32Array]=[new Float32Array(length),new Float32Array(length)];
  for(let c=0;c<2;c++){
    const rng=random(seed+c*513),lobes=Array.from({length:7},(_,i)=>({at:i===0?0:.25+rng()*4.4,width:.3+rng()*1.7,gain:i===0?1:.12+rng()*.35}));
    let low=0,deep=0;
    for(let i=0;i<length;i++){
      const t=i/sampleRate,white=rng()*2-1;low+=.085*(white-low);deep+=.012*(white-deep);
      let envelope=0;for(const l of lobes){const u=t-l.at;if(u>=0)envelope+=l.gain*(1-Math.exp(-u/.016))*Math.exp(-u/l.width);}
      const onset=(1-Math.exp(-t/.007)),tail=Math.min(1,(10-t)/.6);
      const resonance=.08*Math.sin(t*2*Math.PI*37+.2*c)*Math.exp(-t/1.8)+.04*Math.sin(t*2*Math.PI*61)*Math.exp(-t/2.4);
      channels[c][i]=Math.max(-1,Math.min(1,(low*2.4+deep*4+white*.12*Math.exp(-t/.09)+resonance)*envelope*onset*tail));
    }
  }
  return channels;
}
