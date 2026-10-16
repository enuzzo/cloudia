# Cache ombre v58 — verifica indipendente A/B/A

Esito: **PASS di comparabilità dei record, aritmetica, completamento del prefisso e meccanismo della cache. Incremento di cadenza osservato positivo in questo A/B/A locale; nessuna prova di una percentuale stabile generale o di 60 FPS.** Il controllo A2 è sensibilmente più lento di A1: la deriva resta un limite materiale, anche se B supera entrambi.

Analisi offline del 16 ottobre 2026, senza test/build/GPU/browser e senza modifiche al runtime. Fonti: i tre `browser/v57-rain-A1-report.json`, `v58-rain-B-report.json`, `v57-rain-A2-report.json`; metadati `v57-rain-A1-native.json`, `v58-rain-B-native.json`, `v57-rain-A2-metadata.json`; protocollo `browser/PROTOCOL.json`. Dati derivati compatti in `cache-ABA-independent-analysis.json`.

## Cadenza e coda

| Run | Intervalli | Durata ms | Invii/s | p95 ms | Prefisso finale | Drain finale ms |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| A1 v57 | 586 | 30002 | 19.532031197920137 | 67.3000 | 586/586 completed | 250.8000 |
| B v58 | 702 | 30035.5 | 23.372342727772136 | 51.2000 | 702/702 completed | 165.4000 |
| A2 v57 | 530 | 30036.300000000003 | 17.64531583450691 | 68.2000 | 530/530 completed | 228.2000 |

Per tutti e tre: intervalli finiti e positivi; lunghezza, somma e rapporto `N*1000/somma` coincidono esattamente con `stats.frames`, `durationMs`, `fps`. `submissionFps` è la cadenza di invio, non presentazione. `queuePrefix.status=completed`, `confirmedPrefixId=measuredSubmissions=stats.frames`, `unconfirmedMeasuredFrames=0`; tutti i 31 campioni di prefisso per run sono completed. `skippedFrames=0`, nessun limite di frame in flight.

- B rispetto ad A1, controllo più rapido: **+19.6616086209%**.
- B rispetto ad A2: **+32.4563580895%**.
- Deriva A1→A2: **−9.6595963026%** usando A1 come denominatore. Spread relativo al controllo più lento: 10.6924431453%; non confondere i denominatori.

Il B è sopra l’intervallo dei due controlli; è un risultato locale coerente con la rimozione del pass ombra. La deriva impedisce di presentare +19.66% come guadagno precisamente riproducibile. I completion-bounded submission rates sono rispettivamente 19.3629394660 / 23.2429551000 / 17.5083329755: confermano la chiusura dei prefissi, includono backlog/consegna JS e non misurano throughput GPU isolato o compositor. I drain non sono il costo del pass ombra. **60 FPS stabili resta FAIL/non raggiunto** in queste finestre di pioggia.

## Comparabilità del carico — PASS nei record

Tre report: main/WebGPU, Three 186, adapter apple/metal-3 non fallback, ultra 384, volume 256³ e dettaglio 128³, output=internal=2474×1844, modalità screen, DPR2 (CSS1237×922 nei metadati), seed74, ground1, approach0, ablation full, flow full e compute flow attivo. Stessi terreno GLO-90, cover WorldCover, bounds, extinction, empty step e percorso `r8unorm-extracted-r`/linear clamp mip0 senza fallback, a inizio e fine. Specializzazione rain e mask128³ invariati. Profiling/timing queue e assenza di frame limit identici.

Posa esatta nei tre report e metadati: origin `[15.459707890770279,7.558173047097125,2.780613896133632]`, target `[0.3515625,3.119140625,-0.0546875]`, yaw `1.3852869846402587`, pitch `0.2811279826464208`. Le basi camera/FOV, il materiale e tutta la struttura lighting dei tre metadati sono uguali. Sole `[-0.668126592347077,0.7126683651702156,0.21380050955106467]`, sunset0; solar/ambient/flash uguali, flashCount0. Volume/flow/material state non mostrano riduzioni silenziose.

Meteo iniziale dei tre report esattamente uguale: rain `0.7999999999999995`, vento .55, dispersione0, cielo rain, transizione1, no lightning automatico. Metadati: targetRain.8, haze2.6, overcast.85, skyPendingfalse, progress/blend1. Solo rain differisce al livello CPU: A1 `.7999999999999874`, B `.7999999999999877`, A2 `.7999999999999994` (spread circa 1.2e−14). Non è identità letterale dell’intero JSON meteo; non è evidenza di un carico di pioggia ridotto in B.

`weatherTime` differisce fra owner e avanza durante i run: A1 61.6873→93.7227, B 60.4714→92.5236, A2 48.7539→80.8069 s. In tutti simulationTime60→60, forcingTime0→0, precipitationUniformTime0→0; pausedtrue/orbitfalse. Nei metadati flowUniformTime=flowFieldTime60. Il clock meteo non è il clock di advezione della pioggia. I metadati sono singoli draw separati dalla finestra, non un log continuo; il report non espone cameraEnd/skyPendingEnd/rainEnd. Non trasformare questi record in prova per ogni frame o per meteo in transizione.

I tre metadati dichiarano PNG2474×1844, 2508514 B, SHA `9d4d3c19e24bf237691e3d18af0ae4e88b605cfc66c4637269062d72324e16de`. In questo sottotask ho confrontato i metadati, senza ricalcolare i byte PNG o fare una nuova critica visiva: questa coincidenza dichiarata non sostituisce la verifica file del root.

## Cache e chiamate — PASS del meccanismo osservato

B iniziale `terrainRaster.shadow.cache`: requests1448, submissions1, hits1447, epoch0, validtrue. Finale `terrainRasterEnd.shadow.cache`: requests2198, submissions1, hits2197, epoch0, validtrue. Quindi **Δrequests750, Δhits750, Δsubmissions0, Δepoch0**. Il draw freddo è avvenuto prima della misura; non significa assenza totale di GPU shadow work nell’owner. I delta includono warmup/ancora e non vanno confrontati uno-a-uno con i 702 intervalli.

| Run | Render calls attese per draw misurato | Compute calls | Timestamp draw completi / missing, render e compute |
| --- | ---: | ---: | --- |
| A1 | 4, tutti i 586 | 1 | 585 / 1 |
| B | 3, tutti i 702 | 1 | 699 / 3 |
| A2 | 4, tutti i 530 | 1 | 526 / 4 |

Zero partial, invalid-ledger o conflict; zero righe timestamp invalide, UID/callslot duplicati, assegnazioni ambigue o ID ledger/intervallo duplicati. Restano 5/4/5 righe senza assegnazione a un range ledger e 195/192/175 righe fuori dalla finestra misurata: non dichiarare copertura globale senza eccezioni. I missing timestamp sono dati non acquisiti, non frame applicativi persi; tutti i prefissi applicativi risultano completati.

Il contatore cache e 4→3→4 sostengono che B salti il draw ombra mantenendo il compute e il rendering live. A non ha contatori cache né terrainRasterEnd: l’assenza non vale zero. Questi report non identificano da soli il ruolo shader di ogni call; l’attribuzione al pass ombra combina i contatori con il codice congelato, non una nuova cattura pipeline.

Le somme medie timestamp render (100.5636 / 81.9105 / 109.7311 ms) non sono costi esclusivi del frame: gli intervalli restituiti possono sovrapporsi. **Non sottrarle per stimare millisecondi ombra risparmiati, non sommarle al compute e non invertirle per ottenere FPS.** La cache non cambia il bias, la geometria o le scaglie: il PASS qui riguarda la comparabilità e il comportamento prestazionale osservato, non accettazione artistica generale, worker in pioggia o invalidazioni dinamiche durante questi tre run.
