from pathlib import Path
import hashlib,json,resource,subprocess,sys,time
root=Path(__file__).resolve().parent
source=root.parent/'crease-source'
started=time.monotonic()
manifest=json.loads((root.parent/'crease-manifest.json').read_text())
for path,digest in manifest.items():
 assert hashlib.sha256((source/path).read_bytes()).hexdigest()==digest,path
assert sys.platform=='darwin','RSS gate assumes macOS byte units'
out=root/'run'
out.mkdir(exist_ok=False)
freeze={'sourceManifestSHA256':hashlib.sha256((root.parent/'crease-manifest.json').read_bytes()).hexdigest(),'witnessSHA256':hashlib.sha256((root/'witness.ts').read_bytes()).hexdigest(),'limits':{'childCpuSeconds':20,'totalWallSeconds':40,'terminalChildPeakRssBytes':2*1024**3},'scope':'One actual fixed45degree crease model. Terminal macOS peakRSS is an acceptance gate, not an OS memory cap. No retry or GPU.'}
(root/'PRE-RUN-FREEZE.json').write_text(json.dumps(freeze,indent=2)+'\n')
def limits():resource.setrlimit(resource.RLIMIT_CPU,(20,20))
before=resource.getrusage(resource.RUSAGE_CHILDREN)
with (out/'stdout.json').open('wb') as stdout,(out/'stderr.log').open('wb') as stderr:
 proc=subprocess.Popen(['/Users/enuzzo/.bun/bin/bun','run',str(root/'witness.ts')],cwd=source,stdout=stdout,stderr=stderr,preexec_fn=limits)
 try:code=proc.wait(timeout=max(.001,40-(time.monotonic()-started)))
 except subprocess.TimeoutExpired:
  proc.kill();proc.wait();code=124
usage=resource.getrusage(resource.RUSAGE_CHILDREN)
cpu=usage.ru_utime+usage.ru_stime-before.ru_utime-before.ru_stime
wall=time.monotonic()-started
record={'exitCode':code,'childCpuSeconds':cpu,'totalWallSeconds':wall,'terminalChildPeakRssBytes':usage.ru_maxrss,'scope':freeze['scope'],'gatePass':code==0 and cpu<=20 and wall<=40 and usage.ru_maxrss<=2*1024**3}
(out/'run.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2),flush=True)
if not record['gatePass']:raise SystemExit(1)
