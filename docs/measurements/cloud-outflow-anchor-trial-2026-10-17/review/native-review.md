# Outflow R1 — review visiva indipendente A/B

17 ottobre 2026. **Verdetto: FAIL del gate artistico iniziale, front + side seed74.** Valutazione formulata senza conoscere il verdetto root. Il precedente PASS statico resta limitato alla coerenza del sorgente; non viene convertito in accettazione del risultato.

Ho aperto con `view_image` tutti e quattro i PNG nativi interi 2474×1844, poi quattro crop PNG lossless a pixel originali. Nessun browser, GPU, test, prefix, bake o modello. Nessun sorgente modificato. Gli originali sono conservati intatti.

## Osservazioni dalle immagini

| Criterio fissato prima del trial | Front A→B | Side A→B |
|---|---|---|
| Raccordo torre→incudine più convincente | **Non raggiunto.** Il bordo sinistro sotto il cap è più continuo/diritto, ma l’insieme continua a leggere come un cappello quasi orizzontale sopra una colonna scura e liscia. La maggiore continuità non diventa una chiara espansione convettiva verso l’outflow. | **Non raggiunto.** Il cap si ricolloca verso sinistra rispetto al giovane; il raccordo resta un tratto inclinato sotto la mensola. Non vedo un cambiamento della composizione che renda l’outflow più organicamente alimentato. |
| Sella/U e relazione con il giovane | Il giovane resta davanti al corpo, con testa che appare più piatta/estesa. La separazione ottica tra questa testa e il corpo posteriore resta evidente. Questa posa non rende leggibile un miglioramento della sella. | La grande apertura a U/forcella resta la figura dominante. Tra sottoincudine a sinistra e testa giovane a destra lo spazio appare più ampio in B, non meno insistente. È un’osservazione visiva, senza segmentazione o misura dell’area. |
| Nuovo muro/mensola/cuscino/taglio | Nessun nuovo piano di taglio netto o corpo aggiuntivo a ponte. Tuttavia il fianco posteriore scuro conserva una lettura verticale e uniforme, mentre la calotta conserva una sommità da ripiano. | Nessun ponte massiccio che inglobi il giovane; la giovane torre rimane riconoscibile. Restano però mensola superiore, uncino e due bracci divergenti. Nel full B cambia anche il profilo del corpo inferiore: non è uno spostamento percepibile soltanto dell’outflow. |
| Beneficio complessivo | **Insufficiente.** Qualche variazione locale di contorno, senza salto di credibilità. | **Insufficiente e localmente peggiorativo** per l’apertura della forcella. |

Il gate richiedeva un beneficio in entrambe le pose: non è soddisfatto. L’assenza di un nuovo taglio o di un cuscino estremo non basta a salvare la variante. La U non è dichiarata impossibile in meteorologia; il problema qui è che resta la composizione artificiale prioritaria già identificata, mentre il raccordo non diventa più convincente. Non raccomando ulteriori near/meteo/FPS come tentativo di promozione di R1. Nessun coefficiente o nuova variante viene proposto da questa review.

## Comparabilità e limiti

Ho confrontato ricorsivamente i due `metadata` di ogni posa e salvato tutte le differenze in `native-review-image-index.json`. **Camera completa, lighting, qualità, output/internal, passi, volume/dettaglio, tempo simulazione/flow, pausa e vento/dispersione coincidono esattamente per ogni coppia A/B.** Front yaw `1.3852869846402587`; side yaw `−.19789814066289424`; pitch `.2811279826464208`. Target comune `[.3515625,3.119140625,−.0546875]`; origin/basis integrali sono negli input JSON autenticati. La side è 16 ArrowRight dalla frontale, delta `−1.583185125303153` rad.

Sono diverse versione/etichetta variante, owner clocks/frame serial e UUID sky locali, i bounds di supporto/precipitazione derivati dalla nuova anatomia e contatori owner-local della cache terreno/ombra. WeatherTime differisce; nei record applicati rain/forcing sono zero, t60 e flow60 restano fissi. Non dichiaro identità di tutti gli stati interni non esposti. Il FAIL formale del validatore dovuto a hits/requests omessi dall’allowlist è una questione del validatore: non è il motivo del FAIL artistico e non è stato cancellato o trasformato in PASS qui. Non è stato eseguito alcun nuovo validatore/test.

Le due pose seed74 non certificano altre famiglie, altri seed, vista vicina, pioggia, movimento o costo. Non attribuisco le variazioni a un’unica primitiva leggendo il PNG; contrazione, composizione del campo ed occlusione sono già limiti espliciti del modello. Nessuna affermazione sul fotorealismo globale o sulla chiusura del goal.

## Originali autenticati

| Immagine | Byte | SHA256 |
|---|---:|---|
| A front — bitmap canonica v61, alias repo optical | 3599836 | `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9` |
| B front — `browser/candidate-74-front.png` | 3607225 | `a5618ec2982212f7587d7930a5f42b271d86cab19288ae9094d502f2901934aa` |
| A side — `browser/baseline-74-side.png` | 1359259 | `c9c4681b03b9c4771c7be62974712b12b516e8b8717c22dc0907f18318aa2749` |
| B side — `browser/candidate-74-side.png` | 1467060 | `64a047ec9d21590c6e7bdfead6a9e7b10b05210c5685c54e99ae978731d63a2a` |

I crop usano esclusivamente coordinate Pillow **LTRB**: front `[980,280,1590,850]` =610×570; side `[940,270,1760,850]` =820×580. Stessa box A/B per posa, senza resize, contrasto o altri filtri. Sono evidenza supplementare scelta per vedere il raccordo già presente nei full; non un gate quantitativo scelto dopo il risultato. Percorsi assoluti, hash dei crop e dei quattro JSON, dimensioni e differenze metadata sono nell’indice adiacente.
