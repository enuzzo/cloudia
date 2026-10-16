import {describe,expect,it} from 'vitest';
import {
 clipTerrainShadowTexel,TERRAIN_SHADOW_CLIP_CAPACITY,TERRAIN_SHADOW_CLIP_WGSL,
 type TerrainShadowClipPrecision,type TerrainShadowTriangle,
} from './terrainShadowClip';

const covering:TerrainShadowTriangle=[[-1,-1,7],[3,-1,11],[-1,3,15]];
const modes:TerrainShadowClipPrecision[]=['float64','float32'];

describe.each(modes)('affine caster/texel intersection, %s',precision=>{
 it('clips a covering affine triangle to the actual square, including the far corner',()=>{
  // These heights define q=10+x+2y. Its square minimum is exactly 10km.
  const result=clipTerrainShadowTexel(covering,[.5,.5],[1,1],-100,precision);
  expect(result.valid).toBe(true);expect(result.reason).toBeNull();expect(result.count).toBe(4);
  expect(result.minimum).toBeCloseTo(9.999,5);
  expect(result.vertices.map(p=>p.slice(0,2))).toEqual(expect.arrayContaining([[0,0],[1,0],[1,1],[0,1]]));
 });
 it('keeps a triangle entirely inside the texel and its lowest original vertex',()=>{
  const triangle:TerrainShadowTriangle=[[.25,.25,4],[.75,.25,5],[.25,.75,6]];
  const result=clipTerrainShadowTexel(triangle,[.5,.5],[1,1],-7,precision);
  expect(result.valid).toBe(true);expect(result.count).toBe(3);expect(result.minimum).toBeCloseTo(3.999,5);
 });
 it('interpolates q at an edge crossing and deduplicates exact boundary endpoints',()=>{
  const result=clipTerrainShadowTexel([[-1,0,1],[1,0,3],[0,1,4]],[.5,.5],[1,1],-8,precision);
  expect(result.valid).toBe(true);expect(result.count).toBe(3);expect(result.minimum).toBeCloseTo(1.999,5);
  expect(new Set(result.vertices.map(v=>`${v[0]},${v[1]}`)).size).toBe(result.count);
 });
 it('represents a genuine seven-vertex intersection without an eighth temporary slot',()=>{
  const result=clipTerrainShadowTexel([[.2,.2,5],[2,-.5,5],[-.5,2,5]],[.5,.5],[1,1],-9,precision);
  expect(result.valid).toBe(true);expect(result.count).toBe(TERRAIN_SHADOW_CLIP_CAPACITY);
  expect(result.minimum).toBeCloseTo(4.999,5);
  expect(result.vertices.every(v=>v[0]>=0&&v[0]<=1&&v[1]>=0&&v[1]<=1)).toBe(true);
  expect(new Set(result.vertices.map(v=>`${v[0]},${v[1]}`)).size).toBe(7);
 });
 it('uses floor of shadow fragment coordinates and supports a rectangular target',()=>{
  // Same local triangle in texel [100,200] of a 2048x1024 shadow target.
  const projected=covering.map(([x,y,q])=>[(100+x)/2048,(200+y)/1024,q]) as unknown as TerrainShadowTriangle;
  const a=clipTerrainShadowTexel(projected,[100.5,200.5],[2048,1024],-100,precision);
  const b=clipTerrainShadowTexel(projected,[100.999,200.001],[2048,1024],-100,precision);
  expect(a.valid).toBe(true);expect(a.count).toBe(4);expect(a.minimum).toBeCloseTo(9.999,5);
  expect(b.minimum).toBe(a.minimum);expect(b.vertices).toEqual(a.vertices);
 });
 it('does not depend on polygon winding',()=>{
  const a=clipTerrainShadowTexel(covering,[.5,.5],[1,1],-100,precision);
  const b=clipTerrainShadowTexel([covering[2],covering[1],covering[0]],[.5,.5],[1,1],-100,precision);
  expect(a.valid&&b.valid).toBe(true);expect(b.count).toBe(a.count);expect(b.minimum).toBe(a.minimum);
 });
 it('leaves points on the same positive affine face lit, without blanket disabling occluders',()=>{
  const result=clipTerrainShadowTexel(covering,[.5,.5],[1,1],-100,precision);
  // Independent receiver values on the face, all >= its square minimum 10.
  for(const receiver of [10,10.5,11.75,13])expect(receiver>=result.minimum).toBe(true);
  const raised=clipTerrainShadowTexel([[-1,-1,.2],[3,-1,.2],[-1,3,.2]],[.5,.5],[1,1],-.001,precision);
  expect(raised.valid).toBe(true);expect(raised.minimum).toBeCloseTo(.199,6);
  expect(0>=raised.minimum).toBe(false); // A separate 200m blocker remains shadowed.
 });
 it('returns the caller baseline for empty, collinear and point-contact geometry',()=>{
  const empty=clipTerrainShadowTexel([[-3,-3,2],[-2,-3,3],[-3,-2,4]],[.5,.5],[1,1],-17,precision);
  expect(empty).toMatchObject({valid:false,minimum:-17,count:0,reason:'empty'});
  const line=clipTerrainShadowTexel([[0,0,2],[1,1,3],[2,2,4]],[.5,.5],[1,1],-17,precision);
  expect(line).toMatchObject({valid:false,minimum:-17,reason:'degenerate'});
  const point=clipTerrainShadowTexel([[-1,0,2],[0,0,3],[-1,1,4]],[.5,.5],[1,1],-17,precision);
  expect(point).toMatchObject({valid:false,minimum:-17,reason:'degenerate'});
  expect(point.count).toBeLessThan(3);
 });
 it('rejects nonfinite inputs and invalid target addresses without a coverage epsilon',()=>{
  const bad=clipTerrainShadowTexel([[0,0,Infinity],[1,0,2],[0,1,3]],[.5,.5],[1,1],-7,precision);
  expect(bad).toMatchObject({valid:false,minimum:-7,reason:'nonfinite'});
  expect(clipTerrainShadowTexel(covering,[NaN,.5],[1,1],-7,precision).reason).toBe('nonfinite');
  for(const [pixel,size] of [[[.5,.5],[0,1]],[[.5,.5],[1.5,1]],[[-.01,.5],[1,1]],[[1,.5],[1,1]]] as const){
   expect(clipTerrainShadowTexel(covering,pixel,size,-7,precision)).toMatchObject({valid:false,minimum:-7,reason:'invalid-target'});
  }
  const outside=clipTerrainShadowTexel([[1.0001,0,1],[2,0,2],[1.0001,1,3]],[.5,.5],[1,1],-7,precision);
  expect(outside).toMatchObject({valid:false,minimum:-7,reason:'empty'});
 });
});

describe('explicit precision and integration contract',()=>{
 it('exposes projected grazing collapse in f32 instead of claiming Float64/GPU parity',()=>{
  const triangle:TerrainShadowTriangle=[[0,0,2],[1,1,3],[1,1+1e-12,4]];
  const reference=clipTerrainShadowTexel(triangle,[.5,.5],[1,1],-17,'float64');
  const rounded=clipTerrainShadowTexel(triangle,[.5,.5],[1,1],-17,'float32');
  expect(reference.valid).toBe(true);expect(reference.minimum).toBeCloseTo(1.999,12);
  expect(rounded).toMatchObject({valid:false,minimum:-17,reason:'degenerate'});
 });
 it('falls back after nonfinite f32 arithmetic even when every input was finite',()=>{
  const result=clipTerrainShadowTexel([[1e38,0,1],[-1e38,0,2],[0,1,3]],[.5,.5],[2048,2048],-17,'float32');
  expect(result).toMatchObject({valid:false,minimum:-17,reason:'numerical'});
 });
 it('puts the float entry first for Three parsing and keeps derivative evaluation outside the module',()=>{
  expect(TERRAIN_SHADOW_CLIP_WGSL.trimStart()).toMatch(/^fn terrainShadowClippedMinimum\(/);
  expect(TERRAIN_SHADOW_CLIP_WGSL).not.toMatch(/\b(?:dpdx|dpdy|fwidth)\s*\(/);
  expect(TERRAIN_SHADOW_CLIP_WGSL).not.toMatch(/frag_depth|textureLoad|textureSample|discard/);
 });
});

// Twelve frozen cycle27 CPU records, embedded: no external files/runtime imports.
// Float64 clipping reference SHA256 9c685934f80950b0f82c315a80b54173c88b58be8f26410887f5f59b643b0a18.
const frozenRecords=[{"id":"L1-artifact","triangle":[[0.520343781557638,0.6109145445392318,15.885017565120483],[0.5228581747641959,0.6097193808995742,15.804088077575464],[0.5209533297056248,0.6095325728721852,15.717158014094565]],"pixel":[1067,1248],"baseline":15.696154315411782,"minimum":15.718109606469762,"qLookup":15.50604719760997,"lit":0,"physicallyLit":false},{"id":"L1-control","triangle":[[0.5209533297056248,0.6095325728721852,15.717158014094565],[0.5228581747641959,0.6097193808995742,15.804088077575464],[0.5234677274536949,0.609564168766852,15.476701017889377]],"pixel":[1069,1248],"baseline":15.280342904313791,"minimum":15.571982399091235,"qLookup":15.514424307352824,"lit":0,"physicallyLit":false},{"id":"L2-artifact","triangle":[[0.492380604154267,0.6042176035531069,14.739969112193851],[0.4942854527608946,0.6036540190278853,14.92447866213216],[0.49489500545039344,0.6026171320325526,14.711742523969791]],"pixel":[1011,1235],"baseline":14.603874701222615,"minimum":14.719211174686103,"qLookup":14.55703025311887,"lit":0,"physicallyLit":false},{"id":"L2-control","triangle":[[0.492380604154267,0.6042176035531069,14.739969112193851],[0.4942854527608946,0.6036540190278853,14.92447866213216],[0.49489500545039344,0.6026171320325526,14.711742523969791]],"pixel":[1011,1235],"baseline":14.603874701222615,"minimum":14.719211174686103,"qLookup":14.62369042096359,"lit":0,"physicallyLit":false},{"id":"L3-artifact","triangle":[[0.42906344899460425,0.6377358173067378,18.94545812306617],[0.4315778498472237,0.6364219052704995,18.879967988864703],[0.42967300168410316,0.6365434314033476,18.752942696484425]],"pixel":[883,1303],"baseline":18.80640944537438,"minimum":18.850593004729017,"qLookup":18.709249409426626,"lit":0,"physicallyLit":false},{"id":"L3-control","triangle":[[0.42906344899460425,0.6377358173067378,18.94545812306617],[0.4315778498472237,0.6364219052704995,18.879967988864703],[0.42967300168410316,0.6365434314033476,18.752942696484425]],"pixel":[882,1303],"baseline":18.767551431994647,"minimum":18.81803184329584,"qLookup":18.783166376834107,"lit":0,"physicallyLit":false},{"id":"C1-ocean","triangle":[[0.38681391686964234,0.5393984705239115,4.935384698138404],[0.3880711099248648,0.5389344187896844,4.877555809521591],[0.3871186909436357,0.5387184912367139,4.850023657277484]],"pixel":[792,1104],"baseline":4.892108997159529,"minimum":4.892208716958345,"qLookup":4.969217800263517,"lit":1,"physicallyLit":true},{"id":"C2-coastal-lowland","triangle":[[0.389252119396147,0.5714269187418208,8.95922365681452],[0.3879949240701684,0.5718910068927663,9.017049104685409],[0.3898997691287396,0.572318225017911,9.07271680556511]],"pixel":[796,1171],"baseline":9.002180272333735,"minimum":9.002180272333973,"qLookup":9.084590732009218,"lit":1,"physicallyLit":true},{"id":"C3-plain","triangle":[[0.29869563075833483,0.6026794175192044,12.826765686896632],[0.3006004829130189,0.6031096843649222,12.88203735367257],[0.3012100356025178,0.6017466032415179,12.711718731269153]],"pixel":[614,1234],"baseline":12.808981129294102,"minimum":12.808981129294146,"qLookup":12.884028655524803,"lit":1,"physicallyLit":true},{"id":"C4-ridge-L1","triangle":[[0.5102861809146443,0.6153170065941453,16.257921717416476],[0.512800581217315,0.6143463606087476,16.1477968975084],[0.5108957290626309,0.6144012049893635,16.02944250999344]],"pixel":[1048,1258],"baseline":16.044086694431268,"minimum":16.079579360018663,"qLookup":16.32263826352736,"lit":1,"physicallyLit":true},{"id":"C5-ridge-L2","triangle":[[0.484989794966686,0.6172870936291177,16.05734762210444],[0.4868946435733136,0.6174568481007658,16.146495496956003],[0.4875041962628125,0.6167145918533137,15.89544627061768]],"pixel":[996,1263],"baseline":15.870794695770332,"minimum":15.93873281023448,"qLookup":16.0428199406176,"lit":1,"physicallyLit":true},{"id":"C6-ridge-L3","triangle":[[0.41732958587092644,0.6565203221260786,20.798726617396614],[0.4198439817385266,0.6551170715379917,20.74485642165763],[0.4179391340189131,0.6553480072981281,20.60360378505751]],"pixel":[856,1342],"baseline":20.589270311925713,"minimum":20.604799937207073,"qLookup":20.751235009751746,"lit":1,"physicallyLit":true}];
describe('twelve frozen lit/shadow CPU records; not native raster qualification',()=>{
 it.each(frozenRecords)('keeps the fixed clipping/visibility witness $id',record=>{
  const triangle=record.triangle as unknown as TerrainShadowTriangle;
  const pixel=record.pixel as [number,number];
  const reference=clipTerrainShadowTexel(triangle,pixel,[2048,2048],record.baseline,'float64');
  expect(reference.valid).toBe(true);expect(reference.count).toBeLessThanOrEqual(7);
  // Residual tolerance only, inherited from the independent Float64 replay.
  expect(Math.abs(reference.minimum-record.minimum)).toBeLessThanOrEqual(1e-8);
  expect(Number(record.qLookup>=reference.minimum)).toBe(record.lit);
  const rounded=clipTerrainShadowTexel(triangle,pixel,[2048,2048],record.baseline,'float32');
  expect(rounded.valid).toBe(true);expect(rounded.count).toBeLessThanOrEqual(7);
  expect(Number(Math.fround(record.qLookup)>=rounded.minimum)).toBe(record.lit);
  expect(record.lit).toBe(Number(record.physicallyLit));
 });
});
