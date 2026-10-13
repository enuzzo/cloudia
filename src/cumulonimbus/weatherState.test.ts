import {describe,it,expect} from 'vitest';
import {WeatherState} from './weatherState';
describe('shared atmosphere intent',()=>{
 it('transitions precipitation and can interrupt a transition without jumping',()=>{
  const state=new WeatherState();state.apply({type:'scene',scene:'rain'});state.step(.5);
  expect(state.rain).toBeGreaterThan(0);expect(state.rain).toBeLessThan(.8);
  const previous=state.rain;state.apply({type:'scene',scene:'sunset'});expect(state.rain).toBe(previous);state.step(.5);expect(state.rain).toBeLessThan(previous);
 });
 it('ignores invalid intensities and clamps the public input',()=>{
  const state=new WeatherState();state.apply({type:'rain',amount:4});expect(state.targetRain).toBe(1);
  state.apply({type:'rain',amount:NaN});expect(state.targetRain).toBe(1);
  state.step(0);expect(state.rain).toBe(0);
 });
});
