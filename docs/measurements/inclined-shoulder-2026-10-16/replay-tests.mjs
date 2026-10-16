import { readFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { packageDir, sha, verifyPackage } from './verify-package.mjs';

await verifyPackage();
const arg = process.argv.indexOf('--repo');
const repo = resolve(arg < 0 ? '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia' : process.argv[arg + 1]);
const comparisons = [
  ['candidate/volume.ts', 'src/cumulonimbus/volume.ts'],
  ['candidate/inclinedShoulder.ts', 'src/cumulonimbus/inclinedShoulder.ts'],
  ['candidate/inclinedShoulder.test.ts', 'src/cumulonimbus/inclinedShoulder.test.ts'],
  ['baseline/volume.test.ts', 'src/cumulonimbus/volume.test.ts'],
  ...['light.ts', 'sun.ts', 'motion.ts'].map(name => [`shared-source/${name}`, `src/cumulonimbus/${name}`]),
];
for (const [archived, current] of comparisons) {
  if (sha(await readFile(`${packageDir}/${archived}`)) !== sha(await readFile(`${repo}/${current}`))) {
    throw Error(`Checkout differs from qualified sources: ${current}. No test or source mutation performed.`);
  }
}
if (!process.argv.includes('--run')) {
  console.log('Qualified source/test identities match the checkout. No tests executed. Add --run to run the 31 focused tests.');
  process.exit(0);
}
if (repo.includes('/Library/CloudStorage/Dropbox/')) {
  execFileSync('git', ['check-ignore', 'node_modules'], { cwd: repo });
  if (execFileSync('git', ['ls-files', '--', 'node_modules'], { cwd: repo, encoding: 'utf8' }).trim()) throw Error('Tracked dependency paths');
  if (execFileSync('xattr', ['-p', 'com.apple.fileprovider.ignore#P', `${repo}/node_modules`], { encoding: 'utf8' }).trim() !== '1') throw Error('Dropbox dependency exclusion missing');
}
const result = spawnSync('npm', ['test', '--', 'src/cumulonimbus/volume.test.ts', 'src/cumulonimbus/inclinedShoulder.test.ts', '--maxWorkers=1'], { cwd: repo, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
