# Cloud branch roots and section64 diagnosis

17 ottobre2026, ciclo45. **Variante implementata all'esterno e respinta al gate visivo74 fronte+lato. Prodotto v61 invariato; goal attivo.**

La diagnosi circoscritta del precedente raccordo continuo esegue due generazioni effettive64³ con tutti i bake originali, su96 punti congelati della sezione fallita. A conserva15 punti positivi, B nessuno. Il margine massimo macro−erosione di B è−0,09029; usando il campoFloat32 prima della quantizzazione resta−0,09033. Al punto più denso di A, gli8 vicini di B sono già nulli dopo il carving. La perdita precede il dettaglio fine e non è risolta passando daR8 aFloat32. Rumore, warp, erosione e materiale coincidono sui96 punti. Questo localizza il fallimento precedente, senza certificare256 né attribuire tutto a una singola primitiva. Una sola esecuzione,0,961s wall child,1,343s CPU e232,3MB somma dei picchi entro il budget.

Ho acquisito riferimenti attuali72/73 fronte e lato a2474×1844; per74 i nuovi DTO hanno digest identico ai PNG completi già conservati. Una sola ablazione composita `no-detail` su73side rende la parte alta più liscia e piena, senza correggere la forcella tra le celle. Non isola un singolo effetto fisico e non diventa candidato a qualità ridotta. Ritorno a `full` byte-identico al proprio A.

## Variante delle radici

Da v61 canonica, una sola regola per le tre famiglie. Le radici giovani si spostano verso la radice dominante lungo il loro asse, fino alla metà della somma dei raggi direzionali; la traslazione decresce linearmente fino a zero sulla testa. Si muovono gruppi reali core+90 figli, inclusi i corpi sepolti esistenti. Nessuna nuova primitiva, raggio, quota, rumore, cap o shader. Contrazione orizzontale e successivo vecchio raccordo restano nell'ordine canonico. Non usare il raccordo continuo respinto come base.

| Seed | Primitive | Gruppi spostati | Massima traslazione |
|---|---:|---:|---:|
|72|2589|13|0,649km|
|73|2179|6|1,627km|
|74|1918|5|0,938km|

Prefissi di ricetta A/B effettivi verificati: stessa sequenza iniziale, conteggio, raggi e consumo casuale. Le guardie dei cap e delle proprietà passano. Nel74 il vecchio giunto cambia indirettamente90 primitive non traslate direttamente, di massimo2,22×10⁻¹⁶km: registrato senza dedurne identità dei volumi. La raccolta dei gruppi e dei metadati aggiunge lavoro CPU di generazione, e la densità diversa può cambiare il costoGPU. Nessuna promessa di costo zero.

564/564 test in53 file PASS. Primo loader diagnostico fallito per interop prima di chiamare ricette, poi corretto; primo typecheckTS7022 nel solo helper test/audit, corretto con annotazioni esplicite e JS emesso byte-identico. Typecheck e APPbuild finali PASS; hero non compilata. Freeze141R1A `393d1d87…`, overlay5; sorgenti/log/revisioni e fallimenti grezzi conservati.

## Gate nativo e decisione

A/B74 a256³/128³/384 passi,2474×1844, Sole assestato e t60 in pausa. Camera mondiale, luce, qualità e controlli coincidono senza ricentraggio sui bounds. Eccezioni dichiarate prima di B: version/anatomy, bounds pioggia derivati, weatherTime in cielo chiaro/rain0/flashoff, UUID e contatori owner-local inclusi cache.submissions; validità cache obbligatoria. Nessuna identità di densità/luce o prestazione inferita.

| Posa | PNG A SHA256 | PNG B SHA256 |
|---|---|---|
|Fronte|6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9|eb0b90f945a993afa1faaf2e1cce41a81c62b11428a95dc12f023e6c22bc2f34|
|Lato|c9c4681b03b9c4771c7be62974712b12b516e8b8717c22dc0907f18318aa2749|8101ebe6a852d551b9a518a1626bf58763eecfe20685e30240cd58e76c282f66|

**Root e review indipendente: FAIL.** Il ramo giovane è più obliquo di lato, ma il fronte conserva i due montanti e il lato presenta una testa relativamente sporgente sul corpo assottigliato. Il beneficio complessivo nelle due pose è insufficiente. Non è un FAIL imposto dalla sola calotta piatta o dal collo scuro, né dalla mancata soluzione completa del vicino. Le quattro immagini complete sono state lette; trasferimenti e alias autenticati.

Stop prima di B72/73, vicino, altri seedGPU, worker/meteo/moto eFPS. Nessun tuning successivo o adozione. L'accettazione delle tre famiglie resta unica: il solo74 non le certifica. Preview ordinaria4196 ripristinata con Sole/nube matura animata, canvas2474×1844, console[]. QA53788/session24894 chiuso exit0; owner4196/session48736 vivo. I141 sorgenti prodotto sono esatti. Dipendenze Gitignored/untracked e Dropboxignore1 prima/dopo, nessun install/lock edit; `node_modules 2/` e4201 preservati. Nessun push/deploy.

[Archivio](measurements/cloud-branch-roots-trial-2026-10-17/README.md):138 payload/25.733.201B, manifest SHA256 `49f1624f41ec6087dfef748a75ab0f1082f45b66772f6c3156f0dff1d41c36f3`. [Integrità salvata](CLOUD-BRANCH-ROOTS-VERIFICATION-2026-10-17.json) PASS: copie, base141, ricostruzione141/overlay5,7PNG conCRC e decompressione,3alias ricalcolati. Non riesegue modello/GPU/FPS e non cambia il FAIL.

Prossima azione concreta: confrontare l'attuale campo64² di emissione pioggia, derivato dalla macro prima del dettaglio, con lo stesso riduttore alimentato dalFloat32 fine già calcolato per la luce. Prima misurare una singola generazione64 congelata e verificare una differenza spaziale dopo i filtri, evitando di scambiare un semplice indebolimento per maggiore coerenza. Nessuna adozione o promessaFPS; la proposta è separata da questo candidato respinto. In parallelo il limite residuo della geometria del terreno resta da qualificare. Geografia reale incluse aree abitate nella stessa texture, senza edifici3D/pass aggiunti per le città; payload ottico nominale44.739.240B. [Intero goal](measurements/terrain-face-direct-trial-2026-10-17/review/full-goal-gates.md), vicino, anatomia, pioggia/virga, terreno finale, UI e60FPS restano aperti. Pioggia pesante precedente circa19 invii/s non rimisurata.
