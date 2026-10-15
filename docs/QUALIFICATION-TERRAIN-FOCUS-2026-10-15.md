# Quota della camera e ritorno alla tastiera

15 ottobre 2026, sesto ciclo. Renderer `observatory-v40-terrain-camera-focus`,
navigazione `filtered-field-terrain-clearance-v3`. **Due correzioni mantenute;
goal complessivo ancora attivo.** La densità e la luce della nube rimangono
quelle operative v34: macro256³, dettaglio128³,384 passi nominali, output pieno.

## Correzioni e conseguenze

Un clic primario sulla scena ora porta il focus al canvas con `preventScroll`.
Prima, dopo un range del pannello, il clic esterno chiudeva il pannello ma
lasciava il focus sul documento: il drag funzionava, le frecce no. La
[riproduzione precedente](measurements/terrain-focus-2026-10-15/focus-baseline.json)
registra input Vento→BODY e vista0°. La build corretta registra input→CANVAS,
pannello chiuso e rotazione dopo Freccia sinistra a1672×941,390×844 e1280×432.
I due test aggiunti verificano il percorso completo di focus e preservano
clic destro, puntatore non primario, drag già attivo e teardown.

La quota minima della camera, prima fissa a200m sul mare, ora segue il rilievo
sotto le coordinate x/z. Il margine è **radiale200m**, includendo la curvatura
terrestre. La funzione alza soltanto y; il target e l'orbita orizzontale rimangono
gli stessi, poi il renderer ricostruisce forward/right/up. In Solo cielo resta
il limite precedente sul mare. Sei test coprono225 pose con yaw, pitch,
avvicinamento e aspect, oltre a curvatura, idempotenza e coordinate negative.

Per condividere il terreno fra CPU e WGSL è sostituito l'hash `sin*43758` con
un hash u32 a24bit rappresentabili esattamente in f32. **Il paesaggio cambia
realizzazione**, conservando frequenze, pesi, palette, foreste, rocce, costa
e mare. Nessuna texture aggiuntiva. Il resto del calcolo conserva normali
incertezze f32/pow: non è dichiarata uguaglianza dei bit dell'altezza finale.
La [specifica WGSL, §15.7](https://www.w3.org/TR/WGSL/#floating-point-evaluation)
ammette arrotondamento, riassociazione/fusione e accuratezze limitate delle
funzioni: copiare un hash trascendentale in JavaScript non bastava a condividere
la stessa superficie.

## Verifica numerica sulla GPU reale

Lo [script standalone](../scripts/qa-terrain-gpu.ts) genera una pagina locale
con attivazione esplicita,512 posizioni deterministiche e due pipeline separate:
WGSL attuale e WGSL storico estratto da `b3270f9`. Non modifica la UI prodotto,
non avvia GPU automaticamente e non esegue benchmark. Buffer/device vengono
liberati dopo readback. [Input CPU](measurements/terrain-focus-2026-10-15/terrain-audit-cpu.json),
[risultato GPU](measurements/terrain-focus-2026-10-15/terrain-gpu-audit.json)
e hash identificano le fonti esatte.

| Verifica, Apple/Metal di questo Mac | Risultato |
| --- | ---: |
| Campioni finiti |512/512 |
| Errore massimo CPU/GPU attuale |6,4373mm |
| RMS errore attuale |0,9291mm |
| Minimo margine radiale corrente |199,99355m |

Il riferimento CPU usa f32 espliciti dove implementati e Math.pow/sin JS,
con geometria della sfera in float64 a coordinate già quantizzate f32. La
soglia consultiva1m non è una garanzia universale o una prova sui punti non
campionati. L'audit misura la funzione height, **non** l'intersezione dei raggi
o la binding del draw completo; la scena IAB viene controllata separatamente.

Il [witness raggiungibile](measurements/terrain-focus-2026-10-15/terrain-reachable-witness.json)
dimostra il difetto storico senza affidarsi al vecchio hash CPU: target
`[.4296875,2.9365234375,0]`, panorama16km, yaw−.68999483 e pitch−.66728462,
entrambi ammessi. Dopo il vecchio limite sul mare, origine f32
`[-7.5703125,-3.79999995,9.69312286]`. La GPU storica restituisce terreno685,737m,
contro quota radiale211,871m: penetrazione473,866m. La nuova realizzazione a
quel punto è diversa; il nuovo clamp mantiene199,999m sopra la propria quota.

La prima ipotesi CPU alla posizione x=.4296875 non è confermata dallo shader
storico: lì la GPU dà149,276m e la camera207,388m, quindi non penetra. Non viene
usata come prova del bug. L'audit trova192 posizioni storiche sotto terreno,
ma non le presenta tutte come pose raggiungibili; il witness sopra lo dimostra
separatamente con OrbitView e coordinate f32 identiche al readback.

## Immagini e prestazioni

Le prove focus conservano screenshot e stato DOM per desktop, mobile e finestra
bassa. Su mobile il centro geometrico del canvas era coperto dal pannello:
quel tentativo è escluso, poi si ripristinano vento/avvicinamento e si clicca
la porzione esposta a`[195,100]`CSS. Non è un difetto del prodotto.

La [vista bassa con pioggia](measurements/terrain-focus-2026-10-15/fixed-low-orbit-rain.jpg)
è controllata nel renderer main con seme72, nube matura t60,6 in pausa,
vento55%, dispersione0, pioggia80%, pitch−.92 e cielo assestato. Il
[report30s](measurements/terrain-focus-2026-10-15/main-low-rain-native-30s.json)
conferma camera e qualità: CSS1672×941, output/interno3344×1882, Massima384.
Registra **7,283rAF/s**, GPU media269,592ms e p95 del callback150,1ms.
Questa vista è troppo costosa: la prestazione nativa resta aperta. Non è un
confronto causale con v34, mancando una misura storica alla stessa camera e
qualità. rAF, timestamp GPU e presentazione del compositore restano distinti.
Nessuna risoluzione o quantità di materia è stata tagliata per migliorare il numero.

La [misura worker30s](measurements/terrain-focus-2026-10-15/worker-low-rain-native-30s.json)
conferma esecuzione nel worker e qualità invariata, con264 frame in30,019s:
**8,795rAF/s**, mediana100ms, p95 234,2ms, GPU media324,070ms (44 campioni).
Le condizioni nominali corrispondono, ma target/origine x differiscono dal main:
non è un A/B a camera identica né una prova di vantaggio del worker. Anche questo
percorso non soddisfa la prestazione nativa richiesta. Le console warn/error
acquisite nei due percorsi sono vuote.

## Diagnosi della luce e limiti ancora aperti

Il nuovo [audit della sorgente visibile](VISIBLE-SOURCE-AUDIT-2026-10-15.md)
genera una sola baseline256³/128³ e separa densità, diretto, ambient e multiple.
Al centro100%, il residuo16m della densità è già piccolo, circa0,657% della
media; quello della sorgente vale0,273%. I termini costanti valgono il19,87% della sorgente totale al centro100. La loro rimozione algebrica aumenta il CV soprattutto
abbassando la media, senza aumentare la deviazione standard della griglia9×9.
In queste tre pose frontali dello stesso seme e cielo, l'audit non sostiene
la premessa di un grande segnale fine nascosto; non misura l'effetto di un
eventuale powder.
È una diagnosi CPU di scala, non una misura dei pixel; residui16m più sensibili
al passo rispetto alle medie. La proposta powder resta non implementata.

È individuato un secondo difetto geometrico distinto:
[l'intersezione del terreno](TERRAIN-INTERSECTION-AUDIT-2026-10-15.md) può
oscillare con le attuali sei iterazioni. Un caso CPU ritorna un punto con
residuo−1,58km, oltre il primo crossing rilevato. La correttezza del clamp
**non chiude l'occlusione di nube/pioggia/terreno su tutti i raggi**. Il prossimo
intervento deve rendere l'intersezione conservativa e limitata nel costo,
verificando anche le montagne oltre l'orizzonte marino; aumentare indiscriminatamente
i passi del terreno non è una soluzione prestazionale già sostenuta.

La [memoria dell'emissione di pioggia](RAIN-EMISSION-OPTIONS-2026-10-15.md)
è soltanto una proposta per collegare dispersione e cortina già cadente.
Il clock della pioggia si ferma già in pausa: l'ipotesi opposta è falsificata.
Restano anatomia/cap delle famiglie, luce ravvicinata in moto/controluce,
integrazione delle precipitazioni, UI completa e prestazioni native sostenute.

## Verifiche e riproducibilità

Suite completa: **155 test/27 file superati**; app e hero build superate.
I due test focus e i sei test terreno spiegano l'incremento rispetto al checkpoint
precedente. Gli audit standalone hanno anche superato i controlli TypeScript
mirati. Nessun sorgente runtime è stato modificato dopo queste build.

L'[audit CPU dell'avvicinamento](measurements/terrain-focus-2026-10-15/approach-cpu-v40.json)
conserva18 casi: massimo errore della frontiera9,815mm, mediana probe0,095ms,
mediana campo di flusso2,310ms, massimo combinato2,979ms. Verifica campo/probe
CPU e camera OrbitView, non draw GPU, clamp del paesaggio o prestazioni native.

Gli screenshot precedenti non sono confronti esatti di prima/dopo: camera e
output non coincidono. Il [manifesto](measurements/terrain-focus-2026-10-15/manifest.json)
registra SHA-256 delle tre sorgenti runtime modificate, dei due asset app/worker
e delle26 prove archiviate; non è l'hash dell'intero repository.
La [preview finale](measurements/terrain-focus-2026-10-15/final-cycle6-preview.jpg)
è ordinaria main, seme72, Sole,60,6s in pausa, Panorama e pannelli chiusi;
override rimosso, CSS1672×941, output/interno3344×1882, Massima384, console
warn/error vuota. La lettura istantanea Sole non qualifica prestazioni sostenute.

**Chiusura iniziale interrotta:** al termine Git e alcuni readback locali
hanno fallito con File Provider `Operation timed out`, su file già presenti
(`LIGHTING-OPTIONS`, `POWDER-OPTIONS`, `pointer.test.ts`). Nessuna cancellazione,
riscrittura forzata o esclusione Dropbox aggiuntiva. I controlli sopra erano
conclusi prima del problema. Alla ripresa è stata recuperata la lettura dei sorgenti e dello stato/diff Git;
le tre sorgenti runtime e i due asset app/worker coincidono ancora con gli SHA
della qualificazione. Il manifesto conserva lo stato storico della prima chiusura.
Nuova suite completa155/27 e typecheck superati; build app e hero superate.
[Verifica alla ripresa](measurements/terrain-focus-2026-10-15/resumed-verification.json). Il percorso
`node_modules 2/` resta intatto e fuori dallo staging. Nessun push, merge su main o deploy.
