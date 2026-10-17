# Navigazione R3 — revisione statica indipendente

**PASS statico di ambito, nessun blocco concreto rilevato.** Solo lettura del delta `navigation-source` contro `optical-source`; nessun test, build, modello, GPU o browser. Non è qualifica FPS o parità dei pixel.

Input: `NAVIGATION-PRE-RUN-FREEZE.json`. Engine base SHA256 `4cb0dab62b209dc8412033ec7d321370d890c0dfbf21731eebb2426166a6326a`; Engine navigation letto SHA256 `6707f36d7dc2724b569597ec511dff386078e2bd3c71bdb2ae693bb26b2fee9a`; helper `terrainNavigationDiagnostic.ts` SHA256 `fd31885d67948f6a1a3cba22b970a7a5ca624d9c495c1c0eb4bf19480352c673`. I139 percorsi della base manifest R2 sono presenti: differiscono soltanto Engine e lifecycle.test.ts. Nei percorsi della base nessun materiale, WGSL, mesh, shadow, nube o qualità è cambiato; l'harness aggiunge il proprio helper/test.

## Controlli del delta

- `GPUSceneEngine.ts:218`: attivazione solo `profile=1&navAudit=1`, immutabile per owner. Il booleano optical mantiene la stessa formula e gli stessi shader/binding della R2 ottica.
- `:478–480`: `elapsed = rAFnow − measurement.start − measurement.warmup`, soltanto con measurement presente, result assente e cancelReason vuoto. Warmup produce elapsed negativo; l'helper restituisce0. L'helper è puro: `.16*sin(2π*elapsed/10000)` solo nell'intervallo aperto0…30000ms; gli estremi e l'esterno restituiscono esattamente0. Gli zeri interni della sinusoide sono float approssimati, non bit-zero promessi.
- L'offset è sommato al parametro locale autoYaw. `OrbitView.frame` (`camera.ts:30–34`) legge yaw/pitch/approach senza assegnarli: nessuna rotazione cumulativa o modifica dello stato manuale. Il clamp terreno successivo resta quello ordinario e il ledger conserva la vera origin dopo il clamp.
- `:451–470` conserva il clock della nube: simulationTime avanza soltanto se non paused; l'harness non modifica simulationTime, forcing, flusso o weatherTime. **Non forza da sé pausa/t60/orbit=false**: questi sono input del protocollo da verificare nei report start/end, non garanzie introdotte dalla formula. Per il percorso dichiarato usare benchmark30s, non sustained120s: in quest'ultimo il moto terminerebbe comunque dopo i primi30s.
- `:518–520`: un record quando cambia `min(30,floor(elapsed/1000))`, soltanto elapsed≥0. Con rAF monotono, bucket0…30 implica massimo31 righe; possono mancare bucket se non arriva un frame. Campioni effettivi, non interpolazioni ai secondi esatti. `:823–824` azzera array e bucket prima del nuovo measurement; result/cancel spengono il moto. L'invalidazione manuale resta quella esistente.
- Il ledger è raccolto prima delle chiamate compute/draw: documentarlo come posa del frame tentato, qualificata come submission solo se quel draw riesce. Non è una prova di completamento GPU o presentazione. Nessun nuovo readback/query GPU nel delta.

## Limite temporale da mantenere nel report

`performance.ts:31–36` inizia gli intervalli al **primo rAF accettato dopo warmup** e termina30s da quel primo timestamp. La sinusoide usa invece l'origine prefissata `measurement.start+warmup`. Se il primo rAF arriva poco dopo, l'ultima frazione della misura avrà già offset0. È coerente col percorso a tempo reale congelato; non dichiarare che i frame campionati A/B siano identici o che ogni intervallo misurato appartenga alla finestra aperta della sinusoide. Anche cameraEnd resta correttamente a offset0 nel frame terminale.

## Gate ancora da eseguire dal coordinatore

Qualifica dei test/typecheck/build e parità ordinary a nav inattiva dell'intero RGBA32F e PNG; A/B optical con la stessa camera/luce/pausa/output pieno. Nel30s A/B/A verificare report start/end, ledger≤31, posa finale ripristinata e contatori cache/submission. Le durate/ledger sono browser CPU/rAF: presentedFPS resta non misurato. Nessuna adozione o stima di costo deriva dalla revisione statica.

Letture e nota terminate prima delle finestre di navigazione. Il revisore passa idle, senza altri job.
