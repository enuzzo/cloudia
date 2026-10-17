import {afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import {ClampToEdgeWrapping,HalfFloatType,LinearFilter,LinearMipmapLinearFilter,NoColorSpace,RGBAFormat} from 'three/webgpu';
import {
 decodeTerrainOptical,loadTerrainOptical,TERRAIN_OPTICAL_BYTES,TERRAIN_OPTICAL_SHA256,TERRAIN_OPTICAL_SIDE,
} from './terrainOptical';

function deferred<T>(){
 let resolve!:(value:T)=>void;
 const promise=new Promise<T>(finish=>{resolve=finish;});
 return {promise,resolve};
}

function pinnedDigest():ArrayBuffer{
 if(!/^[a-f0-9]{64}$/.test(TERRAIN_OPTICAL_SHA256))throw new Error('Missing immutable optical SHA');
 return Uint8Array.from(TERRAIN_OPTICAL_SHA256.match(/../g)!,value=>Number.parseInt(value,16)).buffer;
}

function harness(chunks:Uint8Array[],status=200){
 let cursor=0;
 const reader={
  read:vi.fn(async():Promise<ReadableStreamReadResult<Uint8Array>>=>cursor<chunks.length?{done:false,value:chunks[cursor++]}:{done:true,value:undefined}),
  cancel:vi.fn(async()=>{}),releaseLock:vi.fn(),
 };
 const body={getReader:vi.fn(()=>reader),cancel:vi.fn(async()=>{})};
 const response={ok:status>=200&&status<300,status,body} as unknown as Response;
 const fetchMock=vi.fn(async()=>response),digest=vi.fn(async()=>pinnedDigest());
 vi.stubGlobal('fetch',fetchMock);vi.stubGlobal('crypto',{subtle:{digest}});
 return {reader,body,response,fetchMock,digest};
}

let validBytes:Uint8Array;
beforeAll(()=>{
 validBytes=new Uint8Array(TERRAIN_OPTICAL_BYTES);
 new Uint16Array(validBytes.buffer).set([0x3000,0x3400,0x3800,0x3c00]);
});
afterEach(()=>vi.unstubAllGlobals());

describe('pinned premultiplied optical terrain data',()=>{
 it('pins the 2048-square half-float payload and keeps its LE words in the same buffer',()=>{
  expect(TERRAIN_OPTICAL_SIDE).toBe(2048);expect(TERRAIN_OPTICAL_BYTES).toBe(2048*2048*4*2);
  expect(TERRAIN_OPTICAL_SHA256).toMatch(/^[a-f0-9]{64}$/);
  const words=decodeTerrainOptical(validBytes.buffer as ArrayBuffer);
  expect(words.buffer).toBe(validBytes.buffer);expect(words.byteOffset).toBe(0);
  expect(Array.from(words.subarray(0,4))).toEqual([0x3000,0x3400,0x3800,0x3c00]);
  expect(Array.from(words.subarray(-4))).toEqual([0,0,0,0]);
 });

 it('rejects every unexpected byte count',()=>{
  for(const count of [0,8,TERRAIN_OPTICAL_BYTES-1,TERRAIN_OPTICAL_BYTES+1]){
   expect(()=>decodeTerrainOptical(new ArrayBuffer(count))).toThrow('Dimensioni');
  }
 });

 it.each([
  ['negative red',0,0x8001],['negative zero red',0,0x8000],['infinite green',1,0x7c00],['NaN blue',2,0x7e00],
  ['above-one red',0,0x3c01],['negative alpha',3,0xb800],['negative zero alpha',3,0x8000],
  ['infinite alpha',3,0x7c00],['NaN alpha',3,0x7e00],['above-one alpha',3,0x3c01],
 ] as const)('rejects %s without a second float payload',(_label,index,word)=>{
  const words=new Uint16Array(validBytes.buffer),old=words[index];words[index]=word;
  try{expect(()=>decodeTerrainOptical(validBytes.buffer as ArrayBuffer)).toThrow(/non valid/);}finally{words[index]=old;}
 });

 it('rejects unpremultiplied RGB and invalid colour at zero validity, including the final cell',()=>{
  const words=new Uint16Array(validBytes.buffer),last=words.length-4;
  words[last]=1;
  try{expect(()=>decodeTerrainOptical(validBytes.buffer as ArrayBuffer)).toThrow('RGB premoltiplicato');}finally{words[last]=0;}
  const alpha=words[3];words[3]=0x3400;
  try{expect(()=>decodeTerrainOptical(validBytes.buffer as ArrayBuffer)).toThrow('RGB premoltiplicato');}finally{words[3]=alpha;}
 });
});

describe('one owned optical terrain texture',()=>{
 it('authenticates the complete streamed bytes, configures linear premultiplied mips, and releases once',async()=>{
  const split=111_113,h=harness([validBytes.subarray(0,split),validBytes.subarray(split)]);
  const owned=await loadTerrainOptical(),texture=owned.texture,data=texture.image.data as Uint16Array;
  expect(h.fetchMock).toHaveBeenCalledOnce();
  const [url,options]=h.fetchMock.mock.calls[0] as unknown as [URL,RequestInit];
  expect(url.pathname).toMatch(/\/assets\/liguria-apuane-optical\.bin$/);expect(options).toEqual({signal:undefined});
  expect(h.digest).toHaveBeenCalledOnce();
  const [algorithm,buffer]=h.digest.mock.calls[0] as unknown as [string,ArrayBuffer];
  expect(algorithm).toBe('SHA-256');expect(buffer.byteLength).toBe(TERRAIN_OPTICAL_BYTES);
  expect(data.buffer).toBe(buffer);expect(data.buffer).not.toBe(validBytes.buffer);
  expect(Array.from(data.subarray(0,4))).toEqual([0x3000,0x3400,0x3800,0x3c00]);
  expect(texture.image.width).toBe(2048);expect(texture.image.height).toBe(2048);
  expect(texture.type).toBe(HalfFloatType);expect(texture.format).toBe(RGBAFormat);expect(texture.colorSpace).toBe(NoColorSpace);
  expect(texture.wrapS).toBe(ClampToEdgeWrapping);expect(texture.wrapT).toBe(ClampToEdgeWrapping);
  expect(texture.minFilter).toBe(LinearMipmapLinearFilter);expect(texture.magFilter).toBe(LinearFilter);
  expect(texture.flipY).toBe(false);expect(texture.premultiplyAlpha).toBe(false);
  expect(texture.generateMipmaps).toBe(true);expect(texture.mipmaps).toHaveLength(0);expect(texture.version).toBe(1);
  expect(owned.stats).toEqual({
   gridSize:[2048,2048],cellKm:.0625,minEdgeKm:[-64,-64],rowOrder:'south-to-north; v0=minZ',
   dataConvention:'premultiplied-linear-RGB-and-valid-area',sourceAssetBytes:33_554_432,basePayloadBytes:33_554_432,
   nominalMipPayloadBytes:11_184_808,totalGpuPayloadBytes:44_739_240,retainedCpuPayloadBytes:33_554_432,mipLevels:12,
  });
  expect(Object.isFrozen(owned.stats)).toBe(true);expect(Object.isFrozen(owned.stats.gridSize)).toBe(true);
  let belowBase=0;for(let side=1024;side>=1;side/=2)belowBase+=side*side*8;
  expect(belowBase).toBe(owned.stats.nominalMipPayloadBytes);expect(data.byteLength).toBe(owned.stats.retainedCpuPayloadBytes);
  expect(h.reader.cancel).not.toHaveBeenCalled();expect(h.reader.releaseLock).toHaveBeenCalledOnce();
  const dispose=vi.spyOn(texture,'dispose');owned.dispose();owned.dispose();expect(dispose).toHaveBeenCalledOnce();
 });

 it('fails on unavailable or missing assets instead of returning a fallback',async()=>{
  const h=harness([],404);
  await expect(loadTerrainOptical()).rejects.toThrow('(404)');
  expect(h.body.cancel).toHaveBeenCalledOnce();expect(h.body.getReader).not.toHaveBeenCalled();expect(h.digest).not.toHaveBeenCalled();
  h.fetchMock.mockResolvedValueOnce({ok:true,status:200,body:null} as Response);
  await expect(loadTerrainOptical()).rejects.toThrow('corpo mancante');
 });

 it('rejects incomplete bodies and stops at the first oversized chunk, releasing the stream',async()=>{
  const short=harness([new Uint8Array(7)]);
  await expect(loadTerrainOptical()).rejects.toThrow('incompleto');
  expect(short.reader.cancel).toHaveBeenCalledOnce();expect(short.reader.releaseLock).toHaveBeenCalledOnce();expect(short.digest).not.toHaveBeenCalled();
  const long=harness([validBytes,new Uint8Array(1),new Uint8Array(1)]);
  await expect(loadTerrainOptical()).rejects.toThrow('troppo grande');
  expect(long.reader.read).toHaveBeenCalledTimes(2);expect(long.reader.cancel).toHaveBeenCalledOnce();
  expect(long.reader.releaseLock).toHaveBeenCalledOnce();expect(long.digest).not.toHaveBeenCalled();
 });

 it('rejects the wrong digest and preserves digest failures',async()=>{
  const h=harness([validBytes]);h.digest.mockResolvedValueOnce(new ArrayBuffer(32));
  await expect(loadTerrainOptical()).rejects.toThrow('SHA-256');
  const error=new Error('Digest unavailable');
  // This owner has consumed its first response; use a fresh stream for the second owner.
  const second=harness([validBytes]);second.digest.mockRejectedValueOnce(error);
  await expect(loadTerrainOptical()).rejects.toBe(error);
 });

 it('passes the AbortSignal to fetch and never starts an already-cancelled load',async()=>{
  const h=harness([validBytes]),controller=new AbortController();controller.abort();
  await expect(loadTerrainOptical(controller.signal)).rejects.toBe(controller.signal.reason);
  expect(h.fetchMock).not.toHaveBeenCalled();expect(h.digest).not.toHaveBeenCalled();
 });

 it('cancels a late response if its owner was released during fetch',async()=>{
  const h=harness([validBytes]),response=deferred<Response>(),controller=new AbortController();
  h.fetchMock.mockReturnValueOnce(response.promise);
  const load=loadTerrainOptical(controller.signal);controller.abort();response.resolve(h.response);
  await expect(load).rejects.toBe(controller.signal.reason);
  const options=(h.fetchMock.mock.calls[0] as unknown as [URL,RequestInit])[1];expect(options.signal).toBe(controller.signal);
  expect(h.body.cancel).toHaveBeenCalledOnce();expect(h.body.getReader).not.toHaveBeenCalled();expect(h.digest).not.toHaveBeenCalled();
 });

 it('cancels a pending body read and releases its reader when its owner is released',async()=>{
  const h=harness([]),read=deferred<ReadableStreamReadResult<Uint8Array>>(),controller=new AbortController();
  h.reader.read.mockReturnValueOnce(read.promise);
  h.reader.cancel.mockImplementation(async()=>{read.resolve({done:true,value:undefined});});
  const load=loadTerrainOptical(controller.signal);
  await vi.waitFor(()=>expect(h.reader.read).toHaveBeenCalledOnce());controller.abort();
  await expect(load).rejects.toBe(controller.signal.reason);
  expect(h.reader.cancel).toHaveBeenCalled();expect(h.reader.releaseLock).toHaveBeenCalledOnce();expect(h.digest).not.toHaveBeenCalled();
 });

 it('does not create a late texture when cancellation arrives during hashing',async()=>{
  const h=harness([validBytes]),digest=deferred<ArrayBuffer>(),controller=new AbortController();
  h.digest.mockReturnValueOnce(digest.promise);
  const load=loadTerrainOptical(controller.signal);
  await vi.waitFor(()=>expect(h.digest).toHaveBeenCalledOnce());controller.abort();digest.resolve(pinnedDigest());
  await expect(load).rejects.toBe(controller.signal.reason);
  expect(h.reader.releaseLock).toHaveBeenCalledOnce();
 });
});
