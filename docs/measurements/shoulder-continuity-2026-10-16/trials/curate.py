from pathlib import Path,PurePosixPath
import hashlib,json,gzip,datetime,subprocess,time
here=Path(__file__).resolve().parent;cycle=here.parent
sha=lambda data:hashlib.sha256(data).hexdigest()
# Explicit manifests, never recursive source/build directory copies.
settings=[
 ('r3',cycle/'anatomy-r3-v55-evidence','MANIFEST.json','evidence',None,[]),
 ('r4',cycle/'anatomy-r4-v55-qualification','MANIFEST.json','evidence',None,[]),
 ('r5-r1',cycle/'anatomy-r5-recenter','MANIFEST.json','dict','659e968d949caa9320938fbc67ec6f9ece7a3dd82691bd7b128f9b20b6d06e13',[]),
 ('r5-r2',cycle/'anatomy-r5-r2-inward','MANIFEST.json','dict','b78e8b56e4aa3338425f00dd3040bbb0b766fa0f10ca79c74a08a721254a5756',['independent-verification.json']),
 ('morphology617-r1',cycle/'morphology617-ab','MANIFEST-R1.json','list','1495fce6254ac9c599c107df4cf13d560e3d42f6069422eb8ac8c9364c9329ca',[]),
 ('morphology617-r2',cycle/'morphology617-ab-r2','MANIFEST.json','list','74050adc4bc0c044dfb968d50a07801ad1b076bdd8c05368a6f4ffd9dfc8a00c',['independent-verification.json'])]
protocol={'status':'CURATION ONLY; no model, scanner, test, build, browser or GPU','frozenUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'groups':[{'group':g,'externalRoot':str(root),'manifest':name,'schema':kind} for g,root,name,kind,_,_ in settings],'selection':'Every evidence payload row in the six listed manifests, the manifests themselves and two existing derived verification JSON; no source snapshot, dist, hero-dist, dependency symlink, raw volume or photograph','compression':'gzip level9 mtime0 only for JSON/log/patch/CSV >=8192bytes; all decompressed bytes unchanged; small scripts and original filenames preserved otherwise','originalRawByteCap':3*1024**2,'offline':'original R4 verifier may read frozen source/dist to verify hashes; this is not another prefix/model/test execution; stdout/stderr and exit status retained separately'}
assert not (here/'PROTOCOL.json').exists();(here/'PROTOCOL.json').write_text(json.dumps(protocol,indent=2)+'\n')
records=[];groups=[];prevalidated=[]
for group,root,name,kind,expected,extras in settings:
 originalManifest=(root/name).read_bytes();digest=sha(originalManifest)
 if expected:assert digest==expected,(group,'frozen manifest drift')
 manifest=json.loads(originalManifest)
 if kind=='evidence':entries=manifest['evidence']['files'];assert len(entries)==manifest['evidence']['fileCount'];assert sum(x['bytes'] for x in entries)==manifest['evidence']['payloadBytes']
 elif kind=='dict':entries=[{'path':p,**info} for p,info in manifest['files'].items()]
 else:entries=manifest['files'];assert len(entries)==manifest['payloadFiles'];assert sum(x['bytes'] for x in entries)==manifest['payloadBytes']
 for item in entries:
  rel=PurePosixPath(item['path']);assert not rel.is_absolute() and '..' not in rel.parts
  path=root/str(rel);assert path.is_file() and not path.is_symlink();raw=path.read_bytes();assert len(raw)==item['bytes'] and sha(raw)==item['sha256'],(group,str(rel),'payload drift')
  assert not set(rel.parts)&{'node_modules','candidate-source','dist','hero-dist'} and path.suffix.lower() not in {'.jpg','.jpeg','.png','.bin','.raw'}
  prevalidated.append((group,root,str(rel),raw,'manifest payload'))
 for rel in [name]+extras:
  raw=(root/rel).read_bytes();prevalidated.append((group,root,rel,raw,'original manifest' if rel==name else 'existing derived verification'))
 groups.append({'group':group,'externalRoot':str(root),'originalManifest':name,'originalManifestSHA256':digest,'manifestSchema':kind,'originalPayloadFiles':len(entries),'selectedFiles':len(entries)+1+len(extras),'selectedOriginalBytes':sum(len(row[3]) for row in prevalidated if row[0]==group)})
assert sum(len(x[3]) for x in prevalidated)<protocol['originalRawByteCap']
# All selected originals have been verified before any payload is copied.
for group,root,rel,raw,role in prevalidated:
 compress=Path(rel).suffix.lower() in {'.json','.log','.patch','.csv'} and len(raw)>=8192
 stored=f'{group}/{rel}'+('.gz' if compress else '')
 out=here/stored;out.parent.mkdir(parents=True,exist_ok=True);assert not out.exists()
 body=gzip.compress(raw,compresslevel=9,mtime=0) if compress else raw;out.write_bytes(body)
 if compress:assert gzip.decompress(body)==raw and body[4:8]==b'\x00'*4
 records.append({'group':group,'originalPath':rel,'externalOriginal':str(root/rel),'role':role,'originalSHA256':sha(raw),'originalBytes':len(raw),'storedPath':stored,'compression':'gzip-mtime0' if compress else 'identity','storedSHA256':sha(body),'storedBytes':len(body)})
# Original verifier performs saved-file/hash/schema reductions only. Capture outside its immutable directory.
start=time.monotonic();result=subprocess.run(['python3',str(cycle/'anatomy-r4-v55-qualification/verify.py')],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
(here/'r4-offline-verifier.stdout.json').write_bytes(result.stdout)
(here/'r4-offline-verifier.stderr.txt').write_bytes(result.stderr)
control={'kind':'original frozen R4 offline verification only','command':['python3',str(cycle/'anatomy-r4-v55-qualification/verify.py')],'exitCode':result.returncode,'elapsedSeconds':time.monotonic()-start,'stdoutSHA256':sha(result.stdout),'stderrSHA256':sha(result.stderr),'noPrefixOrBakeExecution':True}
(here/'r4-offline-verifier-control.json').write_text(json.dumps(control,indent=2)+'\n')
(here/'copy-record.json').write_text(json.dumps({'schema':'curated-lossless-copy-v1','groups':groups,'records':records},indent=2)+'\n')
summary={'status':'CURATED_ARCHIVE, NOT PRODUCT OR ART ACCEPTANCE','copiedOriginalFiles':len(records),'copiedOriginalBytes':sum(r['originalBytes'] for r in records),'storedCopiedBytes':sum(r['storedBytes'] for r in records),'gzipFiles':sum(r['compression']=='gzip-mtime0' for r in records),'groups':groups,'r4OfflineVerifierExitCode':result.returncode,'noNewModelTestBuildExecution':True}
(here/'curation-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
if result.returncode:print('R4 verifier failed; stdout and error preserved. Do not relabel PASS.');raise SystemExit(result.returncode)
