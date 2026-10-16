# Anatomia della nube: esperimenti 1–3 ritirati — 16 ottobre 2026

**Nessuno dei tre candidati viene promosso. Il gate dell’anatomia fotografica resta FAIL.** Le prove hanno ridotto una ripetizione superficiale e individuato un errore reale nelle trasformazioni sperimentali, ma non hanno prodotto la forma naturale richiesta.

Il generatore del prodotto è stato ripristinato a `59bb8d3`: ho verificato il contenuto di `volume.ts` contro il relativo snapshot; SHA256 `86a575e16bd23439f72ebe0ebc24cb6cea5900b22ac79321ca3e4366ac7afd74`. I nuovi helper sperimentali sono assenti dal prodotto e conservati nell’[archivio](measurements/plume-anatomy-2026-10-16/README.md). Ripristinare la versione precedente non equivale ad approvarne l’aspetto. La validazione integrata finale del prodotto è distinta dalle verifiche dei candidati ritirati.

## Cosa è cambiato e cosa mostrano le immagini

| Candidato | Intervento | Risultato visibile e decisione |
| --- | --- | --- |
| 1 | Sostituisce la decorazione uniforme di 18 globuli con quattro figli per nucleo con poche ramificazioni continue, di dimensioni diverse e legate alle correnti ascendenti | La ripetizione diminuisce, ma emergono corpi lisci, pareti cilindriche e una base larga. Nella cella inclinata restano vuoto a U e tetto a uncino. **Ritirato** |
| 2 | Collega basi più strette e teste diverse con volumi continui; modifica corone e sorgenti dell’incudine; elimina il tetto di ghiaccio del congesto | Il congesto conserva cavità e pareti verticali. Le torri multiple sembrano camini su un basamento comune; la cella inclinata conserva mensola e collo sottile, con un nuovo dente centrale. **Ritirato** |
| 3 | Corregge soltanto la proprietà degli array dei segmenti: ogni segmento possiede coordinate indipendenti prima della contrazione | Nel seed 74 cambia la posizione della protrusione, ma persistono tetto a uncino, apertura e parete scura. **Ritirato** |

Esempi: [torri multiple, candidato 2](measurements/plume-anatomy-2026-10-16/browser/candidate2-seed73-quarter0.jpg), [cella inclinata, baseline](measurements/plume-anatomy-2026-10-16/browser/baseline-seed74-quarter0.jpg), [cella inclinata, candidato 3](measurements/plume-anatomy-2026-10-16/browser/candidate3-seed74-quarter0.jpg). Il giudizio riguarda queste immagini: non afferma che qualsiasi separazione tra torri o apertura sia meteorologicamente errata.

## Copertura e limiti del confronto

Sono conservati **21 JPEG**, tutti verificati a 1280×720: sette baseline, sei del candidato 1, sei del candidato 2 e due del candidato 3. La sessione browser era configurata per output nativo 2560×1440, 384 passi nominali, macro 256³ e dettaglio 128³. I JPEG sono catture della viewport CSS, non letture dei pixel nativi; da soli non certificano la risoluzione interna.

Baseline e candidati 1/2 comprendono le tre famiglie, seed 72/73/74, a t60, fronte e quarto, nello scenario Sole. Ogni forma segue però il proprio centro di supporto: le pose dei controlli sono confrontabili, la camera nel mondo non è identica. **Non è un A/B di pixel.** Inoltre la baseline del seed 72 al quarto fu ricentrata con Home, includendo la deriva; i candidati usano il centro del reset di confronto. Quella baseline è esclusa dall’abbinamento rigoroso. Il fronte a 35% del seed 72 è solo contesto.

Del candidato 3 sono state ricatturate solo le due viste del seed 74. Per 72/73 i buffer misurati a 64³ coincidono con il candidato 2; non si dichiara una nuova verifica browser a 256³. Nessuna di queste prove chiude i gate di luce ravvicinata, pioggia/paesaggio, UI o FPS.

## Verifiche numeriche: il test fallito rimane fallito

I candidati 1/2 riportano **30/31 test mirati superati**; il candidato 3 **31/32**, grazie al nuovo controllo sulla proprietà degli array. Il test esistente richiede una differenza verticale dei baricentri dei seed 72/73 maggiore di 0,12 km a 32³. I risultati sono 0,117593557 km per il candidato 1 e 0,116189935 km per 2/3: **il test fallisce**. La soglia non è stata modificata. I risultati superiori alla soglia a 64³/128³ non trasformano quel fallimento in PASS.

Le verifiche dell’helper includono 16.000 coppie di punti, supporto, anisotropia, estremità e casi degeneri. I probe del supporto rivalutano anche il campionatore nei voxel saltati: nel candidato 2, 5.710.907 campioni a 32³/64³/128³ non mostrano falsi vuoti. Sono evidenze finite su griglie campionate, **non una prova generale o una verifica a 256³**, né un’approvazione dell’immagine.

## Errore isolato e causa geometrica ancora aperta

Nel candidato 2 alcuni segmenti condividevano gli stessi array: la contrazione orizzontale veniva applicata due volte. Nel seed 74, con fattore X 0,736423839920452, 13 vertici condivisi accumulavano fino a **490,302 m di errore** rispetto al percorso previsto. Il candidato 3 elimina la condivisione e l’errore misurato. Nei seed 72/73 i fattori sono 1 e i buffer densità/RGBA/tramonto a 64³ restano identici. **La baseline originale non usa questi segmenti ed è estranea al difetto.**

Le sezioni CPU mostrano anche un vuoto già presente nella geometria: a x0,6/y4,0 km la densità macro è zero lungo la linea Z campionata. Più sopra, lo spessore ottico della spalla è 0,1633 contro 10,5811 nella colonna principale. Il ghiaccio assottiglia l’uscita, ma cambiarne solo il materiale non riempie quel vuoto inferiore.

La prossima indagine deve quindi costruire e misurare una **spalla inclinata alimentata dal corpo superiore verso l’incudine**, valutando anche l’intera estensione della testa giovane. Aggiungere rumore o piccoli spuntoni lascerebbe intatta la struttura dominante.

L’archivio contiene sorgenti esatte, patch compresse, immagini, dati e un replay Node autonomo della contrazione: sei generazioni a 64³ confrontano tutti i buffer e i record, senza dipendenze del progetto. Replay e manifest sono verificabili con i comandi nel README. Il [rapporto tecnico completo](measurements/plume-anatomy-2026-10-16/DETAILED-REPORT.md) conserva dettagli e limiti ulteriori. L’obiettivo complessivo resta attivo.
