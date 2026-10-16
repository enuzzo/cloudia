# Unico controesempio affine prefissato

`counterexample.ts` è stato eseguito una sola volta con Bun sullo snapshot
`candidate-source`; non costruisce una mesh e non cerca casi. Importa la funzione
CPU di clipping conservata in `source-trial/src/cumulonimbus/terrainShadowClip.ts`
nell'archivio. Il caso e gli hash degli input sono in `PRE-RUN.json`.

Un controller Python inline ha applicato prima del lancio RLIMIT_CPU=1 s,
osservato il terminale del processo con un limite wall di 10 s e confrontato
`getrusage(RUSAGE_CHILDREN).ru_maxrss` macOS con 512 MiB. Il limite RSS era un
gate finale, non un limite di memoria virtuale. `run.json` conserva exit code,
tempi, picco RSS e gate osservati; `stderr.log` è vuoto. Il controller inline non
è stato salvato come file eseguibile prima del run: non viene ricostruito qui
come se fosse un originale. La verifica dell'archivio legge questi risultati e
gli hash senza ripetere il run.

Comando Bun lanciato dal controller: `bun run counterexample.ts`, con directory
corrente `intrinsic-counterexample`. La struttura esterna originale è
`Cloudia-QA-2026-10-16-cycle27/{intrinsic-counterexample,candidate-source}`;
conservare tale relazione se si desidera un replay separato e nuovamente
limitato. Dipendenze e runtime restano quelli dello snapshot qualificato.

Il risultato dimostra un limite della rappresentazione a un solo triangolo
vincente per texel anche su due triangoli complanari. Non attribuisce a questo
caso la frequenza o la causa concreta dei puntini del PNG GPU. Il ramo Float32
arrotonda clipping e q del lookup: non emula tutte le matrici/FMA della GPU.
