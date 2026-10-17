# Archivio trial GLO30 e diagnosi cache

Prodotto v60 invariato. Candidata GLO30: PASS di risorse/conservazione fonte, FAIL fotografico root e indipendente. Cache: FAIL iniziale042/d7 riprodotto una sola volta con diagnostica R2,21paroleRGB/7pixel e0alpha cambiati; shadowR32F cambia hash, causa unica non determinata.

## Ricostruzione delle snapshot

I129 sorgenti base sono definiti da source/base-manifest.json e commit8b3a144. Per R1 applicare source/candidate-source (overlay135), poi decomprimere assets/liguria-apuane-glo30-mesh.bin.gz nel percorso src/cumulonimbus/assets/liguria-apuane-glo30-mesh.bin. Verificare SHA/bytes nel descriptor. Per R2 applicare source/difference-source sulla R1. I manifest pinnano ogni sorgente e asset; dist/dipendenze non sono archiviati. Le due directory source-*-r0-overlay ripristinano soltanto i vecchi test per le qualifiche iniziali fallite. Nessuno di questi file è adottato nel prodotto.

I bundle condividono una sola copia gzip lossless; il contenuto ricostruito è identico ai sei array/statistiche del preflight. Il modello non serve per riprodurre le build delle snapshot. Per ripetere il preflight si parte invece dalla base129 non ancora integrata in una directory candidate-source esterna, con il CDM1 e l'holdout indicati; il runner rifiuta sorgenti mutate e un secondo outputrun. L'overlay finale e i manifest sono autorevoli; gli script integrate-* conservano i passaggi intermedi, seguiti dalle correzioni documentate, e non sono una pipeline unica da rilanciare sulla snapshot finale.

## Dati e qualifica

Il pacchetto completo originale è fuoriDropbox in Documents/Codex/Cloudia-QA-2026-10-17-cycle35/glo30-dem,36payload/163.950.505B. La sua MANIFEST.json qui copiata descrive quel pacchetto completo, non il sottoinsieme curato Git: i113MB di TIFF pubblici sono conservati esternamente e riacquisibili tramite script+SHA. Qui sono inclusi il CDM1 usato compresso, l'holdoutFloat64, protocolli/script/metadata e licenze. La variante coastlegacy requantizzata non è usata dal modello e non viene duplicata. Il suo hash/confronto restano nei metadati.

Qualifica candidata R0:114pass/4fail, aspettativaIDfonte vecchio e3controlliRAF successivi; source/log preservati. R1:118mirati/518completi e APP→hero/typecheck PASS. I results.json R0 conservano il percorso originale qualification/*.log, spostati in qualification-r0. Runner archiviato è R1. R2:128mirati/528completi PASS; primo buildtypecheck fallisce sul tipo mockstats. Dichiarazione resa callable, runtime invariato, buildapp→hero/typecheck finali PASS in difference-build-r1. Test giàpassati non ripetuti per questa sola modifica di tipo. La review pre-run del runner precede due assertSHA di input aggiunti prima del freeze; witnessSHA e protocollo applicato sono quelli salvati.

Il PNG candidato è solo dopo freshd7 stabile;61parti trasferite. Non esiste PNG del cached042. Baseline fresca90641… è metadata/alias del bitmap precedente, senza un nuovo trasferimento. ROI lossless1:1 secondo ledger; screenshot finale UI ordinaria animata separato dal confronto fisso. Nessun worker,meteo,moto oFPS dopo il FAIL.

I piccoli helper e le note conservano le loro revisioni/qualifiche originali. verify-saved.py verifica soltanto dati/manifest/overlay nel checkoutbase e la riproduzione salvata; non costruisce modello, GPU o nuovi numeri. Richiede Pythonstandard e sorgenti base v60 nel checkout.

next-optical-material-candidate.md è proposta separata: RGBlineare+validità reali già disponibili, nessun NIR persistito, RGBA16F2048²/mip44,74MB e1lookup nel raster terreno. Rischio luce/ombreincorporate dichiarato; nessuna implementazione o accettazione di questa nuova variante in questo checkpoint.
