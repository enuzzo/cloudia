#!/usr/bin/env python3
"""Own-child serial monitor. --preflight never imports/runs the volume module."""
from pathlib import Path
import argparse,ctypes,errno,hashlib,json,os,resource,selectors,signal,subprocess,sys,time
HERE=Path(__file__).resolve().parent
class RUsageInfoV2(ctypes.Structure):
 _fields_=[('ri_uuid',ctypes.c_uint8*16)]+[(name,ctypes.c_uint64) for name in (
 'ri_user_time','ri_system_time','ri_pkg_idle_wkups','ri_interrupt_wkups','ri_pageins','ri_wired_size','ri_resident_size','ri_phys_footprint','ri_proc_start_abstime','ri_proc_exit_abstime','ri_child_user_time','ri_child_system_time','ri_child_pkg_idle_wkups','ri_child_interrupt_wkups','ri_child_pageins','ri_child_elapsed_abstime','ri_diskio_bytesread','ri_diskio_byteswritten')]
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def save(path,value):Path(path).write_text(json.dumps(value,indent=2)+'\n')
def monitor_api():
 if sys.platform!='darwin':raise RuntimeError('This wrapper requires macOS libproc; no fallback to ps')
 lib=ctypes.CDLL('/usr/lib/libproc.dylib',use_errno=True)
 lib.proc_pid_rusage.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_void_p];lib.proc_pid_rusage.restype=ctypes.c_int
 def sample(pid):
  info=RUsageInfoV2()
  if lib.proc_pid_rusage(pid,2,ctypes.byref(info))!=0:
   code=ctypes.get_errno();raise OSError(code,os.strerror(code))
  return {'rssBytes':info.ri_resident_size,'physicalFootprintBytes':info.ri_phys_footprint,'cpuSeconds':(info.ri_user_time+info.ri_system_time)/1e9}
 return sample

def preflight():
 frozen=json.loads((HERE/'MANIFEST.json').read_text())
 for entry in frozen['files']:
  path=HERE/entry['path'];assert path.stat().st_size==entry['bytes'] and sha(path)==entry['sha256'],('Frozen executable mismatch',entry['path'])
 config=json.loads((HERE/'PROTOCOL.json').read_text())
 assert sha(HERE/'inputs.json')==config['inputSHA256'];assert json.loads((HERE/'inputs.json').read_text())==config['input']
 assert sha(HERE/'CAMERA.json')==config['input']['cameraSHA256']
 for label,spec in config['variants'].items():
  mpath=HERE/spec['manifest'];assert sha(mpath)==spec['manifestSHA256'],label
  files=json.loads(mpath.read_text());assert len(files)==122
  source=(HERE/spec['source']).resolve()
  for path,digest in files.items():assert sha(source/path)==digest,(label,path)
  link=source/'node_modules';assert link.is_symlink();target=link.resolve(strict=True)
  attr=subprocess.check_output(['xattr','-p','com.apple.fileprovider.ignore#P',str(target)],text=True).strip();assert attr=='1',(label,'dependency ignore attribute')
  if label=='A':assert files['src/cumulonimbus/volume.ts']==config['baselineVolumeSHA256']
  else:assert files['src/cumulonimbus/volume.ts']==config['candidateVolumeSHA256']
 sample=monitor_api();own=sample(os.getpid())
 assert 0<own['rssBytes']<config['limits']['maxRSSBytes'];assert abs(own['cpuSeconds']-time.process_time())<1,'libproc CPU units/layout mismatch'
 return config,sample,{'status':'PREFLIGHT_PASS_NO_BAKE','wrapperPID':os.getpid(),'ownLibprocSample':own,'sourcesVerified':{'A':122,'B':122},'manifestSHA256':sha(HERE/'MANIFEST.json')}

def main():
 ap=argparse.ArgumentParser();mode=ap.add_mutually_exclusive_group(required=True);mode.add_argument('--preflight',action='store_true');mode.add_argument('--execute',action='store_true');ap.add_argument('--output-dir');args=ap.parse_args()
 config,sample,proof=preflight();print(json.dumps(proof),flush=True)
 if args.preflight:return
 if not args.output_dir:raise SystemExit('--output-dir required; evidence must go outside the frozen code folder')
 output=Path(args.output_dir).resolve();assert output!=HERE and HERE not in output.parents;output.mkdir(parents=True,exist_ok=False)
 save(output/'preflight.json',proof)
 limits=config['limits'];results=[]
 def cpu_limit():resource.setrlimit(resource.RLIMIT_CPU,(limits['kernelCpuSeconds'],limits['kernelCpuSeconds']))
 for label in ['A','B']:
  outfile=output/(label+'-rays.json');logpath=output/(label+'.log');command=['bun',str(HERE/'probe.ts'),label,str(HERE/'PROTOCOL.json'),str(outfile)]
  before=resource.getrusage(resource.RUSAGE_CHILDREN);started=time.monotonic();reason=None;peakRSS=0;peakFootprint=0;last=None;monitorSamples=0;terminal=False
  with logpath.open('w',buffering=1) as log:
   def emit(value):line=json.dumps(value);print(line,flush=True);log.write(line+'\n')
   child=subprocess.Popen(command,cwd=HERE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=cpu_limit)
   emit({'event':'START','variant':label,'pid':child.pid,'command':command,'limitsPerVariant':limits})
   sel=selectors.DefaultSelector();sel.register(child.stdout,selectors.EVENT_READ);nextbeat=started+15;stopAt=None
   while True:
    for key,_ in sel.select(timeout=.25):
     chunk=os.read(key.fileobj.fileno(),65536)
     if chunk:value=chunk.decode('utf-8',errors='replace');print(value,end='',flush=True);log.write(value)
     else:sel.unregister(key.fileobj)
    now=time.monotonic();code=child.poll();terminal=code is not None
    if not terminal:
     try:
      last=sample(child.pid);monitorSamples+=1;peakRSS=max(peakRSS,last['rssBytes']);peakFootprint=max(peakFootprint,last['physicalFootprintBytes'])
      if last['rssBytes']>limits['maxRSSBytes']:reason=reason or 'RSS_LIMIT'
      if last['cpuSeconds']>=limits['kernelCpuSeconds']:reason=reason or 'CPU_LIMIT'
     except OSError as error:
      if child.poll() is None:reason=reason or ('LIBPROC_MONITOR_FAILED:'+str(error.errno))
     if now-started>=limits['wallSeconds']:reason=reason or 'WALL_LIMIT'
     if reason and stopAt is None:stopAt=now;child.terminate();emit({'event':'STOP_REQUEST','variant':label,'pid':child.pid,'reason':reason})
     if stopAt is not None and now-stopAt>=2 and child.poll() is None:child.kill()
    if now>=nextbeat:
     emit({'event':'HEARTBEAT','variant':label,'pid':child.pid,'terminal':terminal,'elapsedSeconds':now-started,'lastLibproc':last,'peakRSSBytesSampled':peakRSS,'reason':reason});nextbeat=now+15
    if child.poll() is not None and not sel.get_map():break
   code=child.wait();after=resource.getrusage(resource.RUSAGE_CHILDREN)
   # On Darwin ru_maxrss is bytes. This is an upper bound over all owned child runs;
   # <=limit therefore also bounds this variant, even if A established a larger peak.
   cumulativePeak=int(after.ru_maxrss)
   if cumulativePeak>limits['maxRSSBytes']:reason=reason or 'TERMINAL_CHILD_PEAK_RSS_LIMIT'
   cpu=(after.ru_utime-before.ru_utime)+(after.ru_stime-before.ru_stime);elapsed=time.monotonic()-started
   if cpu>limits['kernelCpuSeconds']:reason=reason or 'TERMINAL_CPU_LIMIT'
   if elapsed>limits['wallSeconds']:reason=reason or 'TERMINAL_WALL_LIMIT'
   validation=None
   if code==0 and outfile.exists():
    data=json.loads(outfile.read_text());assert data['variant']==label and len(data['rays'])==13 and data['centerHalf']['stepKm']==.0005
    assert data['volume']==256 and data['detail']==128 and data['flow']==16
    assert data['origin']==config['input']['origin'] and data['inspection']==.6
    validation={'rays':13,'centerHalfMetre':True,'terrainLimited':data['terrainLimited'],'resultSHA256':sha(outfile)}
   item={'variant':label,'command':command,'pid':child.pid,'terminalObservedByPopen':True,'exitCode':code,'signal':-code if code<0 else None,'reason':reason,'elapsedSeconds':elapsed,'childCpuSeconds':cpu,'peakRSSBytesSampled':peakRSS,'cumulativeOwnedChildPeakRSSBytes':cumulativePeak,'peakPhysicalFootprintBytesSampled':peakFootprint,'libprocSamples':monitorSamples,'lastLibproc':last,'validation':validation,'status':'PASS_EXECUTION' if code==0 and reason is None and validation is not None else 'FAIL_EXECUTION'}
   results.append(item);save(output/'execution.json',results);emit({'event':'TERMINAL',**item})
   if item['status']!='PASS_EXECUTION':raise SystemExit(1)
 preflight() # Input/executable/source/dependency digests still fixed after both children.
 a=json.loads((output/'A-rays.json').read_text());b=json.loads((output/'B-rays.json').read_text())
 assert a['origin']==b['origin'] and a['target']==b['target'] and a['state']==b['state'] and a['wind']==b['wind'] and a['drift']==b['drift']
 rows=[]
 def delta(a,b):return None if a is None or b is None else (b-a)*1000
 for ar,br in zip(a['rays'],b['rays']):
  assert ar['uv']==br['uv'] and ar['ray']==br['ray']
  af=ar['first'];bf=br['first']
  rows.append({'uv':ar['uv'],'firstDensityDeltaMetres':delta(af['rho002']['sampleDistanceKm'] if af['rho002'] else None,bf['rho002']['sampleDistanceKm'] if bf['rho002'] else None),'tau1DeltaMetres':delta(af['tau1'],bf['tau1']),'tau3DeltaMetres':delta(af['tau3'],bf['tau3']),'weightedDepthDeltaMetres':delta(ar['weighted']['distanceKm'],br['weighted']['distanceKm']),'Afirst':af,'Bfirst':bf,'Aweighted':ar['weighted'],'Bweighted':br['weighted'],'terrainProvenA':ar['terrain']['provenUnoccluded'],'terrainProvenB':br['terrain']['provenUnoccluded']})
 summary={'status':'COMPLETE_SPARSE_CPU_ONLY','rows':rows,'rays':13,'cameraEqual':True,'flowEqual':a['hashes']['flowRGBA16F']==b['hashes']['flowRGBA16F'],'detailRGBNote':'Detail alpha contains occupancy and may change with volume; raw fullRGBA hash is not an RGB equality test','centerHalfMetre':{'A':a['centerHalf']['first'],'B':b['centerHalf']['first'],'weightedDepthDeltaMetres':delta(a['centerHalf']['weighted']['distanceKm'],b['centerHalf']['weighted']['distanceKm'])},'execution':results,'scope':'Depth/opacity only; no art/RGB/performance acceptance. No retry.'}
 save(output/'comparison.json',summary)
 print(json.dumps({'event':'SERIAL_COMPLETE','rays':13,'output':str(output)}),flush=True)
if __name__=='__main__':main()
