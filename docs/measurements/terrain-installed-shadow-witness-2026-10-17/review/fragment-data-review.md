# Receiver fragment — review indipendente dei dati salvati

17 ottobre2026. Solo JSON già acquisiti e aritmetica Python stdlib; nessun nuovo raggio, modello, test, build, browser, GPU o modifica sorgente. **Il mapping receiver concorda nei12punti; la selezione non quantifica un errore globale e non attribuisce le macchie RGB.**

## Integrità e scope

`receiver-fragments.json` è COMPLETE_STABLE_OWNER:12righe,11address unici, probe COMPLETE/stateRestored/inputsStable,1draw debug bbox1049267pixel,1redraw ordinario,24copie e nessun errore/sentinel rimasto. Cache shadow valida con1submission invariata prima/dopo; soltanto requests/hits aumentano di2. Console salvata `[]`. I bit di ogni R32F corrispondono al Float32 dichiarato; tutte le righe probe corrispondono alle righe esposte dal wrapper.

Il transfer dichiara17323caratteri/17323ricevuti; il file locale è ASCII di17324byte/caratteri con newline finale, quindi il payload senza quel newline ha17323caratteri. Il SHA registrato coincide con la copia locale inclusa la newline; distinguere questa serializzazione dal testo trasportato, senza chiamare il delta un effetto UTF-8 o un troncamento. Prima/dopo, i due metadata nativi dichiarano lo stesso PNG2474×1844,2909134byte, SHA `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`. In questa review ho verificato la concordanza dei record PNG salvati; non è stato trasferito o ricalcolato un nuovo bitmap. Camera, materiale, luce, meteo, qualità256/128/384, output e clock applicati simulation/forcing/precipitation/flow concordano. WeatherTime cambia tra catture, mentre il payload luce/flash/meteo applicato resta identico.

Il witness CPU è di **un altro owner**: UUID, tempi locali/seriali, rendererVersion e UUID sky differiscono. I campi applicati camera/materiale/lighting/weather/qualità/output, conteggi/statistiche geometriche e tutte le letture R32F coincidono. Il contratto fornito dal root è source/funzioni/geometria immutate; i JSON non contengono hash portabili dei grandi buffer. Parità bitmap mode0 e questi dati non dimostrano identità della pipeline fragment originale o caster winner-ID.

## Confronto per punto

Delta q è GPUlookup−CPUlookup; delta d è alpha ordinaria GPU−distanza receiver CPU. Entrambi in millimetri. Margine è qGPU−storedR32F, in metri: negativo significa shadow prima del fade. In tutti12 i floor GPU coincidono con il pixel CPU e la visibilityGPU coincide con quella CPU. I sette no-blocker sono classificati UNOCCLUDED_ENTIRE_MESH dal witness, non soltanto entro20km.

| Punto | Pixel shadow comune | Delta q mm | Delta d mm | Margine m | Vgpu | Raggio fisico CPU |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| L1-artifact | 1067,1248 | -7.406 | -0.969 | -138.067 | 0 | blocked |
| L1-control | 1069,1248 | -13.841 | -3.949 | +634.211 | 1 | blocked |
| L2-artifact | 1011,1235 | +14.482 | -1.390 | +190.095 | 1 | unoccluded |
| L2-control | 1010,1236 | -1.415 | +2.797 | +1018.736 | 1 | blocked |
| L3-artifact | 883,1302 | +3.792 | +7.217 | +800.598 | 1 | blocked |
| L3-control | 883,1302 | -2.372 | +0.877 | +875.038 | 1 | blocked |
| C1-ocean | 792,1104 | -3.361 | -7.350 | +77.134 | 1 | unoccluded |
| C2-coastal-lowland | 796,1171 | +12.578 | +11.160 | +82.439 | 1 | unoccluded |
| C3-plain | 614,1234 | +11.223 | +15.030 | +75.126 | 1 | unoccluded |
| C4-ridge-L1 | 1048,1258 | +4.357 | +9.156 | +222.525 | 1 | unoccluded |
| C5-ridge-L2 | 996,1263 | -6.587 | -3.825 | +116.291 | 1 | unoccluded |
| C6-ridge-L3 | 856,1342 | -29.281 | -60.589 | +160.305 | 1 | unoccluded |

Massimo scarto continuo grid=0.000663507texel; il punto GPU più vicino a un bordo resta a0.021850586texel. Massimo |delta q|=29.281mm, massimo |delta d|=60.589mm. Il minimo |margine| è75.126m: nessun cambio di address o piccolo errore q spiega le classificazioni di questa selezione. Le12alpha ordinarie sono finite e positive; l'accordo con la distanza CPU è un controllo aggiuntivo del receiver, non lettura della sua faccia GPU.

I precedenti scarti di metri sono **storedR32F GPU meno minimo affine del caster CPU**, non errori del q receiver: L1-control+26.981m; L2-artifact−27.967m; L2-control+3.933m; C5+25.766m; C6−3.625m; gli altri |delta|<=0.363m. Gli11texel unici sono bitidentici ai valori letti nel precedente owner. Questi residui non identificano da soli una diversa faccia vincente, precisione delle derivate o copertura raster.

## Cosa è dimostrato nella selezione

- Dei5receiver con blocker fisico CPU, soltanto L1-artifact ha Vgpu0. Gli altri4 sono lit: L1-control, L2-control, L3-artifact e L3-control; blocker rispettivamente a310.348,151.492,166.506 e64.157m. È una divergenza puntuale rispetto alla reference della mesh; **non4/12come stima generale** né una prova di illuminazione fisica del mondo reale.
- Tutti7physically unoccluded sono lit. Il solo punto shadow ha un blocker nella reference; questi dati non contengono un falso shadow rispetto a quella classificazione. L'etichetta storica “artifact” non costituisce una classificazione attuale del materiale.
- RGB ordinaria, normale materiale rough/interpolata, contributi ambient/acqua e attenuazione nube/aria restano distinti da V. In particolare L2-artifact e L3-artifact sono lit nel fragment diagnostico: non si può assegnare la loro macchia al solo shadow né dedurre la causa alternativa dal nome o da questi12record.

## Un solo prossimo esperimento discriminante

**Caster-plane probe del solo L1-control, address fissato[1069,1248].** È già un caso selezionato con blocker CPU e Vgpu1, non una ricerca adattiva. Nel medesimo owner congelato, una variante caster restituisce RGBA32F `(qRaw,dpdx(qRaw),dpdy(qRaw),storedMinimum)` mantenendo stessi input, camera/viewport shadow2048², FrontSide/depth e derivate valutate prima di eventuali branch. Usare un target temporaneo RGBA32F+depth32 e scissor2×2 allineato[1068,1248,2,2], leggere soltanto il texel scelto. Non ritagliare la camera e non sostituire la mappa ordinaria. Costo esplicito:80MiB nominali transitori per attachment, una traversata geometrica; nessuna promessa FPS o risoluzione ridotta.

**Gate prima di interpretare:** la W deve avere gli stessi bit dello storedR32F ordinario14.886384010314941km di quel texel e lo stato deve restare invariato. Se non coincide, conservare il FAIL della variante e non attribuire il residuo. Se coincide, qRaw e le derivate scompongono il valore realmente riprodotto: qRaw>qLookupGPU15.520594596862793km ma stored<qLookup rende il minimo affine necessario al cambio di segno in quel confronto. Se già qRaw<=qLookup, quel lowering non basta come spiegazione; resta la geometria/coverage/offset del lookup. La reference CPU prevede qRaw15.740461889km e una sottrazione complessiva881.059m: è una previsione da falsificare, non un valore GPU già letto.

Non serve attribuire subito un faceID per ottenere questa discriminazione; un piano concordante non è comunque ID univoco. Nessun nuovo bias, clipping o coefficienti viene proposto come fix. Anche un esito netto su questo texel non spiegherebbe automaticamente RGB o gli altri tre blocker lit.

## Hash input locali

- `receiver-fragments.json` — 17324B, SHA256 `7a9f5b7b0a09dedd366049db1cd94b28bc89493d7ee0441c4abfbee7dd239436`.
- `receiver-transfer.json` — 181B, SHA256 `a80f2e139adce3578b19b736f728040ec1c357852c6333ea9ec8f4962b42f0a1`.
- `receiver-console.json` — 3B, SHA256 `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570`.
- `installed-shadow-witness.json` — 62341B, SHA256 `ec3187ebc895e0aed4e3bd723d995e0196aa2825fa3167ea4e03c78898348d43`.
- `native-before-receiver.json` — 11959B, SHA256 `bea5cd1c34002f41a1f99ffcaa86510770073a5eb5bbbdfd7884c24775d0ed65`.
- `native-after-receiver.json` — 11958B, SHA256 `041fe9d5623b9728fd9b3b86f0d5f0aa92045f7d5e49324a6d247a22f6b26ed4`.
