import {generateThunder,thunderPlan} from './storm';
/** Audio remains on the DOM thread even when drawing runs in OffscreenCanvas. */
export class ThunderAudio {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private buffers:AudioBuffer[]=[];
  private sources=new Set<AudioBufferSourceNode>();
  private enabled=false;
  private destroyed=false;
  async enable():Promise<void>{
    if(this.destroyed)throw new Error('Audio chiuso');
    if(!this.context){
      this.context=new AudioContext();
      this.master=this.context.createGain();this.master.gain.value=.65;
      const compressor=this.context.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=20;compressor.ratio.value=3;compressor.attack.value=.005;compressor.release.value=.4;
      this.master.connect(compressor);compressor.connect(this.context.destination);
    }
    const context=this.context;
    await context.resume();
    if(this.destroyed||this.context!==context)return;
    if(context.state!=='running')throw new Error('Il browser non ha attivato l’audio. Premi nuovamente Attiva audio.');
    // Prepared only after a gesture, never during a flash or per animation frame.
    if(!this.buffers.length)for(let i=0;i<4;i++){
      const pcm=generateThunder(22050,913+i*7919),buffer=context.createBuffer(2,pcm[0].length,22050);
      for(let c=0;c<2;c++)buffer.getChannelData(c).set(pcm[c]);this.buffers.push(buffer);
    }
    this.enabled=true;
  }
  play(seed:number,distance:number,emittedAt:number){
    if(!this.enabled||!this.context||this.context.state!=='running'||!this.master||!this.buffers.length)return;
    const context=this.context,plan=thunderPlan(distance,seed),source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),pan=context.createStereoPanner();
    source.buffer=this.buffers[seed%this.buffers.length];filter.type='lowpass';filter.frequency.value=plan.cutoff;filter.Q.value=.5;
    gain.gain.value=plan.gain;pan.pan.value=plan.pan;
    source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.master);
    this.sources.add(source);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();this.sources.delete(source);};
    source.start(context.currentTime+Math.max(0,plan.delay-(Date.now()-emittedAt)/1000));
  }
  cancel(){for(const source of this.sources){try{source.stop();}catch{/* Already ended. */}}this.sources.clear();}
  mute(){this.enabled=false;this.cancel();void this.context?.suspend().catch(()=>{});}
  destroy(){this.destroyed=true;this.mute();void this.context?.close().catch(()=>{});this.context=null;this.buffers=[];}
}
