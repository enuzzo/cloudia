// @vitest-environment node
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe,it,expect} from 'vitest';
import {createLayoutPrefix,assertJointLayoutContract} from './layoutPrefix.test-helper';
import {prepareVolumeContinuousOutflow,rasterizeContinuousOutflow,voxelCenter,BOUNDS_SIZE} from './volume';
import {CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM,type ContinuousOutflowKernel,type ContinuousOutflowLobe} from './continuousOutflow';

const source=readFileSync(join(dirname(fileURLToPath(import.meta.url)),'volume.ts'),'utf8');
const trace=createLayoutPrefix(source);

describe('continuous outflow keeps the authored layout and retires only collar lineages',()=>{
  it.each([74,77,80])('registers the mature neck/top/first cap and exactly three complete groups on seed%i',seed=>{
    const t=trace(seed),details=t.continuous!;
    expect(t.family).toBe('sheared');expect(details).not.toBeNull();
    const [neck,top,cap]=details.keyframes!;
    const mature=t.summits.reduce((a,b)=>t.lobes[a][1]>t.lobes[b][1]?a:b);
    expect(top).toBe(mature);expect(cap).toBe(t.iceCores[0]);
    expect(neck).toBe(details.necks.find(pair=>pair.top===mature)!.neck);
    expect(new Set([neck,top,cap]).size).toBe(3);
    expect(details.collars).toHaveLength(3);
    const retired=new Set(details.retired);
    expect(details.retired).toHaveLength(273);expect(retired.size).toBe(273);
    const lineage=new Set<number>();
    for(const group of details.collars){
      expect(group.ids).toHaveLength(91);expect(new Set(group.ids).size).toBe(91);
      expect(group.ids).toContain(group.core);
      for(const id of group.ids){expect(id).toBeGreaterThanOrEqual(0);expect(id).toBeLessThan(t.lobes.length);lineage.add(id);}
    }
    expect([...lineage].sort((a,b)=>a-b)).toEqual([...retired].sort((a,b)=>a-b));
    const protectedIds=[...t.summits,...t.foundations,...t.iceCores,...details.necks.map(pair=>pair.neck),
      ...t.shoulders.map(shoulder=>shoulder.core),...t.groups.flatMap(group=>group.ids)];
    for(const id of protectedIds)expect(retired.has(id)).toBe(false);
    expect(t.uniqueLobes).toBe(t.lobes.length);
    expect(t.contraction.map(entry=>entry.axis)).toEqual([0,2]);
    for(const entry of t.contraction){expect(Number.isFinite(entry.extent)).toBe(true);expect(entry.scale).toBeGreaterThan(0);expect(entry.scale).toBeLessThanOrEqual(1);}
    expect(assertJointLayoutContract(t).bodyExact).toBe(true);
  });

  it.each([72,73])('does not install a continuous raccord or retire any primitive on seed%i',seed=>{
    const t=trace(seed);
    expect(t.continuous!.keyframes).toBeNull();
    expect(t.continuous!.collars).toEqual([]);expect(t.continuous!.retired).toEqual([]);
    expect(assertJointLayoutContract(t).mode).toBe('unmodified-family');
  });

  it('keeps extraction fail-closed when the raster or contraction observation anchor changes',()=>{
    const marker='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.';
    expect(()=>createLayoutPrefix(source.replace(marker,'  // changed raster boundary'))).toThrow('Extraction anchor changed');
    expect(()=>createLayoutPrefix(source.replace('    const scale=Math.min(1,limit/extent);','    const scale = Math.min(1,limit/extent);')))
      .toThrow('Extraction anchor changed');
  });
});

describe('owner-side continuous preparation and one bounded MAX merge',()=>{
  it.each([32,64,128,256])('derives error and light-prune band at native size%i without a volume bake',size=>{
    const key:ContinuousOutflowLobe=[0,3,0,.1,.1,.1];
    const prepared=prepareVolumeContinuousOutflow([key,key,key],size);
    const margin=.13+Math.hypot(...BOUNDS_SIZE)/size;
    expect(prepared.stats.negativeBandKm).toBe(Math.max(.35,margin+.16+CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM));
    expect(prepared.stats.fieldFloorKm).toBe(-prepared.stats.negativeBandKm);
    expect(prepared.stats.fieldErrorBoundKm).toBeLessThanOrEqual(7/size/8);
    expect(prepared.stats.kernelCount).toBeLessThanOrEqual(4096);
    expect(prepared.stats.totalRasterVoxelVisits).toBeLessThanOrEqual(256_000_000);
    expect(prepared.raster.bytes).toBeLessThanOrEqual(16*1024*1024);
    expect(prepared.sample(0,3,0)).toBe(.1);
  });

  const size=4,index=(x:number,y:number,z:number)=>(z*size+y)*size+x;
  const kernel=(x:number,y:number,z:number,offset=0):ContinuousOutflowKernel=>({
    lobe:[voxelCenter(x,0,size)+offset,voxelCenter(y,1,size),voxelCenter(z,2,size),1,1,1],
    start:[x,y,z],end:[x,y,z],
  });
  const input=(kernels:readonly ContinuousOutflowKernel[],lastX=1)=>({
    kernels,raster:{start:[1,1,1] as const,end:[lastX,1,1] as const,voxelCount:lastX,bytes:lastX*4},
    stats:{fieldFloorKm:-.35},
  });

  it('MAXes coincident kernels before the single blend, rather than inflating with one blend per kernel',()=>{
    const field=new Float32Array(size**3);field.fill(1);
    const k=kernel(1,1,1);
    rasterizeContinuousOutflow(field,size,input([k,k]));
    expect(field[index(1,1,1)]).toBe(Math.fround(1.04));
    expect([...field].filter(value=>value!==1)).toHaveLength(1);
  });

  it('is independent of kernel order and uses the nonzero tile origin',()=>{
    const a=new Float32Array(size**3),b=new Float32Array(size**3);a.fill(-10);b.fill(-10);
    const first=kernel(1,1,1,.5),second=kernel(1,1,1);
    rasterizeContinuousOutflow(a,size,input([first,second]));
    rasterizeContinuousOutflow(b,size,input([second,first]));
    expect(a).toEqual(b);expect(a[index(1,1,1)]).toBe(1);expect(a[0]).toBe(-10);
  });

  it('keeps the certified negative floor in uncovered tile cells and leaves the exterior untouched',()=>{
    const field=new Float32Array(size**3);field.fill(-10);
    rasterizeContinuousOutflow(field,size,input([kernel(1,1,1)],2));
    expect(field[index(1,1,1)]).toBe(1);
    expect(field[index(2,1,1)]).toBe(Math.fround(-.35));
    expect(field[index(1,2,1)]).toBe(-10);
    expect([...field].every(Number.isFinite)).toBe(true);
  });

  it('rejects an inconsistent native field or over-budget tile before allocating its local envelope',()=>{
    expect(()=>rasterizeContinuousOutflow(new Float32Array(1),size,input([]))).toThrow('native field');
    const over=input([],4_194_305);
    expect(()=>rasterizeContinuousOutflow(new Float32Array(size**3),size,over)).toThrow('owner budget');
    expect(()=>rasterizeContinuousOutflow(new Float32Array(size**3),size,{...input([]),stats:{fieldFloorKm:NaN}}))
      .toThrow('field floor');
  });
});
