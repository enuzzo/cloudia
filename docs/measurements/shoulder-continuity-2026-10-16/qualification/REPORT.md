# R5 refined inward shoulder — final122 external qualification

16 ottobre 2026. Sorgente ufficiale predisposto per il root, **nessuna adozione
eseguita da questo task**. Versione `observatory-v56-inward-shoulder` nel metadata
engine e nella corrispondente attesa lifecycle. Root mantiene il giudizio visivo.
Dist APP+hero insieme: `../anatomy-r5-v55-source/dist/`,30file, index e quattro
filehero presenti dopo la seconda build; l'app non è stata svuotata.

## Modello esatto e ambito

Il volume è byte-esatto al refined R2 congelato da Rain:
`c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`.
I119file Rain sono stati controllati contro manifest
`5e684127a396920bca727ba89fd19bc5776084801ae2ca7e1e2d82313c4f8e05`.
Il suo archivio `b78e8b56e4aa3338425f00dd3040bbb0b766fa0f10ca79c74a08a721254a5756`
e il protocollo745447… sono rimasti invariati.

Nessuna ulteriore modifica geometrica: solo la componente inward positiva della
spalla matura selezionata semanticamente viene rimossa in X/Z. Il corpo91 resta
sempre baseline; la componente perpendicolare e gli offset dei90discendenti
rispetto al core sono preservati. Tutte le Y, raggi, blend e tuple non selezionate
restano esatti. Non sono introdotti seedif, cap, coefficienti, nuovi RNG o lobes.
È un modello autoriale locale, non una prova fisica di flusso o massa ottica.
L'unione/l'illuminazione possono cambiare pur conservando le primitive estranee.

La baseline è v55/source119, manifest30c5448e… . Rispetto ai119filebase, i soli diff su file esistenti sono tre:
volume.ts, stringa versione engine, expected lifecycle. I tre aggiunti sono
layoutPrefix.test-helper.ts, volume.layout-regression.test.ts e scripts/qa-layout.ts.
Terreno, WorldCover, CSS e shader sono identici v55. Il lifecycle del119Rain aveva
ancora l'attesaR3trial: corretta solo nella nuova122, senza modificare il suo frozen.

Manifest sorgenti122 `e826b119ff2758fa51ed04cf8748d0d40ad1ff09516fc498826466ceae3974b7`.
Freeze prima dei run `1a19ff811c68f5502d43182a4b24cf214df92aa32c42d4549d8dc5f5509a62ab`.
Il freeze harness-r2 `85bad74add34479c92228367e4cb25d6a3274761b2ae143cdceef25fe887e643`
contiene lo stesso identico dizionario di122hash; cambia solo il runner esterno.

## Unico scanner, tre prefix

Una sola esecuzione scanner0..1023, exit0, RLIMIT_CPU5s, stop soft4.5s.
CPU3.057596s, wall2.798030s, Bun1.3.11/arm64, process.version compatibile Node24.3.0.
I prefix sono soltanto A/R3/R5: A e R5 per1024layout, R3 per le323proiezioni inward.
Le due reference bundled sono identiche al ciclo21; volume/depscloud originali
corrispondono alla v55. Il paragone avviene nello stesso runtime, senza golden
trig fra Node e Bun. Stream Float64LE comprendono conteggi/lunghezze tuple e
componenti, conservando signedzero. Nessun raster, campo di densità o bake.

|Contratto|Esito|
|---|---:|
|Layout totali|1024|
|Layout interamente esatti A|701=18outward+683altre famiglie|
|Inward con componente di spostamento corrispondente a R3|323|
|Body shared esatto A|341/341sheared|
|Tutte Y/raggi/blend e tuple non selezionate esatte A|1024/1024|
|Before-joint esatto A e RNG invariato|1024/1024|
|Massima differenza proiettata R3/R5|4.440892098500626e-16km|

Non si dichiara identità X/Z completa con R3: sarebbe falsa per questo modello
refined, che conserva l'irregolarità perpendicolare. Gli hash interi di baseline e
R5, i flag e le osservazioni geometriche sono conservati nel raw; il contratto
relazionale è verificato con precisione1e-12km, mentre le tuple dichiarate esatte
sono confrontate strettamente. Le proprietà non ricalcolano una traslazione attesa.

### Cinque maggiori spostamenti inward osservati

|Seed|Norma R5|Norma R3full-axis|
|---:|---:|---:|
|926|807.388322 m|810.898594 m|
|68|805.489781 m|856.805419 m|
|707|795.731116 m|798.482044 m|
|197|793.515152 m|890.717861 m|
|434|791.079987 m|800.958405 m|

### Testimoni destinati al confronto visivo del root

|Seed|Norma R5|Norma R3full-axis|
|---:|---:|---:|
|74|621.072280 m|675.050649 m|
|77|613.791247 m|704.989865 m|
|80|344.182043 m|562.828003 m|
|323|500.417859 m|972.650018 m|
|917|6.699794 m|941.805096 m|
|926|807.388322 m|810.898594 m|

617,104,119,188 e72/73 sono interamente esatti A. Questi sono layout, non pixel
renderizzati o prove di campo: non è stato fatto un nuovo fullbake617. Le righe
2/72/73/74/77/80/104/119/188/617/323/917/926 sono copiate dallo stesso raw in
named-witnesses.json; nessuna selezione favorevole né secondo scanner.

## Test e build

Typecheck exit0,9/9test in1file, suite completa350/350 in44file, APP exit0 e hero
successiva exit0. I test coprono104/119/188outwardfullA,74inward,2inwardgiàcoperto,
72/73famiglieA e323/917perpendicolare nonzero conservata. Lo stesso bodyoriginale
è controllato anche quando l'attachment sarebbe già coperto: nessun guard ANDlift.

Sette mutazioni reali del prefix sono respinte: R3 e R4 bodylift dalla causa
`Shared body must remain byte-exact`; nojoint74; full-axis917 dalla perdita della
componente perpendicolare; wrongguardalreadycovered2; extrarng74; alias74.
Sorgenti, messaggi e hash delle sette varianti sono conservati. Un marker davvero
rimosso è rifiutato prima del trace.

## FAIL iniziale del runner, preservato e corretto

La prima pipeline si è fermata DOPO scanner/typecheck/9test PASS: il negativo
`marker+' changed'` manteneva il substring dell'anchor e quindi non era una prova
valida. Il relativo check falliva. Questo è un errore del runner del task, non
un FAIL del generatore o dell'helper. Nessuna falsa dichiarazione di PASS iniziale.

La qualifica originale resta `../anatomy-r5-v55-qualification/`; il suo manifest
esterno è `../anatomy-r5-v55-qualification-harness-r1-manifest.json`, SHA
`a129f60fa2002bb2d495c3128a31244e0fd37a2b45892dfd6b06e82f7c889501`.
In questa nuova cartella è corretto SOLO `Rasterize`→`Rasterise` nel negativo,
conservando sorgente122/helper/scanner/runtime immutati. Scanner, tsc e9test sono
riusati con raw/hash esatti, poi eseguiti mutant, fullsuite, APP e hero mancanti.
**Lo scanner non è stato ripetuto.**

`prior-harness-run/` conserva gli override R1 e il manifest integrale. Il resto
del payload R1 è byte-identico ai file correnti e viene verificato dal verifier
senza duplicare raw o mutanti. Il FAIL è così recuperabile anche senza percorsi
assoluti del Mac.

## Limite minore CLI, patch non applicata

Rain ha confermato il difetto del runner e l'integrità122. Ha anche notato che il
campo descrittivo `scope` dello scanner dice sempre treprefix anche nel normale
uso senza le due reference opzionali. Il run qui salvato fornisce entrambe e
non è invalidato. `UNAPPLIED-qa-layout-scope.patch` propone solo testo generico
corretto; **non è stata applicata al source122congelato**. Nessun dato numerico o
comportamento del modello dipende da questa descrizione.

## Verifica e limiti

`python3 /percorso/cycle22/anatomy-r5-v55-qualification-harness-r2/verify.py`
legge sorgenti122, manifest,30dist,350/44, nine-tests e risultati salvati; ricalcola
classifiche e aritmetica proiezione/perpendicolare/delta. Verifica il FAIL-R1 tramite
override più file byte-identici riusati. Non esegue JS, layout, bake, GPU o browser.
Le relazioni dei digest e i flag non ricostruiscono i tuple assenti dai soli hash.

Nessuna installazione/copia di dipendenze: symlink a node_modules esistente,
Gitignored/nontracciato, FileProviderignore1 prima/dopo. `node_modules 2` non letto.
Nessuna modifica prodotto; R3/R4/R5full-axisR1 di Rain preservati. I122hash sono
identici dopo build. Nessuna ulteriore qualifica full256oGPU/FPS; i normali piccoli
volumi CPU dei test esistenti non costituiscono accettazione artistica o supporto
globale per tutti i seed. Il giudizio renderizzato rimane del root.
