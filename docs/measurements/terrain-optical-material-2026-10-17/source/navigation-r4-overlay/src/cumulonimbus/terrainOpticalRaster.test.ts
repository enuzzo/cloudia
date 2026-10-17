import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {terrainOpticalRasterWGSL} from './terrainOpticalRaster';
// Baseline pinned before the new candidate: no runtime or GPU emulation here.
const original=readFileSync('src/cumulonimbus/fixtures/terrain-v60-raster.wgsl','utf8');
describe('immutable optical raster specialization',()=>{
 it('keeps the default wrapper byte exact including original argument list',()=>{
  expect(terrainOpticalRasterWGSL()).toBe(original);expect(terrainOpticalRasterWGSL(false)).toBe(original);
  expect((terrainOpticalRasterWGSL(false).match(/textureSample\(/g)??[])).toHaveLength(2);
 });
 it('adds only one optical sample at the existing cell-edge UV and forwards premult RGBA',()=>{
  const next=terrainOpticalRasterWGSL(true);
  expect((next.match(/textureSample\(/g)??[])).toHaveLength(3);
  const restored=next.replace('coverSamplerB:sampler,opticalMap:texture_2d<f32>,opticalSampler:sampler)->vec3<f32>{','coverSamplerB:sampler)->vec3<f32>{').replace('solarVisibility,coverA,coverB,textureSample(opticalMap,opticalSampler,coverUV));','solarVisibility,coverA,coverB);');
  expect(restored).toBe(original);expect(next).not.toContain('opticalMode');
  expect(createHash('sha256').update(restored).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'));
 });
});
