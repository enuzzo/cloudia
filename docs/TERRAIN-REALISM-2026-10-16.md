# Terreno e montagne — revisione del 16 ottobre 2026

Richiesta del proprietario: sostituire il paesaggio che sembra composto da dune
di sabbia riflettenti con rilievi e materiali realmente più credibili.

## Problema osservato e direzione

Il materiale precedente non aveva una componente speculare. L'impressione di
lucido proveniva soprattutto da grandi superfici chiare e lisce, con pendenze
poco leggibili. Nella stessa vista si osservano fasce orizzontali e superfici
schiacciate: il vecchio solver raffinava il punto sul terreno per sei iterazioni
senza garantire la prima intersezione. Lo screenshot da solo non prova quale
singolo calcolo abbia causato ogni fascia.

La revisione cambia deliberatamente geometria e aspetto; non è un esperimento
di parità con il terreno precedente. Le cache di geometria già ritirate restano
ritirate. Il confronto delle prestazioni, se raccolto, non certifica equivalenza
di carico o di immagine tra due paesaggi diversi.

## Implementazione

- Campo di rilievo con creste gerarchiche collegate, deformazione del dominio e
  colline costiere. È un paesaggio procedurale inventato, non un DEM o una
  simulazione di erosione e drenaggio.
- Materiali diffusivi opachi: bosco sulle quote e pendenze adatte, rocce scure,
  neve limitata da quota, esposizione e distribuzione locale. I dettagli del
  materiale sfumano in funzione dell'impronta del pixel.
- Mesh sferica statica a griglie annidate saldate, senza skirt: 465.409 vertici,
  929.792 triangoli e 4.096 celle di raccordo. Passo centrale 32 m, nove livelli,
  estensione ±1.048,576 km. La precisione diminuisce allontanandosi dal centro.
- Normali analitiche vicino alla scena; transizione continua verso le normali
  delle facce effettive, pesate per area, tra 32,768 e 65,536 km. Le cuciture
  condividono vertici e normali.
- Pass raster alla risoluzione interna piena: RGB lineare non velato e distanza
  in km in alpha, con miss −1. RGBA32F e depth32float, caricamento nearest,
  reversed Z. Nube e pioggia usano questa distanza per terminare l'integrazione.
  È la prima superficie triangolare visibile della nuova mesh, non la prima
  intersezione esatta con il campo continuo.
- Camera sopra i triangoli effettivi, con margine radiale di 200 m. La
  proiezione decentrata coincide con la costruzione dei raggi della nube.
- Aerial perspective e film applicati una sola volta nel compositing. Macro
  256³, dettaglio 128³, 384 passi nominali e scala di qualità 100% conservati.

Il solo target terreno con profondità costa nominalmente 77.890.560 byte a
2112×1844 (74,28 MiB); geometria 26.050.592 byte e lookup CPU 2.359.296 byte.
Queste cifre non misurano picco, risorse temporanee o memoria del driver.
La mappa delle ombre aggiunge 32 MiB nominali, con colore R32F e depth32float
a 2048². La costruzione CPU della mesh 256/9 ha richiesto una volta 681,90 ms
su questo Mac; non è tempo di rendering GPU.

## Verifica e stato

R1 compila TypeScript ma fallisce sulla GPU: `patch` è riservato in WGSL.
Correzione limitata al nome dell'argomento, `patchiness`. Il fallimento è
conservato nel pacchetto esterno, senza interpretarlo come difetto hardware.

R2 avvia il renderer reale. Nella vista interna seed 74, tempo 60 s in pausa,
qualità massima e output nativo, le fasce e le grandi calotte chiare non sono
visibili; si leggono creste più nette. La prima critica rimane negativa sulla
profondità complessiva: occorrono ombre reali tra dorsali. Non è accettazione
fotorealistica definitiva.

Prima delle ombre: 304/304 test in 39 file e typecheck PASS. Il seguito della
verifica GPU, della suite e della critica visiva è registrato sotto prima del
checkpoint finale.

R3 aggiunge ombre reali della stessa mesh, R32F+depth32 a 2048². Compilazione
GPU riuscita, ma **FAIL visivo**: un reticolo scuro segue le facce. Il PCF 3×3
con correzione del piano del ricevitore può attraversare triangoli differenti;
il solo test su un piano non esercitava questo errore. Il reticolo non viene
accettato né attribuito a un difetto dei materiali. Immagine conservata come
`browser/terrain-r3-shadow-acne-css.jpg` nel pacchetto esterno.

R4 rimuove l'estrapolazione tra facce: un solo texel nearest, nel quale il
caster memorizza `q - .5*(abs(dpdx(q))+abs(dpdy(q))) - .001`, in km. Il test
su una valle di due facce con Sole verticale riproduce il falso shadow del
metodo precedente; il nuovo metodo lascia la valle illuminata. Un occludente
separato di 200 m rimane riconosciuto. La griglia diffusa scompare nella GPU,
ma rimangono punti scuri sulle creste: R4 non è il checkpoint consegnato.

R5 alza soltanto il punto della ricerca delle ombre lungo il radiale terrestre
di mezzo texel, 31,25 m: ricalcola da questo punto sia UV sia quota solare.
La geometria visibile e la distanza usata da nube/pioggia non vengono alzate.
Il margine elimina le puntinature visibili sulle creste nel controllo eseguito.
È un compromesso documentato: ombre di contatto decametriche possono sparire,
e il metodo non certifica ogni combinazione di facce dentro un texel.
La copertura è un quadrato di 128 km nello spazio della luce, con dissolvenza
verso illuminato nell'ultimo 15%; non è un'ombra globale dell'intero pianeta.

**R5 congelata: 320/320 test in 40 file, typecheck e app→hero PASS.**
Manifest dei 107 file: `terrain-r5-source-manifest.json`; zero differenze con
il checkout al controllo. Manifest dei 24 file di build:
`terrain-r5-dist-manifest.json`, SHA256
`be576266ed83922a6b27fe20dfbf006e79a43e5677601f18aa603b37b2f0e656`.
Il confronto finale usa Sole, Tramonto e Pioggia. Durante il lavoro il viewport
è passato da 1056×922 CSS / 2112×1844 interni a 1237×922 / 2474×1844:
le azioni da tastiera hanno quindi yaw diversi (circa 93° e 79°), stesso pitch
circa 16°. Le immagini fra questi viewport sono confronti qualitativi,
non coppie pixel per pixel né un A/B prestazionale.

Main: controllate Sole, Tramonto, Pioggia e silhouette all'orizzonte. Worker:
avvio, Sole e qualità nativa 2474×1844 confermati. Nessun nuovo warning/errore
console dell'origine del build nelle letture raccolte. Non è una prova video
continua: alcuni bordi delle ombre rimangono duri e il bosco resta semplificato.

Pioggia main, 30 s a 2474×1844: **16,2139846 invii/s**, 487 intervalli,
mediana 66,60 ms, p95 67,20 ms; prefisso GPU completato. 486/487 draw misurati
hanno ledger render completo, quattro chiamate render per draw. Le somme dei
pass non sono tempo trascorso o throughput; presentazione non misurata.
Il gate dei 60 FPS rimane aperto.

[Pacchetto verificabile](measurements/terrain-realism-2026-10-16/summary.json):
19 payload con hash, immagini originali CSS, report JSON originale compresso,
manifest sorgenti/build e log della suite. Verifica offline:
`python3 docs/measurements/terrain-realism-2026-10-16/verify.py --source-root .`.
PASS su tutti i payload e 107 sorgenti al checkpoint. Il verificatore non
attribuisce fotorealismo, parità nativa o FPS del compositore.

Le immagini CUA sono JPEG alle dimensioni CSS. La configurazione di output
nativo è verificata separatamente; non sono readback del framebuffer nativo,
né prova della presentazione del compositore.

Evidenze esterne recuperabili:
`/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle18/`.
Il riferimento del prodotto precedente è `55faf02`, sorgenti v50/10493.
L'originale allegato dal proprietario è conservato byte per byte con SHA256
`2ca05d942d67d53ff8d06488c5a3f582aa7cca45bd5b2e14e487d6db71458efb`.

## Riferimenti primari

- [Asirvatham e Hoppe, GPU Gems 2: geometry clipmaps](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry):
  livelli concentrici e raccordi per distribuire dettaglio geometrico. Questa
  implementazione usa una mesh statica saldata, senza attribuirsi i risultati
  prestazionali dell'articolo.
- [Geiss, GPU Gems 3: procedural terrains](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu):
  composizione di campi e deformazione del dominio.
- [PBRT, diffuse reflection](https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection):
  riferimento per il carattere diffusivo della superficie, senza presentare il
  materiale semplificato di Cloudia come un modello fisico completo.
- [WebGPU Samples, shadow mapping](https://webgpu.github.io/webgpu-samples/samples/shadowMapping/):
  raster dalla sorgente luminosa e confronto di profondità.
- [Microsoft, cascaded shadow maps](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps):
  limiti della correzione del piano del ricevitore nei filtri PCF e compromessi
  tra alias, bias e ombre di contatto. Non è stata implementata una CSM.

Nessun codice o asset esterno copiato. L'obiettivo dei 60 FPS sostenuti resta
aperto e separato dall'accettazione artistica del nuovo terreno.
