"""Read retained evidence only. No source import, model, test, build or GPU replay."""
from pathlib import Path, PurePosixPath
import argparse, gzip, hashlib, io, json, struct

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive',type=Path)
    parser.add_argument('--runtime-source',type=Path)
    args=parser.parse_args(); root=args.archive.resolve()
    manifest_raw=(root/'MANIFEST.json').read_bytes()
    assert len(manifest_raw)<512*1024
    m=json.loads(manifest_raw); raw={}
    for row in m['files']:
        name=row['path']; path=PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts and str(path)==name
        assert name not in raw and name!='MANIFEST.json'
        file=root/name
        assert not file.is_symlink() and file.stat().st_size<=16*1024**2
        data=file.read_bytes()
        assert len(data)==row['bytes'] and sha(data)==row['sha256'],name
        n=row['rawBytes']; assert 0<=n<=16*1024**2
        if row['encoding']=='gzip':
            with gzip.GzipFile(fileobj=io.BytesIO(data)) as stream:
                data=stream.read(n+1); assert len(data)==n and stream.read(1)==b''
        else:
            assert row['encoding']=='identity'
        assert len(data)==n and sha(data)==row['rawSHA256'],name
        raw[name.removesuffix('.gz') if row['encoding']=='gzip' else name]=data
    inventory={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
    assert inventory=={x['path'] for x in m['files']}|{'MANIFEST.json'}
    load=lambda name:json.loads(raw[name])
    base=load('source/base-manifest.json'); candidate=load('source/candidate-manifest.json')
    assert len(base)==126 and len(candidate)==128
    changes={n for n,h in candidate.items() if base.get(n)!=h}
    assert len(changes)==6 and not set(base)-set(candidate)
    assert all(sha(raw['source/changed/'+n])==candidate[n] for n in changes)
    source_checked=False
    if args.runtime_source:
        assert all(sha((args.runtime_source/n).read_bytes())==h for n,h in base.items())
        virtual=dict(base)
        virtual.update({n:sha(raw['source/changed/'+n]) for n in changes})
        assert virtual==candidate
        ref=load('REFERENCES.json')['baselinePNG']
        b=(args.runtime_source/ref['path']).read_bytes()
        assert len(b)==ref['bytes'] and sha(b)==ref['sha256']
        source_checked=True
    tests=load('qualification/test-results.json')
    assert tests['success'] and tests['numTotalTests']==tests['numPassedTests']==439
    assert len(tests['testResults'])==47
    targeted=load('qualification/targeted-results.json')
    assert targeted['success'] and targeted['numPassedTests']==10
    checks=load('qualification/checks.json')
    assert len(checks)==4 and all(r['exitCode']==0 and not r['timedOut'] and r['terminalObservedByPopen'] for r in checks)
    meta=load('browser/rain-shafts-main-native.json'); png=raw['browser/rain-shafts-main-native.png']
    assert png[:8]==b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II',png[16:24])==(2474,1844)
    assert len(png)==meta['png']['byteLength'] and sha(png)==meta['png']['sha256']
    md=meta['metadata']
    assert md['rendererVersion']=='experiment-v59-rain-shaft-coverage'
    assert md['output']==md['internal']==md['canvas']==[2474,1844]
    assert md['volume']==[256,256,256] and md['detailVolume']==[128,128,128]
    assert md['quality']=='ultra' and md['nominalSteps']==384
    assert md['paused'] and md['seed']==74 and md['flowMode']=='full' and md['ablation']=='full'
    assert md['weather']['atmosphereProgress']==1 and abs(md['weather']['rain']-.8)<1e-9
    assert md['clocks']['simulationTime']==60
    ledger=load('browser/rain-shafts-main-native-transfer.json')
    assert ledger['sha256']==sha(png) and ledger['bytes']==len(png)
    parts=ledger['parts']; assert len(parts)==meta['textExport']['parts']==53
    assert [p['index'] for p in parts]==list(range(1,54))
    assert sum(p['characters'] for p in parts)==meta['textExport']['totalCharacters']
    assert all(p['characters']==65536 for p in parts[:-1]) and 0<parts[-1]['characters']<=65536
    assert load('browser/rain-trial-console.json')==[]
    conclusion=load('rain-trial-conclusion.json')
    assert conclusion['state']=='REJECTED_NATIVE_VISUAL_FAIL'
    assert not any(conclusion['stopRule'][k] for k in ('worker','drySun','motion','FPS'))
    assert b'FAIL' in raw['browser/root-rain-review.md'] and b'FAIL' in raw['browser/independent-rain-review.md']
    ordinary=load('browser/ordinary-restored-proof.json')
    assert ordinary['canvas']['width']==2474 and ordinary['canvas']['height']==1844
    assert ordinary['pauseButtonCount']==1 and ordinary['profileExportCount']==0 and ordinary['console']==[]
    assert (root/'MANIFEST.json').read_bytes()==manifest_raw
    print(json.dumps({'status':'SAVED_EVIDENCE_PASS','payloadFiles':len(m['files']),
        'manifestSHA256':sha(manifest_raw),'source126AndOverlay128Verified':source_checked,
        'testsSaved':439,'targetedSaved':10,'nativePNG_SHA256':sha(png),
        'scope':'Stored bytes, source overlays and retained declarations only. No model, test, render, artistic or FPS acceptance is rerun or inferred.'},indent=2))

if __name__=='__main__':
    main()
