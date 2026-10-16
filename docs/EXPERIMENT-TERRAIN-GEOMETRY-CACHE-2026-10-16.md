# Cache della geometria del terreno: trial ritirato

Il prototipo resta esterno e **non viene promosso nel prodotto**. Con pioggia guadagna il 2,1975% rispetto al controllo più veloce, sotto la soglia del 5% fissata prima delle misure. Con Sole tutti i run restano vicini al limite rAF di 60 invii/s, senza beneficio osservabile nella cadenza. La cache aggiunge 62.312.448 byte nominali (59,4258 MiB) e il rendering Float32 conserva differenze rispetto al percorso diretto.

Il rendering del prodotto resta quello di `10493afa7f6d90389c39e17b2cad79397dfdac01`; questo documento e il suo archivio non modificano sorgenti, qualità o R8. Il goal dei 60 FPS stabili e l'accettazione artistica complessiva rimangono aperti.

## Ipotesi e implementazione esterna

L'audit aveva individuato lavoro geometrico indipendente dal tempo dentro `landscapeColor` e nel solver del terreno. Il trial memorizza per pixel `[distanza, slope.x, slope.z, altezza]` in RGBA32F, lasciando live luce, cielo, albedo, nube, pioggia e moto. Non introduce half-float, filtri, nuovi coefficienti ottici o riduzioni dei passi.

Una nuova chiave della camera usa il percorso diretto; alla prima ripetizione ricostruisce la cache prima di consumarla nello stesso frame. La chiave comprende i valori f32 caricati di origine, base della camera, aspect, tanFov e inspection, dimensioni interne, terreno e versione geometrica. Prepass e film usano lo stesso QuadMesh e le UV interpolate; la lettura è `textureLoad(floor(uv*resolution),0)`. Il target non usa MSAA, depth, stencil, mipmap, color conversion o tone mapping.

La variante è attivata solo da `terrainCache=1`, con etichetta `observatory-v50-terrain-geometry-cache-trial`. La fabbrica diretta conserva byte per byte i 24 FunctionNode WGSL e le sei librerie originali nelle prove CPU. Non è una promessa di identità del codice macchina compilato. Main e worker condividono l'API dell'engine; la QA GPU registrata riguarda soltanto il main thread.

R1 contiene il prototipo e il primo witness. **R2 modifica solo il confronto numerico CPU e il relativo test**: engine, shader, geometria, controller e UI hanno gli stessi byte. Le due build sono separate, per evitare asset misti durante le misure.

## Sei finestre A/B/A

Le condizioni effettive sono identiche nei sei JSON: output e interno nativi **2112×1844**, ultra 384, volume 256³ e dettaglio 128³, seed 72, t = 60 in pausa, vento 55%, dispersione 0, full flow/full ablation, terreno attivo, cielo assestato, luce sinistra diurna. La posa diagnostica usa target `[0,0,0]`, origine `[0,4.439032422097125,15.371889641666392]`, yaw 0 e pitch **0,2811279826464208**. Il pitch non è 0,36: i tre tasti dipendono dall'altezza CSS corrente 1056×922. Nessun confronto percentuale con i cicli precedenti su altre griglie.

Ogni finestra ha 2 secondi di riscaldamento e circa 30 secondi misurati. Nessun altro test, build o probe è stato eseguito durante le finestre. A è il v50 originale; B è R2 con cache già valida, senza ricostruzioni o fallback durante la misura. R8 è associato nella pioggia e conservato senza binding nel Sole. Il residuo pioggia di Sole A1, 1,14066e−6, è sotto la soglia0,001: la specializzazione dichiarata è dry dall'inizio alla fine.

| Meteo | A1 invii/s | B invii/s | A2 invii/s | Esito |
|---|---:|---:|---:|---|
| Pioggia 80% | 13,516513 | 13,950298 | 13,650332 | +2,1975% sul controllo più veloce; deriva controlli 0,9900%; sotto gate 5% |
| Sole | 59,997800 | 59,996400 | 59,994401 | 1800 intervalli per run; nessun vantaggio osservato nella cadenza |

Tutti i prefissi finali sono completi, senza invii misurati non confermati. I timestamp hanno copertura parziale dichiarata: draw completi/mancanti **406/2,415/4,408/2** nella pioggia; **1794/6,1788/12,1796/4** nel Sole. Nessun draw parziale, ledger invalido o conflitto. Le somme dei pass non sono tempi isolati del terreno o tempi trascorsi di un frame; non vengono invertite per ricavare FPS. **La presentazione del compositore non è misurata.**

## Witness GPU: storage verificato, render Float32 diverso

I tre witness coprono tutti i 3.894.528 pixel e 15.578.112 componenti RGBA Float32 della griglia. Il prepass fresco e quello conservato consumato tramite textureLoad sono bit-identici: SHA256 `6e8c172a12ebce2da08dc9141a76b976f25085460cf390f0044506a3aba88b66`, 3.857.434 hit e 37.094 miss. Zero NaN, infiniti, sentinelle residue o errori di validazione registrati.

Questo verifica conservazione, indirizzo e stabilità del prepass nella posa misurata. **Non confronta la geometria calcolata dentro il renderer monolitico diretto.** R1 conservava solo le prime otto differenze del colore: i loro 1–3 ULP non erano un limite globale. R2 aggiunge massimi, RMSE e distribuzioni sull'intero buffer, senza modificare il criterio sui bit.

| Render post-film lineare | Canali / pixel diversi | Max assoluto | RMSE RGB | Max ULP | RGB8 lineare / sRGB8 derivati |
|---|---:|---:|---:|---:|---|
| R1 pioggia | 95.690 /69.186 | Non registrato | Non registrato | Non registrato | Non registrati |
| R2 pioggia | 95.690 /69.186 | 1,788139343e−7 | 1,310016547e−9 | 14 | Zero differenze in entrambi |
| R2 Sole | 165.543 /114.092 | 1,788139343e−7 | 2,311597132e−9 | 18 | 2 canali/2 pixel e1 canale/1 pixel; delta massimo1 |

R1 e R2 pioggia hanno gli stessi hash di entrambi i buffer render. La quantizzazione CPU confronta tutti gli 11.683.584 canali RGB eleggibili, con clamp [0,1], trasferimento IEC sRGB ed arrotondamento a 8 bit; alpha è escluso e non vi sono canali invalidi esclusi. **È una misura derivata, non un'immagine del compositore. Il render resta FAIL sui bit in tutti e tre i witness.**

Non è stata individuata una formula semanticamente diversa per il caso misurato. La separazione RGBA32F può cambiare il contesto delle operazioni f32, ma la causa non è isolata. La [specifica WGSL, sezione 15.7.5](https://gpuweb.github.io/gpuweb/wgsl/#reassociation-and-fusion), consente riassociazione e fusione; non dimostra che siano la causa osservata né garantisce questi limiti per altre pose o backend.

Gli otto JPEG archiviati sono snapshot **CSS 1056×922**, non PNG nativi o video. I tre Sole sono identici anche nei byte; i tre pioggia includono il pannello Misure con opacità, contatori e scroll differenti e non costituiscono una prova di equivalenza dell'intero frame. Il confronto numerico ha uno scope distinto e più preciso.

## Prove conservate e limiti aperti

R1 passa 115 test mirati in 8 file; R2 ne passa 127 negli stessi8 file. Typecheck e build Vite passano per entrambe. I log conservano anche i primi errori corretti: un locale inutilizzato e un selettore del fixture UI con ID duplicati. I test CPU di controller/host e del padding 17×2 non qualificano worker GPU, indirizzamento GPU a larghezza dispari o lifecycle reale.

Nessun pixel t=0 è apparso. Camera mobile, invalidazioni interattive, rilascio/device loss e solver geometrico inline rimangono non qualificati su GPU. Il trial preserva i limiti di correttezza del solver originale. Il witness aggiunge un secondo target e copie CPU temporanee: il picco di memoria non è misurato.

L'[archivio curato](measurements/terrain-geometry-cache-2026-10-16/README.md) conserva i 16 sorgenti originali necessari alle differenze, manifest completi, prove WGSL, log, sei report integrali compressi, tre witness, JPEG e metadati. Il verificatore offline controlla hash e invarianti senza renderer. I buffer GPU completi non sono stati esportati: i loro hash e le statistiche sono conservati nei report, ma il verificatore non può ricalcolare gli errori completi dai soli hash. Lo script di ricostruzione recupera i 108 file baseline dal commit locale verificato e ricostruisce i 116 file R2 in una nuova directory esterna, senza installare o avviare nulla.
