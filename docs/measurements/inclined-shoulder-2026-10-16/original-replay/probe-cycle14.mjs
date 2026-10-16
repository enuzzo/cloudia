import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia';
const qa = dirname(fileURLToPath(import.meta.url));
const require = createRequire(`${repo}/package.json`), { build } = require('esbuild');
const sha = b => createHash('sha256').update(b).digest('hex');
const sizes = (process.argv[2] ?? '32,64').split(',').map(Number);
if (!sizes.every(v => Number.isInteger(v) && v >= 8 && v <= 256)) throw Error('Invalid sizes');
const baselineSections = JSON.parse(await readFile(`${qa}/baseline-sections.json`, 'utf8'));
const seeds = [72, 73, 74, 77, 80], results = [], buffers = new Map();
for (const label of ['baseline', 'candidate-1']) {
  const source = await readFile(`${qa}/${label}/volume.ts`, 'utf8');
  const supportTarget = 'if(field[i]<-supportMargin) {density[i]=0;continue;}';
  if (source.split(supportTarget).length !== 2) throw Error('Expected one support prefilter');
  let code = source.replace('const supportMargin=.13+Math.hypot(...BOUNDS_SIZE)/size;',
    'const supportMargin=.13+Math.hypot(...BOUNDS_SIZE)/size; const supportAudit={skipped:0,missed:0,maxMissed:0};');
  code = code.replace(supportTarget, `if(field[i]<-supportMargin) {
    const py=voxelCenter(y,1,size),ice=smoothstep(iceStart,iceEnd,py);
    const exact=sampleCloudDensity(envelope,detail,voxelCenter(x,0,size),py,voxelCenter(z,2,size),ice);
    supportAudit.skipped++;if(exact>0){supportAudit.missed++;supportAudit.maxMissed=Math.max(supportAudit.maxMissed,exact);}
    density[i]=0;continue;
  }`);
  code = code.replace('return {size, data, sunsetLight, detail, supportBounds:',
    'return {size, data, sunsetLight, detail, diagnostics:{summits,foundations,iceCores,supportAudit}, supportBounds:');
  if (label === 'candidate-1') code += "\nexport { prepareInclinedShoulder } from './inclinedShoulder';\n";
  const stem = `${qa}/${label}-${sizes.join('-')}-probe`;
  await writeFile(`${stem}.ts`, code);
  await build({ stdin: { contents: code, sourcefile: 'volume.ts', resolveDir: `${repo}/src/cumulonimbus`, loader: 'ts' },
    outfile: `${stem}.mjs`, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    plugins: [{ name: 'frozen-shoulder', setup(b) {
      b.onResolve({ filter: /^\.\/inclinedShoulder$/ }, () => ({ path: `${qa}/candidate-1/inclinedShoulder.ts` }));
      b.onResolve({ filter: /^\.\/(light|sun|motion)$/ }, args => ({ path: `${qa}/shared-source/${args.path.slice(2)}.ts` }));
    } }],
  });
  const bundleSha256 = sha(await readFile(`${stem}.mjs`));
  const mod = await import(`${stem}.mjs`);
  for (const size of sizes) for (const seed of seeds) {
    let v = mod.generateVolume(size, seed), r = new Uint8Array(size ** 3);
    let occupied = 0, mass = 0, minFaceClearance = Infinity;
    const faceClearance = [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity];
    for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (z * size + y) * size + x, density = v.data[i * 4]; r[i] = density; mass += density / 255;
      if (!density) continue;
      occupied++;
      const p = [mod.voxelCenter(x, 0, size), mod.voxelCenter(y, 1, size), mod.voxelCenter(z, 2, size)];
      for (let a = 0; a < 3; a++) {
        faceClearance[a * 2] = Math.min(faceClearance[a * 2], p[a] - mod.BOUNDS_MIN[a]);
        faceClearance[a * 2 + 1] = Math.min(faceClearance[a * 2 + 1], mod.BOUNDS_MIN[a] + mod.BOUNDS_SIZE[a] - p[a]);
      }
      minFaceClearance = Math.min(...faceClearance);
    }
    const hash = { density: sha(r), rgba: sha(v.data), sunset: sha(v.sunsetLight), detail: sha(v.detail.data) };
    const item = { label, seed, size, sourceSha256: sha(source), bundleSha256, hash, occupied, mass, minFaceClearance, faceClearance,
      support: v.diagnostics.supportAudit, shoulder: null, originalVoid: null };
    if (label === 'baseline') {
      if (size <= 64) buffers.set(`${size}-${seed}`, r);
    } else {
      const old = buffers.get(`${size}-${seed}`); let decreased = 0, increased = 0;
      if (old) {
        for (let i = 0; i < r.length; i++) { if (r[i] < old[i]) decreased++; if (r[i] > old[i]) increased++; }
        item.densityChange = { increased, decreased };
      } else item.densityChange = { comparison: 'Hashes only; buffers released between large volumes' };
    }
    if ([74, 77, 80].includes(seed)) {
      const { summits, foundations, iceCores } = v.diagnostics;
      const mature = summits.reduce((a, b) => a[1] > b[1] ? a : b), foot = foundations[summits.indexOf(mature)];
      const cap = iceCores.reduce((a, b) => Math.hypot(a[0] - mature[0], a[2] - mature[2]) < Math.hypot(b[0] - mature[0], b[2] - mature[2]) ? a : b);
      const start = [foot[0] + (mature[0] - foot[0]) * .68, foot[1] + (mature[1] - foot[1]) * .68, foot[2] + (mature[2] - foot[2]) * .68];
      const end = [cap[0] + cap[3] * .28, cap[1] - cap[4] * .1, cap[2]];
      if (label === 'candidate-1') {
        const width = Math.max(mature[3] * .95, foot[3] * .62), depth = Math.max(mature[5] * .95, cap[5] * .68);
        const prepared = mod.prepareInclinedShoulder(start, end, width, depth);
        item.shoulder = { start, end, width, depth, min: prepared.min, max: prepared.max };
      }
      const original = baselineSections.result.find(v => v.seed === seed).minimum;
      const { x, y } = original, [lo, hi] = mod.iceHeights(seed), t = Math.max(0, Math.min(1, (y - lo) / (hi - lo))), ice = t * t * (3 - 2 * t);
      let macroMax = 0, fineMax = 0, tau = 0;
      const sections = [];
      for (let k = 0; k < 96; k++) {
        const z = -3.5 + (k + .5) * 7 / 96;
        const macro = mod.sampleDetail({ size, data: v.data }, (x + 5) / 10, (y + .5) / 8.5, (z + 3.5) / 7, 0, false);
        const fine = mod.sampleCloudDensity({ size, data: v.data }, v.detail, x, y, z, ice);
        macroMax = Math.max(macroMax, macro); fineMax = Math.max(fineMax, fine);
        tau += fine * mod.materialExtinction(ice) * 7 / 96;
        sections.push({ z, macro, fine });
      }
      item.originalVoid = { x, y, ice, macroMax, fineMax, tau, sections };
    }
    results.push(item);
    console.log(JSON.stringify({ label, size, seed, support: item.support, minFaceClearance, densityChange: item.densityChange,
      void: item.originalVoid ? { x: item.originalVoid.x, y: item.originalVoid.y, macroMax: item.originalVoid.macroMax, fineMax: item.originalVoid.fineMax, tau: item.originalVoid.tau } : null }));
    v = null; r = null;
    globalThis.gc?.();
    await new Promise(resolve => setImmediate(resolve));
  }
}
const equality = results.filter(v => v.label === 'candidate-1' && [72, 73].includes(v.seed)).map(v => ({
  size: v.size, seed: v.seed, channels: Object.fromEntries(Object.entries(v.hash).map(([key, value]) => [key,
    results.find(w => w.label === 'baseline' && w.size === v.size && w.seed === v.seed).hash[key] === value])),
}));
await writeFile(`${qa}/comparison-${sizes.join('-')}.json`, JSON.stringify({
  description: 'Frozen baseline08c33cb vs one inclined shoulder added only to sheared. Probe coordinates were located on the actual baseline seed-derived sections. Every skipped bake voxel re-evaluated with the fine sampler.',
  frozenDependencies: JSON.parse(await readFile(`${qa}/shared-source/manifest.json`, 'utf8')),
  sizes, seeds, equality, results,
}, null, 2) + '\n');
console.log(JSON.stringify({ unchangedFamilies: equality }));
