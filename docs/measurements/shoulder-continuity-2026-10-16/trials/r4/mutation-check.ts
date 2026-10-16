/** External actual-source branch mutation; no raster or bake. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createLayoutPrefix,assertJointLayoutContract} from '../anatomy-r4-v55-source/src/cumulonimbus/layoutPrefix.test-helper';
const source=readFileSync(new URL('../anatomy-r4-v55-source/src/cumulonimbus/volume.ts',import.meta.url),'utf8');
const anchor='if(selected.projection>0)for(const lobe of innerGroup)';assert.equal(source.split(anchor).length,2);
const mutant=source.replace(anchor,'if(selected.projection>0&&newRoof>oldRoof)for(const lobe of innerGroup)');
writeFileSync(new URL('wrong-recenter-requires-lift.volume.ts',import.meta.url),mutant);
let error='';try{assertJointLayoutContract(createLayoutPrefix(mutant)(2));}catch(caught){error=String(caught);}
assert(error.includes('Recentered shoulder core must lie on its mature feeding axis'),'Real seed2 must reject the incorrect lift-dependent recenter: '+error);
const report={status:'REJECTED_REAL_COVERED_INWARD_BRANCH_MUTANT',seed:2,sourceSHA256:createHash('sha256').update(source).digest('hex'),mutantSHA256:createHash('sha256').update(mutant).digest('hex'),error,newBakeRuns:0};
writeFileSync(new URL('mutation-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
