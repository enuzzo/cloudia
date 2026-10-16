# Trial unico: copertura ampia intermittente della pioggia

**PROPOSTA ESTERNA, NON ESEGUITA, NON ADOTTATA.** Base v59/9ea9840. Nessuna modifica al checkout prodotto e nessuna copia dell'intero albero sorgente. Root seleziona il trial prima di test/compilazione/GPU.

Formula fissata: `c=smoothstep(.35,.65,sheets); factor=2*c*c`. Lo zero inferiore apre canali; il plateau superiore concentra i nuclei mantenendo il massimo2. Non conserva la massa integrale. Nessuna variante2.45 è stata scritta; le proposte discusse in chat non sono candidati concorrenti.

`candidate.patch` modifica solo la specializzazione rainy di cloudShader e aggiunge `rainSheetFactor.ts`/test. I soli due nuovi file sono inclusi leggibili sotto `src/`. `SOURCE-CHECKS.json` registra precondizione hash e hash atteso del cloudShader dopo applicazione; applicazione/compilazione non eseguite. `PROTOCOL.json` congela formula, invarianti e stop rule. Nessun tag/versione prodotto cambiato: root deve etichettare esplicitamente il futuro snapshot trial.

Il WGSL del nuovo helper è incluso soltanto se useNarrow seleziona già il percorso pioggia. Literal e dipendenze dry restano quelle della base corrente. La derivazione del nuovo fattore non modifica source R/G, base, mapping, sheets campionato, evaporazione con sheets originale, streak, luce, estinzione, bounds, ds/t/jitter/clip,6m,256³/128³/384/output. Non aggiunge risorse/lookup/pass. Le ALU e il costo dinamico dopo cutoff richiedono misure; nessuna previsione FPS.

Tre test sono **proposti e non eseguiti**: vuoto/nuclei; finite/bounds/monotonia su codici UNORM8; conseguenza ottica con integrateMediaSegment reale, distinguendo maggiore trasmissione debole e maggiore estinzione forte. Non sono prove GPU, della sorgente reale74 o artistiche. CPU Float64 e smoothstep WGSL non sono dichiarati bit-identici.

Prima guardia: nativa Rain80 alla stessa posa74. Richiedere canali/nuclei credibili e distanza leggibile, non soltanto cambio di media. FAIL se palizzata, tubi ritagliati, periodicità, distacchi o velo soltanto attenuato; preservare e fermarsi senza rifitting. Solo dopo eventuale PASS, qualificare virga/vento/Sole/Tramonto/moto/worker e costi.

Limiti: soglie/gain autoriali, assenza di conservazione della massa, nessuna microfisica aggiunta. I nuclei possono diventare troppo opachi. La scala ampia312.5m e il periodo5km non cambiano; la soglia può renderne visibile la trama. L'evaporazione monotona è invariata ma canali vuoti possono rendere la virga più discontinua. Nessun miglioramento è ancora osservato.
