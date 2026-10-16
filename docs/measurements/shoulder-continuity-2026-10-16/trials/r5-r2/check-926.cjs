const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const here=__dirname,r1=path.join(here,'../anatomy-r5-recenter');
const original=fs.readFileSync(path.join(r1,'check-layout.cjs'),'utf8');
assert.equal(crypto.createHash('sha256').update(original).digest('hex'),JSON.parse(fs.readFileSync(path.join(r1,'check-freeze.json'),'utf8')).scripts['check-layout.cjs']);
const anchor='const rows=[];for(const seed of [2,74,77,80,104,119,617,72,73]){';assert.equal(original.split(anchor).length,2);
let common=original.slice(0,original.indexOf(anchor));
const fields='body:sharedBody?lobes.indexOf(sharedBody):null,groups:';
assert.equal(common.split(fields).length,2);
common=common.replace(fields,'body:sharedBody?lobes.indexOf(sharedBody):null,summits:summits.map(l=>lobes.indexOf(l)),foundations:foundations.map(l=>lobes.indexOf(l)),shoulders:authoredShoulders.map(s=>({core:lobes.indexOf(s.core),top:lobes.indexOf(s.top),foundation:lobes.indexOf(s.foundation)})),groups:');
const checks=`
const rows=[];const close=(a,b)=>assert(Math.abs(a-b)<=1e-12,'Geometric invariant mismatch '+a+' '+b);
for(const seed of [926]){
 const a=f.A.trace(seed),r3=f.R3.trace(seed),b=f.R5.trace(seed);assert.equal(a.family,'sheared');
 assert.deepEqual(r3.before,a.lobes);assert.deepEqual(b.before,a.lobes);assert.deepEqual(r3.groups,b.groups);
 for(const t of [a,r3,b])assert.equal(t.uniqueLobes,t.lobes.length);
 assert.deepEqual(a.rng,r3.rngBefore);assert.deepEqual(r3.rngBefore,r3.rng);assert.deepEqual(a.rng,b.rngBefore);assert.deepEqual(b.rngBefore,b.rng);
 const body=b.groups.find(g=>g.core===b.body).ids;assert.equal(body.length,91);
 for(const id of body)assert.deepEqual(b.lobes[id],a.lobes[id],'Shared body91 must remain A');
 // Select the independently archived R3's actually translated group, without copying the new translation formula.
 const r3ChangedXZ=r3.lobes.flatMap((l,i)=>Object.is(l[0],a.lobes[i][0])&&Object.is(l[2],a.lobes[i][2])?[]:[i]);
 let diagnostic={projectionBeforeKm:null,projectionAfterKm:null,perpendicularBeforeKm:null,perpendicularAfterKm:null,r3FullAxisDisplacementM:0,r5InwardOnlyDisplacementM:0};
 if(r3ChangedXZ.length){
  assert.equal(r3ChangedXZ.length,91);const set=new Set(r3ChangedXZ),selected=b.groups.find(g=>g.ids.length===91&&g.ids.every(id=>set.has(id)));assert(selected);
  const authored=b.shoulders.find(s=>s.core===selected.core);assert(authored);const foot=a.lobes[authored.foundation],top=a.lobes[authored.top],other=a.lobes[b.foundations.find(id=>id!==authored.foundation)];
  const axis=[other[0]-foot[0],other[2]-foot[2]],length=Math.hypot(...axis),inner=axis.map(v=>v/length);assert(length>0);
  const core=a.lobes[selected.core],out=b.lobes[selected.core],height=(core[1]-foot[1])/(top[1]-foot[1]);
  const pivot=[foot[0]+(top[0]-foot[0])*height,foot[2]+(top[2]-foot[2])*height];
  const offset=[core[0]-pivot[0],core[2]-pivot[1]],after=[out[0]-pivot[0],out[2]-pivot[1]];
  const along=v=>v[0]*inner[0]+v[1]*inner[1],cross=v=>v[0]*inner[1]-v[1]*inner[0];
  assert(along(offset)>0);close(along(after),0);close(cross(after),cross(offset));
  const delta=[out[0]-core[0],out[2]-core[2]];close(cross(delta),0);assert(along(delta)<0);
  const r3Delta=[r3.lobes[selected.core][0]-core[0],r3.lobes[selected.core][2]-core[2]];
  for(let i=0;i<b.lobes.length;i++){
   if(!set.has(i))assert.deepEqual(b.lobes[i],a.lobes[i],'Unselected tuple must be A');
   else{for(const component of [1,3,4,5,6])assert.equal(b.lobes[i][component],a.lobes[i][component]);
    close(b.lobes[i][0]-out[0],a.lobes[i][0]-core[0]);close(b.lobes[i][2]-out[2],a.lobes[i][2]-core[2]);}
  }
  diagnostic={projectionBeforeKm:along(offset),projectionAfterKm:along(after),perpendicularBeforeKm:cross(offset),perpendicularAfterKm:cross(after),r3FullAxisDisplacementM:Math.hypot(...r3Delta)*1000,r5InwardOnlyDisplacementM:Math.hypot(...delta)*1000};
 }else assert.deepEqual(b.lobes,a.lobes,'Outward full layout must remain A');
 rows.push({seed,lobes:a.lobes.length,changedGroup:r3ChangedXZ.length,body91ExactA:true,rngExactA:true,...diagnostic,tupleSHA256:{A:tupleSHA(a.lobes),R3:tupleSHA(r3.lobes),R5R2:tupleSHA(b.lobes)}});
}
assert(rows[0].projectionBeforeKm>.807&&rows[0].projectionBeforeKm<.808);
const result={status:'PASS',scope:'1 supplemental named actual prefix only, no raster/bake or new 1024 scan',runtime:{node:process.version,arch:process.arch},factories:Object.fromEntries(Object.entries(f).map(([k,v])=>[k,{sourceSHA256:v.sourceSHA256,emittedPrefixSHA256:v.emittedPrefixSHA256}])),oracle:'geometric signed/perpendicular projection and child-relative offset invariants; exact baseline tuples elsewhere. Group identified by actual archived R3 changed X/Z IDs, no copied R5 translation expression.',toleranceKm:1e-12,rows};
fs.writeFileSync(path.join(here,'expected-926.json'),JSON.stringify(result,null,2)+'\\n');console.log(JSON.stringify(result.rows.map(({seed,changedGroup,r3FullAxisDisplacementM,r5InwardOnlyDisplacementM})=>({seed,changedGroup,r3FullAxisDisplacementM,r5InwardOnlyDisplacementM})),null,2));
`;
new Function('require','__dirname',common+checks)(require,here);
