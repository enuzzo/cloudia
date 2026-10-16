# v58 — cache delle ombre e diagnosi sulle facce reali

16 ottobre 2026. **Cache adottata; fotorealismo e60FPS globali ancora aperti.**
La preferenza per geografia reale, comprese le zone abitate, resta nel materiale
WorldCover già presente: nessun edificio o nuovo pass è stato aggiunto.

## Modifica adottata

Il terreno è una mesh statica e il target delle sue ombre ha un solo proprietario.
v57 disegnava nuovamente i929.792triangoli anche con sole e geometria identici.
v58 conserva il risultato finché coincidono renderer, reverse depth, direzione
solare normalizzata, bounds, dimensioni, identità/versioni degli attachment ed epoch.
Il pass colore/distanza del terreno continua a ogni frame. Shader caster/receiver,
materiali, mesh, densità nube e qualità256³/128³/384 sono identici.

Un miss invalida la vecchia chiave prima del clear; il commit avviene dopo draw
e ripristino riusciti. Un errore dopo il clear non rende riutilizzabile il vecchio
contenuto. Listener di dispose e invalidazione durante draw/restore impediscono
di confermare una chiave superata; dispose è terminale. Le versioni post-bind di
Three vengono conservate. Mutazioni future dei caster o scritture/reset esterni
richiedono `invalidate()`: la cache non scopre modifiche arbitrarie.

L'hit conserva un piccolo costo CPU per validazione, frame della luce e chiave;
non aggiunge texture GPU. I contatori sono chiamate/tentativi CPU, non completamenti
GPU. Diagnostica PNG e benchmark espongono questa distinzione e snapshot iniziale/finale.

## Qualifica e immagini native

124sorgenti congelati, manifest SHA256
`21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`.
Tutti corrispondono al checkout dopo l'adozione dei soli quattro file modificati.
37/37test mirati, typecheck,399/399test45file e build APP→hero PASS.
Review indipendente statica e dei report senza blocker nel contratto sopra.

Canvas2474×1844, qualità piena, seed74, t60, pausa, dispersione0, flow completo.
Camera terreno: origin[15.459707890770279,7.558173047097125,2.780613896133632],
target[.3515625,3.119140625,-.0546875], yaw1.3852869846402587,
pitch.2811279826464208, approach0. Sole assestato main e worker:
2.817.764B, SHA256`af8877ac93db6fcd50ab3ceece43ac1a40fc7d21c41151afb3a9620ca7586be5`,
**byte-identici anche al PNG v57 precedente**. Ogni trasferimento completo è
ricontrollato per lunghezza, SHA, IHDR e decodifica;58parti testuali visibili.
Prima cattura Sole durante la transizione conservata separatamente, non comparabile.

Rotazione della camera: shadow submissions resta1 e gli hit crescono.
Cambio della luce: nuova direzione solare e30tentativi al momento della cattura
durante l'interpolazione, cache valida; nessuna promessa di numero fisso dei miss
durante un sole in movimento. Worker Sole identico e console senza warn/error.

## FPS: confronto fresco A/B/A sulla pioggia

Stessa camera, output nativo, backend Apple Metal3, main, diagnostica queue,
384passi,256³/128³, R8, pausa e nessuna ablazione.2s warmup,30s misurati per run.
Tutti i prefissi start/periodici/end sono completati e nessun frame misurato è
rimasto non confermato. I PNG Rain A1/B coincidono byte per byte:
SHA256`9d4d3c19e24bf237691e3d18af0ae4e88b605cfc66c4637269062d72324e16de`.
A2 registra lo stesso hash prodotto dall'app, senza un terzo trasferimento PNG.
Pioggia assestata: differenze floating-point inferiori a1,3e-14; forcing e clock
precipitazione0, simulazione60 in tutti gli start/end. WeatherTime avanza e differisce.

| Run | Versione | Frame / tempo | Invii/s | p95 rAF | Prefisso confermato |
| --- | --- | --- | ---: | ---: | --- |
| A1 | v57 |586/30.002,0ms|19,5320|67,30ms|586/586|
| B | v58 |702/30.035,5ms|23,3723|51,20ms|702/702|
| A2 | v57 |530/30.036,3ms|17,6453|68,20ms|530/530|

B supera il controllo più rapido del19,66%, A2 del32,46%; deriva A1→A2−9,66%.
È un miglioramento locale osservato con variabilità rilevante, non una percentuale
garantita o una qualifica dell'animazione/compositore. **60FPS con pioggia non raggiunti.**
Nel delta start/end B:750richieste,750hit,0draw ombra, epoch0/valid true.
Il delta include warmup/ancora, quindi non equivale ai702intervalli misurati.
Chiamate render attese per draw4→3→4, compute1 sempre; copertura timestamp completa
585/586,699/702,526/530, nessun conflitto. Le poche acquisizioni mancanti restano tali.
Gli intervalli GPU possono sovrapporsi: non sommarli/invertirli o attribuire la loro
differenza al costo esclusivo dell'ombra. Il fence prova completamento del prefisso,
non presentazione dello schermo. Nessun confronto causale con i vecchi run ad altra mira.

## Correzione della diagnosi delle scaglie

Il trial normal-clearance precedente resta scartato. La semplice scomparsa delle
chiazze con visibility1 identificava il ramo ombre, senza dimostrare acne.
Ora18raggi su sei pixel prefissati usano la mesh Float32 effettiva465.409vertici,
929.792triangoli e la camera nativa: ricevitore, caster al centro del texel, raggio
fisico verso il sole. Unico run CPU2,299s, wall1,994s, RSS834.404.352B sotto2GiB,
exit0 entro i limiti. La review della proiezione non trova blocker; raster/f32GPU
e tie-break non sono riprodotti bit per bit.

Tutti i tre pixel scuri hanno un blocker reale della mesh, a79–272m. **Anche i
tre vicini scelti perché invariati nella prova senza ombre hanno un blocker**,
a98–275m; il riferimento shadow-map li illumina. L1 e L3 condividono perfino la
stessa faccia ricevente tra punto scuro e controllo. Non è corretto chiamare
quei tre pixel scuri semplici ombre spurie da eliminare.

Il minimo affine sull'intero texel estrapola fuori dal triangolo. Nel controllo
L1 il caster è quasi radente, normale·sole.07705: la riduzione è432,78m e rende
il confronto illuminato con margine234,08m. La perdita non è limitata a contatti
millimetrici o necessariamente sotto poche decine di metri. Anche la mesh locale
usa celle256m contro il passo DEM125m: facce e silhouette restano un tema distinto.

Analisi Float64 dei soli sei record salvati, nessun nuovo rendering: limitare
il minimo al triangolo intero lascia due controlli erroneamente illuminati;
ritagliare triangolo∩texel li rende tutti schermati. **Nessun fix adottato:**
tutti e sei i lookup UV sono fuori dal triangolo caster vincente, che occupa
solo parte del texel; mancano controlli fisicamente non schermati. Un risultato
positivo su questi sei punti non garantisce l'assenza di nuove ombre false.

Lo studio API descrive un caster per triangolo supportato da Three0.186 con
storage propri e ownership statica verificata, ma non implementato/compilato.
Potenziali2,79milioni di invocazioni vertex, payload aggiuntivo fino18,60MB:
nessuna equivalenza di costo, specie mentre si sposta il sole. Prima di un trial
servono controlli realmente illuminati e verifica del lifecycle reale.

## Consegna e prossimi gate

[Pacchetto curato](measurements/terrain-shadow-cache-2026-10-16/README.md):
protocolli, prima/dopo dei quattro sorgenti, manifest124/30, test/build, review,
PNG native/metadati/paginazione, tre report originali, witness e analisi offline.
`verify.py` controlla soltanto evidenze salvate e hash: non riesegue GPU/test/raggi.
88payload/20.526.317B, manifest SHA256
`8d1c2f22c1a6451590bf167f7fff34034dc66d7341cdd3d9ec33f415867f2190`;
verifica hash, cinque PNG decodificati,124sorgenti base/candidata virtuali e30dist PASS.
Preview ordinaria4196 aggiornata a v58, Sole animata, canvas2474×1844, senza
controlli diagnostici; screenshot UI separato dai PNG native. Console osservata
senza warn/error. Server temporaneo53763 chiuso dopo la qualifica;4201 estraneo intatto.

Restano aperti fotorealismo, facce uniformi, perdita d'ombra, anatomia grandeU,
vicino troppo morbido, cortina pioggia uniforme, movimento/UI e60FPS globali.
Il goal resta attivo: questo checkpoint è un progresso prestazionale e diagnostico.
