# Canonico v61, Pioggia 90 s — verifica indipendente salvata

**PASS della coerenza della misura salvata; obiettivo 60 FPS stabili non raggiunto in questa finestra di invio.** Nessun nuovo benchmark, modello, build, browser o GPU eseguito dal reviewer.

Protocollo SHA `a9fde4febc174b3b1849efd7b3365fd229502d4c4735cf1abd6b93ec598deef6` verificato. Report `browser/canonical-rain-90.json` SHA `67f64472fcf33d0a054f464837cd10ed3720251b033d399cc6287fa571728a73`: **4586830 byte UTF-8**, 4586828 caratteri. Manifest canonico SHA `2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73`, **141/141 file attuali identici**.

| Dato ricalcolato dai valori salvati | Risultato |
|---|---:|
| Intervalli accettati / somma | 1783 / 90039 ms |
| FPS di invio | 19.802530014771378 |
| Mediana / p95 / p99 / massimo | 50 / 67.5 / 68.4 / 89.2 ms |
| Intervalli >18 ms / >33.34 ms | 1783 / 1563 |
| Prefisso finale confermato | 1783/1783, nessun invio non confermato |
| Tasso comprensivo della conferma finale | 19.7631963395308 invii/s |
| Drain finale | 172.70000004768372 ms |

Le statistiche degli intervalli, `stats`, `submissionPacing` e `submissionFps` coincidono esattamente usando la convenzione canonica `floor(n*p)`. Tutti gli intervalli sono finiti e positivi. Le statistiche CPU e dei campioni GPU sparsi coincidono entro arrotondamento Float64. Le **89 fence** sono completate, con prefissi monotoni e latenze coerenti; il tasso comprensivo della conferma usa **90218.20000004768 ms** fra l’osservazione locale iniziale e la notifica finale, senza mescolare clock rAF e locale.

Il contesto registrato corrisponde al protocollo: renderer `observatory-v61-observed-terrain-material`, seed 74, WebGPU Apple/Metal-3, Three 186; output e interno **2474×1844**, volume **256³**, dettaglio **128³**, **384 step**, ablation/flow `full`, main thread, modalità `screen` e timing `stages`. Pioggia effettiva 0.7999999999999995, cielo `rain`, transizione 1, `skyPending:false`, `paused:false`, `orbit:false`; nessun lampo all’inizio/fine. Simulazione e forcing avanzano; origine della camera identica agli estremi. Campionamento densità `r8unorm-extracted-r` identico all’inizio/fine, senza fallback; specializzazione finale `rain`. Warmup dichiarato 2 s, durata richiesta 90 s, nessun frame saltato registrato. Il report non contiene una traccia continua di meteo/visibilità/interazioni: questi aspetti dell’intero intervallo restano coperti dalla procedura UI root, non provati da ogni singolo campione JSON.

**Timestamp:** verificati UID freschi unici, corrispondenza frame/call-range e somme dei pass rispetto ai ledger/samples. Su 1783 intervalli misurati, **1782 completi** sia render sia compute; manca soltanto l’intervallo 1783, draw 1823. Nessun duplicato, conflitto o mapping errato; 772 batch freschi, zero stale. I 120 pass fuori finestra restano esclusi. Le somme complete hanno media render **97.89463904826023 ms** (due pass/draw) e compute **0.025449445566778976 ms**; sono somme di pass, non tempo trascorso di un frame o throughput isolato. I 377 campioni scalari storici sono un’altra popolazione e non sostituiscono il ledger.

`presentedCanvasFps:null`: **nessun FPS di presentazione misurato**. Il massimo di 25 invii non ancora confermati è un limite superiore logico, non profondità fisica della coda. Tassi/tempi includono overhead diagnostico non sottratto; la conferma include backlog e consegna JS. Nessuna attribuzione causale a uno shader, confronto diretto con vecchi contesti differenti o qualifica globale dei 60 FPS deriva da questa sola finestra.
