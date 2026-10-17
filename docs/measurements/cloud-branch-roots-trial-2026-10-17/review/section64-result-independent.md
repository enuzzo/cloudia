# Review indipendente — sezione64 A/B

**Esito: regressione riprodotta e localizzata nei dati salvati; nessun nuovo run.** Ho riletto i96 record per variante ed eseguito soltanto algebra su quei record. Raw: `section64-diagnostic/run/result.json`, SHA256 `615a63cee52fa6e1907a514c03e7a75a987d47918a650731428818023c5e2035` (1.460.197 B). Freeze del programma: `2c3c1463a8a978bbc1200076ff7d39fbf799d1a1b45bef916c21947edb132a4a`. Seed74, size64, x=.5609226029381325, y=4.0458440042043025,96Z prefissate; A volume c349e8f7, B6b8f59bf. Entrambe le generazioni complete sono state eseguite da root.

RGB del dettaglio, wx/wy/wz, ice, erosione, additionalErosion e material sono bit-identici Float64 A/B in96/96 coppie. Punti, indirizzi degli8 vicini e pesi coincidono; ice=0, additionalErosion=0 e material=1 ovunque. Le somme degli8 vicini riproducono esattamente R8 interpolato, campo grezzo e densità macro Float32 salvati in192/192 righe; i bit Float32 e il packing `round(density*255)` coincidono in tutte le1.536 occorrenze di corner (non1.536 voxel unici). Anche l’algebra finale ricostruisce192/192 risultati esatti.

| Variante | Positivi finali | Punto del massimo margine | R8−erosione massimo | F32 macro interpolato−erosione massimo | Densità finale in quel punto |
|---|---:|---|---:|---:|---:|
| A |15/96|i48, Z=.03645833333333348|+.7103205226923033|+.7089321943504371|.8636423791490866|
| B |0/96|i39, Z=−.619791666666667|−.09029256400954713|−.09033351135252865|0|

In B, il massimo R8=.13175039431294336 è già inferiore all’erosione=.2220429583224905. Il corrispondente Float32 macro interpolato=.13170944696996184 non supera la stessa soglia: togliere solo la quantizzazione non rende positivo alcuno dei96 campioni (A resta15/96). Il delta R8−Float32 interpolato varia da−.001475939987757413 a+.0013883283418661962 in A; da−.0001556184036647229 a+.0001322945055255778 in B. In B il massimo delta assoluto è.0001556184036647229, molto minore del deficit minimo di supporto.

Nel precedente massimo A, i48, A ha campo grezzo interpolato=.30887078456397293, macro Float32=.8864615284341181 e R8=.8878498567759843. B ha ancora campo grezzo interpolato positivo=.11290681200166541, ma **tutti gli8 corner hanno densità macro Float32=0 e R8=0**, pur con campo grezzo individuale positivo (min .033835891634225845; max .19588200747966766). Qui la perdita è già presente dopo il carving macro, prima dell’interpolazione e del passo fine. A i39 B conserva4/8 corner macro positivi, ma la combinazione interpolata resta sotto l’identica erosione fine.

Conclusione causale circoscritta: il nuovo campo/raccordo offre supporto insufficiente dopo l’interazione con il carving macro originale; il campionatore fine invariato elimina il residuo nei96 punti. Il solo fatto che il campo grezzo sia positivo non garantisce densità dopo carving. Il prune della luce non è la causa di questa asserzione: R8 è impacchettato prima di quel loop e `sampleCloudDensity` usa R8 + RGB dettaglio, non i canali ottici generati dopo. Material=1 identico esclude anche una variazione del moltiplicatore di materiale in questa sezione; non si propone tuning di opacità o erosione per mascherare il deficit.

Questo non distingue da solo il contributo causale delle singole primitive ritirate dal nuovo involucro, né prova errori globali di banda/pruning o assenza di nube continua. È evidenza discreta della sezione64 prefissata; nessuna deduzione automatica su256, GPU, intera forma o resa artistica. Le griglie Float32 interpolate sono riferimenti supplementari, non una nuova valutazione geometrica continua.

Il terminale root è exit0, COMPLETE_WITHIN_BUDGET:1.342757 CPU child +.020284 CPU wrapper, .960756792s wall child; somma conservativa dei picchi RSS232.275.968 B. Sono i valori terminali del wrapper, distinti dal campione interno del child. Nessuna generazione/test/fixture/rerun aggiunto dalla review.
