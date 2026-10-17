# R2 cache difference — review integrazione e lifecycle

17 ottobre 2026. Revisione statica della snapshot `difference-source`. Modificato soltanto `src/cumulonimbus/lifecycle.test.ts`; nessun test, typecheck, modello, build o GPU eseguito da questa agente. La qualifica è del root. Il source prima dell’edit è recuperabile in `difference-lifecycle-before.ts`; patch separata in `difference-lifecycle-tests.patch`.

## Copertura aggiunta, non ancora eseguita

Due dichiarazioni di test, tre casi effettivi: il primo è parametrizzato false/true.

- **Flag assente:** esattamente due letture RGBA1×1 dagli stessi target, nessuna lettura shadow, vecchio reportKind e nessun campo difference.
- **Flag attivo:** sequenza esatta RGBA→R32F2048²→RGBA→R32F2048², con rettangoli e identità target controllati. Il mock RGBA introduce deliberatamente una differenza R e una alpha in un pixel: il report deve localizzare entrambi, non solo cambiare hash. Shadow identica e byte count16MiB sono verificati separatamente.
- **Teardown durante R32F pendente:** rAF ordinario fermo, capture/benchmark disabilitati, owner e texture shadow vivi finché la lettura pendente non termina; poi dispose unico, nessun invalidate/fresh read o nuovo report.

I target sono oggetti metadata e piccole DataTexture: nessun RenderTarget o mesh reale. Per ciascun caso attivo è usato un solo Float32Array R32F16MiB, riutilizzato per le due risposte; RGBA resta un pixel. Nessun clone di target nativi o fullbuffer aggiuntivo. Gli altri test e l’aspettativa rendererVersion ricevuta dal root sono preservati.

## Rilievi statici comunicati al root

1. **Export UI da includere nel ramo audit.** Nella versione letta `CumulonimbusApp.ts:171,239` riconosce soltanto `terrain-raster-cache-full-f32-v1`. Il nuovo `terrain-cache-difference-v1` appare nel textarea, ma non riabilita EsportaJSON e, se l’action fosse invocata, entrerebbe nel nome benchmark con `output.join` senza output top-level. La correzione compete al root: riconoscere entrambi i reportKind.
2. **Etichetta del catch.** Il catch Engine usa ancora il reportKind ordinary anche nel percorso difference. Non altera i dati del successo, ma un errore andrebbe etichettato con il tipo diagnostico richiesto per non confondere l’archivio.

Nessun altro blocco concreto di ownership/drain emerso: la Promise dell’audit mantiene vive le risorse; le guardie impediscono ulteriori letture/report dopo il ritorno dei digest; formato/shape R32F sono fissati e le richieste sono seriali. Precisazione: durante un teardown pendente un digest helper può ancora terminare pack/hash CPU prima della guardia esterna; questo non è una lettura GPU ulteriore né una pubblicazione tardiva. Non attribuisco alla nuova strumentazione la causa del primo FAIL.

Questa review non esegue né anticipa il risultato della riproduzione. Il confronto colore+shadow localizza eventuali differenze di bit nei due attachment; non legge depth, receiverGPU o caster winnerID e non prova da solo la causa artistica dei segni scuri. Il FAIL originario resta conservato.

## Freeze del solo file posseduto

`lifecycle.test.ts`: 79023 byte, SHA256 `478f643247c0e3fbc9a0fd27d6ec4c0e5e9c135b8942bc8b7f0ef48cf51e5d3b`. Stato **FROZEN_FOR_ROOT_QUALIFICATION, NOT_EXECUTED_HERE**.

## Aggiornamento prima della qualifica root

Root ha corretto entrambi i rilievi: App riconosce i due reportKind per export/nomi dedicati; il catch Engine conserva il tipo difference quando attivo. Riletti staticamente i rami aggiornati. Il caso parametrizzato verifica ora anche EsportaJSON riabilitato dopo il report, senza click o download. **Nessun blocker residuo identificato; qualifica ancora non eseguita da me.**

Freeze finale del test: 79160 byte, SHA256 `9d8d4b54f02e9bd64a0ef4182da2db93fe7eee9d3608ae44a4a05d3ceefa37cf`. Il freeze precedente è preservato in `difference-lifecycle-freeze-r0.json`; questa aggiunta non cambia gli altri file sorgente.
