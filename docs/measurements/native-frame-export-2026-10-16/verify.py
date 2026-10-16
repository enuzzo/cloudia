#!/usr/bin/env python3
"""Verify curated payloads and native PNG evidence without running Cloudia."""
from pathlib import Path
import argparse,hashlib,json,runpy
p=argparse.ArgumentParser();p.add_argument('--runtime-source',type=Path);p.add_argument('--dist',type=Path);a=p.parse_args();root=Path(__file__).resolve().parent
manifest=json.loads((root/'MANIFEST.json').read_text())
for name,expected in manifest['files'].items():
 f=root/name
 assert f.is_file() and f.stat().st_size==expected['bytes'] and hashlib.sha256(f.read_bytes()).hexdigest()==expected['sha256'],name
module=runpy.run_path(str(root/'native-export-verifier/verify.py'))
r=module['run'](root,True,a.runtime_source,a.dist)
clear=json.loads((root/'browser/clear-after-main720.json').read_text());assert clear['jsonCharacters']==clear['pngCharacters']==0 and clear['downloadHref'] is None and clear['captureEnabled']
w=json.loads((root/'browser/worker-clear-console.json').read_text());assert w['jsonCharacters']==w['pngCharacters']==0 and w['downloadHref'] is None and w['captureEnabled'] and w['logs']==[]
o=json.loads((root/'browser/ordinary-4196.json').read_text());assert o['canvas']=={'height':1844,'width':2474} and o['animatedPauseButton']==1 and o['diagnosticPNGControls']==0 and o['logs']==[]
print(json.dumps({'status':r['status'],'payloads':len(manifest['files']),'payloadBytes':sum(x['bytes'] for x in manifest['files'].values()),'PNG':r['verifiedPNGCount'],'uniquePNG':r['uniquePNGHashes'],'mainWorker':r['mainWorker']['status'],'runtimeSourceHashesVerified':r['qualification']['runtimeSourceHashesVerified'],'distHashesVerified':r['qualification']['distHashesVerified'],'savedOrdinaryAndClearEvidence':'PASS','noTestOrGPURun':True}))
