# Terreno osservato v61 — qualifica locale del materiale

17 ottobre 2026. **Il materiale ottico è adottato localmente come miglioramento visibile del terreno; il fotorealismo finale e l’obiettivo FPS dell’intera scena restano aperti.** Il default v61 è autenticato contro la candidata qualificata. [Archivio delle evidenze](measurements/terrain-optical-material-2026-10-17/README.md) e [verifica dei dati salvati](TERRAIN-OPTICAL-MATERIAL-VERIFICATION-2026-10-17.json). Nessun push o deploy pubblico.

## Cambiamento e motivo

Le sole palette autoriali producevano ampie campiture uniformi. Il materiale ora usa anche la distribuzione spaziale del composito annuale Sentinel-2 2021: bosco, superfici minerali, aree agricole e costruite acquistano variazioni geografiche riconoscibili. Le classi reali cropland/built non vengono riclassificate come foresta naturale. La mesh, il DEM, le normali e la luce restano gli stessi; la texture non aggiunge incisioni, canopia o dettaglio geometrico.

Il derivato statico è una griglia 2048² di celle 62,5m, RGBA16F: RGB lineare premoltiplicato per frazione valida, A=frazione valida. Le mip vengono generate per campionare le medie di area; nessun gain, gamma aggiuntiva, fit per seed o divisione per alpha. Nelle sei componenti terrestri note la parte valida sostituisce il colore autoriale con il colore osservato; acqua e area unknown mantengono il trattamento precedente. Il composito contiene illuminazione e ombre: **non viene dichiarato albedo fisica né recupero BRDF**. Fonte e trasformazioni sono indicate nell’avviso dati, con credito CC BY 4.0 e [accesso ufficiale ESA](https://esa-worldcover.org/en/data-access).

L’implementazione comprende:

- `terrainOptical.ts`: caricamento una volta per owner, stream di dimensione fissa, SHA256 atteso prima della texture, controlli strutturali, AbortSignal e dispose idempotente. Errore di autenticazione/caricamento esplicito, senza sostituzione silenziosa del dato.
- Factory compile-time `terrainOpticalSurfaceWGSL` e wrapper raster: false restituisce il percorso canonico; true aggiunge il solo campione ottico e la sostituzione del colore. Normali, roughness, illuminazione, mare, geometria e integrazione nube/pioggia restano invariati.
- Binding ottico incluso nelle dipendenze della cache terreno. Payload nominali:33.554.432B CPU/base texture,44.739.240B GPU comprese mip. Non sono misure di picco o residenza driver; avvio non cronometrato separatamente.
- v61 attiva l’ottica per default su main/worker; `?profile=1&optical=0` ricrea un owner canonico senza asset/binding ottico. Non c’è cambio shader a metà frame.
- Harness diagnostico `profile=1&navAudit=1`: solo durante il benchmark 30s, yaw additivo `.16*sin(2πt/10s)`, nullo fuori finestra, senza mutare la vista manuale. Ledger fino a 31 pose effettive sparse; nessuna identità per-frame o presentazione implicita.

## Gate visivo e numerico

Il confronto nativo iniziale A/B, prima completo e poi nelle due ROI1:1 fissate, ha ottenuto **PASS materiale limitato** da root e revisore indipendente. B riduce chiaramente le campiture uniformi e rende leggibili distribuzioni irregolari sui costoni e lungo la costa; il cambiamento non consiste in un semplice oscuramento. Nella posa non sono emerse nuove griglie 62,5/125m, giunzioni rettangolari o invasione visibile del mare. Restano fasce/segni scuri sulle creste, superfici arrotondate e materiale morbido. La copertura cromatica non prova roccia o foresta tridimensionale credibile.

Sole con X specchiata e Tramonto non hanno mostrato contraddizioni macroscopiche nuove sufficienti allo stop. Non erano confronti con un A alle stesse luci: non escludono tutta l’illuminazione incorporata, e il Tramonto scuro è un controllo meno sensibile. Pioggia e worker Sole/Pioggia sono stati acquisiti; i controlli saved cached=fresh e i digest PNG main/worker corrispondono. I duplicati PNG worker non sono stati ritrasferiti. Nessuna qualifica FPS della pioggia deriva da questi controlli visivi/numerici.

Il default finale v61, seed 74/t60 fermo/posa fissata, conserva il frame B qualificato:

| Evidenza finale | Risultato |
|---|---|
| Target terreno completo RGBA32F | cached=fresh, stable e cacheStateQualified;72.992.896B packed |
| SHA RGBA32F | `07fa43ec5de6d77b9bdf83d5a78e73cb607ae573d875ce382b3c28f909fb2fb9` |
| SHA alpha distanza,18.248.224B | `29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c`, uguale al canonico |
| PNG canvas 2474×1844,3.599.836B | `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9`, uguale al B qualificato |
| Qualifica finale |561 test/53 file PASS; typecheck e build APP→hero PASS |

Sono prove di bit della posa e del canvas, separate da accuratezza geografica, percezione visiva e presentazione del compositore. La geometria qualificata resta 591.788V/1.182.550T con quattro buffer canonici autenticati; il controllo RSS geometria con unità errata resta NON QUALIFICATO, senza dichiarare un budgetPASS.

## Prestazioni: un A/B/A statico e uno in navigazione

Stessa qualità piena: macro 256³, detail 128³, 384 passi, output=interno2474×1844, full flow, seed 74, nube ferma a60s; finestre30s dopo 2s di warmup. A=canonico, B=ottico, owner nuovi in ordine A1/B/A2, timing timestamp disattivato. Nessun modello/build/audit/esportazione durante le finestre.

| Percorso | A1 invii/s | B invii/s | A2 invii/s | B vs media A | Deriva A2/A1 |
|---|---:|---:|---:|---:|---:|
| Statico |59,9982|59,9956|59,9934|−0,00033%|−0,00800%|
| Navigazione deterministica |59,9605|59,9992|59,9954|+0,03545%|+0,05825%|

Tutte le sei finestre hanno zero intervalli oltre 33,34ms e prefisso finale completato nei report. Nello statico il terreno è riusato: zero nuove submission colore durante il percorso conteggiato. In navigazione risultano circa 1.800 submission terreno e 31 pose sparse per finestra, verificate rispetto alla formula (errore massimo della ricostruzione 4,44e−16km). Il ledger non misura ogni frame e i campioni rAF non avvengono agli stessi istanti A/B.

**Non emerge una regressione degli invii nelle due prove; non è costo zero.** I risultati sono al limite di refresh: non misurano headroom GPU né FPS presentati (`presentedCanvasFps=null`). Un solo A/B/A per percorso, senza intervalli di confidenza o isolamento termico. Non ricavare un guadagno di velocità dalle piccole differenze. La pioggia pesante, in precedenza intorno a 19 invii/s, non è stata rimisurata in questo ciclo.

## Stato e prossimi limiti

Applicati localmente 15 percorsi esatti dopo verifica della base 129 e del nuovo insieme 141; tutti i 141 hash prodotto corrispondono a `final-manifest.json` SHA `2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73`. Preview locale 4196 aggiornata dal build finale, Sole animato maturo e output nativo; non equivale a deploy pubblico.

Conservare anche i negativi di preparazione: navigazione R3 con 560 PASS/1 FAIL per fixture di assestamento, poi R4 corretta e qualificata; due setup finali directory/symlink senza esecuzione valida, poi final R3 qualificata, senza installazioni. Il warning chunk grande dei build resta registrato. Nessuno di questi è cancellato dal risultato finale.

Rimangono aperti fotorealismo complessivo, segni/fasce sulle creste, forma/near della nube, leggibilità pioggia/virga, UI e FPS nelle viste pesanti. Non introdurre nuovi gain o variazioni del materiale dopo le immagini per forzare il PASS. Il materiale osservato è un progresso locale verificato, non chiusura del goal.

## Evidenze archiviate

- `qualification-results.json`, `performance-summary.json` e protocolli pre-run statico/navigazione/adozione.
- `browser/final-default-full-f32.json`, `final-default-native.json`, PNG B e ledger; confronti A/B, luci ampliate, pioggia e worker.
- Report prestazionali grezzi statici/navigazione e relativi console/precondizioni.
- `native-independent-review.md`, `expanded-light-review.md`, `native-root-review.md`, review loader/factory/navigazione e `final-adoption-review.md`.
- Loader/factory/test, asset SHA/provenienza e avviso pubblico; source manifest base/candidata/navigazione/finale. Snapshot/dist completi restano esternamente; source/INDEX e overlay ricostruiscono i quattro snapshot elencati dalla base Git immutabile. I negativi della fixture navigazione R3 hanno log e correttivo documentato, senza un proprio manifest pre-run.

Censimento finale archivio:188payload/53.965.937B; manifestSHA da sidecar. I due screenshot UI erano byte JPEG sotto estensione.png e sono stati rinominati.jpg senza conversione; i PNG nativi/ROI erano corretti. Il verificatore controlla anche il censimento completo, incluso il manifest originale del pack. Le sole verifiche salvate non rieseguono modello/GPU/FPS.
