# Cloudia — contributo diretto delle ombre e trial delle normali45°

17 ottobre 2026, ciclo36. **Controfattuale GPU completato; trial visivo delle normali respinto. Runtime v59/9ea9840 conservato, goal attivo.** Le prove cambiano la direzione del lavoro senza introdurre un ritocco visivo non convincente.

## La luce diretta non spiega il contrasto nei dodici punti

Il nuovo owner esterno `diagnostic-v59-shadow-direct-counterfactual` usa lo stesso materiale e pipeline compilato della diagnostica: mode0 ordinario, mode1 lookup precedente, mode2 sostituisce soltanto l'argomento `solarVisibility` dello shade con1. Il materiale ordinario, incluse rough normals, albedo, WorldCover e derivate implicite, resta fuori dall'If di override. Camera, geometria, Sole, colori solari/ambientali, footprint, acqua e distanza restano identici. Non è un nuovo modello fisico né identità delle operazioni della pipeline prodotto originale.

Riusa il target RGBA32F nativo:12copie ordinarie, un draw forced-lit nel BBOX fisso1.049.267pixel,12copie di confronto. Mode0 e ridisegno ordinario completo ripristinati prima di qualsiasi await; drain allSettled, busy e lifecycle preservati. Nessun target, texture o raggio nuovo;384B nominali restituiti, non memoria driver/staging. La review ha aggiunto prima della GPU un controllo esplicito della sentinella vuota; R1 qualifica conservata, nessuna GPU su quella revisione. Finale85test mirati,444/444 in47file, typecheck e APP→hero PASS.

**Risultato:48/48 componenti RGBA Float32 identiche tra live e forced-lit.** ΔRGB=[0,0,0] per tutti12 i punti; alpha e i tre contrasti di coppia identici. Le48componenti ordinarie sono anche bit-identiche alla precedente lettura GPU del ciclo35. L1-artifact aveva visibility0, ma togliere quell'attenuazione non cambia il suo RGB campionato. L2/L3 e gli altri controlli avevano già1. Questo confronto non separa ulteriormente normali, albedo, ambiente o acqua e non attribuisce automaticamente l'intera forma delle macchie.

Cache shadow valida: submission1→1,epoch0,richieste1821→1823; input e ripristino stabili. Elapsed38,8ms complessivi,38,2ms sonda: performance.now con copie attese, non timestamp GPU, CPU usage, compositore o FPS. Review indipendente conferma bit, contrasti e limiti.

La prima acquisizione Sole era durante la transizione, progress.35425/haze1.569946: metadata conservati come tentativo non qualificato, senza byte PNG trasferiti o alias inventato. A cielo assestato, prima/dopo:2474×1844,2.909.134B,SHA90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d, stesso bitmap v59 già interamente trasferito. Metadata freschi e alias verificato, nessun nuovo trasferimento di quei PNG. Console osservata vuota.

## Una sola candidata: gruppi di normali a45°

`experiment-v59-terrain-crease45`, copia esterna pulita della base126. Il helper usa CSR dei corner incidenti, senza Map di milioni di edge/stringhe. Unisce le facce soltanto attraverso un secondo indice condiviso e un dihedrale<=45°; gruppi connessi con somma delle aree Float64. Con un unico gruppo mantiene esattamente i bit della normale originale. Duplica gli altri vertici per normali distinte, preservando posizione e dati del suolo per ogni corner e ordine/winding dei triangoli. Nessun DEM sample, noise, lookup, shader o pass aggiunto per frame.

La connessione è transitiva: un fan alternativo può ricongiungere un endpoint anche se il suo edge diretto supera45°. Non promettere un taglio su ogni hard edge. Test e statistiche distinguono adiacenze hard e vertici effettivamente divisi. Soglia45 fissata, nessuno sweep dopo l'esito.

Otto test piccoli coprono piano invariato, cuneo/soglia inclusiva, facce che condividono solo un vertice, transitività/fan alternativo, corner bits, input immutati e cap/finiteness. Review statica indipendente senza blocker.90test mirati,443/443 in47file, typecheck e APP→hero PASS. Dipendenze già disponibili, nessuna installazione o modifica lockfile; node_modules Gitignorato/non tracciato ed esclusione Dropbox1 verificata prima/dopo.

Un solo preflight sul modello reale, con i quattro hash v59 storici verificati prima e dopo il helper. Tutti3.547.650corner confrontati:0scarti posizione/surface, input immutati, normali finite; massimo errore unitario4,13e−8. Output591.788→594.082vertici, stessi1.182.550triangoli.2.294duplicati su1.965vertici sorgenti,73.408B geometrici aggiunti:33.201.224B finali.9.034coppie edge-endpoint hard, non edge unici. Massima valenza11 e4gruppi. Scratch nominale56.771.628B, capacità output36.590.600B, picco owned typed-array112.372.852B escluso input/driver; distinti dal RSS.

Run bounded PASS:2,592691s childCPU,2,161396s wall complessivi,962.772.992B peak RSS terminale macOS. Gate20CPU/40wall/2GiB RSSterminale, non limite OS alla memoria. La fase lettura/decode/build1.568,7ms e la fase helper con verifica preliminare dei quattro hash374,4ms sono elapsed di questo singolo run, non confronto di velocità con vecchi run né costo GPU.

## Gate nativo: FAIL e stop

PNG candidato2474×1844,2.908.264B,SHA cac9ee865df1a24728150f8d7d2106e379f17172782d1710a70f4dc6eb6c2898: **60parti complete**, letture grezze<=16.384caratteri, lunghezza/SHA/IHDR verificati. Seed74/t60,Sole assestato, stessa camera/luce float32 e qualità256³/128³/384/fullflow/native. Native metadata confermano594.082vertici e gli stessi stats del preflight. Console vuota.

Root e review indipendente: **FAIL/no utile miglioramento.** I grandi crinali restano morbidi/cuscinosi; alcuni corti bordi o segmenti scuri diventano più netti e la catena lontana mostra più facce angolari. Le ROI1:1 fisse [0,560,1000,1000] e [700,540,1030,780] non mostrano struttura naturale aggiunta; cuneo e versante restano quasi identici. La review ha riletto gli hash e verificato i crop pixel-esatti. Il conteggio PNG cambia78.711pixel/4.562.056(1,7253%), massimo delta canale20: misura8bit di differenza, non beneficio artistico.

Stop rispettato: nessun ritocco angolo, worker, pioggia/Tramonto, moto o benchmarkFPS dopoFAIL. Helper e integrazione non promossi; non usare crease-source come nuova base.

## Continuità e prossimo passo concreto

Preview ordinaria4196 ripristinata: Sole animato, output/interno2474×1844,256³/128³/384,console vuota e screenshot UI salvato. Valori live rAF/GPU non qualificano60FPS. Server53773/session37499 e53774/session49393 chiusi intenzionalmente,exit0.126sorgenti prodotto byte-identici alla base fb6c231918e7a825f5b1a407efcd98aaacf5cca352c60cbdcdb9b5271a913ff2.4201 e node_modules2/ estranei preservati; nessun push/deploy.

**Prossimo intervento FPS selezionato: cache per input esatti dell'attuale target colore+distanza TerrainMesh.** Il target esiste già: nessuna nuova texture; su hit si può evitare un clear/draw di1.182.550triangoli mantenendo cloud/rain live. Servono dipendenze esplicite della shade closure, versioni/epoch di risorse/camera/luce/materiale, invalidazione su errori/resize/reset/scritture esterne e default live senza descrittore. Non basta una camera ferma. Prima parità target Float32 e PNG, cambi controllati e main/worker; poi A/B/A fresco a qualità piena e controllo camera mobile. Nessun tempo GPU o60FPS promesso dalla stima statica. Proposta esterna salvata e non implementata. DryR8 non riproposto: già provato senza beneficio nearSun; vecchia cachev50 riguardava un altro intermedio ed è respinta nel suo ambito.

Sul piano visivo resta da trovare un materiale/dettaglio coerente con la scala dei rilievi: né ombre mancanti nel campione né normale hard45 spiegano/risolvono da sole la richiesta. Anatomia/vicino, pioggia/virga, paesaggio/UI e60FPS restano aperti. Il ciclo è progresso per il controfattuale e il trial eseguiti, non completamento del goal.

Archivio [terrain-direct-light-crease-2026-10-17](measurements/terrain-direct-light-crease-2026-10-17/manifest.json):70payload,4.247.402B,manifest9b3734e6… . Overlay counterfactual128 rispetto al parent128 del ciclo35; overlay crease128 rispetto alla base126. Source/dist completi esterni in /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle32. Saved-evidence controlla soltanto file e contratti registrati, senza replay del modello/GPU/FPS o nuova approvazione artistica.
