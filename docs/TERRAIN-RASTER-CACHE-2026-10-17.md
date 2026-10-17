# Cloudia — cache esatta del raster terreno, v60

17 ottobre 2026. Base prodotto v59,126 sorgenti; candidata e build finale in snapshot esterne, dipendenze locali ignorate da Dropbox. **Cache adottata come piccola ottimizzazione statica.** Non cambia la qualità visiva. Fotorealismo delle montagne, anatomia/vicino, pioggia/virga, UI e60FPS a qualità piena restano aperti.

## Risultato e comportamento

Il target RGBA32F+depth32 del terreno esisteva già. Prima veniva cancellato e ridisegnato ad ogni frame; ora TerrainMesh lo riusa soltanto quando tutti gli input descritti coincidono esattamente. Nube, pioggia e flusso continuano a eseguire il percorso completo. In una posa nativa piovosa fissa: A1senza cache19,26474 → Bcon cache19,46639 → A2senza cache19,13376 invii/s. Guadagno sulla media dei riferimenti **+1,3914%**, contro deriva0,6822%; frequenza delimitata dal prefisso completato **+1,1341%**, deriva0,8237%. Un solo A/B/A, margine piccolo, nessuna stima di confidenza né isolamento termico.

Non sono FPS presentati: `presentedCanvasFps=null`. I tre prefissi finiscono con statuscompleted e zero frame misurati non confermati. La metrica comprende backlog/consegna JS, non throughput GPU isolato. Non è una soluzione ai60FPS nella pioggia.

## Contratto e implementazione

`TerrainMeshConfiguration.cacheInputs` è un opt-in esplicito: valori finiti e texture di tutte le dipendenze mutabili catturate dalla callback shade. Senza descrittore resta il draw live. Engine dichiara solarColor,ambientColor e le due WorldCover; Sole e camera sono già argomenti render. Le formule WGSL del materiale, camera, fabbrica target, geometria e asset reali sono invariati.

La chiave usa uguaglianza esatta senza epsilon: renderer/backend/reverse-depth e configurazione osservata; camera completa e near/far; target/depth identità,versioni,size,viewport/scissor; geometria,attributi,index,materiale/scene/trasformazioni; colori,texture e loro configurazione/versioni; shadow valida,epoch,submission e risorse. La shadow cache esistente viene aggiornata prima della chiave colore. Un Sole fermo con ambiente diverso produce comunque miss.

Prima di clear/draw l'entry viene tolta. Viene confermata soltanto dopo draw e ripristino riusciti e input ancora uguali; sono ammessi solo incrementi di versione di primo bind degli attachment posseduti. Mutazioni durante draw,errori clear/draw/restore,resize/dispose e sostituzioni di risorse non mantengono un vecchio hit valido. `invalidate()` invalida colore e shadow; `invalidateGeometry()` azzera anche il fingerprint caster.

Contratto di proprietà: scena/geometria statiche e target esclusivo. Scritture raw di array senza needsUpdate, callback/dipendenze omesse dal descrittore o reset esterni non osservabili richiedono invalidazione esplicita e bounds aggiornati. La cache non introspeziona closure arbitrarie.

Nessun nuovo payload GPU texture/geometria. A2474×1844 il target già presente resta72.992.896B colore+distanza +18.248.224Bdepth. La chiave aggiunge stato e allocazioni CPU: costo non nullo, soprattutto sui miss. I contatori sono richieste/render attempt CPU, non completamenti GPU.

## Qualifica e parità effettiva

505/505 test in48file;146 mirati. Typecheck e APP→hero PASS. I test coprono dipendenze/ambient a Sole invariato,default live,primo bind,mutazioni durante draw,errori,dispose e lifecycle. Le prove mock non dimostrano la parità GPU: questa è stata misurata separatamente.

Audit pubblico solo `profile=1&terrainAudit=1`: scena ferma,sky assestato,terreno attivo,nessun export/benchmark pendente. Dopo controlli o dimensioni mutate attende un frame ordinario riuscito. Blocca temporaneamente i draw ordinari; legge il target corrente, invalida colore+shadow e ridisegna, poi rilegge. Due SHA256 su tutti i byte RGBA32F, compresa alpha distanza/miss; packing bytewise dello stride r186256B, senza conversione float,quantizzazione o flip. NaN e±0 preservati nei test del compattatore. Limite packed96MiB/8192px per asse prima del readback. A native ogni lettura restituisce73.169.824B e ne confronta72.992.896; residency/GC/staging e picco non misurati. Nessun nuovo target grande. Readback e digest non sono misure FPS.

Rilascio GPU attende il readback pendente; destroy/loss non emettono un risultato tardivo né avviano la seconda lettura. La build finale cancella il report precedente all'avvio e disabilita EsportaJSON; il risultato diagnostico ha nome download dedicato e non assume output top-level del benchmark.

| Caso candidata | Target cached=fresh SHA256 | Esito |
|---|---|---|
| Main e worker Sole, ritorni camera/resize | e4435ce3a0a45e243c19dea24e5bc1133f6db1c8fd5ca168e94e644b1c6c9045 | bit-identico |
| Main1237×922 | a2121b877fd51659e8e1435fd2b9196c4d4fec7bb1d4be6bffb9a8754ee417fa | bit-identico |
| Camera realmente spostata | 6246446302731c0f8aa4a21be532d1449479511ac960f21517424d993746ebed | diverso dalla posa iniziale, cached=fresh |
| Main Tramonto | b66da37b843ada80763cef8c3ca7783157c7924fef554596065cd00ceec5db8f | bit-identico |
| Main RainON/OFF e worker Rain | d0a96b214411d8860551b7669e42159dee6eb6b1a7212db1c07cd0a17bbce0e3 | bit-identico |

I delta dell'audit sono +1richiesta/submission/epoch e0hit per colore e shadow; l'invalidazione forzata ridisegna intenzionalmente entrambi. La partenza camera provata usa `camera-away` e `camera-real-return`; il primo `camera-return` eseguito troppo rapidamente da solo non dimostra che una posa intermedia sia stata disegnata. Nel ritorno reale posizione/basi/yaw e hash iniziale tornano esatti. La transizione Tramonto produce molti draw prima dei nuovi hit assestati.

PNG nativi proprietario main/worker: Sole2474×1844,2.909.134B,SHA90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d; Pioggia2.585.113B,SHA0dd971b684b29c9d9855a405878d903da025eb729f17832dda813ac50051fa1b. Identici ai bitmap v59 già trasferiti e verificati; metadati freschi/alias, nessun nuovo trasferimento dei pixel per questi duplicati. Il PNG pioggia prima dell'assestamento ha SHA5a03b65c… e rain diverso anche in f32: conservato come non qualificato per il confronto, non attribuito alla cache.

## Misura e controllo in movimento

| Finestra30s+2warmup | Invii/s | Prefisso completato/s | Delta richieste/draw/hit, warmup incluso |
|---|---:|---:|---|
| A1OFF |19,264740|19,145095|616/616/0|
| BON |19,466388|19,282811|625/0/625|
| A2OFF |19,133757|18,988052|615/615/0|

Stesso seed74,posa,target superficie,qualità256³/128³/384 e2474×1844,Pioggia80%,t60/forcing0,pausa=true,orbita=false,flusso completo,timingqueue,lampi0. Unica differenza trovata nel gruppo di campi scena/pipeline selezionato: rainCPU, identico dopo arrotondamento f32 a.800000011920929. PNG prima di ogni finestra identico. Nessun nuovo draw shadow nelle tre finestre. Il protocollo è stato congelato prima delle misure; review indipendente conservata con calcoli e limiti.

Controllo con orbita/simulazione attive: OFF641richieste/641draw/0hit; ON643/643/0. Tutti i prefissi completati,console vuota. CPU media osservata OFF.34302ms/p95.60, ON.56179ms/p951.10; render.24037→.43040ms. Tempi iniziali80,6838 contro88,3554 e traiettorie differenti: non misura causale degli FPS né overhead isolato della chiave. I circa20,043invii/s di entrambi sono indicativi. Il risultato utile è zero hit impropri, e il costo CPU viene dichiarato.

## Cronologia e riproducibilità

Base126manifestfb6c2319…; candidata129manifestf8d68185…; finale129manifesta4e38cfc…. R0 mirati145PASS/1FAIL: fixture attendeva2s contro transizione2,4s; corretta a3s. Il log R0 è stato sovrascritto per un errore di percorso di archiviazione: summary esplicito, nessun raw ricostruito. R1 146mirati/505completi PASS; tsc fallì soltanto sulle dimensioni Texture.image tipizzate{}; annotazione optionalwidth/height/depth, runtime identico e sourceR1 preservata. R2 APP→hero PASS. La finale aggiorna tagv60/reportKindv1 e aggiunge clearreport/guardexport al test lifecycle, quindi ripete146/505 e APP→hero con successo.

Workspace esterno `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle33`. `node_modules` ignoratoGit/nontracciato e attributoDropbox1 verificato prima/dopo; nessuna installazione o lock edit. `node_modules2/` e servizio4201 estranei preservati. Nessun push/deploy.

## Build finale e preview

`observatory-v60-terrain-raster-cache`: tutti e quattro i casi finali main/worker × Sole/Pioggia ripetono i targetFloat32 e i PNG sopra, qualità piena e stessa posa. ReportKind stabile `terrain-raster-cache-full-f32-v1`. Campo JSON svuotato all'avvio della nuova richiesta; nessun vecchio risultato letto come nuovo. Qualifica campi salvati in final-browser-qualification.json; non è un replay GPU.

Otto percorsi prodotto adottati dopo verifica byte dei126sorgenti di partenza;129sorgenti finali verificati contro snapshot. Preview4196 ora serve final-source/dist,ordinary seed74,Sole/nube matura animata,2474×1844;14sinistra/3giù per mostrare il terreno. Screenshot UI e console vuota salvati, separati dai PNG canvas fissi. QA53775/53776 e precedente server4196 chiusi intenzionalmente,exit0; nuovo4196 attivo. Nessuna modifica al servizio4201.

L'immagine resta invariata per contratto: questo checkpoint non passa il gate fotorealismo. La proposta materiale successiva è solo diagnostica: separare albedo da normal/illuminazione nello stesso target, prima di scegliere una correzione; nessun nuovo trial eseguito. La copertura reale nel core non è sostituita dallo slope-biome, che riguarda il fallback ignoto. Non riaprire normali45°,bias ombre o tuning senza prova causale.


## Archivio e continuita

Archivio [terrain-raster-cache-2026-10-17](measurements/terrain-raster-cache-2026-10-17/manifest.json): **82payload/10139919B**, escluso il manifest; manifestSHA256 `2d2651ce2179a4db1350f8186d18cc2f22b4eff1fb89d5b156f7e0ca3345c54c`. Sourcebase/candidata/finale,overlay,revisione indipendente,qualifica,JSON raw e aliasPNG,protocollo e screenshot ordinario. Gli overlay ricostruiscono la candidata sulla base126 e la finale sulla candidata129. Nessuna dipendenza o dist nell'archivio.

Restano aperti:60FPS stabili/presentati a piena qualita,materiale/struttura visiva credibile del terreno,anatomia/continuita della luce ravvicinata,pioggia/virga e UI. Non dichiarare PASS fotografico o prestazionale globale dalla cache. Non riprendere dal trial crease respinto; la base prodotto e ora la v60 con geometria/shader v59 invariati.

