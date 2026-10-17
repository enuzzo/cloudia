# Pioggia v61 — nuova misura90s a qualità piena

**Target60 ancora aperto: 19,80253 invii/s.** Misura del17 ottobre2026 sulla versione canonica, indipendente dalla candidata sulle sommità fermata per risorse. Nessun confronto A/B né miglioramento prestazionale dichiarato.

[Rapporto integrale](measurements/cloud-head-attachment-trial-2026-10-17/browser/canonical-rain-90.json), [analisi salvata](measurements/cloud-head-attachment-trial-2026-10-17/run/canonical-rain-90-analysis.json), [protocollo prima dell'avvio](measurements/cloud-head-attachment-trial-2026-10-17/run/CANONICAL-RAIN-PERFORMANCE-PROTOCOL.json). SHA rapporto `67f64472fcf33d0a054f464837cd10ed3720251b033d399cc6287fa571728a73`; protocollo `a9fde4febc174b3b1849efd7b3365fd229502d4c4735cf1abd6b93ec598deef6`.

Un solo avvio tramite Misura90secondi, warmup incorporato2s, pioggia stabilizzata prima. Canonico `observatory-v61-observed-terrain-material`, seed74/sheared, main, macro256³, dettaglio128³,384 passi nominali, output e interno2474×1844/screen, ultra, full ablation/full flow. Pioggia preset0,8; skyPendingfalse, transizione1, vento0,55, dispersione0, velocità1; animazione attiva, orbita/flash/automatic lightning spenti. Camera origine identica agli estremi. Clock nube255,8518→339,8588s; tempo della nube e tempo reale sono distinti. Modalità timestamp `stages`, default della preview ordinaria: overhead presente, non sottratto. GPU identificata dal browser come Apple; nessuna generalizzazione ad altri dispositivi.

| Misura effettiva | Valore |
|---|---:|
| Intervalli inviati |1.783|
| Somma intervalli reali |90.039ms|
| Cadenza di invio |19,802530/s|
| Mediana |50,0ms|
| p95 / p99 |67,5 /68,4ms|
| Massimo |89,2ms|
| Intervalli oltre33,34ms |1.563|
| CPU invio, media /p95 |0,394896 /0,8ms|
| Frame skipped del contatore interno |0|
| Prefissi di coda |89 osservazioni completate|
| Disegni confermati al termine |1.783/1.783;0 non confermati|
| Attesa del prefisso finale |172,7ms|
| Cadenza limitata dal completamento del prefisso |19,763196/s|
| FPS presentati dal compositore |non misurati|

Il terreno e la shadow map restano validi: entrambi accumulano1.823 richieste e1.823 hit durante la misura con warmup, nessuna nuova submission o variazione epoch. Vale per questa camera ferma e non dimostra il costo durante la navigazione.

Il ricalcolo dai1783 intervalli riproduce esattamente tutte le statistiche del rapporto. Anche la cadenza limitata dal completamento è ricostruita sul clock locale:90218,2ms. Il massimo di25 disegni non ancora confermati a JavaScript è un bound logico, non la profondità fisica della coda GPU. Il contatore skipped0 non significa assenza di scatti o fotogrammi presentati mancanti.

Il ledger di timestamp qualifica1782/1783 disegni completi sia render sia compute, con1 disegno finale senza timestamp: il dato mancante rimane esplicito. Somma dei pass render dei disegni completi: media97,894639ms, p95123,666432ms; compute media0,025449ms, p950,131072ms. Queste somme di intervalli di pass non sono il tempo trascorso per un frame e non si trasformano in FPS tramite reciproco. Il precedente scalare sparse render (377 campioni, media98,126862ms) resta separato dal ledger fresco. Non sono tempi isolati del solo integratore pioggia. La verifica indipendente ricontrolla UID, call ranges, copertura e risultato numerico senza nuova esecuzione.

La prova aggiorna il precedente dato storico di circa19 invii/s; impostazioni e finestra non sono una coppia matched e non permettono di dichiarare regressione o miglioramento. È una nuova baseline della pioggia su questo Mac. Sole, tramonto, vicino, movimento della camera, worker e altri dispositivi richiedono le proprie qualifiche: una finestra non chiude il goal60.

La geografia reale, comprese le zone abitate, è rappresentata nello stesso materiale del terreno. Per le città non si introducono edifici3D o un pass dedicato; questa misura non confronta artificiosamente costa naturale contro costa abitata e non dimostra costo totale nullo.

Dopo il campionamento è stata ripristinata la preview ordinaria4196, Sole/nube matura animata, pannello chiuso. Nessuna modifica dei141 sorgenti prodotto, nessun install o lockfile edit, nessun push/deploy. Prossimo intervento sostanziale: eliminare lavoro ridondante dal percorso pioggia preservando campioni e integrazione, poi verificare immagine e cadenza nelle stesse condizioni; nessuna riduzione di qualità per raggiungere il numero.

[Proposta circoscritta conservata](measurements/cloud-head-attachment-trial-2026-10-17/review/rain-next-exact-work-removal.md): estrarre soltanto forwardRain/rainLight invarianti dal loop piovoso. Era già annotata nel ciclo44 e non è un trial nuovo eseguito. Il compilatore potrebbe già farlo e la pressione sui registri potrebbe peggiorare; nessun guadagno previsto. Dry e integrazione dipendente da t devono restare identici, con i controlli già esistenti; non serve inventare un altro verificatore del modello.
