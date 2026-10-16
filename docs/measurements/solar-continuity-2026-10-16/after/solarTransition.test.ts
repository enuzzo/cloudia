import {afterEach,describe,expect,it,vi} from 'vitest';
import {Vector3} from 'three/webgpu';
import {GPUSceneEngine} from './GPUSceneEngine';
import {SKY_LUT_SIZE} from './atmosphere';
import {solarDirection} from './sun';
import {interpolateSolarDirection} from './solarTransition';
import type {SkyResult} from './skyCache';
import type {WeatherScene} from './weatherState';

interface Runtime {
  quad:object|null;side:number;skyMode:WeatherScene;skyPending:boolean;deviceLost:boolean;
  activeFlash:object|null;flashPreview:boolean;flash:{value:{w:number}};
  skyCache:{request:(scene:WeatherScene,side:number)=>Promise<SkyResult>;destroy:()=>void};
  sun:{value:Vector3};lightSide:{value:number};sunsetAmount:{value:number};
  solarColor:{value:Vector3};ambientColor:{value:Vector3};weather:{value:Vector3};
  skyData:Float32Array;skyFromData:Float32Array;atmosphereBlend:{value:number};
  applySky(result:SkyResult):void;advanceAtmosphere(dt:number):void;
}
interface Pending {scene:WeatherScene;side:number;resolve:(result:SkyResult)=>void;reject:(error:Error)=>void}
const engines:GPUSceneEngine[]=[];
afterEach(async()=>{vi.stubGlobal('cancelAnimationFrame',vi.fn());await Promise.all(engines.splice(0).map(engine=>engine.destroy()));vi.unstubAllGlobals();});
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function sky(side:number,sunset:number,value=1):SkyResult {
  return {side,sunset,data:new Float32Array(SKY_LUT_SIZE**2*4).fill(value),solar:[value,value*.9,value*.8],ambient:[value*.1,value*.2,value*.3],haze:value,overcast:value*.1};
}
function fixture(thread:'main'|'worker',low=false,profile=false){
  const engine=new GPUSceneEngine({canvas:document.createElement('canvas'),search:profile?'?profile=1':'',viewport:{width:1280,height:720,dpr:2},visible:true,thread,emit:()=>{}});
  engines.push(engine);
  const runtime=engine as unknown as Runtime,pending:Pending[]=[];
  runtime.skyMode=low?'sunset':'clear';runtime.applySky(sky(0,+low));runtime.quad={};
  runtime.skyCache={request:(scene,side)=>new Promise((resolve,reject)=>pending.push({scene,side,resolve,reject})),destroy:()=>{}};
  return {engine,runtime,pending};
}
function snapshot(runtime:Runtime){
  const blend=runtime.atmosphereBlend.value;
  return {sun:runtime.sun.value.toArray(),lightSide:runtime.lightSide.value,sunset:runtime.sunsetAmount.value,solar:runtime.solarColor.value.toArray(),ambient:runtime.ambientColor.value.toArray(),weather:runtime.weather.value.toArray(),sky:runtime.skyFromData[0]+(runtime.skyData[0]-runtime.skyFromData[0])*blend};
}
function sameDisplayed(actual:ReturnType<typeof snapshot>,expected:ReturnType<typeof snapshot>){
  for(const name of ['sun','solar','ambient','weather'] as const)for(let i=0;i<3;i++)expect(actual[name][i]).toBeCloseTo(expected[name][i],12);
  for(const name of ['lightSide','sunset'] as const)expect(actual[name]).toBeCloseTo(expected[name],12);
  expect(actual.sky).toBeCloseTo(expected.sky,6); // Interrupted LUT snapshots are Float32.
}

describe.each(['main','worker'] as const)('coherent solar transitions on the %s render host',thread=>{
  it.each([false,true])('holds displayed lighting while a side request is pending and starts continuously at its reply (low sun: %s)',async low=>{
    const {engine,runtime,pending}=fixture(thread,low),before=snapshot(runtime);
    engine.action('light');expect(runtime.side).toBe(1);expect(runtime.skyPending).toBe(true);
    sameDisplayed(snapshot(runtime),before);
    runtime.advanceAtmosphere(.2);sameDisplayed(snapshot(runtime),before);
    pending[0].resolve(sky(1,+low,2));await flush();
    expect(runtime.skyPending).toBe(false);sameDisplayed(snapshot(runtime),before);
    let previous=runtime.sun.value.clone(),maxStep=0;
    for(let i=1;i<=150;i++){
      runtime.advanceAtmosphere(1/60);
      maxStep=Math.max(maxStep,previous.angleTo(runtime.sun.value));previous.copy(runtime.sun.value);
      expect(runtime.sun.value.length()).toBeCloseTo(1,12);
      expect(runtime.sun.value.y).toBeCloseTo(before.sun[1],12);
      // Cache endpoint weight, sky radiance and colors share one fade clock.
      expect(runtime.lightSide.value).toBeCloseTo(runtime.atmosphereBlend.value,12);
      expect(runtime.solarColor.value.x).toBeCloseTo(1+runtime.atmosphereBlend.value,12);
    }
    expect(maxStep).toBeLessThan(2*Math.PI/180);
    expect(runtime.sun.value.toArray()).toEqual(solarDirection(1,low));
    expect(runtime.lightSide.value).toBe(1);expect(runtime.sunsetAmount.value).toBe(+low);
  });
  it('rejects an obsolete pending side reply when the command is reversed before it arrives',async()=>{
    const {engine,runtime,pending}=fixture(thread,true),before=snapshot(runtime);
    engine.action('light');engine.action('light');
    pending[0].resolve(sky(1,1,2));await flush();
    expect(runtime.skyPending).toBe(true);sameDisplayed(snapshot(runtime),before);
    pending[1].resolve(sky(0,1));await flush();
    expect(runtime.skyPending).toBe(false);sameDisplayed(snapshot(runtime),before);
    runtime.advanceAtmosphere(3);sameDisplayed(snapshot(runtime),before);
  });
  it('continues the current fade while a reversal is pending, then retargets the displayed direction and all light weights',async()=>{
    const {engine,runtime,pending}=fixture(thread,true);
    engine.action('light');pending[0].resolve(sky(1,1,3));await flush();runtime.advanceAtmosphere(.7);
    const atCommand=snapshot(runtime);engine.action('light');sameDisplayed(snapshot(runtime),atCommand);
    runtime.advanceAtmosphere(.35);const atReply=snapshot(runtime);
    expect(atReply.lightSide).toBeGreaterThan(atCommand.lightSide);
    pending[1].resolve(sky(0,1));await flush();sameDisplayed(snapshot(runtime),atReply);
    runtime.advanceAtmosphere(.5);
    expect(runtime.lightSide.value).toBeLessThan(atReply.lightSide);
    expect(runtime.sun.value.y).toBeCloseTo(solarDirection(0,true)[1],12);
    runtime.advanceAtmosphere(3);expect(runtime.sun.value.toArray()).toEqual(solarDirection(0,true));
    expect(runtime.lightSide.value).toBe(0);expect(runtime.solarColor.value.x).toBe(1);
  });
  it('retargets an interrupted scene and side blend from the displayed elevation, sunset weight and radiance',async()=>{
    const {engine,runtime,pending}=fixture(thread);
    engine.atmosphere({type:'scene',scene:'sunset'});pending[0].resolve(sky(0,1,3));await flush();runtime.advanceAtmosphere(.9);
    engine.action('light');const before=snapshot(runtime);
    pending[1].resolve(sky(1,1,2));await flush();sameDisplayed(snapshot(runtime),before);
    runtime.advanceAtmosphere(.8);const middle=snapshot(runtime);
    engine.atmosphere({type:'scene',scene:'clear'});pending[2].resolve(sky(1,0,4));await flush();sameDisplayed(snapshot(runtime),middle);
    runtime.advanceAtmosphere(3);expect(runtime.sun.value.toArray()).toEqual(solarDirection(1));
    expect(runtime.sunsetAmount.value).toBe(0);expect(runtime.lightSide.value).toBe(1);expect(runtime.solarColor.value.x).toBe(4);
  });
  it.each(['reset','probe-reference'])('keeps %s coherent while waiting for the left-side sky',async action=>{
    const {engine,runtime,pending}=fixture(thread,true,true);
    engine.action('light');pending[0].resolve(sky(1,1,2));await flush();runtime.advanceAtmosphere(.8);
    runtime.activeFlash={};runtime.flashPreview=true;runtime.flash.value.w=2;
    const before=snapshot(runtime);engine.action(action);sameDisplayed(snapshot(runtime),before);
    // Silence stops the flash immediately, without snapping sky radiance,
    // solar/ambient colors, haze or overcast to the pending scenario.
    expect(runtime.activeFlash).toBeNull();expect(runtime.flashPreview).toBe(false);expect(runtime.flash.value.w).toBe(0);
    const low=action==='reset';
    expect(runtime.side).toBe(0);expect(pending[1].side).toBe(0);expect(pending[1].scene).toBe(low?'sunset':'storm');
    pending[1].resolve(sky(0,+low));await flush();sameDisplayed(snapshot(runtime),before);
    runtime.advanceAtmosphere(3);expect(runtime.lightSide.value).toBe(0);
    expect(runtime.sun.value.toArray()).toEqual(solarDirection(0,low));expect(runtime.sunsetAmount.value).toBe(+low);
  });
  it('keeps the displayed state after a failed request and ignores a reply after device loss',async()=>{
    const {engine,runtime,pending}=fixture(thread),before=snapshot(runtime);
    engine.action('light');pending[0].reject(new Error('sky unavailable'));await flush();
    expect(runtime.skyPending).toBe(false);sameDisplayed(snapshot(runtime),before);
    engine.action('light');runtime.deviceLost=true;pending[1].resolve(sky(0,1,3));await flush();sameDisplayed(snapshot(runtime),before);
  });
});

describe('solar angular interpolation',()=>{
  it('takes the short azimuth path across the angular wrap and preserves exact endpoints',()=>{
    const angle=179*Math.PI/180,from=new Vector3(Math.sin(angle),.2,Math.cos(angle)).normalize(),to=new Vector3(-Math.sin(angle),.2,Math.cos(angle)).normalize(),out=new Vector3();
    interpolateSolarDirection(from,to,0,out);expect(out.toArray()).toEqual(from.toArray());
    interpolateSolarDirection(from,to,.5,out);expect(Math.abs(out.x)).toBeLessThan(1e-12);expect(out.z).toBeLessThan(0);expect(out.y).toBeCloseTo(from.y,12);
    interpolateSolarDirection(from,to,1,out);expect(out.toArray()).toEqual(to.toArray());
  });
});
