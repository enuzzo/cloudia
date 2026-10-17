"""Archive/source preservation only. Never imports or reruns Cloudia."""
from pathlib import Path
import argparse,hashlib,json
p=argparse.ArgumentParser();p.add_argument('--manifest-sha256',required=True);p.add_argument('--output',required=True);args=p.parse_args()
arc=Path(__file__).resolve().parent.parent;root=arc.parents[2]
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
manifest=arc/'MANIFEST.json';assert sha(manifest)==args.manifest_sha256,'Manifest differs'
m=json.loads(manifest.read_text());total=0
for name,row in m['payload'].items():
 q=arc/name;assert q.resolve().is_relative_to(arc.resolve()) and q.is_file() and not q.is_symlink(),name
 assert q.stat().st_size==row['bytes'] and sha(q)==row['sha256'],name;total+=q.stat().st_size
base=json.loads((arc/'run/source-baseline141.json').read_text());candidate=json.loads((arc/'run/SOURCE-FREEZE-R1.json').read_text());assert len(base)==141 and len(candidate)==143
for name,digest in base.items():assert sha(root/name)==digest,'Canonical changed: '+name
for name,digest in candidate.items():
 overlay=arc/'source-overlay'/name
 assert sha(overlay if overlay.exists() else root/name)==digest,'Candidate reconstruction differs: '+name
prefix=json.loads((arc/'run/prefix-result.json').read_text());assert prefix['status']=='FAIL_STOP_NO_FALLBACK' and prefix['completed']==37 and prefix['seed']==37 and len(prefix['rows'])==37
rain=json.loads((arc/'browser/canonical-rain-90.json').read_text());assert rain['stats']['fps']<60 and rain['queuePrefix']['status']=='completed'
out={'status':'PASS_CONSERVATION_ONLY','manifestSHA256':args.manifest_sha256,'payloadFiles':len(m['payload']),'payloadBytes':total,'canonicalSourceFilesExact':len(base),'reconstructedCandidateSourceFilesExact':len(candidate),'candidateAdopted':False,'candidateOverall':'UNQUALIFIED_RESOURCE_FAIL','canonicalRainTarget60':'NOT_REACHED','wholeGoal':'active','modelReplays':0,'testReplays':0,'GPUReplays':0,'scope':'File integrity and preserved verdicts only; does not turn resource failure into acceptance or requalify model, visual appearance, performance or whole goal.'}
Path(args.output).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
