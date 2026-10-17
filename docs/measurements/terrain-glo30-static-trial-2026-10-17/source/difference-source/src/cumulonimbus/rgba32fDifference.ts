/** Bit comparison of native-endian, tightly packed RGBA32F readbacks. Inputs
 * remain owned by the caller and must not be mutated concurrently. DataViews
 * respect view offsets, including unaligned ones; no full input copy is made.
 */
export const RGBA32F_DIFFERENCE_LIMITS=Object.freeze({maxDimension:8192,maxPackedBytes:96*1024*1024,maxExamples:24});
type Four<T>=[T,T,T,T];
export type ReportFloat=number|'NaN'|'+Infinity'|'-Infinity'|'-0';
export interface NonFiniteWordCounts {nanWords:number;positiveInfinityWords:number;negativeInfinityWords:number}
export interface RGBA32FDifferenceExample {
 x:number;y:number;/** Bits1/2/4/8 identify changed R/G/B/A channels. */channelMask:number;
 before:{bits:Four<number>;values:Four<ReportFloat>};after:{bits:Four<number>;values:Four<ReportFloat>};
}
export interface RGBA32FDifferenceReport {
 format:'native-packed-rgba32f';byteOrder:'little-endian'|'big-endian';width:number;height:number;packedByteLength:number;
 pixelCount:number;comparedWords:number;changedWords:number;changedPixels:number;
 changedRgbWords:number;changedRgbPixels:number;changedAlphaWords:number;changedAlphaPixels:number;
 changedWordsByChannel:Four<number>;boundingRect:{x:number;y:number;width:number;height:number}|null;
 /** Includes equal finite pairs. Maxima exclude every pair with a NaN/Inf;
  * null means no finite comparable pair, while0 includes signed-zero changes. */
 finiteComparableWords:number;maxFiniteAbsDelta:number|null;maxFiniteAbsDeltaByChannel:Four<number|null>;
 beforeNonFinite:NonFiniteWordCounts;afterNonFinite:NonFiniteWordCounts;
 nonFinitePairs:{eitherNonFiniteWords:number;bothNonFiniteWords:number;finiteToNonFiniteWords:number;nonFiniteToFiniteWords:number;changedWordsWithNonFinite:number;bothNaNChangedBits:number};
 signedZeroChangedWords:number;firstDifferences:RGBA32FDifferenceExample[];
}
const nativeLittleEndian=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
const zeroCounts=():NonFiniteWordCounts=>({nanWords:0,positiveInfinityWords:0,negativeInfinityWords:0});
/** 0finite,1NaN,2positiveInfinity,3negativeInfinity; all NaN payloads retained
 * in the u32 comparison rather than canonicalized through a JS Number. */
function nonFiniteKind(bits:number):number{
 if((bits&0x7f800000)!==0x7f800000)return 0;
 return (bits&0x007fffff)!==0?1:(bits>>>31)===0?2:3;
}
function countNonFinite(counts:NonFiniteWordCounts,kind:number):void{
 if(kind===1)counts.nanWords++;else if(kind===2)counts.positiveInfinityWords++;else if(kind===3)counts.negativeInfinityWords++;
}
function jsonFloat(value:number):ReportFloat{
 if(Number.isNaN(value))return 'NaN';if(value===Infinity)return '+Infinity';if(value===-Infinity)return '-Infinity';
 return Object.is(value,-0)?'-0':value;
}
function pixel(view:DataView,offset:number):RGBA32FDifferenceExample['before']{
 const bits:Four<number>=[0,0,0,0],values:Four<ReportFloat>=[0,0,0,0];
 for(let channel=0;channel<4;channel++){
  bits[channel]=view.getUint32(offset+channel*4,nativeLittleEndian);
  values[channel]=jsonFloat(view.getFloat32(offset+channel*4,nativeLittleEndian));
 }
 return {bits,values};
}

export function comparePackedRGBA32F(before:Uint8Array,after:Uint8Array,width:number,height:number):RGBA32FDifferenceReport{
 const limit=RGBA32F_DIFFERENCE_LIMITS;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>limit.maxDimension||height>limit.maxDimension)
  throw new RangeError('RGBA32F difference dimensions must be integers1..8192');
 const pixelCount=width*height,expected=pixelCount*16;
 if(expected>limit.maxPackedBytes)throw new RangeError('RGBA32F difference packed payload exceeds96MiB');
 if(!(before instanceof Uint8Array)||!(after instanceof Uint8Array)||!(before.buffer instanceof ArrayBuffer)||!(after.buffer instanceof ArrayBuffer)
  ||before.byteLength!==expected||after.byteLength!==expected)throw new RangeError('RGBA32F difference requires exact packed Uint8Array shapes backed by ArrayBuffer');
 const a=new DataView(before.buffer,before.byteOffset,before.byteLength),b=new DataView(after.buffer,after.byteOffset,after.byteLength);
 const changed:Four<number>=[0,0,0,0],finitePairs:Four<number>=[0,0,0,0],maxDelta:Four<number>=[0,0,0,0];
 const beforeNonFinite=zeroCounts(),afterNonFinite=zeroCounts();
 const nonFinitePairs={eitherNonFiniteWords:0,bothNonFiniteWords:0,finiteToNonFiniteWords:0,nonFiniteToFiniteWords:0,changedWordsWithNonFinite:0,bothNaNChangedBits:0};
 let changedPixels=0,changedRgbPixels=0,changedAlphaPixels=0,signedZeroChangedWords=0,minX=width,minY=height,maxX=-1,maxY=-1;
 const firstDifferences:RGBA32FDifferenceExample[]=[];
 for(let index=0;index<pixelCount;index++){
  const offset=index*16;let mask=0;
  for(let channel=0;channel<4;channel++){
   const at=offset+channel*4,ab=a.getUint32(at,nativeLittleEndian),bb=b.getUint32(at,nativeLittleEndian);
   const ak=nonFiniteKind(ab),bk=nonFiniteKind(bb);countNonFinite(beforeNonFinite,ak);countNonFinite(afterNonFinite,bk);
   if(ak||bk){
    nonFinitePairs.eitherNonFiniteWords++;
    if(ak&&bk)nonFinitePairs.bothNonFiniteWords++;else if(bk)nonFinitePairs.finiteToNonFiniteWords++;else nonFinitePairs.nonFiniteToFiniteWords++;
   }else finitePairs[channel]=finitePairs[channel]!+1;
   if(ab===bb)continue;
   changed[channel]=changed[channel]!+1;mask|=1<<channel;
   if(ak||bk){nonFinitePairs.changedWordsWithNonFinite++;if(ak===1&&bk===1)nonFinitePairs.bothNaNChangedBits++;}
   else{
    const delta=Math.abs(b.getFloat32(at,nativeLittleEndian)-a.getFloat32(at,nativeLittleEndian));
    if(delta>maxDelta[channel]!)maxDelta[channel]=delta;
    if((ab&0x7fffffff)===0&&(bb&0x7fffffff)===0)signedZeroChangedWords++;
   }
  }
  if(mask===0)continue;
  changedPixels++;if(mask&7)changedRgbPixels++;if(mask&8)changedAlphaPixels++;
  const x=index%width,y=Math.floor(index/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  if(firstDifferences.length<limit.maxExamples)firstDifferences.push({x,y,channelMask:mask,before:pixel(a,offset),after:pixel(b,offset)});
 }
 const finiteComparableWords=finitePairs[0]+finitePairs[1]+finitePairs[2]+finitePairs[3];
 return {format:'native-packed-rgba32f',byteOrder:nativeLittleEndian?'little-endian':'big-endian',width,height,packedByteLength:expected,pixelCount,comparedWords:pixelCount*4,
  changedWords:changed[0]+changed[1]+changed[2]+changed[3],changedPixels,changedRgbWords:changed[0]+changed[1]+changed[2],changedRgbPixels,changedAlphaWords:changed[3],changedAlphaPixels,
  changedWordsByChannel:changed,boundingRect:changedPixels?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null,
  finiteComparableWords,maxFiniteAbsDelta:finiteComparableWords?Math.max(...maxDelta):null,
  maxFiniteAbsDeltaByChannel:[finitePairs[0]?maxDelta[0]:null,finitePairs[1]?maxDelta[1]:null,finitePairs[2]?maxDelta[2]:null,finitePairs[3]?maxDelta[3]:null],
  beforeNonFinite,afterNonFinite,nonFinitePairs,signedZeroChangedWords,firstDifferences};
}
