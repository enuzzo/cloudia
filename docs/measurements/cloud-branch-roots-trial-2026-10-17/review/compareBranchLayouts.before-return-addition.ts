/** External diagnostic only. No top-level recipe call; root runs once after freeze.
 * Actual canonical/candidate source text is required; no inverted-transform fixture.
 * Exactly72/73/74, prefix only, no volume/detail/raster/bake allocation.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLayoutPrefix,assertBranchLayoutContract,assertJointLayoutContract} from '../branched-source/src/cumulonimbus/layoutPrefix.test-helper';

export function compareBranchLayouts(canonicalSource:string,candidateSource:string) {
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
 const canonicalSHA256=hash(canonicalSource),candidateSHA256=hash(candidateSource);
 assert.equal(canonicalSHA256,'c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d');
 assert.equal(candidateSHA256,'d161e2efd350f38cce6ee353ef70a0af45a689c90c75d74f99d81213b4895003');
 const actualA=createLayoutPrefix(canonicalSource),actualB=createLayoutPrefix(candidateSource);
 const rows=[72,73,74].map(seed=>{
  const a=actualA(seed),b=actualB(seed);
  assert.equal(a.family,b.family);assert.equal(a.uniqueLobes,b.uniqueLobes);
  assert.deepEqual(b.branch.before,a.before,'Every actual pre-branch tuple must equal canonical A');
  assert.deepEqual(b.branch.beforeRng,a.beforeRng,'Actual layout RNG streams/counts must equal canonical A');
  assert.deepEqual(b.afterRng,a.afterRng,'Final layout RNG streams/counts must equal canonical A');
  assert.deepEqual(b.branch.turrets,a.branch.turrets,'Turret/core/head IDs must equal canonical source ownership');
  assert.deepEqual(b.branch.groups,a.branch.groups,'Actual generic descendant ID order must equal canonical A');
  const branch=assertBranchLayoutContract(b),joint=assertJointLayoutContract(b);
  return {seed,family:b.family,primitiveCount:b.lobes.length,branch,joint,
   rng:b.afterRng,heads:b.summits,caps:b.branch.iceCores,turrets:b.branch.turrets,groups:b.branch.declaredGroups,
   canonicalBefore:a.before,afterBranch:b.branch.after,afterJoint:b.lobes};
 });
 return {scope:'three actual source prefixes; no dense generation/GPU/art acceptance',canonicalSHA256,candidateSHA256,rows};
}
