# Outflow ancorato — review indipendente del sorgente congelato

17 ottobre 2026. **PASS statico limitato; qualifica numerica e visiva ancora pending.** Nessun test, prefix, bake, build, browser o GPU eseguito dal reviewer. Baseline letta `volume.ts` 29836 B, SHA `c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`; candidata 30536 B, SHA `3f67f044d9bfe653d60fa2daac3521f69680f98d6838b0441249c4b9a35b6eb7`. Helper/test corrispondono a `outflow-helper-freeze/FREEZE.json`; digesti degli input in `source-review-inputs.json`.

## Contratto riscontrato

- `volume.ts:243–250`: F è la foundation appartenente al summit maturo M; C è il primo iceCore. La correzione viene calcolata prima del transform e aggiunta una sola volta ai due core distinti. `capParents.set(mature,proximal)` conserva l’identità degli oggetti che saranno trasformati e contratti in seguito. Nessuna seconda trasformazione attraverso gli alias summits/foundations.
- `outflowAnchor.ts:12–25`: input finiti, rise positivo e risultato finito; estrapolazione alla Y esistente di C, senza clamp. Restituisce solo X/Z e non muta gli input. Il transform dei centri è affine: la correzione equivalente dopo transform è deltaXZ×towerWidth, anche in presenza di windLean e towerHeight.
- `volume.ts:275` e `:395`: collar e spalla inclinata usano il medesimo parent esplicito. Il fallback rimane presente nel sorgente, ma sul ramo sheared raggiunto la Map è stata popolata prima; non vi è una nuova scelta nearest indipendente per il maturo.
- `volume.ts:345–347`: tutti i 48 streak sheared ricevono delta×towerWidth, non anvilSpread. Billow e puff esistenti ereditano la nuova posizione dei core; i loro raggi, quote, blend, conteggi e ordine delle chiamate casuali non sono modificati. Il delta completo rispetto alla baseline non tocca rasterizzazione, carving, quantizzazione, dettaglio, baked light o extinction.
- Il gruppo outflow comprende 98 primitive: 2×(core+10 billow+14 puff)+48 streak. I tre collar maturi e i loro 3×91 discendenti sono rigenerati dai nuovi endpoint; la spalla continua a usare lo stesso campo bounded esistente. Non si tratta di sole 98 primitive traslate senza altri effetti sul campo.

## Rischi che restano reali

La contrazione X/Z (`:352–355`) dipende dagli estremi dell’intero layout. I fattori possono cambiare e alterare anche posizioni/raggi delle masse sheared non spostate esplicitamente. L’ancoraggio F/M/C sopravvive a una trasformazione affine comune, ma non segue da questo identità dei vecchi raggi o della silhouette. Anche la correzione inward R5 viene rivalutata nel nuovo layout contratto: il codice e l’ordine restano identici; l’esito numerico non è ancora osservato qui. Registrare fattori, endpoint e ruolo selezionato senza compensazioni per seed.

La forma finale erosa non è una traslazione rigida della vecchia densità: carving/noise restano nello stesso sistema mondo, e smooth-union/occlusione cambiano. Lo stesso numero di primitive non certifica uguale costo di bake o GPU. L’estrapolazione lineare F→M è una scelta autoriale, non una legge meteorologica; può semplicemente ricollocare la mensola o chiudere troppo la vista vicina.

Gli otto test nuovi verificano algebra, transform, immutabilità e input invalidi del helper. Sono coerenti ma non esercitano l’aggancio dentro `generateVolume`. I test layout esistenti confrontano il blocco R5 prima/dopo nel layout corrente; non sono da soli una prova A/B contro la vecchia anatomia. Conservare i contratti esistenti, riportare ogni fallimento e non spostare punti/abbassare soglie per far passare la candidata.

## Due pose A già fissate, non inferite dai tasti

Lette le registrazioni `browser/baseline-74-front.json` e `baseline-74-side.json`: seed74 sheared, ultra, volume256³, dettaglio128³,384 step, output/internal2474×1844, t60 in pausa, Sole assestato, flow60/disp0.

| Posa | Origin | Yaw | Pitch |
|---|---|---|---|
| Front | [15.459707890770279,7.558173047097125,2.780613896133632] | 1.3852869846402587 | .2811279826464208 |
| Side | [−2.670688295776402,7.558173047097125,15.017173409754953] | −.19789814066289424 | .2811279826464208 |

Target comune `[.3515625,3.119140625,−.0546875]`, surface `.7227685139973958`, approach0, FOV tanHalf `.2867`, aspect `1.341648590021692`; basis complete nei JSON. La laterale è 16 ArrowRight dalla frontale, delta yaw `−1.583185125303153` rad; non 24 e non un angolo esatto di90°. WeatherTime differisce tra le due catture A; per ogni confronto A/B verificare gli effettivi uniform applicati, non soltanto il nome Sole.

Prima B: fissare anche la matrice/camera mondo di A senza nuovo probe dei bounds. Il gate iniziale resta beneficio del raccordo e nessuna nuova parete, mensola, cuscino, taglio o scomparsa del giovane, da entrambe le viste. Static PASS non è artist PASS, adozione o accettazione del goal completo. Le prossime prove near/77/80/72/73 e meteo/FPS sono subordinate al verdetto visivo root; non sono state avviate dal reviewer.
