import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageDir = dirname(fileURLToPath(import.meta.url));
export const sha = data => createHash('sha256').update(data).digest('hex');

export async function verifyPackage() {
  const manifest = JSON.parse(await readFile(`${packageDir}/manifest.json`, 'utf8'));
  let bytes = 0;
  for (const item of manifest.files) {
    const data = await readFile(`${packageDir}/${item.path}`);
    if (data.length !== item.bytes || sha(data) !== item.sha256) throw Error(`Integrity mismatch: ${item.path}`);
    bytes += data.length;
  }
  if (bytes !== manifest.payloadBytes) throw Error('Payload byte total mismatch');
  const proof = JSON.parse(await readFile(`${packageDir}/proof/comparison-256.json`, 'utf8'));
  for (const [label, filename, source] of [
    ['baseline', 'baseline.mjs', 'baseline/volume.ts'],
    ['candidate-1', 'candidate.mjs', 'candidate/volume.ts'],
  ]) {
    const records = proof.results.filter(item => item.label === label);
    const bundle = sha(await readFile(`${packageDir}/qualified-bundles/${filename}`));
    const sourceHash = sha(await readFile(`${packageDir}/${source}`));
    if (!records.every(item => item.bundleSha256 === bundle && item.sourceSha256 === sourceHash)) {
      throw Error(`Qualified source/bundle identity mismatch: ${label}`);
    }
  }
  const missed = proof.results.reduce((sum, item) => sum + item.support.missed, 0);
  const skipped = proof.results.reduce((sum, item) => sum + item.support.skipped, 0);
  if (missed !== 0 || skipped !== 140692504) throw Error('Recorded support counters mismatch');
  if (!proof.equality.every(item => Object.values(item.channels).every(Boolean))) throw Error('Recorded equality mismatch');
  return { files: manifest.files.length, bytes, missed, skipped };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({ verification: 'Archive integrity and recorded bookkeeping only; no volume regenerated.', ...await verifyPackage() }, null, 2));
}
