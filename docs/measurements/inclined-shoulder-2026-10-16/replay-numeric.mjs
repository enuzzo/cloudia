import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { packageDir, sha, verifyPackage } from './verify-package.mjs';

await verifyPackage();
const run = process.argv.indexOf('--run');
if (run < 0) {
  console.log('Archive verified. No bake executed. Use --run 64 or --run 256 for a serial CPU replay.');
  process.exit(0);
}
const size = Number(process.argv[run + 1]);
if (![32, 64, 256].includes(size)) throw Error('Allowed replay sizes: 32, 64, 256');
const proofFile = size === 256 ? 'comparison-256.json' : 'comparison-32-64.json';
const proof = JSON.parse(await readFile(`${packageDir}/proof/${proofFile}`, 'utf8'));
let completed = 0;
for (const [label, filename] of [['baseline', 'baseline.mjs'], ['candidate-1', 'candidate.mjs']]) {
  const { generateVolume } = await import(pathToFileURL(`${packageDir}/qualified-bundles/${filename}`).href);
  for (const seed of [72, 73, 74, 77, 80]) {
    let volume = generateVolume(size, seed), density = new Uint8Array(size ** 3);
    for (let i = 0; i < density.length; i++) density[i] = volume.data[i * 4];
    const actual = { density: sha(density), rgba: sha(volume.data), sunset: sha(volume.sunsetLight), detail: sha(volume.detail.data) };
    const expected = proof.results.find(item => item.label === label && item.seed === seed && item.size === size);
    if (!expected) throw Error('Missing qualified record');
    for (const key of Object.keys(actual)) if (actual[key] !== expected.hash[key]) throw Error(`Data hash mismatch: ${label}/${seed}/${key}`);
    const audit = volume.diagnostics.supportAudit;
    for (const key of ['skipped', 'missed', 'maxMissed']) if (audit[key] !== expected.support[key]) throw Error(`Support mismatch: ${label}/${seed}/${key}`);
    completed++;
    console.log(JSON.stringify({ label, seed, size, result: 'CPU data hashes and support counters match', support: audit }));
    volume = null; density = null;
    globalThis.gc?.();
    await new Promise(resolve => setImmediate(resolve));
  }
}
console.log(JSON.stringify({ completed, classification: 'CPU replay; no GPU, screenshot, FPS or artistic qualification' }));
