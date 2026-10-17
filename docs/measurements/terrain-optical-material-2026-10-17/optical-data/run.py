"""Single pack wrapper; no model/GPU. Existing Python+NumPy only."""
from pathlib import Path
import argparse,hashlib,json,resource,subprocess,sys,time
HERE=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 started=time.monotonic();self_before=resource.getrusage(resource.RUSAGE_SELF);children_before=resource.getrusage(resource.RUSAGE_CHILDREN)
 parser=argparse.ArgumentParser();parser.add_argument('--source-root',type=Path,required=True);args=parser.parse_args()
 if sys.platform!='darwin':raise RuntimeError('Saved resource budget assumes macOS RSS bytes')
 freeze=json.loads((HERE/'PRE-RUN-FREEZE.json').read_text())
 for row in freeze['files']:
  if sha(HERE/row['path'])!=row['sha256']:raise RuntimeError('Frozen input drift: '+row['path'])
 run=HERE/'run';run.mkdir(exist_ok=False)
 command=[sys.executable,str(HERE/'pack-optical.py'),'--rgb',str(args.source_root/'rgb-linear.f32'),'--validity',str(args.source_root/'valid-area.f32')]
 def limits():resource.setrlimit(resource.RLIMIT_CPU,(10,10))
 with (run/'stdout.log').open('xb') as out,(run/'stderr.log').open('xb') as err:
  process=subprocess.Popen(command,cwd=HERE,stdout=out,stderr=err,preexec_fn=limits)
  try:code=process.wait(timeout=20)
  except subprocess.TimeoutExpired:process.kill();process.wait();code=124
 own=resource.getrusage(resource.RUSAGE_SELF);child=resource.getrusage(resource.RUSAGE_CHILDREN)
 cpu=(own.ru_utime+own.ru_stime-self_before.ru_utime-self_before.ru_stime)+(child.ru_utime+child.ru_stime-children_before.ru_utime-children_before.ru_stime)
 wall=time.monotonic()-started;peak=int(own.ru_maxrss+child.ru_maxrss)
 result={'exitCode':code,'command':command,'cpuCombinedSeconds':cpu,'wallSeconds':wall,'wrapperPeakRssBytes':own.ru_maxrss,'childPeakRssBytes':child.ru_maxrss,'sumPeakRssBytes':peak,'limits':{'cpuCombinedSeconds':10,'wallSeconds':20,'sumPeakRssBytes':192*1024**2},'scope':'OSchildCPU10s;20swait;phase/terminalRSSacceptance,notOSallocationcap;sumpeaksconservative','gatePass':code==0 and cpu<=10 and wall<=20 and peak<=192*1024**2}
 (run/'execution.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
 if not result['gatePass']:raise SystemExit(1)
if __name__=='__main__':main()
