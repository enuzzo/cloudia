from pathlib import Path
import hashlib,json,resource,subprocess,os,signal,time,sys
p=Path(__file__).resolve().parent
assert sys.argv[1:]==['--execute-reviewed']
f=json.loads((p/'PRE-RUN-FREEZE.json').read_text());assert f['state']=='ROOT_APPROVED_UNEXECUTED'
for row in f['inputs']:
 q=Path(row['path']);assert q.stat().st_size==row['bytes'] and hashlib.sha256(q.read_bytes()).hexdigest()==row['sha256']
assert not (p/'run.json').exists()
start=time.monotonic();r0=resource.getrusage(resource.RUSAGE_SELF)
def limits():resource.setrlimit(resource.RLIMIT_CPU,(20,20))
cmd=[sys.executable,str(p.parent/'archive-payload/verify_saved.py'),str(p.parent/'archive-payload'),'--base-source','/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle27/source','--runtime-source','/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia']
with (p/'stdout.json').open('x') as out,(p/'stderr.log').open('x') as err:
 child=subprocess.Popen(cmd,stdout=out,stderr=err,start_new_session=True,preexec_fn=limits)
 timeout=False
 try:code=child.wait(timeout=40)
 except subprocess.TimeoutExpired:
  timeout=True;os.killpg(child.pid,signal.SIGKILL);code=child.wait()
a=resource.getrusage(resource.RUSAGE_SELF);b=resource.getrusage(resource.RUSAGE_CHILDREN);wall=time.monotonic()-start;cpu=a.ru_utime+a.ru_stime-r0.ru_utime-r0.ru_stime+b.ru_utime+b.ru_stime;rss=a.ru_maxrss+b.ru_maxrss
unchanged=all(Path(x['path']).stat().st_size==x['bytes'] and hashlib.sha256(Path(x['path']).read_bytes()).hexdigest()==x['sha256'] for x in f['inputs'])
try:verified=json.loads((p/'stdout.json').read_text()).get('status')=='SAVED_EVIDENCE_PASS'
except Exception:verified=False
record={'status':'PASS' if code==0 and not timeout and wall<=40 and cpu<=20 and rss<=2*1024**3 and unchanged and verified else 'FAIL','command':cmd,'terminalObserved':True,'exitCode':code,'timedOut':timeout,'wallSeconds':wall,'combinedCPUSeconds':cpu,'conservativeSumOfPeakRSSBytes':rss,'inputHashesUnchanged':unchanged,'scope':'One stdlib saved-evidence verification; no model, mesh, sampler, test, build or GPU replay.'}
(p/'run.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record));sys.exit(0 if record['status']=='PASS' else 1)
