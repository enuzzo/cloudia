# Preflight R1 — FAIL_PREPARE_GATE

L’unica esecuzione autorizzata si è fermata al prepare del seed74: `RangeError: Outflow raster visit budget exceeded: 256603112 > 256000000`. Exit code1. Nessuna modifica, ripetizione o aumento dei limiti; nessun sample, raster, modello, bake, browser o GPU.

Prima del prepare erano già conclusi tutti i cinque confronti dei prefissi reali A/B. Ogni tupla Float64, ordine, contatore RNG, identità di riferimento osservata e contrazione coincide; anche il contratto legacy del joint coincide dentro i due owner.

| Seed | Famiglia | Primitive uniche A/B | Lineage ritirata |
| --- | --- | ---: | ---: |
| 74 | sheared | 1918 / 1918 | 273 esatte |
| 77 | sheared | 1827 / 1827 | 273 esatte |
| 80 | sheared | 1918 / 1918 | 273 esatte |
| 72 | congestus | 2589 / 2589 | 0; ricetta interamente identica |
| 73 | multicell | 2179 / 2179 | 0; ricetta interamente identica |

Nei tre sheared i keyframe sono i riferimenti reali già contratti di neck, top maturo e primo core ice. I273 ID coincidono con tre collar e i loro90 discendenti ciascuno; non comprendono l’anatomia conservata. Il candidato mantiene queste primitive nella ricetta e nella contrazione, ritirandole soltanto dal futuro raster.

Il prepare74 conta anticipatamente le visite locali dei kernel e della merge. **256603112 è il conteggio parziale al momento del superamento, non il costo finale completo.** La tabella non è stata restituita: nessun K/W/temp finale qualificato, `prepareRows=[]`; i prepare77/80 non sono stati chiamati. Il FAIL non autorizza a considerare il metodo vicino al limite né ad alzarlo.

Il costo analitico del solo raster canonico che verrebbe rimosso è già registrato dai prefissi e dalla preparazione scalare della spalla originale, estratta dal codice effettivo:

| Seed | Vecchi273 lobi: visite | Vecchia spalla: visite | Somma |
| --- | ---: | ---: | ---: |
| 74 | 8387575 | 558912 | 8946487 |
| 77 | 8903463 | 562684 | 9466147 |
| 80 | 8026596 | 434700 | 8461296 |

Questi sono conteggi di lavoro, non tempi di raster né risparmi FPS. Il nuovo costo completo non è disponibile.

Caps invariati: 6s CPU /10s wall /384MiB processo;4096 kernel;256000000 visite;16MiB scratch; epsilon=7/2048km; macro256. Runtime osservato dell’intero preflight: CPU0.45425s, wall0.281886584s, RSS195756032B; alarm esterno20s non intervenuto. La causa del FAIL è il conteggio di visite del prepare, non un superamento del budget temporale del preflight.

Pin root: input-pins `84235cc175a23bf48670506f5e7bf07db37749f0b74e5eb3894590d4bc8a8366`; source144 freeze `be4e30b0283e393285a1fa077ddc5e792fa1868255dce7a4c4b064ea09ffeea1`. Runner congelato `1fcf041e895271da41117bc539e5363b099ff7fea4a94ef388ebcf61032b2389`; contratto `c8c93f0706a574455eda664cd57b35b711e8761030f2a6741f6b1bce5369374c`.

`result.json` SHA256: `c9b27961f182960bbbd6a393e0496db245365b624a26ebb6248d7e1c91589f94`. `stdout-stderr.log` conserva l’output integrale; `raw-run-log.json` conserva anche comando, exit code e risposta dello strumento. Lo strumento espone stdout/stderr combinati, senza canali separati: questa limitazione è dichiarata nel log. Il risultato non emette alcun PASS di fattibilità, qualità visiva o prestazioni.
