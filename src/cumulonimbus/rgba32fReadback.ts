/** Policy caps for a one-shot whole-target audit, not device capability claims. */
export const RGBA32F_READBACK_MAX_DIMENSION=8192;
export const RGBA32F_READBACK_MAX_PACKED_BYTES=96*1024*1024;

/** Compact the exact padded Float32Array returned by Three0.186 WebGPU
 * WebGPUTextureUtils.copyTextureToBuffer (local source803–860).
 * Rows have align256(width*16) bytes; the last row has no trailing padding.
 * Copies bytes only: no float conversion, quantisation, row flip or finiteness
 * filter. NaN payloads, signed zeros and every other input bit are preserved.
 * The result owns a fresh ArrayBuffer suitable for crypto.subtle.digest.
 */
export function packRGBA32FReadback(data:Float32Array,width:number,height:number):Uint8Array<ArrayBuffer>{
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
  width>RGBA32F_READBACK_MAX_DIMENSION||height>RGBA32F_READBACK_MAX_DIMENSION)
  throw new RangeError('RGBA32F readback dimensions must be integers in1..8192');
 const rowBytes=width*16,packedBytes=rowBytes*height;
 if(packedBytes>RGBA32F_READBACK_MAX_PACKED_BYTES)throw new RangeError('RGBA32F packed readback exceeds96MiB');
 if(!(data instanceof Float32Array))throw new TypeError('RGBA32F readback must be a Float32Array');
 const stride=Math.ceil(rowBytes/256)*256,expectedBytes=(height-1)*stride+rowBytes;
 if(data.byteLength!==expectedBytes||data.length!==expectedBytes/4)
  throw new RangeError('RGBA32F readback shape differs from the pinned Three186 row layout');
 const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
 const packed=new Uint8Array(packedBytes);
 for(let row=0;row<height;row++)packed.set(bytes.subarray(row*stride,row*stride+rowBytes),row*rowBytes);
 return packed;
}
