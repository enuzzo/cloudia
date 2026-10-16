/** External actual-source mutation checks. Never rasterize or bake. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createLayoutPrefix,assertJointLayoutContract} from '../anatomy-r5-v55-source/src/cumulonimbus/layoutPrefix.test-helper';
const source=readFileSync(new URL('../anatomy-r5-v55-source/src/cumulonimbus/volume.ts',import.meta.url),'utf8'),sha=(s:string)=>createHash('sha256').update(s).digest('hex');
assert.equal(sha(source),'c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d');
const guard='if(selected.projection>0)for(const lobe of innerGroup)',selected='    const selected=candidates.reduce((a,b)=>a.projection>b.projection?a:b);';
const translation='    const translation=[-inner[0]*selected.projection,0,-inner[2]*selected.projection];';
for(const anchor of [guard,selected,translation])assert.equal(source.split(anchor).length,2);
const joint=source.slice(0,source.indexOf('  // Rasterize lobes into')).lastIndexOf("  if(shape.family==='sheared') {");assert(joint>0);
const variants=[
 {name:'r3-forbidden-body-lift',seed:74,source:readFileSync(new URL('references/r3-body-lift.volume.ts',import.meta.url),'utf8'),expected:'Shared body must remain byte-exact'},
 {name:'r4-forbidden-body-lift',seed:74,source:readFileSync(new URL('references/r4-body-lift.volume.ts',import.meta.url),'utf8'),expected:'Shared body must remain byte-exact'},
 {name:'no-joint',seed:74,source:source.replace(guard,guard.replace('if(selected.projection>0)','if(false&&selected.projection>0)')),expected:'Inward component must be removed'},
 {name:'full-axis-collapse',seed:917,source:source.replace(translation,'    const translation=[selected.pivot[0]-selected.core[0],0,selected.pivot[2]-selected.core[2]];'),expected:'Perpendicular'},
 {name:'covered-inward-skipped',seed:2,source:source.replace(guard,guard.replace('if(selected.projection>0)','if(selected.projection>0&&selected.pivot[1]>sharedBody[1]+sharedBody[4])')),expected:'Inward component must be removed'},
 {name:'extra-joint-rng',seed:74,source:source.replace(selected,selected+'\n    rng();'),expected:'AssertionError'},
 {name:'duplicate-alias',seed:74,source:source.slice(0,joint)+'  lobes.push(lobes[0]);\n'+source.slice(joint),expected:'AssertionError'},
];
mkdirSync(new URL('mutations/',import.meta.url));
const results=variants.map(v=>{
 writeFileSync(new URL('mutations/'+v.name+'.volume.ts',import.meta.url),v.source);
 let error='';try{assertJointLayoutContract(createLayoutPrefix(v.source)(v.seed));}catch(caught){error=String(caught);}
 assert(error.includes(v.expected),v.name+' survived or failed for the wrong reason: '+error);
 return {name:v.name,seed:v.seed,sourceSHA256:sha(v.source),expected:v.expected,rejected:true,error:error.slice(0,6000)};
});
const marker='  // Rasterize lobes into their local bounds instead of testing every lobe at every voxel.';let anchorError='';
try{createLayoutPrefix(source.replace(marker,marker.replace('Rasterize','Rasterise')));}catch(caught){anchorError=String(caught);}
assert(anchorError.includes('Extraction anchor changed'));
const report={status:'SEVEN_ACTUAL_SOURCE_MUTANTS_REJECTED',sourceSHA256:sha(source),results,missingMarkerRejectedBeforeTrace:true,anchorError,newBakeRuns:0};
writeFileSync(new URL('mutation-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:results.map(({error,...rest})=>({...rest,error:error.split('\n')[0]}))}));
