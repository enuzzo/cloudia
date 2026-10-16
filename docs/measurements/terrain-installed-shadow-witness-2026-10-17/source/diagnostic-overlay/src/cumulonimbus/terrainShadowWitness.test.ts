import {afterEach,describe,it,expect,vi} from 'vitest';
import {BufferAttribute,BufferGeometry,MeshBasicNodeMaterial} from 'three/webgpu';
import {auditTerrainShadowWitness,TERRAIN_SHADOW_WITNESS_POINTS} from './terrainShadowWitness';
const frame={origin:[0,2,0],forward:[0,-1,0],right:[1,0,0],up:[0,0,-1],aspect:2474/1844,tanFov:.2867,inspection:0};
function plane(){
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new BufferAttribute(new Float32Array([-10,0,-10,-10,0,10,10,0,10,10,0,-10]),3));
 geometry.setAttribute('normal',new BufferAttribute(new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),3));
 geometry.setIndex(new BufferAttribute(new Uint32Array([0,1,2,0,2,3]),1));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
afterEach(()=>vi.restoreAllMocks());
describe('installed-geometry shadow witness proposal (small analytic fixtures)',()=>{
 it('classifies a horizontal unoccluded plane, preserves borrowed geometry and disposes only its own material',()=>{
  const geometry=plane(),bounds=geometry.boundingBox,sphere=geometry.boundingSphere,position=geometry.getAttribute('position') as BufferAttribute,index=geometry.index;
  const before=position.array.slice(),beforeIndex=index!.array.slice(),version=position.version;
  const sourceDispose=vi.spyOn(geometry,'dispose'),materialDispose=vi.spyOn(MeshBasicNodeMaterial.prototype,'dispose');
  const report=auditTerrainShadowWitness(geometry,frame,[0,1,0],2474,1844,TERRAIN_SHADOW_WITNESS_POINTS);
  expect(report.status).toBe('COMPLETE_CPU_REFERENCE_ONLY');expect(report.raycasts).toBe(36);
  expect(report.counts.complete).toBe(12);expect(report.counts.physicallyUnoccluded).toBe(12);expect(report.counts.cpuShadow).toBe(0);
  expect(report.rows.every(row=>row.physicalSunRay?.classification==='UNOCCLUDED_ENTIRE_MESH')).toBe(true);
  expect((report.rows[0].receiver?.point as number[])[1]).toBeCloseTo(0,12);
  expect((report.rows[0].receiver?.interpolatedVertexNormal as number[])[1]).toBeCloseTo(1,12);
  expect(report.rows[0].receiver?.interpolatedVertexNormalDotSun).toBeCloseTo(1,12);
  expect(report.rows[0].caster?.storedMinimumKm).toBeCloseTo(3.999,12);
  expect(geometry.getAttribute('position')).toBe(position);expect(geometry.index).toBe(index);
  expect(geometry.boundingBox).toBe(bounds);expect(geometry.boundingSphere).toBe(sphere);
  expect(position.array).toEqual(before);expect(index!.array).toEqual(beforeIndex);expect(position.version).toBe(version);
  expect(sourceDispose).not.toHaveBeenCalled();expect(materialDispose).toHaveBeenCalledOnce();
 });
 it('rejects replacements and missing bounds without computing or changing borrowed bounds',()=>{
  const geometry=plane(),box=vi.spyOn(geometry,'computeBoundingBox'),sphere=vi.spyOn(geometry,'computeBoundingSphere');
  expect(()=>auditTerrainShadowWitness(geometry,frame,[0,1,0],2474,1844,TERRAIN_SHADOW_WITNESS_POINTS.slice(1))).toThrow();
  const replacement=TERRAIN_SHADOW_WITNESS_POINTS.map(p=>({...p,uv:[...p.uv] as [number,number]}));replacement[0].uv[0]+=.0001;
  expect(()=>auditTerrainShadowWitness(geometry,frame,[0,1,0],2474,1844,replacement)).toThrow();
  geometry.boundingSphere=null;
  expect(()=>auditTerrainShadowWitness(geometry,frame,[0,1,0],2474,1844,TERRAIN_SHADOW_WITNESS_POINTS)).toThrow(/boundingSphere/);
  expect(box).not.toHaveBeenCalled();expect(sphere).not.toHaveBeenCalled();expect(geometry.boundingSphere).toBeNull();
 });
 it('stops cooperatively between rays and still releases only its owned material',()=>{
  const geometry=plane(),sourceDispose=vi.spyOn(geometry,'dispose'),dispose=vi.spyOn(MeshBasicNodeMaterial.prototype,'dispose');
  let elapsed=0;vi.spyOn(performance,'now').mockImplementation(()=>{const value=elapsed;elapsed+=10000;return value;});
  const report=auditTerrainShadowWitness(geometry,frame,[0,1,0],2474,1844,TERRAIN_SHADOW_WITNESS_POINTS);
  expect(report.status).toBe('BUDGET_EXCEEDED_PARTIAL');expect(report.raycasts).toBe(1);
  expect(report.timings.budgetPhase).toBe('L1-artifact:caster');expect(report.rows[0].status).toBe('BUDGET_EXCEEDED_PARTIAL');
  expect(sourceDispose).not.toHaveBeenCalled();expect(dispose).toHaveBeenCalledOnce();
 });
});
