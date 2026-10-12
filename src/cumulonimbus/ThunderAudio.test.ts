import {afterEach,it,expect,vi} from 'vitest';
import {ThunderAudio} from './ThunderAudio';
const param=()=>({value:0});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('requires enabling, schedules physical delay and stops pending audio when muted',async()=>{
  const starts:number[]=[],stops=vi.fn();
  const node=()=>({connect:vi.fn(),disconnect:vi.fn()});
  vi.spyOn(Date,'now').mockReturnValue(100000);
  vi.stubGlobal('AudioContext',class {
    state='suspended';currentTime=20;destination={};
    resume=async()=>{this.state='running';};suspend=async()=>{this.state='suspended';};close=vi.fn(async()=>{});
    createGain(){return {...node(),gain:param()};}
    createDynamicsCompressor(){return {...node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
    createBuffer(_channels:number,length:number){const channels=[new Float32Array(length),new Float32Array(length)];return {getChannelData:(i:number)=>channels[i]};}
    createBufferSource(){return {...node(),buffer:null,onended:null,start:(t:number)=>starts.push(t),stop:stops};}
    createBiquadFilter(){return {...node(),type:'lowpass',frequency:param(),Q:param()};}
    createStereoPanner(){return {...node(),pan:param()};}
  });
  const audio=new ThunderAudio();
  audio.play(17,3,99500);expect(starts).toEqual([]);
  await audio.enable();audio.play(17,3,99500);
  expect(starts[0]).toBeCloseTo(20+3000/343-.5,6);
  audio.mute();expect(stops).toHaveBeenCalledOnce();
  audio.play(18,3,100000);expect(starts).toHaveLength(1);
  audio.destroy();
});
