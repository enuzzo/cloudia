#!/usr/bin/env python3
"""Read-only PNG/metadata/transfer verification. No renderer, model or browser execution."""
from pathlib import Path,PurePosixPath
import argparse,hashlib,json,math,re,struct,sys
from PIL import Image
import PIL
HERE=Path(__file__).resolve().parent
VERSION='observatory-v57-native-frame-export'
def check(condition,message):
 if not condition:raise ValueError(message)
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def load(path):
 def reject(value):raise ValueError('Non-finite JSON token '+value)
 return json.loads(Path(path).read_text(),parse_constant=reject)
def number(value):return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)
def vector(value,size,name):check(isinstance(value,list) and len(value)==size and all(number(v) for v in value),name+' finite vector shape')
def finite_tree(value,path='metadata'):
 if isinstance(value,float):check(math.isfinite(value),'Nonfinite '+path)
 elif isinstance(value,list):
  for i,v in enumerate(value):finite_tree(v,f'{path}[{i}]')
 elif isinstance(value,dict):
  for k,v in value.items():finite_tree(v,path+'.'+k)
def relative_path(path):
 p=PurePosixPath(path);check(not p.is_absolute() and '..' not in p.parts,'Unsafe manifest path '+path);return p

def qualification(root,source_dir=None,dist_dir=None):
 folder=root/'qualification';protocol=load(folder/'PROTOCOL.json');manifest=load(folder/'source-manifest.json')
 check(isinstance(manifest,dict) and len(manifest)==124,'Source manifest must contain124files, not123')
 check(protocol['sourceFiles']==124 and protocol['sourceManifestSHA256']==sha(folder/'source-manifest.json'),'Source manifest qualification identity')
 for path,digest in manifest.items():
  relative_path(path);check(isinstance(digest,str) and re.fullmatch('[0-9a-f]{64}',digest),'Source digest '+path)
  if source_dir is not None:check(sha(source_dir/path)==digest,'Runtime source mismatch '+path)
 dist=load(folder/'dist-manifest.json');check(isinstance(dist,dict) and len(dist)==30,'Dist manifest count')
 for path,digest in dist.items():
  relative_path(path);check(isinstance(digest,str) and re.fullmatch('[0-9a-f]{64}',digest),'Dist digest '+path)
  if dist_dir is not None:check(sha(dist_dir/path)==digest,'Dist mismatch '+path)
 tests=load(folder/'test-results.json')
 check(tests['success'] and tests['numTotalTests']==tests['numPassedTests']==378 and tests['numFailedTests']==0,'Saved378test qualification')
 check(len(tests['testResults'])==45,'Actual test file count45; Vitest suite/group counters are different')
 check(all(t['status']=='passed' and all(a['status']=='passed' for a in t['assertionResults']) for t in tests['testResults']),'Saved assertion status')
 commands=load(folder/'checks.json');check([x['name'] for x in commands]==['typecheck','full-tests','app-build','hero-build'],'Qualification command order')
 check(all(x['exitCode']==0 and x['terminalObservedByPopen'] and not x['wallTimedOut'] for x in commands),'Saved terminal command status')
 return {'sourceFiles':124,'sourceManifestSHA256':sha(folder/'source-manifest.json'),'runtimeSourceHashesVerified':source_dir is not None,'distFiles':30,'distManifestSHA256':sha(folder/'dist-manifest.json'),'distHashesVerified':dist_dir is not None,'savedTestsPassed':378,'savedTestFiles':45,'savedCommandsExitZero':True,'testsWereRerun':False}

def validate_camera(camera,size):
 for name in ['origin','target','forward','right','up']:vector(camera[name],3,'camera.'+name)
 for name in ['yaw','pitch','approach','aspect','tanHalfVerticalFov','ground','terrainClearanceKm']:check(number(camera[name]),'camera.'+name)
 check(0<=camera['approach']<=1 and camera['aspect']>0 and camera['tanHalfVerticalFov']>0,'Camera ranges')
 check(math.isclose(camera['aspect'],size[0]/size[1],abs_tol=1e-12,rel_tol=0),'Camera aspect matches bitmap/internal')
 for name in ['forward','right','up']:check(math.isclose(sum(x*x for x in camera[name]),1,abs_tol=1e-10,rel_tol=0),'Camera unit '+name)
 for a,b in [('forward','right'),('forward','up'),('right','up')]:check(abs(sum(x*y for x,y in zip(camera[a],camera[b])))<1e-10,'Camera orthogonality')
 direction=[b-a for a,b in zip(camera['origin'],camera['target'])];length=math.sqrt(sum(x*x for x in direction));check(length>0,'Camera origin equals target')
 check(max(abs(x/length-y) for x,y in zip(direction,camera['forward']))<1e-10,'Camera points at recorded target')
 if camera['comparisonTargetKm'] is not None:vector(camera['comparisonTargetKm'],3,'comparisonTargetKm')
 if camera['comparisonSurfaceKm'] is not None:check(number(camera['comparisonSurfaceKm']) and camera['comparisonSurfaceKm']>0,'comparisonSurfaceKm')

def png_record(folder,pose,protocol):
 name=pose['name'];path=folder/(name+'.png');meta_path=folder/(name+'.json');transfer_path=folder/(name+'.transfer.json')
 data=path.read_bytes();meta=load(meta_path);transfer=load(transfer_path);info=meta['png'];m=meta['metadata'];text=meta['textExport'];finite_tree(meta)
 check(meta['schema']=='cloudia-native-frame-v1' and meta['state']=='ready','Metadata schema/state '+name)
 check(info['mime']=='image/png' and 33<=len(data)<=32*1024*1024 and len(data)==info['byteLength'],'PNG MIME/byteLength/limit '+name)
 digest=hashlib.sha256(data).hexdigest();check(digest==info['sha256'],'PNG digest '+name)
 check(data[:8]==b'\x89PNG\r\n\x1a\n' and data[8:16]==b'\0\0\0\rIHDR','PNG signature/IHDR '+name)
 size=list(struct.unpack('>II',data[16:24]));check(size==[info['width'],info['height']]==pose['output'],'IHDR/metadata/protocol dimensions '+name)
 check(size[0]>0 and size[1]>0 and size[0]*size[1]<=8388608,'PNG pixel bound '+name)
 with Image.open(path) as image:
  check(image.format=='PNG' and list(image.size)==size,'Pillow header '+name);image.verify()
 with Image.open(path) as image:
  image.load();check(getattr(image,'n_frames',1)==1,'Expected still PNG '+name);mode=image.mode
  pixels=image.convert('RGBA').tobytes();pixel_digest=hashlib.sha256(pixels).hexdigest()
 check(m['schemaVersion']==1 and m['rendererVersion']==VERSION and m['threeRevision']=='186','Renderer identity '+name)
 check(m['ready'] is True and m['regenerating'] is False and m['executionThread']==pose['thread'],'Draw owner/readiness '+name)
 check(isinstance(meta['requestId'],int) and meta['requestId']>=0,'Request ID '+name)
 check(meta['captureId']==f"{pose['thread']}-{meta['requestId']}-{digest[:12]}",'CaptureID correlation '+name)
 check(m['quality']=='ultra' and m['nominalSteps']==384 and m['volume']==[256]*3 and m['detailVolume']==[128]*3 and m['motionField']==[16]*3,'Full quality '+name)
 check(math.isclose(m['stepSizeKm'],7/384,abs_tol=1e-14,rel_tol=0),'Nominal step size '+name)
 check(m['output']==m['internal']==m['canvas']==size,'Output/internal/canvas/PNG equality '+name)
 check(m['seed']==protocol['seed'] and m['paused'] is True and m['orbit'] is False and m['ablation']=='full' and m['ablationCode']==0,'Seed/paused/full '+name)
 check(m['flowMode']=='full' and m['flowSampled'] is True and m['flowComputeThisDraw'] is True,'Flow path '+name)
 validate_camera(m['camera'],size)
 check(m['camera']['approach']==pose['approach'],'Recorded approach '+name)
 for field in ['yaw','pitch']:
  if field in pose:check(math.isclose(m['camera'][field],pose[field],abs_tol=1e-12,rel_tol=0),'Recorded '+field+' '+name)
 check(m['camera']['comparisonSurfaceKm']==protocol['comparisonSurfaceKm'] and m['camera']['comparisonTargetKm']==protocol['comparisonTargetKm'],'Fixed comparison pose '+name)
 check(m['clocks']['simulationTime']==protocol['simulationTime'] and m['clocks']['flowUniformTime']==60 and m['clocks']['flowFieldTime']==60,'Recorded applied flow/sim clock '+name)
 for field in ['forcingTime','weatherTime','precipitationUniformTime','flowFieldDispersion']:check(number(m['clocks'][field]),'Applied clock '+field)
 check(m['weather']['windStrength']==protocol['wind'] and m['weather']['dispersion']==protocol['dispersion'],'Weather wind/dispersion '+name)
 check(m['weather']['skyIntent']==pose['weather'] and m['weather']['skyPending'] is False and m['weather']['atmosphereProgress']==m['weather']['atmosphereBlend']==1,'Settled atmosphere '+name)
 if pose['weather']=='clear':check(0<=m['weather']['rain']<=.001 and m['weather']['targetRain']==0 and m['narrowCloudSpecialization']=='dry' and m['densitySampling']['path']=='macro-rgba8-r','Dry path '+name)
 else:check(m['weather']['rain']>0 and m['weather']['targetRain']>0 and m['narrowCloudSpecialization']=='rain' and m['densitySampling']['path']=='r8unorm-extracted-r','Rain R8 path '+name)
 check(m['densitySampling']['dimensions']==[256]*3,'Density dimensions '+name)
 if m['outputMode']=='screen':
  view=m['viewport'];check([math.floor(view['width']*view['dpr']+.5),math.floor(view['height']*view['dpr']+.5)]==size,'Screen viewport/DPR applied '+name)
 else:check(m['outputMode'] in ['720','1080'] and size==([1280,720] if m['outputMode']=='720' else [1920,1080]),'Fixed output mode '+name)
 check(text['partCharacters']==65536 and text['totalCharacters']==22+4*((len(data)+2)//3),'Base64 URL length arithmetic '+name)
 count=(text['totalCharacters']+65535)//65536;check(text['parts']==count,'Part count '+name)
 check(transfer['status']=='PASS_VISIBLE_PARTS_ROUNDTRIP' and transfer['captureId']==meta['captureId'] and transfer['bytes']==len(data) and transfer['sha256']==digest,'Transfer identity '+name)
 check(transfer['parts']==count and transfer['totalCharacters']==text['totalCharacters'] and len(transfer['ledger'])==count,'Transfer ledger count '+name)
 total=0
 for index,item in enumerate(transfer['ledger'],1):
  start=(index-1)*65536+1;end=min(index*65536,text['totalCharacters']);expected=end-start+1
  check(item['part']==index and item['characters']==expected,'Transfer contiguous length '+name)
  check(item['label']==f"Parte {index} di {count} · caratteri {start}–{end} di {text['totalCharacters']}",'Transfer visible range '+name);total+=item['characters']
 check(total==text['totalCharacters'],'Transfer total length '+name)
 record={'name':name,'thread':m['executionThread'],'size':size,'bytes':len(data),'sha256':digest,'decodedRGBAsha256':pixel_digest,'pillowMode':mode,'fullyDecoded':True,'captureId':meta['captureId'],'parts':count,'totalCharacters':text['totalCharacters'],'quality':m['quality'],'nominalSteps':384,'volume':[256]*3,'detail':[128]*3,'approach':m['camera']['approach'],'densityPath':m['densitySampling']['path'],'cameraFiniteAndOrthonormal':True,'metadataSHA256':sha(meta_path),'transferSHA256':sha(transfer_path)}
 return record,m

def differences(a,b,path='',tol=1e-12):
 if number(a) and number(b):return [] if abs(a-b)<=tol else [path]
 if type(a)!=type(b):return [path]
 if isinstance(a,dict):
  if set(a)!=set(b):return [path+':keys']
  return sum((differences(a[k],b[k],path+'.'+k,tol) for k in a),[])
 if isinstance(a,list):
  if len(a)!=len(b):return [path+':length']
  return sum((differences(x,y,f'{path}[{i}]',tol) for i,(x,y) in enumerate(zip(a,b))),[])
 return [] if a==b else [path]

def run(root,require_worker=False,source_dir=None,dist_dir=None):
 qualified=qualification(root,source_dir,dist_dir);folder=root/'browser';protocol=load(folder/'PROTOCOL.json')
 check(protocol['sourceManifestSHA256']==qualified['sourceManifestSHA256'],'Browser source pin differs from qualification')
 poses=list(protocol['poses'])
 amendment=protocol.get('amendmentBeforeSixthCapture')
 if amendment:
  check(amendment['capture']=='main74-sun-terrain-native' and amendment['cameraDifferenceFromRain']=='none planned; preset alone changes','Unknown protocol amendment')
  baseline=next(p for p in poses if p['name']=='main74-rain-terrain-native')
  poses.append({**baseline,'name':amendment['capture'],'weather':'clear'})
 check(len({p['name'] for p in poses})==len(poses),'Duplicate protocol pose')
 records=[];states={};by_name={};missing=[]
 for pose in poses:
  name=pose['name'];needed=[folder/(name+suffix) for suffix in ['.png','.json','.transfer.json']]
  if not all(p.is_file() for p in needed):missing.append({'name':name,'missing':[p.name for p in needed if not p.is_file()]});continue
  record,state=png_record(folder,pose,protocol);records.append(record);states[name]=state;by_name[name]=record
 check(len(records)>=4,'Four primary PNG artefacts not yet complete')
 if require_worker:check(not missing,'All protocol PNG triplets required: '+str(missing))
 else:check(all(x['name'].startswith('worker') for x in missing),'Only an unavailable worker triplet may be deferred')
 main='main74-near60-sun-native';worker='worker74-near60-sun-native';second='main74-near95-sun-native'
 check(main in states and second in states,'Both native main poses required')
 check(by_name[main]['sha256']!=by_name[second]['sha256'] and by_name[main]['decodedRGBAsha256']!=by_name[second]['decodedRGBAsha256'],'Two poses need different file AND decoded pixels')
 check(states[main]['camera']['origin']!=states[second]['camera']['origin'],'Two poses need different recorded camera')
 pair={'status':'WORKER_NOT_YET_SAVED','notClaimed':'No worker PNG verification or native main/worker comparison until complete triplet exists'}
 if worker in states:
  keys=['rendererVersion','threeRevision','seed','family','quality','nominalSteps','stepSizeKm','emptyStepKm','output','internal','canvas','volume','detailVolume','motionField','ablation','ablationCode','flowMode','flowSampled','flowComputeThisDraw','densitySampling','narrowCloudSpecialization','camera','paused','orbit','speed','material','weather','lighting','terrain']
  mismatches=sum((differences(states[main][k],states[worker][k],k) for k in keys),[])
  clock_keys=['simulationTime','forcingTime','precipitationUniformTime','flowUniformTime','flowFieldTime','flowFieldDispersion']
  mismatches+=sum((differences(states[main]['clocks'][k],states[worker]['clocks'][k],'clocks.'+k) for k in clock_keys),[])
  check(not mismatches,'Native main/worker effective render state differs '+str(mismatches))
  pair={'status':'PASS_SAME_EFFECTIVE_POSE','comparedFields':keys,'comparedAppliedClocks':clock_keys,'excludedOwnerLocalFields':['captureId','requestId','frame timestamps/counter/timeOrigin','clocks.weatherTime','skyTextures owner UUID/version/serial'],'pngSHA256Equal':by_name[main]['sha256']==by_name[worker]['sha256'],'decodedRGBAEqual':by_name[main]['decodedRGBAsha256']==by_name[worker]['decodedRGBAsha256'],'bitEqualityScope':'Only these two exported canvas PNG/decoded bitmaps; no float buffer/compositor/global renderer claim'}
 elif require_worker:raise ValueError('Worker PNG triplet required and not yet available')
 terrain_pair={'status':'NOT_PRESENT'}
 sun_terrain='main74-sun-terrain-native';rain_terrain='main74-rain-terrain-native'
 if sun_terrain in states and rain_terrain in states:
  fields=['camera','quality','nominalSteps','stepSizeKm','output','internal','canvas','volume','detailVolume','motionField','seed','paused','orbit','flowMode','material']
  mismatches=sum((differences(states[sun_terrain][k],states[rain_terrain][k],k) for k in fields),[])
  check(not mismatches,'Sun/rain terrain pose/quality mismatch '+str(mismatches))
  terrain_pair={'status':'PASS_SAME_CAMERA_QUALITY','comparedFields':fields,'sunSkyIntent':states[sun_terrain]['weather']['skyIntent'],'rainSkyIntent':states[rain_terrain]['weather']['skyIntent'],'pngHashesDiffer':by_name[sun_terrain]['sha256']!=by_name[rain_terrain]['sha256'],'scope':'Weather/light/aerial paths differ intentionally; no causal or artistic acceptance from this comparison.'}
 auxiliary={}
 for name in ['clear-after-main720.json','worker-clear-console.json','ordinary-preview.json','preview-console.json']:
  path=folder/name
  if path.is_file():auxiliary[name]={'sha256':sha(path),'savedEvidence':load(path)}
 old=root/'browser-r1/transport-limit.json';rejected=None
 if old.is_file():
  rejected=load(old);check(rejected['status']=='REJECTED_TRUNCATED_TEXT_NO_PNG_SAVED','Historical R1 status changed')
 return {'status':'PASS_COMPLETE_NATIVE_PNG_SET' if len(records)==len(poses) and not missing else 'PASS_AVAILABLE_PNG_WORKER_PENDING','pillowVersion':PIL.__version__,'qualification':qualified,'browserProtocolSHA256':sha(folder/'PROTOCOL.json'),'expectedPNGCount':len(poses),'protocolAmendmentIncluded':bool(amendment),'verifiedPNGCount':len(records),'uniquePNGHashes':len({r['sha256'] for r in records}),'uniqueDecodedRGBAHashes':len({r['decodedRGBAsha256'] for r in records}),'png':records,'missingExpectedTriplets':missing,'mainWorker':pair,'sunRainTerrain':terrain_pair,'twoNativeMainPoses':{'fileAndPixelHashesDiffer':True,'cameraOriginDiffers':True},'auxiliarySavedEvidence':auxiliary,'historicalR1':{'status':rejected['status'],'expectedBytes':rejected['expected']['byteLength'],'partialBytes':rejected['decodedPartialBytes']} if rejected else None,'scope':'File bytes/full Pillow decode/PNG dimensions, saved metadata and transfer ledger arithmetic only. Raw UI part strings are not archived, so visible-UI provenance is the collector record, not independently replayed here. No tests/build/model/GPU/browser were run; no FPS, compositor, HDR/float or artistic acceptance.'}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=HERE.parent);parser.add_argument('--require-worker',action='store_true');parser.add_argument('--runtime-source',type=Path);parser.add_argument('--dist',type=Path);parser.add_argument('--output',type=Path);args=parser.parse_args()
 try:result=run(args.root.resolve(),args.require_worker,args.runtime_source.resolve() if args.runtime_source else None,args.dist.resolve() if args.dist else None);code=0
 except Exception as error:result={'status':'FAIL','message':str(error),'scope':'No input files modified'};code=1
 if args.output:
  check(not args.output.exists(),'Preserve previous verification output');args.output.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({'status':result['status'],'verifiedPNGCount':result.get('verifiedPNGCount'),'message':result.get('message'),'mainWorker':result.get('mainWorker',{}).get('status'),'output':str(args.output) if args.output else None}))
 raise SystemExit(code)
if __name__=='__main__':main()
