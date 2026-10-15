# Archivio CPU rain-work e ricerca non convessa

Questo archivio conserva prove diagnostiche del 2026-10-16, non una candidata
renderer. Nessuna GPU, nuova generazione o misura è stata eseguita per archiviarlo.
Leggere il [resoconto](../../RAIN-WORK-2026-10-16.md) e la
[proposta non convessa](RAIN-NONCONVEX-NEXT.md) prima dei conteggi.

`archive-manifest.json` elenca byte e SHA256 di ogni payload, compreso questo
README. Il manifest non può includere ricorsivamente il proprio hash; il suo
SHA è riportato nella consegna. `companionDocument` identifica il resoconto.
Le copie storiche, inclusi `work-16x9.json` e `work-32x18.json` completi di
tutti i raggi, hanno i byte originali. Le due proiezioni `*-summary.json` sono
indici aggregati aggiuntivi: omettono soltanto `rays`, mantenendo gli altri campi
e registrando SHA/dimensione del report completo. Non sostituiscono gli originali.

La cache binaria da 109.092.864 byte NON è qui. Gli hash e il formato sono nel piccolo
`rain-work/data/manifest.json`; la cache già prodotta rimane esternamente in:
`/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle10/rain-work/data`.
Nessuna matrice binaria, node_modules o ambiente viene duplicato nel repository.

I tre script sono copie esatte di quelli eseguiti, con i percorsi assoluti
originali. Non è un pacchetto portabile autonomo: il replay richiede quella cache,
le dipendenze già installate e i sorgenti modello con gli hash richiesti.
`count-work.ts` e `rain-nonconvex-estimate.ts` non chiamano generateVolume.
Se la sorgente è cambiata, il guard deve rifiutare il replay: non rimuoverlo,
non produrre una nuova cache automaticamente. `prepare-data.ts` è conservato
solo per provenienza; la singola generazione autorizzata è già terminata e il
marker/cache originale ne impedisce la ripetizione.

Le 9 copie sorgente sono quelle verificate dopo i conteggi. Il manifest snapshot
spiega perché GPUSceneEngine, cambiato successivamente, è escluso; il suo hash
al bake resta nei report. Le copie non comprendono tutte le dipendenze transitive
(ad esempio sun.ts e Three), quindi servono a ispezionare il modello storico,
non a fingere un checkout completo eseguibile. Gli import assoluti degli script
non vengono silenziosamente riscritti su queste copie.

Una eventuale replica, soltanto se richiesta e con prerequisiti ancora validi,
può usare gli script esterni originali da Documents/Codex. Non serve alcuna
replica per verificare questo archivio: basta confrontare i payload con SHA256.
I conteggi descrivono chiamate semantiche su griglie CPU finite e non istruzioni,
fetch fisici, tempo GPU, pixel parity o accettazione visiva.
