# Review indipendente della proiezione — ciclo 26

Stato finale: lettura statica della sorgente congelata e del witness sotto indicato, prima della sua esecuzione. Nessun blocker concreto trovato. Nessuna esecuzione di witness, test, build, bake o GPU da parte del reviewer. Nessuna modifica al prodotto.

Input: `PROTOCOL.json`, `baseline-native.json`, `source-manifest.json` e sorgenti sotto `source/` dello stesso ciclo. Il protocollo identifica v57/99fc989, 124 file, manifest `8dce2ed7a5843104c3b606c4223435d69408d43739712b1f722c7a1fa8a348f2`; PNG baseline `af8877ac93db6fcd50ab3ceece43ac1a40fc7d21c41151afb3a9620ca7586be5`. Questa review non riesegue la verifica integrale dei 124 hash.

## Camera nativa → receiver

La posa è la metadata congelata, non la camera frontale dei precedenti audit: bitmap/internal 2474×1844, approach=0, tanFov=.2867. I sei pixel del protocollo sono già coordinate native top-origin; non vanno moltiplicati per DPR=2 una seconda volta.

Per pixel intero (x,y), usare u=(x+.5)/2474, v=(y+.5)/1844, sx=2u−1, sy=1−2v−s, s=.16*(1−f32(approach)). Il riferimento geometrico è O+t*normalize(F+R*sx*f32(aspect)*f32(tanFov)+U*sy*f32(tanFov)), con componenti di O/F/R/U arrotondate f32 come `configureTerrainCamera` (`terrainMesh.ts:159–179`). In questa posa s=.16, cioè principal point spostato di 147.52 pixel verticali. Non sottrarre lo shift due volte se si usa l'inversa della camera Three già configurata.

La camera Three memorizza il view offset (`:175`) e la base [R,U,−F]; `cloudShader.ts:32–33` usa lo stesso segno dello shift. Three ricostruisce la proiezione per reversed-Z senza perdere il view offset. Reversed-Z modifica soltanto la mappa della profondità; non sx/sy, la direzione fisica o il significato del receiver.

La ray formula Float64, anche con input f32, resta un riferimento: Three inverte la matrice della base arrotondata, poi carica matrici f32 e rasterizza. La base f32 non è perfettamente ortonormale. Operazioni matriciali, interpolazione prospettica, FMA e regole di copertura possono cambiare il triangolo vincente vicino a un bordo. Near=.025 km e far=1600 km sono piani nella coordinata camera, non semplicemente una sfera di raggio t; preservare il clipping o dichiararlo irrilevante per i sei hit.

Il receiver corretto è il primo triangolo visibile della mesh Float32 cucita (`terrainMesh.ts:71–121,206–220`), non H(x,z) analitico né una mesh regolare che ometta i fan di raccordo. `GPUSceneEngine.ts:325–331` congela cells=256, levels=9, normalMode=geometry e passa la stessa base all'effettivo render.

## Light map → caster, segno e lato

`terrainShadowFrame` (`TerrainShadow.ts:23–41`) normalizza il Sole S, costruisce R=normalize(reference×S), U=normalize(S×R), centro C=[0,−4,0]. La light camera è in C+D*S e guarda −S (`:140–142`). Quindi q=(P−C)·S maggiore significa più vicino al Sole; profondità geometrica D−q minore. La depth GPU sceglie il massimo q visibile. Reversed-Z conserva questa scelta attraverso il confronto depth invertito di Three; non invertire il confronto di colore `qReceiver >= stored` (`:93–95`).

Entrambi i `MeshBasicNodeMaterial` mantengono il default FrontSide: il pass shadow usa un override materiale ordinario, non il sistema di shadow-map automatico di Three. Per winding (B−A)×(C−A)=N e modello identity, receiver frontale se N·ray<0; caster frontale se N·S>0. Un raycast DoubleSide può scegliere una faccia che questo raster scarta. I casi quasi tangenti richiedono una cautela separata sulle soglie CPU e sulla copertura GPU.

Per Nmap=2048, radius=64 km, passo Δ=128/2048=.0625 km: pixel light (i,j) top-origin ha coordinate ξ=((i+.5)/2048−.5)*128, η=(.5−(j+.5)/2048)*128. Il raggio parte da C+R*ξ+U*η+D*S verso −S. Il caster deve essere cercato al **centro del texel indirizzato** dal lookup receiver elevato radialmente di .03125 km (`:59–61,86–94`), non sulla proiezione del punto receiver originale.

Prima scegliere il caster con massimo q grezzo al centro, poi memorizzare il minimum della sola faccia vincente. Scegliere il massimo fra i minimum delle facce cambierebbe l'algoritmo reale: la selezione depth è indipendente dal valore R32F restituito dal fragment.

## Derivata affine e limiti causali

Per una faccia non tangente, q è affine sulle coordinate ortografiche. Dal piano N·(P−A)=0:

- dq/dpixelX = −Δ*(N·R)/(N·S);
- dq/dpixelY = +Δ*(N·U)/(N·S), poiché Y top-origin cresce verso −U;
- stored = qCentro − .5*(abs(gx)+abs(gy)) − .001 km.

Questa è la proprietà ideale implementata da `TerrainShadow.ts:74–80`. La derivata è quella del **caster**, non del receiver, e la .001 km è già inclusa: il lookup applica bias=0. La stima estende il piano affine all'intero quadrato del texel, anche fuori dalla sua area coperta; non è il minimo della geometria reale multifaccia.

Il witness può distinguere (a) receiver primario, (b) caster del texel, (c) intersezione geometrica lungo +S e (d) confronto idealmente rasterizzato. Una discordanza fra questi risultati è utile, ma non prova da sola un bug GPU. Restano non osservati: matrici/uniform f32 effettive, triangolo e valore depth vincente, interpolazione/helper invocation delle derivate, quantizzazione dei bordi, tie e ordine di draw. Il caso con N·S vicino a zero amplifica qualsiasi scarto. Una discordanza CPU↔PNG senza readback non autorizza coefficienti o filtri nuovi.

Anche il bordo coverage ha un fade .85→1 (`:96–97`); fuori mappa o clear −1e6 restituiscono luce. Per legare una differenza RGB al ramo shadow vanno registrati almeno UV/texel, qReceiver, qCaster/minimum, fade e hit fisico, non soltanto il booleano finale. I sei campioni sono selezionati per diagnostica e controlli vicini: nessuna inferenza sulla frequenza globale degli artefatti o sull'accettazione artistica.

Riferimenti Three r186 letti nelle dipendenze esistenti, senza eseguirle: `PerspectiveCamera.js:353–379` (view offset), `Matrix4.js:1140–1180,1200–1240` (XY invariati dal reversed depth), `Renderer.js:3617–3631` (rebuild), `Material.js:79–88` (FrontSide), `WebGPUPipelineUtils.js:914–922,958–983` (culling/depth). Nessun browser, nessuna nuova dipendenza.

## Riscontro sul witness effettivamente letto

`witness/witness.ts`, 130 righe, SHA256 `acf106523c8103124cad26e74c8dadcd26be55b02b2ba87a4cabd6e32fcd3c7c`.

- `:20–29` ricostruisce la mesh con il vero sampler DEM/fallback e parametri runtime; usa posizioni Float32, fan e indici effettivi. Il numero atteso di vertici/triangoli è un assert, non un risultato già osservato da questa review.
- `:31–35,56–68` configura la camera reale e controlla anche il ray manuale. Non imposta reversedDepth=true: per `setFromCamera` e la direzione del ray questo non è un difetto, perché cambia solo Z della proiezione. Il confronto manuale resta un controllo di geometria CPU, non delle matrici GPU caricate.
- `:69–87` indirizza il texel dal lookup elevato, proietta il centro giusto, sceglie il primo FrontSide/raw q e applica il minimum della sola faccia vincente. Segni di gx/gy, bias e coverage fade coerenti con la sorgente.
- `:89–100,115–120` separa il raggio fisico DoubleSide dal riferimento raster FrontSide e registra l'offset di 1cm, le esclusioni e il limite di 20km. La conclusione «nessun blocker in tutta questa mesh» è giustificata soltanto quando `farPastEntireMeshMaximumY=true`; altrimenti vale entro l'intervallo campionato. In questa posa il Sole ha Y positivo, ma il flag deve comunque essere letto nell'output effettivo.
- `:58` usa near/far euclidei del Raycaster: non sono esattamente i piani della camera. Nessun blocco se i sei hit risultano nettamente interni; un hit a ridosso dei piani richiederebbe una verifica del clipping prima dell'interpretazione.
- `:101–120` distingue correttamente il mismatch forte dell'artefatto da un controllo RGB invariato: quest'ultimo può mascherare una shadow visibility diversa da 1 per illuminazione, atmosfera e arrotondamento.

Resta un witness falsificabile della catena CPU mesh→caster, non un readback della GPU. Nessun intervento su coefficienti, filtro o geometria è giustificato dalla sola review statica. La nota termina qui; wrapper, budget effettivi e risultati del run appartengono alla qualifica separata del proprietario del witness.
