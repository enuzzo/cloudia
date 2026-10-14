import {describe,it,expect,vi,afterEach} from 'vitest';
import {SkyCache} from './skyCache';
const result={data:new Float32Array(4),solar:[1,1,1],ambient:[.1,.1,.1],sunset:1,haze:1.6,overcast:0,side:0};
afterEach(()=>vi.unstubAllGlobals());
describe('dedicated atmosphere worker cache',()=>{
 it('deduplicates in-flight work, reuses completed presets and terminates on cleanup',async()=>{
  let worker:any;vi.stubGlobal('Worker',class{onmessage:any;onerror:any;postMessage=vi.fn();terminate=vi.fn();constructor(){worker=this;}});
  const cache=new SkyCache(),a=cache.request('sunset',0),b=cache.request('sunset',0);
  expect(a).toBe(b);expect(worker.postMessage).toHaveBeenCalledOnce();
  worker.onmessage({data:{key:'sunset:0',result}});expect(await a).toBe(result);expect(await cache.request('sunset',0)).toBe(result);
  expect(worker.postMessage).toHaveBeenCalledOnce();cache.destroy();expect(worker.terminate).toHaveBeenCalledOnce();
 });
 it('rejects pending work on failure and permits a fresh worker on retry',async()=>{
  const workers:any[]=[];vi.stubGlobal('Worker',class{onmessage:any;onerror:any;postMessage=vi.fn();terminate=vi.fn();constructor(){workers.push(this);}});
  const cache=new SkyCache(),pending=cache.request('rain',1),check=expect(pending).rejects.toThrow('interrotto');
  workers[0].onerror();await check;
  const retry=cache.request('sunset',0);workers[1].onmessage({data:{key:'sunset:0',result}});expect(await retry).toBe(result);cache.destroy();
 });
 it('rejects requests after teardown and discards late results',async()=>{
  let worker:any;vi.stubGlobal('Worker',class{onmessage:any;postMessage=vi.fn();terminate=vi.fn();constructor(){worker=this;}});
  const cache=new SkyCache(),promise=cache.request('clear',0),check=expect(promise).rejects.toThrow('closed');
  cache.destroy();await check;worker.onmessage({data:{key:'clear:0',result}});
  await expect(cache.request('clear',0)).rejects.toThrow('closed');
 });
});
