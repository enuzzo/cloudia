from pathlib import Path
import hashlib,json,datetime,subprocess
here=Path(__file__).resolve().parent;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=here/'candidate-source';m=json.loads((here/'candidate-source-manifest.json').read_text());assert len(m)==119 and all(sha(source/r)==digest for r,digest in m.items())
proto=json.loads((here/'PROTOCOL.json').read_text());r1=here.parent/'anatomy-r5-recenter'
checks=json.loads((here/'checks.json').read_text());assert len(checks)==5 and all(x['exitCode']==0 for x in checks)
tests=json.loads((here/'targeted-test-results.json').read_text());assert tests['numPassedTests']==31 and tests['numFailedTests']==0
for dirname,manifest in [('dist','dist-manifest.json'),('hero-dist','hero-dist-manifest.json')]:
 entries={str(p.relative_to(here/dirname)):sha(p) for p in sorted((here/dirname).rglob('*')) if p.is_file()};assert entries;(here/manifest).write_text(json.dumps(entries,indent=2)+'\n')
currentCSS={p.name:sha(p) for p in sorted((here/'dist/assets').glob('*.css'))}
css={'R5R2':currentCSS}
for label,root in [('A',Path(proto['baseline']).parent/'dist'),('R3',Path(proto['r3'])/'dist'),('R5R1',r1/'dist')]:
 if root.is_dir():css[label]={p.name:sha(p) for p in sorted((root/'assets').glob('*.css'))}
assert css['R5R1']==currentCSS
for label,d in css.items():assert d==currentCSS,(label,'CSS drift')
ignore=subprocess.run(['xattr','-p','com.apple.fileprovider.ignore#P',str(source/'node_modules')],capture_output=True,text=True);assert ignore.returncode==0 and ignore.stdout.strip()=='1'
report=json.loads((here/'expected-report.json').read_text());extra=json.loads((here/'expected-926.json').read_text());assert len(report['rows'])==7 and len(extra['rows'])==1
post={'source119UnchangedAfterBuild':True,'nodeModulesIgnoreAfter':'1','compiledCSS':css,'sourceDiffOnly':['src/cumulonimbus/volume.ts','src/cumulonimbus/GPUSceneEngine.ts'],'runtime':{'node':subprocess.check_output(['/Users/enuzzo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node','-p','process.version+" "+process.arch'],text=True).strip()}}
(here/'post-checks.json').write_text(json.dumps(post,indent=2)+'\n')
summary={'status':'EXTERNAL R5 R2 FROZEN, NOT ADOPTED','sourceFiles':119,'sourceManifestSHA256':sha(here/'candidate-source-manifest.json'),'volumeSHA256':m['src/cumulonimbus/volume.ts'],'distManifestSHA256':sha(here/'dist-manifest.json'),'heroDistManifestSHA256':sha(here/'hero-dist-manifest.json'),'nodeModulesIgnoredBeforeAndAfter':True,'tests':31,'typecheck':'PASS','appBuild':'PASS','heroBuild':'PASS','namedPrefixes':8,'rendererVersion':proto['rendererVersion'],'layout':'body always A; only positive inward projection removed; perpendicular shoulder offset preserved','limitations':'named layout prefixes only, no new full1024 scanner, density bake, GPU, image or FPS result; root visual review required'}
(here/'freeze-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(here/'REPORT.md').write_text('''# R5 R2 — sola componente inward, candidata esterna non adottata

Questa variante usa i 119 file v55/R3 congelati e conserva integralmente la R1 full-axis separata. Cambiano soltanto il blocco joint di `volume.ts` e l’etichetta diagnostica `observatory-v56-inward-shoulder-trial`.

Il corpo comune e i suoi 91 elementi conservano ogni valore di A. Se la spalla matura punta verso l’altra cella (`projection > 0`), la sola traslazione X/Z `-inner * projection` rimuove quella componente; lo scostamento perpendicolare, Y, raggi, blend e gli scostamenti relativi dei figli restano invariati. Nessuna nuova primitiva, estrazione RNG, frequenza o coefficiente.

Gli 8 prefix nominali effettivi (74/77/80/617/323/917/2 più 926 aggiunto su richiesta) verificano identità esatta A fuori dal gruppo selezionato, corpo91 sempre A, RNG/assenza alias e invarianti geometriche senza riscrivere la formula della candidata come oracle. Sono PASS. Il caso917 passa da941.805m della ricentratura completa a6.699794m, conservando la componente perpendicolare; il caso926 richiede807.388322m inward. Il caso617 resta tutto A. La tolleranza delle sole identità geometriche derivate è1e-12km; le tuple non modificate usano deep equality esatta inclusi segno di zero e lunghezze.

31 test focalizzati, typecheck, una build app e una hero separata sono PASS. Il suffisso di rasterizzazione e le dipendenze light/sun/motion/inclinedShoulder restano identici; CSS compilato identico. `source-freeze.json`, `checks.json`, manifest source/dist, patch e verifier conservano la provenienza.

Questi controlli non sono un render né una qualifica della forma. La traslazione può ancora peggiorare il raccordo o far avvicinare lobi al dominio dopo il precedente contenimento orizzontale: nessuna prova universale di assenza clipping viene dedotta. I casi nominali non sostituiscono lo scanner indipendente, la bake256/128 o il giudizio browser. Il conteggio323inward/18outward/683altre famiglie deriva dal precedente scanner e non è stato rieseguito qui. Nessun vantaggio FPS o adozione dichiarati.

Servire `dist/` per il trial app; `hero-dist/` è indipendente. Nessun server avviato. Nessun file del repository prodotto modificato.
''')
entries={p.name:{'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(here.iterdir()) if p.is_file() and p.name not in ['MANIFEST.json','independent-verification.json']}
(here/'MANIFEST.json').write_text(json.dumps({'schema':'R5-R2-inward-external-v1','frozenUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':entries},indent=2)+'\n')
print(json.dumps(summary,indent=2));print('MANIFEST SHA '+sha(here/'MANIFEST.json'))
