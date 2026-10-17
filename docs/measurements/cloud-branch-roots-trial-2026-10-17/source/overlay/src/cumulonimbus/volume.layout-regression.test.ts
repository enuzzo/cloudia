// @vitest-environment node
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe,it,expect} from 'vitest';
import {createLayoutPrefix,assertJointLayoutContract,assertBranchLayoutContract} from './layoutPrefix.test-helper';
const trace=createLayoutPrefix(readFileSync(join(dirname(fileURLToPath(import.meta.url)),'volume.ts'),'utf8'));

describe('inward shoulder projection preserves authored body and lateral irregularity',()=>{
 it.each([104,119])('preserves the entire outward layout on seed%i',seed=>{
  const t=trace(seed),result=assertJointLayoutContract(t);
  expect(result.projection).toBeLessThanOrEqual(0);expect(result.mode).toBe('outward-unchanged');expect(t.lobes).toEqual(t.before);
 });
 it('preserves the entire outward layout already covering its attachment on seed188',()=>{
  const t=trace(188),result=assertJointLayoutContract(t);
  expect(result.mode).toBe('outward-unchanged');expect(t.lobes).toEqual(t.before);
 });
 it('removes the inward shoulder component without changing the body on seed74',()=>{
  const result=assertJointLayoutContract(trace(74));expect(result.projection).toBeGreaterThan(0);expect(result.mode).toBe('inward-projected');expect(result.bodyExact).toBe(true);
 });
 it('still moves the inward shoulder when the body already covers the attachment on seed2',()=>{
  const t=trace(2),result=assertJointLayoutContract(t);
  expect(result.mode).toBe('inward-projected');expect(result.attachmentY!).toBeLessThanOrEqual(result.oldRoof!);expect(result.scale).toBe(1);expect(result.recenterKm!).toBeGreaterThan(0);
  const body=t.groups.find(g=>g.core===t.sharedBody)!;expect(body.ids.map(i=>t.lobes[i])).toEqual(body.ids.map(i=>t.before[i]));
 });
 it.each([323,917])('keeps the nonzero perpendicular shoulder offset on seed%i',seed=>{
  const result=assertJointLayoutContract(trace(seed));expect(result.mode).toBe('inward-projected');
  expect(Math.hypot(...result.perpendicularBeforeXZ!)).toBeGreaterThan(0);expect(Math.hypot(...result.perpendicularAfterXZ!)).toBeGreaterThan(0);
  expect(result.signedAfter!).toBeCloseTo(0,12);
 });
 it.each([72,73])('preserves other morphology families on seed%i',seed=>{expect(assertJointLayoutContract(trace(seed)).mode).toBe('unmodified-family');});
});


describe('height-pinned source-cell branches',()=>{
 it.each([72,73,74])('keeps actual groups, heads and caps while nesting roots on seed%i',seed=>{
  const t=trace(seed),result=assertBranchLayoutContract(t);
  expect(result.movedRoots).toBeGreaterThan(0);expect(result.coreGroupCount).toBeGreaterThan(result.turretCount);
  // The old joint is checked on its actual post-branch input, never on a
  // fabricated layout or a relaxed version of the nine contracts above.
  assertJointLayoutContract(t);
 });
});
