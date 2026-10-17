# Support R8 — review indipendente A1/B/A2 salvata

**Tre finestre valide; FAIL del gate di adozione, nessuna adozione R8.** Sola lettura/hash, decodifica dei ledger e aritmetica sui dati salvati. Nessun modello, test, build, browser, GPU o nuova finestra eseguiti dal reviewer.

| Finestra | Intervalli / durata ms | Invii/s | Invii/s con conferma finale | p95 / p99 ms | Sim / forcing iniziali s |
|---|---:|---:|---:|---:|---:|
| A1 canonico | 1306 / 90021.4 | 14.50766151 | 14.46138003 | 83.4 / 84 | 60.05 / .0659 |
| B support R8 | 1364 / 90054.9 | 15.14631630 | 15.09798192 | 83.4 / 83.8 | 60 / 0 |
| A2 canonico | 1469 / 90022.3 | 16.31817894 | 16.27296937 | 83.7 / 116.5 | 60 / 0 |

**Criterio pre-dati invariato:** protocollo SHA `ec9365c6c68d8755530daf790e0348e58dd7e1c4a980aa1a656c44d91aceef81`. B doveva raggiungere **17.134087887112415 invii/s** e **17.086617836685495/s** comprensivi della conferma, ciascuno 1.05×migliore A. Entrambi falliscono; p95≤83.69999999999709 e p99≤116.5 passano. B/A1 mostra +4.402190% negli invii e +4.402083% con conferma; B/A2 invece **−7.181332% / −7.220486%**. Lo scarto A2/A1 è **+12.479733%**: il miglioramento apparente rispetto al solo A1 non isola l’effetto della candidata. Non si deduce una regressione causale universale né una causa termica/driver da questo singolo bracket.

**Correzione del verificatore, senza nuova misura:** letto il diff completo: cambia soltanto `duration=sum(values)` in accumulo sequenziale `duration=0.0; duration+=interval`. Quest’ultimo riproduce l’ordine IEEE754 del `reduce` JavaScript canonico; nessuna tolleranza o soglia aggiunta. Ricalcolo indipendente: A2 **90022.3 ms** esatti come il report; builtin Python3.14 **90022.30000000002**, un ULP diverso. Vecchio FAIL conservato, con unico check fallito `statisticsRecompute`, SHA `1c42fbc2ea51eb65a940624bfa18e8c99e23aff8f7c830706240c66fa5f01086`. Verificatore precedente SHA `e11f995f5b90626cc7098604e2b5d7883f7039b5a44845a6901578a61a0563a4`, corretto SHA `dc6c6a9820d4a64b90bb2bb5eb8beeac0326b5333d4bd45151920e077d5095d2`, coerente con la ricevuta esplicita. Il FAIL dell’audit originale resta distinto dalla validità della finestra, verificata con l’algoritmo corretto; niente replay, modifica dei dati o promozione del trial.

**Contesto:** stesso seed74, adapter/backend/Three, camera completa e camera finale, geografia/ottico/supporti, mezzo/sole e path densità macro R8 senza fallback. Ultra **256³/128³/384**, interno/output **2474×1844 screen**, main/stages, flow/ablation full, moto attivo, orbit/navAudit/framecap disattivati, speed1, wind.55/dispersion0, cielo Rain assestato, flash0 e skipped0. Rain CPU differisce lievemente in B ma tutti i valori hanno lo stesso Float32 di .8, come previsto. B `supportSamplingStart/End` coincide integralmente con l’oggetto nativo R8 qualificato128³/2097152B/fallbacknull; A1/A2 non dichiarano questo percorso nuovo. Tutti gli avvii rispettano i100ms prefissati; sim finali126.8409/129.8628/132.1829, senza replay identica per frame. Metadati ai checkpoint e procedura UI non sono una traccia continua di ogni input o dello stato del sistema.

**Aritmetica e coda:** statistiche intervalli/alias/FPS ricalcolate esattamente con accumulo sequenziale e percentili `floor(n*p)`; tutti gli intervalli finiti positivi. Sei riassunti scalari CPU/GPU e alias coincidono esattamente con i raw. Tutte le89 fence per finestra completed, prefissi monotoni;1306/1364/1469 invii confermati, zero residui. Tassi con solo clock locale e drain ricalcolati esatti:283.4/276.1/233.4ms finali. Massimi19/20/22 invii logicamente non confermati, non profondità fisica della coda.

**UID/call/frame per ogni draw:** univoci, range/frame invariati, somme e completeSamples/statistiche ricostruiti esattamente; zero duplicati/conflitti/ledger invalidi/batch stale. Render e compute completi **1304/1306**, **1361/1364**, **1468/1469**. Mancano solo intervalli finali1305–1306;1362–1364;1469. A1 conserva3 pass del frame2035 prima del ledger; B3 del frame1419 prima del ledger; A2zero unmatched. Tutti esclusi correttamente, insieme ai90/102/93 pass associati fuori finestra; nessun riempimento. Campioni GPU scalari sparsi276/291/311, distinti dal ledger completo. Somme dei pass non convertite in FPS tramite reciproco.

**Confronti e limiti:** i circa19.9 invii/s del ciclo46 sono **storico non matched**, fuori da questo bracket: non sono un A sostitutivo e non dimostrano un calo causato da R8. La deriva dei due A attuali resta esplicita. Microprova e PNG nativo precedenti mantengono i loro ambiti limitati; non estendono parità a ogni frame animato. `presentedCanvasFps:null` in tutti i report; nessuna misura del compositore o throughput GPU isolato, overhead diagnostico non sottratto. Stop del trial senza ulteriore tuning/ripetizione R8; obiettivo60 e restante goal, inclusa anatomia, ancora aperti.

Pin dei tre raw, verificati contro le ricevute e il confronto finale:

- A1,3324443B: `da32e7ba6a159e9accace0bfec1dd2a91365bb005cc7e0067381d0bc14256dad`.
- B,3475663B: `a13863fad0bdd9c93c98e954811c65c64101b1d8c8109d479aca1de36ad2c2fb`.
- A2,3724210B: `481b8cbecb3ae44c7333257fe2a6e0d8443e1c15335417ba907c41c0f6daaedc`.
