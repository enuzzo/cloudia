# Raccordo continuo — review nativa indipendente

17 ottobre 2026. **FAIL del gate visivo iniziale front+lato seed74.** Il verdetto è stato comunicato a root dopo la prima lettura dei quattro full native, prima di ricevere il suo giudizio concorde. Nessuna nuova GPU, modello, ricetta, test o taratura dal reviewer.

Ho ispezionato tutti e quattro i PNG interi2474×1844, poi i quattro crop lossless matched della stessa regione di raccordo già usata nel ciclo39. Gli originali sono intatti; file/hash/byte/box e riferimento al protocollo sono in `native-independent-inputs.json`.

| Aspetto | Front A→B | Lato A→B |
|---|---|---|
| Beneficio locale reale | Scompaiono alcune sporgenze sotto il cap; il contorno è più semplice. Non si traduce in una chiara crescita della sezione alimentante. | **Sì, limitato:** meno rigonfiamenti pendenti/dischi sotto la radice; il bordo inferiore è più regolare e rastremato, la transizione laterale meno ammucchiata. |
| Difetto prioritario | Continua a leggere un cappello quasi piatto sopra un collo scuro, verticale e poco articolato. La testa giovane davanti conserva la separazione dalla torre posteriore. La differenza macro è piccola. | La grande U/uncino resta dominante. Il ritiro delle masse sottoincudine rende lo spazio aperto più esposto; il nuovo bordo più pulito non cambia la composizione a due bracci. Non misuro né dichiaro l’area della U. |
| Nuove regressioni evidenti | Non vedo un nuovo cuscino, ponte massiccio, piano di taglio netto o giovane inglobato. Il collo continua però a sembrare una superficie liscia/parete scura. | Nessun nuovo taglio netto o cuscino evidente. La calotta è più sottile verso il vuoto e mantiene la lettura di mensola; la perdita di supporto visibile non è un miglioramento complessivo. |
| Gate entrambe le pose | **Non raggiunto.** | Miglioramento locale insufficiente a compensare il difetto macro persistente. |

Il protocollo richiedeva beneficio in entrambe le pose, non soltanto rimozione di piccole protuberanze. Per questo il risultato visivo è FAIL anche separando completamente la regressione numerica a64³. Non deduco dalle immagini che la sezione storica del test sia vuota a256³, né che qualsiasi U sia meteorologicamente impossibile. Non propongo altro tuning o un’altra variante in questa review.

## Comparabilità qualificata, distinta dal giudizio

Il report root corrente è **`MATCH_RENDER_INPUTS_WITH_EXPLICIT_OWNER_COUNTER_QUALIFICATION`**, non un PASS incondizionato dell’intero DTO. Camera mondiale, lighting e qualità corrispondono esattamente secondo quel confronto;256³/128³/384/output2474×1844, t60 in pausa e stato Sole/vento/dispersione fissati. Differiscono i dati di owner e i nuovi stats anatomici. WeatherTime è esentato dal protocollo soltanto nelle condizioni clear/paused/nonorbit/zeroRain/flashoff dichiarate prima delle catture.

La prima classificazione aveva trattato anche `terrainRaster.cache.submissions` come owner-local; il protocollo nominava richieste/hit senza nominare submissions. Root ha preservato il primo report e aggiunto la qualifica esplicita. L’indice conserva il digest della prima lettura e quello del report rettificato. Non cancello questa distinzione e non uso i contatori come misura fisica o qualità; essa non cambia il giudizio sulle immagini.

## Provenienza visiva

| PNG nativo | Byte | SHA256 |
|---|---:|---|
| A front, canonico v61 |3599836|`6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9`|
| B front, ciclo40 |3598468|`60757e475a67cb50976d220f4d8fee5444ad494c65ab85aeb0ed3af08349af97`|
| A side, canonico archiviato |1359259|`c9c4681b03b9c4771c7be62974712b12b516e8b8717c22dc0907f18318aa2749`|
| B side, ciclo40 |1341477|`e0b47ea7d238b6649e5720004dead4b832eb7c2db33777905bef4ce7664f9860`|

Crop esclusivamente Pillow LTRB, senza resize o filtri: front `[980,280,1590,850]`610×570; side `[940,270,1760,850]`820×580. Stesse box A/B e stessa notazione del precedente confronto. I crop sono supplementari ai quattro full già ispezionati.

Il fullsuite resta separatamente589/590 con la regressione conservata in `inclinedShoulder.test.ts:18`; il mancato PASS della suite esclude già l’adozione. Questa review aggiunge un FAIL artistico proprio, non usa quel test come prova dell’immagine. Nessuna qualifica di near, altri seed, pioggia, worker, moto o FPS; nessuna chiusura dei goal originali.
