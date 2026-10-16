/** Verify every immutable payload against manifest.json, without project dependencies. */
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('.',import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const seen=[];
async function visit(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,item.name),key=relative(root,path).split('\\').join('/');
    assert.ok(!item.isSymbolicLink(),`Unexpected symlink ${key}`);
    if(item.isDirectory()){await visit(path);continue;}
    if(key==='manifest.json')continue;
    const expected=manifest.files[key];assert.ok(expected,`Unlisted payload ${key}`);
    const data=await readFile(path),hash=createHash('sha256').update(data).digest('hex');
    assert.equal(data.byteLength,expected.bytes,`Byte count ${key}`);
    assert.equal(hash,expected.sha256,`SHA256 ${key}`);seen.push(key);
  }
}
await visit(root);
assert.deepEqual(seen.sort(),Object.keys(manifest.files).sort(),'Payload coverage mismatch');
console.log(JSON.stringify({status:'PASS',files:seen.length,bytes:manifest.totalBytes,scope:'All archive payloads; manifest itself is the trust anchor, not self-hashed'},null,2));
