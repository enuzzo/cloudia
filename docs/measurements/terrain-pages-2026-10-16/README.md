# Terreno: formato compatto e pagine conservative, prova CPU del 2026-10-16

**Packing PASS sul corpus CPU; politica di paging FAIL. Nessuna promozione GPU o prodotto.** Il campo analitico originale, il ledger e i limiti restano invariati: 16 point query, 256 visite, stack 48, banda geometrica 1 m.

Il resoconto italiano è in `../../TERRAIN-PAGES-2026-10-16.md`. `RESULTS.md` conserva il resoconto esterno completo; `review-notes.md` contiene la revisione indipendente. `execution-README.md` è la copia esatta del documento operativo esterno, da leggere come prova storica insieme a questo indice.

## Contenuto e prove

- `compact.ts`: un record RGBA32F base per nodo, un record gradiente per foglia, chiavi dyadiche implicite, builder di pagine con preflight entro 8 MiB.
- `trace-compact.ts`: clipping del figlio prima del fetch e lettura lazy dei gradienti, mantenendo lo stesso valutatore analitico e la stessa ricerca ordinata.
- `protocol.ts`: fasci di preparazione e holdout, limiti e scelta delle pagine fissati prima dell'esecuzione. Le richieste provengono dal normale cap, senza usare distanze hit dell'oracle.
- `baseline/`: sorgenti congelati del precedente prototipo e campo originale. Gli snapshot non contengono geometria interpolata sostitutiva.
- `run.ts`: runner effettivo delle fasi pages/full. `executed/packing/run.ts` è la versione effettiva della prima fase; differisce nel reporting e nei tempi aggiunti. `executed-source-map.json` verifica e deduplica gli altri snapshot identici, senza riscrivere le versioni eseguite.
- `results/packing.json`: risultato raw della prima fase. Il vecchio campo `original.metadataRecordLoads` contava accessi a nodi; `recordsBefore` già contava correttamente i tre RGBA32F per accesso. `packing-normalized-summary.json` corregge solo quella denominazione e registra lo SHA raw originale.
- `results/pages.json.gz`: tutte le richieste, esiti dei refill e risultati/witness di preparazione, holdout e controlli. `results/full-rows.json.gz`: tutti i 5198 risultati finali. `results/all-unresolved.json.gz`: tutti i 660 irrisolti, senza filtro.
- `results/packing-original-rows.json.gz` e `results/packing-compact-rows.json.gz`: confronto completo prima delle pagine; consentono di riverificare l'identità geometrica dei 5198 raggi.
- `execution.json` e stdout/stderr: una sola esecuzione per fase; exit 1 della fase full dovuto al gate di efficienza fallito, senza crash o timeout.

## Verifica e ripristino dei JSON

Da questo archivio si possono eseguire soltanto letture/verifiche, senza simulazioni:

```sh
python3 verify-archive.py
python3 restore-json.py /percorso/esterno/di/destinazione
```

`verify-archive.py` controlla SHA e dimensioni di tutte le copie, SHA/dimensioni originali dopo decompressione gzip, mapping degli snapshot effettivamente eseguiti, identità geometrica del packing e conteggi/witness dei risultati archiviati. Non esegue il tracer, un builder, un benchmark o lavoro GPU. `verification.json` è il suo risultato; è escluso dall'hash manifest per evitare un vincolo circolare.

Ogni gzip conserva esattamente i byte JSON originali. SHA originale, SHA compresso e dimensioni sono in `manifest.json` e `selection.json`. `restore-json.py` scrive soltanto nella destinazione esplicita; rifiuta di sovrascrivere un file diverso e verifica nuovamente i byte ripristinati.

## Riproduzione futura, da autorizzare separatamente

Non avviare i runner dentro Dropbox. Per una futura riproduzione copia questo archivio in una cartella di lavoro esterna. Gli input originali sono riusati dal percorso esterno del ciclo 10 indicato in `fixture.ts`, dopo SHA esatti di sorgente, fixture e metadata.

La fixture originale è già archiviata una volta in `../terrain-gradient-2026-10-16/audit-cases.json.gz`; `restore-fixture.py` del relativo archivio ripristina i byte con SHA `cfad064c4dbe4b100294222c8c12a4fbcd98cf8f5316f0f1a3a10494543800a1`. Nel layout esterno originale va disponibile in `cycle10/terrain-gpu/audit-cases.json`.

Il tree originale da 5238768 byte non è duplicato. Si ricostruisce in una copia esterna del precedente archivio con il suo `run.ts --candidate-only`, stessi input e opzioni; lo SHA richiesto è `69b2b49c06eddb8c582b9f1b14cdb944f707488fd73a4f5f17d6e261f62b12c4`. La riproduzione esegue lavoro CPU e richiede di rispettare il coordinamento delle misure GPU; non è stata rilanciata per creare questo archivio.

Neppure i due tree residenti nuovi sono inclusi: sono rigenerabili, e dimensioni/SHA correnti sono conservati in `results/analysis.json`. Il runner eseguito confrontava già gli SHA dei sorgenti fra pages e full, ma **non vincolava con SHA i contenuti dei due binari residenti al confine fra le fasi**. Il limite resta dichiarato: non abbiamo aggiunto quel controllo retroattivamente né rilanciato la prova.

## Limiti che accompagnano i numeri

La riduzione dell'86,75% riguarda i record logici del modello CPU. `Work` conserva nodo, anchor e cache dei gradienti; una cache separata conserva i campioni. Questo non qualifica banda, registri o stack GPU da 16 byte. Il futuro port deve controllare capacità prima di ciascun push; nessun overflow è stato osservato nel corpus CPU, con massimo 18 elementi.

La residenza serializzata finale è 5549520 byte, 5,292 MiB. Tenere vecchio e nuovo tree compatti simultaneamente richiede già 8605472 byte, 8,207 MiB; 8 MiB non sono quindi una misura del totale o del picco di allocazione. Nessun upload, compilazione shader, ledger WGSL/Metal universale, costo GPU o FPS è stato qualificato da questo esperimento.
