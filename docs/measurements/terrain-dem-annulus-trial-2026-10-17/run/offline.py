"""Root executor for one frozen source command. Explicit test/build only."""
import hashlib,json,os,signal,subprocess,sys,time
from pathlib import Path
R=Path(__file__).resolve().parent;S=R.parent/'patch-source';C=Path('/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia')
name=sys.argv[1];label=sys.argv[2] if len(sys.argv)>2 else name;commands={'tests':['/Users/enuzzo/.bun/bin/bun','run','test','--maxWorkers=2'],'app':['/Users/enuzzo/.bun/bin/bun','run','build'],'hero':['/Users/enuzzo/.bun/bin/bun','run','build:hero']}
if name not in commands:raise ValueError(name)
f=json.loads((R/'SOURCE-FREEZE-R2.json').read_text())
def verify():
 for p,digest in f.items():
  if hashlib.sha256((S/p).read_bytes()).hexdigest()!=digest:raise RuntimeError('Source changed: '+p)
 v=subprocess.run(['/usr/bin/xattr','-p','com.apple.fileprovider.ignore#P',str(C/'node_modules')],capture_output=True,check=True,timeout=3)
 if v.stdout.strip()!=b'1':raise RuntimeError('Dropbox ignore differs')
verify();started=time.monotonic();timeout=False
with (R/(label+'-r2.log')).open('xb') as log:
 p=subprocess.Popen(commands[name],cwd=S,stdout=log,stderr=subprocess.STDOUT,start_new_session=True,env=dict(os.environ,BUN_RUNTIME_TRANSPILER_CACHE_PATH=str(R/'transpiler-cache')))
 try:code=p.wait(timeout=180)
 except subprocess.TimeoutExpired:
  timeout=True;os.killpg(p.pid,signal.SIGKILL);code=p.wait()
wall=time.monotonic()-started;verify()
receipt=dict(command=commands[name],cwd=str(S),exitCode=code,wallSeconds=wall,wallLimitSeconds=180,wallKilled=timeout,sourceSHA256=hashlib.sha256((R/'SOURCE-FREEZE-R2.json').read_bytes()).hexdigest(),sourceStable=True,dependencyIgnoreReadback='1')
(R/(label+'-r2-receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));sys.exit(0 if code==0 and not timeout else 1)
