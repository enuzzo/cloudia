# Griglia32→31,25m — review indipendente dei risultati salvati

**FAIL del gate CPU prefissato: non procedere al native.** L’esecuzione A/B è completa e nei limiti; la variante non soddisfa tre condizioni numeriche. Giudizio concluso prima di leggere qualsiasi output SAVED-GRID-ANALYSIS del root; tale output non è stato letto. Analisi soltanto dei due stream F64, record, POINTS, gate pre-numerico e coast CDM1 per la maschera; nessun builder/altezza/modello/GPU/test rieseguito.

| Set e metrica del gate | A32m | B31,25m | Esito |
|---|---:|---:|---|
| Fit RMS terrestre (334589 punti) |11.64135661m|9.95649502m|PASS|
| Fit p99 assoluto, tutti591361 |36.11132934m|35.81562748m|PASS|
| Fit massimo assoluto, tutti |96.06550239m|125.75544573m|**FAIL**|
| Holdout RMS terrestre (334018 punti) |7.38675989m|8.15933798m|**FAIL**|
| Holdout p99 assoluto, tutti589824 |25.00927651m|25.69030984m|**FAIL**|
| Holdout massimo assoluto, tutti |87.02977015m|75.31293325m|PASS|

p99 è il valore ordinato di abs(error) all’indice floor(.99*(n−1)):585446 sul fit,583924 sul holdout; nessuna interpolazione/tolleranza. RMS principali con math.fsum. Maschera identica A/B: coast>=0, su nodi fit e media bilineare dei quattro codici coast ai centri holdout. Non sono state calcolate nuove quote altimetriche.

Il fit all-points ha407601 miglioramenti,183705 regressioni e55 uguaglianze; il holdout244539 miglioramenti,345283 regressioni e2 uguaglianze. La riduzione del fit non si generalizza ai centri delle celle. Non attribuisco una causa esclusiva senza ulteriori prove; i dati sono però coerenti con il rischio già dichiarato di premiare l’allineamento ai nodi usati per selezionare il refinement.

Bande fisiche A comuni, RMS terrestre holdout:

| Raggio L∞ | A→B, metri |
|---|---:|
|0–4.096km|.019770→.000110 (solo56 punti terrestri)|
|4.096–8.192km|.216481→.682615|
|8.192–16.384km|1.481096→4.711193|
|16.384–32.768km|2.565892→4.859451|
|32.768–48km, ultimo cap65.536|9.574390→9.992292|

Quindi quattro bande holdout peggiorano. Il massimo incremento locale di abs(error) nel fit è101.097622m a XZ[−32.625,5.625]km (A−9.526427m,B−110.624048m); nel holdout62.720585m a[−7.6875,35.5625]km (A+1.278577m,B−63.999163m). Le regressioni complete rimangono nei due stream originali, non vengono selezionate o rimosse. I piccoli valori del primo anello non qualificano l’intero terreno.

Costi distinti: A591788V/1182550T/33127816B; B568304V/1135582T/31812712B. Child A2.754347CPU,2.415680s wall,888815616B RSS; child B2.632186CPU,2.267242s wall,852836352B RSS, entrambi exit0 e dentro20CPU/30wall/1.5GiB terminali. Sono osservazioni singole sequenziali, non benchmark GPU o previsione FPS. Payload inferiore non compensa il gate fallito. Dominio esterno e geometria sono cambiati, nessuna identità globale viene dedotta.

Autenticati gzip e rawSHA dei due stream, conteggi/encoding F64LE e fitA storico58ca… esatto. Sei hashA sono riportati concordi nel record di identità; la fonte resta il GLO90 campionato125m, non nuova geografia. Nessun giudizio fotografico/continuo né adozione. I veto fit-max e holdout-RMS/p99 rendono il risultato decisivo secondo il protocollo, senza nuovi criteri posthoc.

Dati indipendenti compatti: `terrain-grid-independent-data.json`, SHA256 `18c2eb777527ea86ffeb650164bb9130de73119c1d0e1336adb95c03ea4c1d0a` (13.548 B). Stream rawA `ef4836dae907207f904b851db56404df9f5cc40e370f56852246d9b2aac2189d`; rawB `9c5b967f13b443332a2ca305b01cf73f5b9492ffb3450285af60175248811b96`.
