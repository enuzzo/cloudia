# Outflow sheared — controllo preliminare e gate nativo

17 ottobre2026. **Piano letto; candidata e qualifica ancora da revisionare al loro freeze.** Al primo accesso `outflow-source/volume.ts` era ancora identico al prodotto:29836B, SHA256 `c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`. Non è un PASS anticipato del nuovo codice. Nessun prefix, modello, bake, test, browser o GPU eseguito dal revisore; scritture soltanto in questa cartella review.

Piano autorevole: `docs/measurements/terrain-face-direct-trial-2026-10-17/review/anatomy-next-action.md`. Base: prodotto v61, non i trial plume/cap-root/face-direct respinti.

## Contratto da verificare nel delta effettivo

- **F/M/C semantici:** M è il summit maturo secondo la stessa selezione di quota; F è la foundation associata a quell'oggetto; C è il core prossimale esplicitamente nominato. Calcolare t e deltaXZ prima di transform, senza mutare F/M o riapplicare la trasformazione ai loro alias. Le Y, i raggi e il blend dei due core restano quelli autoriali prima della contrazione.
- **Un solo parent:** `capParents` deve associare M allo stesso C usato dal collar e da `prepareInclinedShoulder`. Il secondo routing nearest-cap non deve scegliere un altro destinatario dopo lo spostamento. Registrare i parent per identità, non indici arbitrari di lobes. Le sole due forme ice esistenti restano due; niente nuovo bridge/roof/rumore.
- **Unità della traslazione:** nel transform i centri X/Z usano towerWidth anche per l'ice; anvilSpread scala rx. Quindi agli streaks già trasformati serve `deltaXZ*towerWidth`, non anvilSpread, né delta grezzo o applicazione doppia. Con deltaY0 lo shear dei centri non introduce un termine aggiuntivo.
- **Conseguenze reali prima della contrazione:** il gruppo outflow diretto comprende2×(core+10billow+14puff)+48streak=98primitive. I3collar maturi sono liquid: ciascuno ha1core+18billow+72figli=91primitive; si ricollocano lungo i propri endpoint con fattore t, non come gruppo rigido dello stesso delta. Anche la spalla inclinata cambia endpoint. Non descrivere la modifica come soltanto due centri o soltanto98tuple.
- **RNG/ordine/alias:** mantenere tutte le chiamate anatomy/rng/capRng/iceRng e l'ordine di append/smooth-union. I riferimenti condivisi in summits/foundations/mappe non vanno trasformati due volte. Lo spostamento prima della decorazione deve conservare la popolazione, non ricostruirla con nuova casualità. Rumore/carving fissati nel mondo significano che il campo eroso non è una traslazione rigida dell'immagine, anche quando i centri sono traslati rigidamente.
- **Contrazione globale esplicita:** gli estremi dell'intero insieme determinano scaleX/scaleZ. Lo spostamento può cambiare tutte le X/Z e i raggi orizzontali sheared, comprese le torri non direttamente selezionate. L'affinità comune conserva la relazione dell'asse alimentante, ma non rende le altre tuple identiche alla baseline. Servono fattori/estremi prima-dopo e coordinate finali dichiarati; niente nuova compensazione/clamp per seed.
- **v56 inward acquisita:** mantenere guard/proiezione e gruppi91 della correzione esistente. I suoi test confrontano prima/dopo quel blocco: il loro PASS non certifica che l'intera nuova anatomia sia identica alla vecchia. Per72/73 il ramo e RNG restano invariati; l'identità effettiva va verificata nella qualifica prevista, senza dedurla da un nome family.

## Sicurezza e qualifica da leggere, senza eseguirle qui

Freeze source/patch e input prima delle esecuzioni root. Il delta deve preservare campo ellissoidale, smooth-union, raster bounds, carve, quantizzazione, support/pruning e ricottura della luce dalla nuova densità. Nessuna cache geometria/luce vecchia riutilizzata con nuovi centri. Stesse256³/128³/384/native e shader/ottica/terreno invariati; il costo può comunque cambiare con supporto e sovrapposizioni.

Leggere poi i risultati reali dei test mirati e della qualifica completa, source/diff manifest e comandi con exit. Non abbassare soglie o muovere stencil soltanto per ottenere PASS. In particolare il test64 della spalla contiene un vecchio punto mondo fisso: un eventuale fallimento è una perdita di quella presenza campionata da spiegare, non automaticamente un veto fotografico universale né un motivo per riscriverlo alla cieca. La prova di sicurezza bounds/light resta distinta dal giudizio artistico.

## Due pose già scelte, con correzione prima di esecuzione

Seme74, Sole assestato, t60 in pausa, vento.55, dispersione0, fullflow,2474×1844 sia output sia interno,256³/128³/384. Prima catturare metadata effettivi A per entrambe le pose; B deve usare le stesse origin/target/forward/right/up e proiezione nel mondo, non un probe o un centro nube ricalcolato dai nuovi bounds.

1. Frontale operativa: l'attuale14Left+3Down, classificata dai valori reali salvati, non chiamata yaw0.
2. Laterale corretta: **16ArrowRight dalla frontale**, non24. Parent ha verificato `−36/1237*3.4` per tasto, totale circa−1.58319rad(~90.71°), non90° esatti. Le24ArrowRight inizialmente nominate avrebbero prodotto circa136° e non vengono usate. I vettori effettivi dei metadata prevalgono sulla sequenza dei tasti e sul calcolo nominale.

A/B devono mantenere anche aspect/FOV/offset verticale/near-far/approach/surface e clamp effettivo della camera. Cattura PNG lossless più metadata dello stesso draw; camera/world match prima del confronto. Le due immagini richieste non saranno una qualifica globale delle3famiglie o del vicino.

**Gate artistico indipendente:** radice dell'incus e passaggio corpo→outflow più credibili in entrambe le viste; non basta spostare una mensola. FAIL/stop se U/uncino restano sostanzialmente uguali, manca beneficio oppure compaiono nuova parete, roof, cuscino, distacco o testa giovane inghiottita. Il vuoto intertorre non deve essere riempito per principio fisico: conta la composizione macro, non una somma di densità.

Solo dopo beneficio nelle prime due viste: vicino con matrice A congelata, semi77/80, guard delle altre famiglie e ulteriori gate previsti dal root. Nessun secondo modello/retuning suggerito da questa review. Revisore pronto alle PNG originali; nessun verdetto root richiesto prima del proprio giudizio.
