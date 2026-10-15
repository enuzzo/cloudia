#!/usr/bin/env python3
"""Serve one external v40 main-app override. Preparation never starts this server."""
from __future__ import annotations
import argparse
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.parse import unquote, urlsplit

OUT=Path(__file__).resolve().parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=4180)
    parser.add_argument('--archive',type=Path,help='Optional file tree of captured unmodified v40 assets, preferred over dist.')
    args=parser.parse_args()
    manifest=json.loads((OUT/'rain-support-candidate-manifest.json').read_text())
    assert manifest['status']=='PREPARED; NOT RENDERED OR TIMED'
    override_url=manifest['overrideUrl']
    candidate=OUT/'overrides'/override_url.lstrip('/')
    entry=next(a for a in manifest['artifacts'] if a['path']==str(candidate))
    assert digest(candidate)==entry['sha256'], 'Candidate asset bytes changed after preparation.'
    assert digest(OUT/'base'/override_url.lstrip('/'))==manifest['baseAppSha256']
    roots=([args.archive.resolve()] if args.archive else [])+[Path(manifest['distRoot'])]
    index=next((root/'index.html' for root in roots if (root/'index.html').is_file()),None)
    assert index and digest(index)==manifest['baseIndexSha256'], 'Fallback index is not the captured v40 index.'

    class Handler(SimpleHTTPRequestHandler):
        def translate_path(self,path):
            request=unquote(urlsplit(path).path)
            if request==override_url:
                return str(candidate)
            relative=request.lstrip('/') or 'index.html'
            if '..' in Path(relative).parts:
                return str(OUT/'__forbidden__')
            for root in roots:
                resolved=(root/relative).resolve()
                if resolved.is_relative_to(root.resolve()) and resolved.is_file():
                    return str(resolved)
            return str(OUT/'__not_found__')
        def end_headers(self):
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Cloudia-Candidate',manifest['candidateVersion'])
            super().end_headers()

    print(f"MAIN ONLY: {manifest['candidateVersion']} at http://localhost:{args.port}",flush=True)
    print(f"Override only {override_url}; fallback roots={roots}; worker remains baseline/unqualified.",flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()

if __name__=='__main__':
    main()
