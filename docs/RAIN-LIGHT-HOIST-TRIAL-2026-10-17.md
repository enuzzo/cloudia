# Pioggia: hoist della luce senza beneficio FPS

17 ottobre 2026, ciclo 50. **Candidata respinta; prodotto locale v61 invariato; goal attivo.**

La modifica sposta fuori dal loop soltanto i due calcoli invarianti `forwardRain` e `rainLight`, nella specializzazione piovosa. Espressioni e operazioni restano letterali; il template asciutto, i campioni, le coordinate, i passi, l'integrazione atmosferica e i binding restano identici. Il compilatore potrebbe già eliminare queste ripetizioni: il guadagno non era presunto.

La candidata è stata preparata in una copia esterna, partendo dai 141 file canonici del manifest `2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73`. Il freeze candidato è `74fab83ee0c7cbc2ea5dddc8bd62874c4f1d3018ec8a74b0829e2be06f573edc`, sempre 141 file, con quattro delta: shader, etichetta sperimentale del renderer, aspettativa dell'etichetta nel test lifecycle e guardia di compatibilità dello shader. Quest'ultima inverte il solo spostamento e mantiene l'hash storico dell'intero ramo wet; l'hash dry resta invariato. Sorgenti, patch reversibile, protocolli e risultati sono nell'[archivio](measurements/rain-light-hoist-trial-2026-10-17/README.md).

## Qualifica eseguita

Typecheck, **561 test su 53 file** e build APP passano sulla candidata congelata. CPU/wall/peak RSS del processo lanciato, osservati con `wait4`, sono conservati nei receipt; non rappresentano il picco simultaneo dell'intero albero di processi. Nessuna riduzione di qualità, nuovo modello di densità, installazione o modifica del lockfile. Hero non ricompilata perché il successivo gate di adozione fallisce.

| Verifica | Esito |
| --- | --- |
| Template asciutto | Byte identico, 12.454 byte |
| Nuovo export PNG A/B pioggia in pausa | Identico sull'intera immagine |
| Risoluzione nativa | 2474 × 1844 |
| Qualità | Macro 256³, dettaglio 128³, 384 passi nominali, full flow e ablation full |
| FPS A1/B/A2 | Nessun guadagno utile; candidata respinta |

Il PNG A completo è di 3.258.221 byte, SHA256 `6ea5e9a22052c40ebdbd223594a1a9ec2761e321410e6a009086ea8ca5972fd1`. B è un nuovo export con DTO proprio e lo stesso digest/numero di byte/dimensioni; il bitmap viene riusato tramite alias verificato. Entrambi: seed 74, pioggia Float32 0,8, Sole della posa di confronto, tempo nube 60, forcing/precipitazione 0, scena in pausa, camera mondiale identica e cielo assestato. Il confronto ricorsivo conserva 14 differenze attese di versione, identità/contatori locali, tempi di acquisizione e weatherTime con flash disattivati. Nessuna differenza negli input fisici. La review indipendente ricostruisce e autentica il PNG dalle 67 parti, controllando anche CRC/IEND. È parità di un'immagine PNG in uno stato, senza nuova prova HDR, moto o accettazione artistica.

Un primo trasferimento dell'export ha superato i 30 secondi del bridge UI e si è fermato alla parte 51/67. È stato recuperato **lo stesso export**, in blocchi più brevi, senza rigenerare scena o immagine; il fallimento tecnico e il ledger completo sono conservati.

## Misure attive di 90 secondi

Un solo confronto A1/B/A2, stesso tab/GPU, main thread, timing per stadi, camera ferma, moto nube attivo, output pieno e nessun frame cap. Riscaldamento di 2 secondi e pioggia stabilizzata prima della partenza. L'inviluppo di partenza di 100 ms e il gate sono stati congelati prima di B.

| Finestra | Intervalli / durata | Invii/s | Invii/s con completamento finale | p95 / p99 / massimo intervallo |
| --- | --- | ---: | ---: | --- |
| A1 v61 | 1794 / 90,0381 s | 19,924898 | 19,884969 | 67,4 / 68,5 / 83,9 ms |
| B hoist | 1792 / 90,0052 s | 19,909961 | 19,873131 | 67,0 / 68,3 / 98,1 ms |
| A2 v61 | 1796 / 90,0390 s | 19,946912 | 19,910205 | 67,3 / 68,4 / 83,6 ms |

Il gate richiede a B almeno il **5% sopra il migliore A**, sia per gli invii sia per la misura che include lo svuotamento finale della coda, con p95 e p99 non peggiori del peggiore A. B passa le due code della distribuzione, ma fallisce entrambi i requisiti di throughput: −0,185247% invii e −0,186202% con completamento rispetto al migliore A. A2 varia di +0,110482% rispetto ad A1. Nessun vantaggio dimostrato; non si dichiara neppure una regressione causale di questa piccola entità. Il massimo B più alto resta nel rapporto, benché non sia un veto aggiunto dopo la misura.

Tutti i prefissi di coda sono completati e confermano tutti gli invii, senza frame misurati non confermati. La copertura timestamp completa render/compute è 1793/1794 per A1, 1788/1792 per B e 1791/1796 per A2; i mancanti restano espliciti. I sei pass unmatched di B precedono l'inizio del ledger misurato e non vengono assegnati a frame misurati. Le somme dei pass render GPU, circa 97 ms, sono conservate separatamente dalla cadenza invio: non sono durata frame esclusiva né FPS presentati. I report completi, i dati sparsi e i ledger per frame sono tutti salvati. La review indipendente conferma contesti, aritmetica, copertura e FAIL del gate.

Il primo tentativo A, conservato come `performance-a1.json`, è **invalido per confronto**: partenza nube 60,1344 e forcing 0,1347, oltre i 100 ms prefissati. Prima di B è stata congelata una sola riparazione della procedura UI: attivare entrambi i pulsanti esistenti con Enter. A1 corretto parte esattamente da 60/0; B da 60,05/0,0666; A2 da 60/0. Nessuna soglia è stata allargata. L'attesa di stabilità del click è una possibile spiegazione del primo scarto, non una causa dimostrata; la distinzione è descritta nella ricerca salvata. I clock attivi seguono ancora i dt reali, senza replay sincrono per frame.

Questa misura non certifica FPS del compositore, throughput GPU isolato, intervallo di confidenza, stato termico controllato o 60 FPS globali. Nessun altro tentativo di tuning o ripetizione dopo il FAIL, né estensione della candidata a hero, worker, altri meteo o anatomie.

## Stato conservato

La preview ordinaria [4196, seed 74](http://127.0.0.1:4196/?seed=74) è ripristinata a Sole e nube matura animata, canvas 2474 × 1844 su viewport CSS 1237 × 922, console vuota. Lo screenshot finale mostra **la v61 invariata**, non un nuovo risultato artistico. Il solo server candidato 53789/sessione 6302 è stato chiuso con uscita 0; l'owner canonico 48736 resta attivo. I 141 sorgenti canonici e candidati sono stati riautenticati, dipendenze ignorate da Dropbox con attributo 1 prima/dopo. `node_modules 2/` e porta 4201 preservati. Nessun push o deploy.

Restano aperti: anatomia delle tre famiglie, vicino/luce/moto, pioggia e virga, geometria e fotorealismo del terreno, UI e 60 FPS a qualità piena. La geografia reale scelta dall'utente comprende le aree abitate nello stesso materiale, senza edifici 3D o pass aggiuntivi per rappresentarle; il costo totale non è dichiarato nullo. Il prossimo intervento va scelto dalla diagnosi dei costi salvati, senza adottare questo hoist come nuova base.

La [diagnosi e unica prossima proposta](measurements/rain-light-hoist-trial-2026-10-17/review/next-rain-bottleneck-action.md) individua la lettura broad-support alpha del detail RGBA a ogni passo wet. Propone una copia R8 byte esatta di quel canale, mantenendo filtro e coordinate, senza ricostruire il campo o cambiare i passi. È distinta dal macro R8 e dalla narrow mask esistenti; aggiunge 2 MiB CPU e 2 MiB GPU nominali. Non è implementata o misurata qui, può peggiorare la cache e non promette il passaggio da 20 a 60. I certificati di sola nube vuota non autorizzano a saltare gli intervalli che possono contenere pioggia.
