import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pretransformAnchor,uniformXZ,contraction,recipeIdentity} from './contract.mjs';
const copy=value=>structuredClone(value);

test('anchor lies on the feeding axis while translating both cores and preserving raw liquid',()=>{
 const before={liquid:[[0,1,0,1,1,1]],summits:[[2,5,4,1,1,1],[8,4,0,1,1,1]],foundations:[[0,1,0,1,1,1],[6,1,0,1,1,1]],iceCores:[[1,7,1,2,.4,1,.04],[4,8,2,3,.3,2,.03]]};
 const after=copy(before);for(const core of after.iceCores){core[0]+=2;core[2]+=5;}
 const result=pretransformAnchor(before,after,[2,5]);assert.deepEqual(result.expectedProximal,[3,7,6]);
 const broken=copy(after);broken.iceCores[1][4]+=.1;assert.throws(()=>pretransformAnchor(before,broken,[2,5]),/non-XZ/);
});

test('uniform displacement rejects one forgotten descendant and preserves blend tuple lengths',()=>{
 const before=[[0,2,1,.5,.5,.5],[1,2,3,.2,.2,.2,.03]],after=before.map(l=>[l[0]+2,l[1],l[2]-1,...l.slice(3)]);
 uniformXZ(before,after,[0,1],[2,-1],'fixture');after[1][2]+=.1;
 assert.throws(()=>uniformXZ(before,after,[0,1],[2,-1],'fixture'),/Z shift/);
});

test('whole-axis contraction scales every centre/radius and rejects per-centre clipping',()=>{
 const before=[[-4,2,1,1,.5,.7],[3,4,-1,2,.8,.9,.2]],after=before.map(l=>l.map((v,i)=>i===0||i===3?v*.8:v));
 const result=contraction({axis:0,radius:3,limit:4,extent:5,scale:.8,before,after});assert.equal(result.postExtent,4);
 const clipped=copy(after);clipped[0][0]=Math.max(-3,clipped[0][0]);assert.throws(()=>contraction({axis:0,radius:3,limit:4,extent:5,scale:.8,before,after:clipped}),/Contraction/);
});

test('recipe identity preserves signed-zero bytes and RNG count, without any recipe execution',()=>{
 const a={lobes:[[0,2,3,1,1,1]],afterRng:[{initialSeed:1,calls:3}]},b=copy(a);recipeIdentity(a,b);
 b.lobes[0][0]=-0;assert.throws(()=>recipeIdentity(a,b),/recipe differs/);b.lobes[0][0]=0;b.afterRng[0].calls++;
 assert.throws(()=>recipeIdentity(a,b),/RNG differs/);
});
