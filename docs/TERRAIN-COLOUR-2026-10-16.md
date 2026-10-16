# Cloudia v55 — colori del terreno guidati da Sentinel-2

16 ottobre 2026. Goal attivo, fotorealismo complessivo e 60 FPS ancora aperti.
Segue i rilievi Copernicus v53 e la copertura WorldCover v54. La preferenza
del proprietario mantiene geografia reale e aree abitate a costo equivalente.

## Modifica adottata

Le tre righe RGB dei boschi e della vegetazione bassa ricevono una correzione
cromatica guidata dal composito annuale Sentinel-2 L2A2021. Per classe10 e30,
la cromaticità mediana dei campioni selezionati determina un fattore RGB comune
rispetto al centroide dei colori originali. Ogni estremo conserva poi la propria
luminanza autoriale. Si conservano anche i contrasti relativi fra i rapporti
dei canali: non si porta tutta la vegetazione a una sola tinta.

**R1 è scartata**: la cromia unica per classe appiattiva i boschi. R2 recupera
la variazione; nella stessa posa il cambiamento rispetto a v54 è contenuto,
senza regressione cromatica evidente nella review indipendente. È una guida
per i colori autoriali, non una calibrazione fisica dell'albedo o un PASS
fotografico globale. L'immagine satellitare contiene già illuminazione e ombre:
non viene distribuita o applicata come texture ottica del terreno.

La formula è stata fissata prima del calcolo/GPU, senza sweep o fitting.
Una ricostruzione Decimal indipendente riproduce18/18 componenti Float32.
Residuo massimo Y intrinseca4,04e−9;14 contrasti logaritmici conservati entro
1,75e−7. La luminanza finale sotto luce RGB colorata non è necessariamente
invariata. La vegetazione bassa aggregata resta una semplificazione: il
riferimento cromatico proviene dalla classe30, non da ogni specie del gruppo.

**Nessuna nuova espressione runtime, lettura texture, pass, geometria o risorsa
GPU.** Cambiano sei costanti RGB, un commento e l'identificatore della versione.
Normali, grana, ombre, DEM, frazioni di copertura e nube sono conservati.
Restano256³ macro,128³ dettaglio,384 passi nominali e output pieno.

## Riferimento ottico e limiti

Quattro Range verificati,71.091.595 byte compressi;24 blocchi sorgente.
RGB lineare e frazione valida in2048² celle da62,5m, stessi assi e dominio
128×128km del terreno. Il primo run supera il limite RSS384MiB e resta
archiviato come FAIL; il secondo riusa i Range verificati senza altro download,
mantiene l'algoritmo e completa in3,41s con333,78MiB. Cinque witness byte-identici.

Campioni ammessi: alberi80.090, erba2.628. Arbusti28 e nudo10 sono insufficienti:
nessuna loro palette è inferita. Il filtro è euristico, senza una maschera SCL
ufficiale delle nuvole. L'area valida è66,866%; la quasi totalità dell'area
invalida pesata sulle classi WorldCover è acqua/NoData, non terra mancante.
Sono conservati anche coltivi e costruzioni. Nessun recupero fisico delle ombre,
BRDF, correzione delle giunzioni o simulazione stagionale è dichiarato.
Fonti, licenza CC BY4.0 e trasformazioni nel notice pubblico del terreno.

## Verifiche integrate

119 sorgenti congelati, identici al checkout durante la qualifica. **341/341
test in43 file, typecheck e build app→hero PASS**,30 file di build. Il primo run
337/341 è conservato: un'aspettativa ancora v54 interrompeva il test prima del
teardown, causando anche tre successive asserzioni RAF. È aggiornata soltanto
la versione attesa; nessuna soglia o logica del lifecycle è cambiata.
Il fix mobile della guida Mani è incluso e conserva la sua prova prima/dopo.

Browser: confronto v54/R1/R2 a1920×1080, tempo60s in pausa, Sole e Tramonto;
R2 anche nella vista costiera più verticale. Le immagini sono JPEG CSS.
Versione integrata main Sole/Pioggia e worker Sole a2474×1844 nativi;
nessun nuovo errore/warning osservato dall'avvio della versione integrata.
Questo non cancella l'errore MutationObserver storico non attribuito del QA UI.
Dettaglio dei versanti, vegetazione, materiali e ombre lontane restano
semplificati; nessuna accettazione fotografica totale o prova touch fisico.

Main, seme74,256³/128³/384, griglia2474×1844, tempo60s in pausa, vento55%,
dispersione0%, yaw1,3852869846402587/pitch0,2811279826464208,
mira[0,2.7,0]. Sole:59,2964422invii/s,1779 intervalli/30.001,8ms,
mediana16,7ms/p95 17,7ms;11 oltre33,34ms. Pioggia:15,6814436invii/s,
471 intervalli/30.035,5ms, mediana66,6ms/p95 83,3ms;455 oltre33,34ms.
Prefissi coda1779/1779 e471/471 completati. Timestamp completi/mancanti:
1773/6 e469/2; nessun campione inventato. Pioggia effettiva iniziale0,79999157.
Sono invii rAF, non presentazione del compositore. La mira differisce dal
precedente run v54: nessuno speedup o regressione causale è attribuito.
**60FPS stabili non raggiunti**, soprattutto nella pioggia.

Preview principale locale:localhost:4196. Sorgenti/build completi e dati ottici
voluminosi in Documents/Codex/Cloudia-QA-2026-10-16-cycle21; archivio curato
con verificatore in `docs/measurements/terrain-colour-2026-10-16/`.
Nessuna installazione, lockfile modificato, push o deploy.

Manifest dei119 sorgenti: `30c5448e87fb60c3bd3fdc8ca133993c49e54503a9950f9da1815fd59883171f`.
Manifest dei30 file di build: `79d07ae7119d9085a61083fdc32f9125218d0d59ad1c39c16eb9fae6a4ee2f86`.
Pacchetto curato:110 payload,3.548.434 byte, più manifest; SHA
`e35cd124fb161a841417cdc707ceb1af05b4800a5f808bad2a071f5309aa8bda`.
Verificatore offline PASS anche sui119 file espliciti del checkout:

```sh
python3 docs/measurements/terrain-colour-2026-10-16/verify.py --verify-runtime .
```
