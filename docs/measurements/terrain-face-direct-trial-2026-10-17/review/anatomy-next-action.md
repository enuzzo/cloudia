# Prossima azione anatomica — outflow ancorato alla sorgente matura

17 ottobre 2026. **Una proposta implementabile, non eseguita né adottata.** La bocciatura nativa del face-direct resta acquisita. Qui si interviene sulla forma macro iniziale, senza altra taratura del materiale, rumore, nuove risorse o riduzione di 256³/128³/384/output pieno.

## Causa di codice da affrontare

Nel `volume.ts` attuale il congestus e il multicell costruiscono i cap dal proprio summit e registrano `capParents` (`:201–226`). Lo sheared usa invece due `iceCores` con centri assoluti fissi (`:241`), indipendenti dalle deviazioni seed del percorso foundation→summit. Il raccordo successivo sceglie il cap più vicino (`:266`), mentre i 48 streaks usano una terza origine indipendente (`:334–338`: origin −.1, length 3.5, quota 6, offset vento 5.3). La spalla inclinata aggiunta sotto il cap (`:385–401`) raccorda questi elementi, ma non cambia la relazione originaria tra asse alimentante e intero outflow.

Questa è una discontinuità nella **costruzione semantica**, non la prova che ogni U sia meteorologicamente errata o che un vuoto numerico sia ancora quello delle vecchie immagini. È plausibile che il raccordo locale ispessito conservi una calotta disposta come mensola rispetto al corpo che dovrebbe alimentarla.

## Singolo intervento: traslazione solidale dell’outflow, senza lift

Solo nel ramo sheared, usare il summit maturo `M`, la sua foundation `F` e il primo cap prossimale `C`. Alla quota già esistente di C, prolungare l’asse alimentante:

`t=(C.y−F.y)/(M.y−F.y)`; `axisXZ=F.xz+t*(M.xz−F.xz)`; `deltaXZ=axisXZ−C.xz`.

1. Prima di `transform`, aggiungere lo stesso deltaXZ ai due iceCores, senza cambiare alcuna Y, raggio o blend. Registrare il primo cap come parent esplicito del maturo. Il cap distale mantiene forma e offset rispetto a quello prossimale; non si riempie la U gonfiando il corpo.
2. I billow/puff che già derivano dai core seguiranno automaticamente i centri aggiornati, con lo stesso numero/ordine di chiamate RNG. Ai soli streaks sheared generati in coordinate già trasformate aggiungere `deltaXZ*shape.towerWidth` (per i centri il transform usa towerWidth, non anvilSpread). Nessuna nuova casualità o formula di dettaglio.
3. I collar esistenti continuano a essere generati dai loro endpoint, ora parent coerenti. Anche la scelta del cap per `prepareInclinedShoulder` deve usare quel parent esplicito: non introdurre un secondo near-cap routing diverso. Non aumentare spalla, neck, sharedBody o testa giovane.
4. Conservare rasterizzazione, smooth-union, carving, quantizzazione e bake della luce/precipitazione dalla nuova densità. Non riusare cache della vecchia anatomia.

È un piccolo riordino dei riferimenti e dei centri, con nessuna nuova primitiva o funzione di campo. Restano le ellissoidi e i loro contratti di supporto; bounds/occupazione/luce vanno ricalcolati normalmente. Nessun lookup aggiuntivo nel renderer. Il costo GPU non è per questo garantito uguale: cambiano sovrapposizioni, supporto e raggi attraversati.

## Differenze dai fallimenti già conservati

- R3/R4 del corpo alzavano il roof, fino a +27,3% sul 617 o +29,04% sul 260, producendo cuscino e invasione della vista vicina. Questa proposta non alza o allarga il corpo comune.
- La torre giovane abbassata spostava 182 primitive e lasciava U/uncino, con testa più tozza. Qui giovane/fondazioni/sommità rimangono autoriali.
- La rotazione della radice incus muoveva 25 primitive prossimali, lasciando distale e streaks invariati: cambiava soprattutto la calotta. Qui si cambia il sistema di riferimento di **tutto** l’outflow, mantenendone la forma relativa; non si ripropone quella rotazione.
- v56 corregge solo la protrusione inward della spalla e resta acquisita. Non annullare quella correzione né promettere che questa nuova proposta risolva anche il dente o la morbidezza interna.

Limite concreto: la contrazione globale X/Z (`:343–346`) dipende dagli estremi di tutte le primitive. Spostare l’outflow prima di quel passo può cambiarne i fattori e quindi anche altre coordinate sheared. Registrare tali fattori e gli endpoint nel confronto; non dichiarare torri byte-identiche dopo la contrazione. Non correggere l’esito con nuovi clamp/coeff o compensazioni per seed. Per congestus 72/multicell 73 il ramo e la sequenza casuale restano immutati: richiedere identità dei canali come guard delle altre due famiglie.

L’ancoraggio lineare è una scelta autoriale senza nuovo coefficiente libero, non una simulazione del vento. La [definizione WMO di incus](https://cloudatlas.wmo.int/en/clouds-supplementary-features-incus.html) lo identifica come parte superiore espansa del cumulonembo; le [note WMO](https://cloudatlas.wmo.int/en/explanatory-remarks-and-special-clouds-cumulonimbus.html) descrivono espansione e outflow sottovento con vento crescente. Queste fonti motivano il legame sorgente→outflow, senza convalidare l’estrapolazione proposta o imporre una silhouette unica.

## Un piano nativo con stop precoce

Congelare la formula sopra e una sola candidata. Prima A/B nativo seed 74, t60 in pausa, Sole assestato, vento 55%, dispersione 0, stessa camera nel mondo e stessa mira prese dalla baseline: niente nuovo probe che cambi distanza/origine quando cambiano i bounds. Una coppia frontale e una laterale già scelta prima del trial devono mostrare la radice dell’incus e lo spazio intertorre. Se si limita a traslare la mensola, lascia U/uncino uguali o crea nuova parete/cuscino, **FAIL e stop**.

Solo se il primo confronto è favorevole: stessa verifica vicino con matrice baseline congelata (evitare il precedente falso confronto da camera spostata), poi 77/80 e guard canonici 72/73. PASS circoscritto richiede transizione corpo→incudine più credibile da entrambi i lati senza una calotta che copra tutta la vista vicina, perdita della torre giovane o nuove superfici tagliate. Nessuna soglia fotografica sostituita da connettività o somma della densità. FPS/worker/pioggia soltanto dopo un beneficio visivo, senza allargare questo primo esperimento.

Letture: `SHOULDER-CONTINUITY`, `EXPERIMENT-SECONDARY-HIERARCHY`, `EXPERIMENT-CAP-ROOT-ORIENTATION`, `EXPERIMENT-INCLINED-SHOULDER`, `EXPERIMENT-PLUME-ANATOMY` e sorgente corrente. Non è stato lanciato neppure un prefix scanner o bake.

`src/cumulonimbus/volume.ts` letto: 29836B, SHA256 `c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`.
