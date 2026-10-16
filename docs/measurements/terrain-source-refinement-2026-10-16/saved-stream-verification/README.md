# Verifica indipendente degli stream OFF/ON salvati

**PASS delle evidenze numeriche salvate e dei sei gate di fit congelati. Non adozione o PASS artistico/GPU/FPS.** Un solo processo di verifica Python: nessun Bun, modulo TypeScript, mesh, raggio, sampler/interpolazione DEM, query geometrica o modello rieseguito.

## Metodo e conservazione

`PROTOCOL.json`, `verify.py`, wrapper e 17 input sono identificati in `PRE-RUN-FREEZE.json` prima della verifica. Freeze SHA `a2f70ee549443b98ec5d4c981139aae35431ca54c5da109600f114cf955c4d14`; script SHA `b8074ad4c61ad9ac3716e2de13dc9cbb01167e1c89a1c7baa68d6e4772c9153f`.

Sono stati letti entrambi gli stream Float64LE conservati: 591.361 errori e 4.730.888 byte per modo. OFF riproduce il digest storico `6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a`; ON ha digest `58ca7139fc88f4f087854cb80a4901a8645536b23c7d504dc1c7bfecb7186093`. Lo stream OFF è una nuova riproduzione autenticata dallo storico, non il recupero dell'array originariamente non conservato.

L'associazione ai 18 gruppi usa soltanto indice row-major, ring originale e lettura diretta del codice coast intero dal CDM1 pin; non legge o interpola quote e non invoca helper del modello. Somme e quadrati usano `math.fsum`; top8 usano `heapq`, indipendentemente dall'accumulazione Kahan/retain del witness. Istogrammi, errori estremi e relative molteplicità, classificazioni paired e top8 sono ricostruiti da tutti gli errori salvati. Conteggi, valori individuali, classificazioni e ordinamenti sono esatti; confronto fsum/Kahan con tolleranze prefissate relative 2e−12/assolute 1e−8.

Unico processo: exit 0, stderr vuoto, **2.958 controlli**, CPU 6,040792s, wall 6,083457s, picco RSS 109.969.408B, entro il budget prudente 20 s / 40 s / 2 GiB. I 17 input risultano invariati dopo la verifica. `result.json` è la sintesi indipendente; `run.json` conserva terminale, risorse e hash stdout/stderr. Il verificatore non modifica gli input originali.

## Identità e gate

OFF: tutti i cinque hash buffer, statistiche mesh, aggregate/ring e digest degli errori coincidono con lo storico. La verifica legge le dichiarazioni degli hash mesh già osservati dal run, senza rigenerare gli array. ON: prefissi originali positions/surface esatti, contabilità geometria e limiti salvati coerenti, dipendenza dal risultato/run/stream OFF identificata prima e dopo dal wrapper.

I sei gate restano tutti veri: RMS globale e land strettamente inferiori, massimo assoluto non oltre baseline+0,001m, RMS land ring2/3/4 strettamente inferiori. Stato terminale PASS e selectionFitGatePASS sono distinti dalla successiva accettazione visiva.

| RMS land m | OFF | ON |
|---|---:|---:|
| Ring0 | 0,213317 | 0,213317 |
| Ring1 | 2,015450 | 2,015450 |
| Ring2 | 8,055547 | 4,334225 |
| Ring3 | 16,106521 | 8,032407 |
| Ring4 entro ±48 km | 30,071097 | 14,011065 |
| Totale land | 24,684421 | 11,641357 |

RMS globale 18,578115→8,760919m. Estremi signed globali OFF −261,538942/+209,989797m, ON −96,065502/+90,427707m. Positivo indica mesh sotto il riferimento DEM curvo; negativo mesh sopra.

## Peggioramenti conservati

| Confronto paired | Tutti | Land mask | Sea mask |
|---|---:|---:|---:|
| Errore assoluto migliorato | 225.051 | 224.074 | 977 |
| Peggiorato | 55.125 | 55.051 | 74 |
| Uguale | 311.185 | 55.464 | 255.721 |
| Entra oltre 5 m | 12.883 | 12.879 | 4 |
| Esce da oltre 5 m | 69.448 | 69.199 | 249 |

La regressione assoluta più forte conservata è **+54,222130m**, nodo order 514063, grid[499,796], X/Z[−1,625;35,500]km: errore OFF −5,669415m→ON −59,891545m. Migliorare RMS e massimo globale non garantisce miglioramento di ogni valle o rilievo. I 42.775 cambi di segno sono riportati separatamente dall'uguaglianza di magnitudine.

## Costo geometrico e limiti

ON registra 591.788 vertici/1.182.550 triangoli rispetto a 465.409/929.792 OFF; payload geometria 33.127.816B contro 26.050.592B. La lookup aggiunge 589.824B di cellTriangleCount, esclusi dal cap dei soli attributi/indici. Le statistiche riportano 405 midpoint fuori dal dominio di selezione ±48 km: selezione e propagazione conforme non sono una promessa di tutte le facce esterne invariate. Questi numeri sono contabilità salvata, non una misura del costo GPU.

I run del modello originali rispettano i propri gate: OFF CPU 2,018513s / wall 1,651520s/somma picchi 910.295.040B; ON CPU 2,790412s / wall 2,314884s/somma picchi 1.189.593.088B. Non sono confronti FPS né misure di residenza simultanea.

La selezione e la valutazione usano gli stessi nodi: **fit, non holdout**. Non si controllano massimi continui, errori fra nodi, silhouette, normali, crack o corretta visibilità solare. Nessuna prova di parità GPU deriva dal Float32 degli attributi con interpolazione Float64 del lookup CPU. I ring0/1 restano identici nel campione; ring4 non è osservato fino al limite 65,536 km. La maschera coast è materiale, non costa fisica indipendente.

La verifica conferma i dati disponibili senza dimostrare credibilità fotografica o causa delle scaglie. Le immagini native, i controlli di topologia/lifecycle del percorso effettivo e il costo del renderer restano gate separati del root.
