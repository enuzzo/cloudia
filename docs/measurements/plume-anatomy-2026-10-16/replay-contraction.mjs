/** Portable CPU replay. No project dependencies, build, GPU, browser or file output. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sha=value=>createHash('sha256').update(value).digest('hex');
const expected=JSON.parse(await readFile(new URL('./numerical/candidate-2-vs-3-contraction.json',import.meta.url),'utf8'));
const results=[];
for(const version of [2,3]){
  const label=`candidate-${version}`;
  const source=await readFile(new URL(`./sources/${label}/volume.ts`,import.meta.url));
  const helper=await readFile(new URL(`./sources/${label}/morphology.ts`,import.meta.url));
  const {generateVolume}=await import(new URL(`./audit-code/${label}-contraction-audit.mjs`,import.meta.url));
  for(const seed of [72,73,74]){
    const size=64,volume=generateVolume(size,seed),density=new Uint8Array(size**3);
    for(let i=0;i<density.length;i++)density[i]=volume.data[i*4];
    const actual={label,seed,size,sourceSha256:sha(source),helperSha256:sha(helper),
      densitySha256:sha(density),rgbaSha256:sha(volume.data),sunsetSha256:sha(volume.sunsetLight),
      contraction:volume.contractionAudit};
    const record=expected.results.find(item=>item.label===label&&item.seed===seed&&item.size===size);
    assert.ok(record,`Missing expected ${label} seed${seed}`);
    // No timestamps, elapsed time or absolute paths participate in this comparison.
    assert.deepEqual(actual,record,`${label} seed${seed} replay differs`);
    results.push({label,seed,matching:true,densitySha256:actual.densitySha256,
      maximumPositionErrorKm:Math.max(...actual.contraction.map(axis=>axis.maximumPositionError))});
  }
}
console.log(JSON.stringify({status:'PASS',method:'Six exact64-cubed generated buffer and contraction-record comparisons; no render claim',results},null,2));
