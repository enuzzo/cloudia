"""One direct owned Bun child; bounded live RSS, CPU and wall, no ps/retry."""
from pathlib import Path
import ctypes,os,sys,json,hashlib,time,signal,subprocess,resource,struct
ROOT=Path(__file__).resolve().parent
CPU_LIMIT=180;WALL_LIMIT=240.;RSS_LIMIT=2*1024**3
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,value):(ROOT/name).write_text(json.dumps(value,indent=2)+'\n')
lib=ctypes.CDLL('/usr/lib/libproc.dylib',use_errno=True)
lib.proc_pidinfo.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int]
lib.proc_pidinfo.restype=ctypes.c_int
# SDK sys/proc_info.h: six uint64 then twelve int32, resident bytes at offset8.
def read_rss(pid):
    data=ctypes.create_string_buffer(96);n=lib.proc_pidinfo(pid,4,0,data,96)
    if n!=96:raise RuntimeError(f'libproc RSS monitor failed pid={pid},bytes={n},errno={ctypes.get_errno()}')
    return struct.unpack_from('Q',data.raw,8)[0]
def limits():resource.setrlimit(resource.RLIMIT_CPU,(CPU_LIMIT,CPU_LIMIT))
def on_signal(sig,frame):raise RuntimeError(f'Wrapper interrupted by signal{sig}')
for sig in [signal.SIGINT,signal.SIGTERM,signal.SIGHUP]:signal.signal(sig,on_signal)

def main():
    name=sys.argv[1];inputs=json.loads((ROOT/'input-manifest.json').read_text());case=inputs['cases'][name]
    control=ROOT/(name+'-control.json');assert not control.exists(),'No restart permitted'
    if name=='B-candidate':
        a=json.loads((ROOT/'A-baseline-control.json').read_text());v=json.loads((ROOT/'A-baseline-validation.json').read_text())
        assert a['exitCode']==0 and a['status']=='PASS_ONE_BOUNDED_FULL_QUALITY_CPU_DIAGNOSTIC' and v['status']=='PASS_VALID_FULL_QUALITY_MORPHOLOGY_JSON'
        assert sha(ROOT/'A-baseline.json')==v['outputSha256']
    freeze=json.loads((ROOT/'pre-run-freeze.json').read_text())
    for file,expected in freeze['sha256'].items():assert sha(ROOT/file)==expected,file
    source=Path(case['source']);manifest=Path(case['manifest']);assert sha(manifest)==case['expected']
    records=json.loads(manifest.read_text());assert len(records)==119
    for file,expected in records.items():assert sha(source/file)==expected,(name,file)
    directory=Path(case['runDirectory']);script=directory/'scripts/qa-morphology.ts'
    assert (directory/'src').resolve()==source/'src'
    assert sha(script)==inputs['commonScriptSha256'] and sha(Path(inputs['sameBunBinary']))==inputs['bunBinarySha256']
    assert read_rss(os.getpid())<RSS_LIMIT
    output=ROOT/(name+'.json');assert not output.exists()
    command=[inputs['sameBunBinary'],str(script),str(output),'256','617']
    start=time.monotonic();peak=0;sample_count=0;next_log=0.;p=None;error=None;exit_code=None
    write(control.name,{'status':'STARTING_ONE_ATTEMPT','command':command,'startedAtUnix':time.time(),'sourceManifestSha256':case['expected']})
    try:
        with open(ROOT/(name+'.log'),'xb') as stream:
            p=subprocess.Popen(command,cwd=directory,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
            print(json.dumps({'case':name,'pid':p.pid,'status':'STARTED','command':command}),flush=True)
            while p.poll() is None:
                elapsed=time.monotonic()-start
                if elapsed>WALL_LIMIT:raise TimeoutError(f'wall{elapsed:.3f}s exceeds{WALL_LIMIT}s')
                try:rss=read_rss(p.pid)
                except RuntimeError:
                    if p.poll() is not None:break
                    raise
                peak=max(peak,rss);sample_count+=1
                if rss>RSS_LIMIT:raise MemoryError(f'live RSS{rss} exceeds{RSS_LIMIT}')
                if elapsed>=next_log:
                    print(json.dumps({'case':name,'elapsedSeconds':elapsed,'rssMiB':rss/1024**2,'sampledPeakMiB':peak/1024**2}),flush=True);next_log=elapsed+15
                time.sleep(.05)
            exit_code=p.wait()
    except BaseException as failure:error=f'{type(failure).__name__}: {failure}'
    finally:
        if p is not None:
            if p.poll() is None:
                try:os.killpg(p.pid,signal.SIGTERM)
                except ProcessLookupError:pass
                try:p.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    try:os.killpg(p.pid,signal.SIGKILL)
                    except ProcessLookupError:pass
                    p.wait()
            exit_code=p.wait()
        usage=resource.getrusage(resource.RUSAGE_CHILDREN)
        highwater=usage.ru_maxrss if sys.platform=='darwin' else usage.ru_maxrss*1024
    elapsed=time.monotonic()-start
    success=error is None and exit_code==0 and output.exists() and highwater<=RSS_LIMIT and elapsed<=WALL_LIMIT
    report={'status':'PASS_ONE_BOUNDED_FULL_QUALITY_CPU_DIAGNOSTIC' if success else 'FAIL_STOP_NO_RESTART',
      'case':name,'command':command,'exitCode':exit_code,'error':error,'elapsedSeconds':elapsed,
      'childCpuSeconds':usage.ru_utime+usage.ru_stime,'cpuLimitSeconds':CPU_LIMIT,'wallLimitSeconds':WALL_LIMIT,
      'sampledPeakRssBytes':peak,'sampleCount':sample_count,'lifetimeHighwaterRssBytes':highwater,'rssLimitBytes':RSS_LIMIT,
      'rssMonitor':'libproc PROC_PIDTASKINFO every50ms + child self-checks; final exact RUSAGE_CHILDREN highwater',
      'ownedChildReaped':p is not None and p.returncode is not None,'sourceManifestSha256':case['expected'],
      'scriptSha256':sha(script),'outputSha256':sha(output) if output.exists() else None,
      'noPs':True,'noRestart':True,'noVolumeDataMutation':True}
    write(control.name,report);print(json.dumps(report),flush=True)
    return 0 if success else 1

if __name__=='__main__':
    try:sys.exit(main())
    except Exception as error:
        write('wrapper-precondition-failure-'+(sys.argv[1] if len(sys.argv)>1 else 'missing')+'.json',{'status':'STOP_BEFORE_CHILD_OR_AFTER_CLEANUP','error':str(error)})
        raise
