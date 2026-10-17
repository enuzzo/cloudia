# Continuous outflow — archivio della prova respinta

Checkpoint ciclo44,17 ottobre2026. Candidato esterno `experiment-v61-continuous-outflow-r2`, non adottato; prodotto `observatory-v61-observed-terrain-material` invariato.

Leggere prima il [resoconto](../../CLOUD-CONTINUOUS-OUTFLOW-TRIAL-2026-10-17.md), poi `run/OUTCOME.json`. Il goal completo e i60FPS rimangono aperti.

- `source/`: manifest canonico141 e manifest candidato144; `overlay/` contiene soltanto i7 file differenti. Per ricostruire il candidato, usare una copia esterna dei141 file verificati e applicare questi7 percorsi. Non sovrascrivere il prodotto stabile. Manifest e log identificano la revisione effettivamente eseguita.
- `preflight/`: primo runner, pin, fixture e FAIL parziale256603112. Non è un conteggio completo del raster.
- `preflight-r2/`: runner scanline, nuovo freeze e unico risultato effettivo PASS dei layout/prepare. Conteggia il lavoro dei guard; il replay contabile condivide l'enumerator. Nessun modello denso o GPU in questi runner. I pin conservano i percorsi originali della sessione, non sono un invito a rieseguire.
- `continuous-helper/` e `revisions/`: revisioni matematiche e primo integrato, compresi sorgenti e risultati negativi. Non confondere il helper autore con la copia test dopo la sola correzione TypeScript root.
- `run/`: protocolli precedenti alla prova, freeze,29 test mirati PASS, typecheck/build PASS, suite590 con1 FAIL e correzione documentata della classificazione del contatore `cache.submissions`. Il primo classificatore resta byte-esatto.
- `browser/`: nuovi DTO A e alias verificati dei bitmap precedenti; due PNG B completi con ledger delle74/28 parti; console e screenshot CSS dell'anteprima stabile ripristinata. Lo screenshot UI non è il PNG nativo e non misura FPS.
- `review/`: review indipendenti numeriche, del codice, della regressione e dei quattro full native, più il giudizio root. Mantengono separati FAIL a64 e giudizio visivo a256.

`MANIFEST.json` registra byte/SHA256 di tutti i payload, escludendo sé stesso. La verifica di conservazione esterna all'archivio controlla inoltre source overlay, identità141 correnti, PNG/IHDR e ledger ricostruiti. Non riesegue ricette, modelli, build, GPU o benchmark e non trasforma i FAIL in accettazione.

La preview ordinaria resta [Cloudia4196](http://127.0.0.1:4196/?seed=74), Sole, nube matura animata e terreno reale. La sorgente di geografia/texture comprende aree abitate; nessun edificio3D o pass aggiuntivo per le città. QA53787 è stato chiuso. Nessun push o deploy.
