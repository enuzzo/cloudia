/** Affine winning-caster triangle restricted to one shadow texel.
 * This does not represent other faces inside the texel or change depth selection.
 * No epsilon expands coverage. Invalid/empty/numerically collapsed cases retain
 * the caller's already-computed affine baseline, including its known erosion.
 */
export type TerrainShadowUVQ=readonly [number,number,number];
export type TerrainShadowPixel=readonly [number,number];
export type TerrainShadowTriangle=readonly [TerrainShadowUVQ,TerrainShadowUVQ,TerrainShadowUVQ];
export type TerrainShadowClipPrecision='float64'|'float32';
export type TerrainShadowClipFailure='nonfinite'|'invalid-target'|'degenerate'|'empty'|'overflow'|'numerical';
export interface TerrainShadowClipResult {
 minimum:number;valid:boolean;count:number;reason:TerrainShadowClipFailure|null;
 /** Local texel XY and solar height q; useful for the CPU diagnostic only. */
 vertices:TerrainShadowUVQ[];
}
export const TERRAIN_SHADOW_CLIP_CAPACITY=7;
export const TERRAIN_SHADOW_CLIP_BIAS_KM=.001;

/** Float64 is the affine geometry reference. Float32 explicitly rounds every
 * scalar operation; it is a diagnostic model, not GPU parity (FMA/reassociation,
 * raster edge quantization, loaded matrices and interpolation remain separate).
 */
export function clipTerrainShadowTexel(
 triangle:TerrainShadowTriangle,screenPixel:TerrainShadowPixel,mapSize:TerrainShadowPixel,
 baselineMinimum:number,precision:TerrainShadowClipPrecision='float64',
):TerrainShadowClipResult {
 const round=precision==='float32'?Math.fround:(value:number)=>value;
 const baseline=round(baselineMinimum),size=mapSize.map(round),inputPixel=screenPixel.map(round);
 let polygon=triangle.map(v=>v.map(round) as [number,number,number]);
 const fail=(reason:TerrainShadowClipFailure):TerrainShadowClipResult=>({minimum:baseline,valid:false,count:polygon.length,reason,vertices:polygon.map(v=>[...v])});
 if(![baseline,...inputPixel,...size,...polygon.flat()].every(Number.isFinite))return fail('nonfinite');
 const pixel=inputPixel.map(Math.floor);
 if(size.some(v=>!Number.isFinite(v)||!Number.isInteger(v)||v<=0)||pixel.some((v,i)=>v<0||v>=size[i]))return fail('invalid-target');
 polygon=polygon.map(v=>[round(round(v[0]*size[0])-pixel[0]),round(round(v[1]*size[1])-pixel[1]),v[2]]);
 if(!polygon.flat().every(Number.isFinite))return fail('numerical');
 const cross=(a:TerrainShadowUVQ,b:TerrainShadowUVQ,c:TerrainShadowUVQ)=>
  round(round(round(b[0]-a[0])*round(c[1]-a[1]))-round(round(b[1]-a[1])*round(c[0]-a[0])));
 const determinant=cross(polygon[0],polygon[1],polygon[2]);
 if(!Number.isFinite(determinant))return fail('numerical');
 if(determinant===0)return fail('degenerate');
 for(let plane=0;plane<4;plane++){
  if(polygon.length===0)return fail('empty');
  const axis=plane<2?0:1,bound=plane%2,sign=bound===0?1:-1;
  const next:[number,number,number][]=[];
  const append=(p:[number,number,number])=>{
   // Exact XY duplicates can arise when an on-plane endpoint is emitted twice.
   // Keep the lower q on numerical duplicate XY; never expand XY with epsilon.
   for(const index of [next.length-1,0])if(index>=0&&next[index]?.[0]===p[0]&&next[index]?.[1]===p[1]){
    next[index][2]=Math.min(next[index][2],p[2]);return true;
   }
   if(next.length===TERRAIN_SHADOW_CLIP_CAPACITY)return false;
   next.push(p);return true;
  };
  let a=polygon.at(-1)!,da=round(sign*round(a[axis]-bound)),insideA=da>=0;
  for(const b of polygon){
   const db=round(sign*round(b[axis]-bound)),insideB=db>=0;
   if(insideA!==insideB){
    const denominator=round(da-db),t=round(da/denominator);
    if(!Number.isFinite(denominator)||!Number.isFinite(t)||denominator===0||t<0||t>1)return fail('numerical');
    const cut=a.map((v,k)=>round(v+round(t*round(b[k]-v)))) as [number,number,number];
    cut[axis]=bound;
    if(!cut.every(Number.isFinite))return fail('numerical');
    if(!append(cut))return fail('overflow');
   }
   if(insideB&&!append([...b]))return fail('overflow');
   a=b;da=db;insideA=insideB;
  }
  polygon=next;
 }
 if(polygon.length===0)return fail('empty');
 if(polygon.length<3)return fail('degenerate');
 let area=0;
 for(let i=1;i<polygon.length-1;i++)area=round(area+cross(polygon[0],polygon[i],polygon[i+1]));
 if(!Number.isFinite(area))return fail('numerical');
 if(area===0)return fail('degenerate');
 const minimum=round(Math.min(...polygon.map(v=>v[2]))-round(TERRAIN_SHADOW_CLIP_BIAS_KM));
 if(!Number.isFinite(minimum))return fail('numerical');
 return {minimum,valid:true,count:polygon.length,reason:null,vertices:polygon.map(v=>[...v])};
}

/** Entry must precede structs/helpers for Three r186 WGSLNodeFunction parsing.
 * All derivatives belong to the caller and must be evaluated before divergence.
 * Reason codes: 0 valid, 1 nonfinite, 2 target, 3 degenerate, 4 empty,
 * 5 capacity overflow, 6 nonfinite arithmetic/invalid crossing.
 */
export const TERRAIN_SHADOW_CLIP_WGSL=/* wgsl */`
fn terrainShadowClippedMinimum(aUVQ:vec3<f32>, bUVQ:vec3<f32>, cUVQ:vec3<f32>, screenPixel:vec2<f32>, mapSize:vec2<f32>, baselineMinimum:f32)->f32 {
 return terrainShadowClipResult(aUVQ,bUVQ,cUVQ,screenPixel,mapSize,baselineMinimum).minimum;
}
struct TerrainShadowClipResult {
 minimum:f32,
 valid:u32,
 count:u32,
 reason:u32,
}
fn terrainShadowClipFinite(value:f32)->bool {
 return (bitcast<u32>(value)&0x7f800000u)!=0x7f800000u;
}
fn terrainShadowClipFinite3(value:vec3<f32>)->bool {
 return terrainShadowClipFinite(value.x)&&terrainShadowClipFinite(value.y)&&terrainShadowClipFinite(value.z);
}
fn terrainShadowClipFailure(baseline:f32, count:u32, reason:u32)->TerrainShadowClipResult {
 return TerrainShadowClipResult(baseline,0u,count,reason);
}
fn terrainShadowClipCross(a:vec3<f32>, b:vec3<f32>, c:vec3<f32>)->f32 {
 let ab=b.xy-a.xy;
 let ac=c.xy-a.xy;
 return ab.x*ac.y-ab.y*ac.x;
}
fn terrainShadowClipAppend(vertices:ptr<function,array<vec3<f32>,7>>, count:ptr<function,u32>, value:vec3<f32>)->bool {
 if((*count)>0u){
  let last=(*count)-1u;
  if(all((*vertices)[last].xy==value.xy)){
   (*vertices)[last].z=min((*vertices)[last].z,value.z);
   return true;
  }
  // Also suppress a closing duplicate before a possible eighth temporary write.
  if(all((*vertices)[0].xy==value.xy)){
   (*vertices)[0].z=min((*vertices)[0].z,value.z);
   return true;
  }
 }
 if((*count)>=7u){return false;}
 (*vertices)[*count]=value;
 (*count)=(*count)+1u;
 return true;
}
fn terrainShadowClipResult(aUVQ:vec3<f32>, bUVQ:vec3<f32>, cUVQ:vec3<f32>, screenPixel:vec2<f32>, mapSize:vec2<f32>, baselineMinimum:f32)->TerrainShadowClipResult {
 if(!terrainShadowClipFinite3(aUVQ)||!terrainShadowClipFinite3(bUVQ)||!terrainShadowClipFinite3(cUVQ)||
    !terrainShadowClipFinite(screenPixel.x)||!terrainShadowClipFinite(screenPixel.y)||
    !terrainShadowClipFinite(mapSize.x)||!terrainShadowClipFinite(mapSize.y)||!terrainShadowClipFinite(baselineMinimum)){
  return terrainShadowClipFailure(baselineMinimum,3u,1u);
 }
 let pixel=floor(screenPixel);
 if(any(mapSize<=vec2<f32>(0.0))||any(mapSize!=floor(mapSize))||any(pixel<vec2<f32>(0.0))||any(pixel>=mapSize)){
  return terrainShadowClipFailure(baselineMinimum,3u,2u);
 }
 var polygon:array<vec3<f32>,7>;
 var next:array<vec3<f32>,7>;
 polygon[0]=vec3<f32>(aUVQ.xy*mapSize-pixel,aUVQ.z);
 polygon[1]=vec3<f32>(bUVQ.xy*mapSize-pixel,bUVQ.z);
 polygon[2]=vec3<f32>(cUVQ.xy*mapSize-pixel,cUVQ.z);
 var count=3u;
 if(!terrainShadowClipFinite3(polygon[0])||!terrainShadowClipFinite3(polygon[1])||!terrainShadowClipFinite3(polygon[2])){
  return terrainShadowClipFailure(baselineMinimum,count,6u);
 }
 let determinant=terrainShadowClipCross(polygon[0],polygon[1],polygon[2]);
 if(!terrainShadowClipFinite(determinant)){return terrainShadowClipFailure(baselineMinimum,count,6u);}
 if(determinant==0.0){return terrainShadowClipFailure(baselineMinimum,count,3u);}
 for(var plane=0u;plane<4u;plane++){
  if(count==0u){return terrainShadowClipFailure(baselineMinimum,count,4u);}
  let axis=select(0u,1u,plane>=2u);
  let bound=f32(plane%2u);
  let sign=select(1.0,-1.0,bound==1.0);
  var nextCount=0u;
  var a=polygon[count-1u];
  var da=sign*(a[axis]-bound);
  var insideA=da>=0.0;
  for(var i=0u;i<7u;i++){
   if(i>=count){break;}
   let b=polygon[i];
   let db=sign*(b[axis]-bound);
   let insideB=db>=0.0;
   if(insideA!=insideB){
    let denominator=da-db;
    if(denominator==0.0||!terrainShadowClipFinite(denominator)){return terrainShadowClipFailure(baselineMinimum,count,6u);}
    let t=da/denominator;
    if(!terrainShadowClipFinite(t)||t<0.0||t>1.0){return terrainShadowClipFailure(baselineMinimum,count,6u);}
    var cut=a+(b-a)*t;
    cut[axis]=bound;
    if(!terrainShadowClipFinite3(cut)){return terrainShadowClipFailure(baselineMinimum,count,6u);}
    if(!terrainShadowClipAppend(&next,&nextCount,cut)){return terrainShadowClipFailure(baselineMinimum,count,5u);}
   }
   if(insideB){
    if(!terrainShadowClipAppend(&next,&nextCount,b)){return terrainShadowClipFailure(baselineMinimum,count,5u);}
   }
   a=b;da=db;insideA=insideB;
  }
  polygon=next;count=nextCount;
 }
 if(count==0u){return terrainShadowClipFailure(baselineMinimum,count,4u);}
 if(count<3u){return terrainShadowClipFailure(baselineMinimum,count,3u);}
 var area=0.0;
 var minimum=polygon[0].z;
 for(var i=1u;i<7u;i++){
  if(i>=count){break;}
  minimum=min(minimum,polygon[i].z);
  if(i+1u<count){area+=terrainShadowClipCross(polygon[0],polygon[i],polygon[i+1u]);}
 }
 if(!terrainShadowClipFinite(area)){return terrainShadowClipFailure(baselineMinimum,count,6u);}
 if(area==0.0){return terrainShadowClipFailure(baselineMinimum,count,3u);}
 minimum-=.001;
 if(!terrainShadowClipFinite(minimum)){return terrainShadowClipFailure(baselineMinimum,count,6u);}
 return TerrainShadowClipResult(minimum,1u,count,0u);
}
`;
