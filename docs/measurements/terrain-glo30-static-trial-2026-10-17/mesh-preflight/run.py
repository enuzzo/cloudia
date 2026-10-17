from pathlib import Path
import hashlib,json,resource,subprocess,sys,time
here=Path(__file__).resolve().parent; qa=here.parent; source=qa/'candidate-source'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads((qa/'base-manifest.json').read_text())
for p,h in base.items():assert sha(source/p)==h,p
inputs=[qa/'glo30-dem/glo30-62_5m-recomputed-coast.cdm1.bin',qa/'glo30-dem/holdout-native-m.f64le.bin']
for p in inputs:assert p.is_file(),p
assert sha(inputs[0])=='79f84ba70848724549f65c4d4f6758041f10068dc9885156894c36e7bc2c4cd1'
assert sha(inputs[1])=='be7e34ad823f6499773c556dc6f05524665df1c3a93a26d8703cfb05632b65e9'
assert sys.platform=='darwin','RSS assumes macOS bytes'
freeze={'baseManifestSHA256':sha(qa/'base-manifest.json'),'baseSourceFiles':len(base),'witnessSHA256':sha(here/'witness.ts'),'inputs':{str(p.relative_to(qa)):sha(p) for p in inputs},'limits':{'childCpuSeconds':20,'totalWallSeconds':40,'terminalChildPeakRssBytes':2*1024**3,'offlineProbeCount':2400000,'vertices':1000000,'triangles':2000000,'geometryBytes':64*1024**2},'qualityGateBeforeGPU':'All geometry invariants and budgets pass; fixed canonical-land native-source holdout RMS must improve at least10percent against canonical v60 mesh. Report extrema and regressions without claiming maximum error guarantee. If fails stop candidate without cap relaxation/retry/GPU.','comparison':'New GLO30 sampled62.5m, one existing red/green pass >5m, original256cells/9levels/32m base; source1x, old coast continuously sampled. Not global62.5m mesh, no palette/normal/lighting change.','gpuGate':'If preflight passes, codec+loader static bundle first, source/tests/build, then root+independent fixed native Sun PNG; stop after visualFAIL before worker/weather/FPS. No adoption from RMS.'}
out=here/'run';out.mkdir(exist_ok=False)
(here/'PRE-RUN-FREEZE.json').write_text(json.dumps(freeze,indent=2)+'\n')
started=time.monotonic()
def child_limits():resource.setrlimit(resource.RLIMIT_CPU,(20,20))
before=resource.getrusage(resource.RUSAGE_CHILDREN)
with (out/'stdout.json').open('wb') as stdout,(out/'stderr.log').open('wb') as stderr:
 p=subprocess.Popen(['/Users/enuzzo/.bun/bin/bun','run',str(here/'witness.ts')],cwd=source,stdout=stdout,stderr=stderr,preexec_fn=child_limits)
 try:code=p.wait(timeout=40)
 except subprocess.TimeoutExpired:p.kill();p.wait();code=124
usage=resource.getrusage(resource.RUSAGE_CHILDREN);cpu=usage.ru_utime+usage.ru_stime-before.ru_utime-before.ru_stime;wall=time.monotonic()-started
record={'exitCode':code,'childCpuSeconds':cpu,'totalWallSeconds':wall,'terminalChildPeakRssBytes':usage.ru_maxrss,'resourceGatePass':code==0 and cpu<=20 and wall<=40 and usage.ru_maxrss<=2*1024**3,'scope':'Offline terminal model run. PeakRSS is measured acceptance, not OS allocation cap. No GPU/FPS.'}
if code==0:
 d=json.loads((out/'stdout.json').read_text());ratio=d['holdout']['candidate']['rmsMetres']/d['holdout']['baseline']['rmsMetres'];record['holdoutRMSRatio']=ratio;record['sourceRetentionGatePass']=ratio<=.9
else:record['sourceRetentionGatePass']=False
record['gatePass']=record['resourceGatePass'] and record['sourceRetentionGatePass'];(out/'run.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2),flush=True)
if not record['gatePass']:raise SystemExit(1)
