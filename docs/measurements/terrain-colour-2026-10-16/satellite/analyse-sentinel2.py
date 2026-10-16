"""Separate serial diagnostics after the R2 accumulation process has exited."""
from pathlib import Path
import importlib.util,json,time,sys
import numpy as np
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('s2r2',ROOT/'preprocess-sentinel2.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)

def run():
    start=time.perf_counter()
    assert not (ROOT/'analysis-started.json').exists(),'Refuse diagnostic rerun'
    s.write_json('analysis-started.json',{'startedAtUnix':time.time(),'scope':'No aggregation; read immutable R2 output in separate process'})
    freeze=json.loads((ROOT/'pre-run-freeze.json').read_text())
    for name,expected in freeze['sha256'].items():assert s.file_sha(ROOT/name)==expected,f'Frozen drift {name}'
    pre=json.loads((ROOT/'preprocess-result.json').read_text())
    for record in [pre['rgb'],pre['validity']]:
        assert s.file_sha(ROOT/record['path'])==record['sha256']
    rgb=np.memmap(ROOT/pre['rgb']['path'],dtype='<f4',mode='r',shape=(s.SIDE,s.SIDE,3))
    valid=np.memmap(ROOT/pre['validity']['path'],dtype='<f4',mode='r',shape=(s.SIDE,s.SIDE))
    inputs=json.loads((ROOT/'inputs.json').read_text())
    assert s.file_sha(inputs['worldcover']['path'])==inputs['worldcover']['sha256']
    cover=np.memmap(inputs['worldcover']['path'],np.uint8,mode='r',offset=32,shape=(1024,1024,12))
    palette,heuristics=s.diagnostics(rgb,valid,cover);s.memory_gate()
    validity={'mean':float(valid.mean(dtype=float)),'zeroCells':int(np.count_nonzero(valid==0)),
      'partialCells':int(np.count_nonzero((valid>0)&(valid<1))),'cellsUnder99percent':int(np.count_nonzero(valid<.99)),
      'validAreaProjectedKm2':float(valid.sum(dtype=float)*s.SPACING**2)}
    report={**pre,'status':'R2_CPU_REFERENCE_PREPROCESS_AND_DIAGNOSTICS_PASS_NOT_ALBEDO_NOT_GPU_ADOPTION',
      'analysisScriptSha256':s.file_sha(Path(__file__)),'validityStats':validity,
      'paletteSampleCounts':{str(a['classCode']):a['acceptedSamples'] for a in palette},
      'heuristicDiagnostics':heuristics,
      'visualizationProtocol':'ONE fixed global gain3, clip0..1, standard piecewise sRGB OETF; not asset data encoding; no retuning',
      'analysisPeakRssBytes':s.rss(),'analysisElapsedSeconds':time.perf_counter()-start,
      'processSeparation':'Accumulation/serialization exited before this analysis; peak is max of separate processes, not sum',
      'limits':pre['limits']+[
        'Cloud/snow/dark thresholds are prefixed diagnostics, not SCL or truth; no automatic radiometric repair.',
        'WorldCover class10 includes orchards/plantations; mask does not certify wild forest.',
        'Full RGB preserves observed crop/built areas; only palette statistics exclude them.',
        'R1 had no complete RGB/validity output, so full-field byte equality to R1 is not claimed. Small conversion oracle plus five actual witnesses qualify memory refactor.']}
    s.memory_gate();s.write_json('result.json',report)
    print(json.dumps({'status':report['status'],'validity':validity,'paletteSampleCounts':report['paletteSampleCounts'],
      'peakMiB':s.rss()/1024**2,'elapsedSeconds':report['analysisElapsedSeconds']}),flush=True)

if __name__=='__main__':
    try:run()
    except Exception as error:
        s.write_json('analysis-failure.json',{'status':'STOP_NO_AUTOMATIC_RERUN','error':type(error).__name__,'message':str(error),'scriptSha256':s.file_sha(Path(__file__))})
        raise
