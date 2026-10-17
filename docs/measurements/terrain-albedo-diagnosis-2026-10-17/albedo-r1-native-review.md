# R1 — lettura visiva indipendente

Ispezionati il PNG albedo nativo2474×1844, il canonico ordinary di SHA90641c32…, e i quattro crop ordinary/albedo1:1. Nessun rendering, browser, modifica o nuova selezione. Il ritorno ordinary è ancora pendente al momento di questa nota.

1. **Gran parte delle scaglie scure si attenua nettamente.** Nella primaria la grande faccia scura a sinistra e vari piccoli tagli sui crinali perdono molta evidenza; nella secondaria la macchia triangolare sotto il crinale centrale/destra quasi non si legge più. La lettura è coerente con il calo di contrasto dei due campioni L2(.21062→.02087) e L3(.01885→.00477), ma non è una mappa quantitativa di tutti gli artefatti. Il contrasto fra i due campioni L1 resta quasi uguale(.08270→.08244): non estendo il comportamento delle altre coppie a tutta la primaria.

2. **Persistono campiture grandi e materiale poco differenziato.** Nell'albedo diventano più evidenti ampie superfici grigio/beige alternate a verde scuro, chiazze morbide e alcuni limiti piuttosto netti sui versanti. La grana non si legge come una tessitura rocciosa convincente. Questo non identifica bosco, roccia, colture o abitati: le etichette dei dodici punti sono soltanto storiche e la PNG non fornisce da sola una classificazione.

3. **Non emerge un rilievo più credibile dalla sola rimozione dell'illuminazione.** Profili, selle e disposizione delle dorsali coincidono; rimangono versanti ampi, levigati e arrotondati. Il chiaroscuro ridotto toglie parte del volume percepito e lascia un aspetto più piatto/cartografico. È un'ablazione diagnostica utile, non una proposta di materiale finale e non un PASS fotografico.

L'alpha completo uguale fra i due owner riguarda tutti i4562056 pixel e sostiene l'identità del payload distanza della vista, non l'identità del triangolo/caster o una causa di ogni macchia. Le immagini e i12 campioni non separano da soli NdotSun, normale di materiale e termine ambient. Mare/acqua interna restano illuminati per contratto; il controllo storico C1 mantiene i bit RGBA, senza generalizzare a ogni pixel d'acqua.

Fonti: PNG albedo3005033 B,SHA256 `5eb7d8bef55d6e707ee552bd2f0ed5f93b39d97dcaf4e69f7a3cd2033f0e0f2b` (hash riletto); canonico `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`. ROI primaria[0,560,1000,1000], secondaria[700,540,1030,780], come `browser/roi-ledger.json`; SHA dei quattro file riletto e coerente con il ledger. Una seconda lettura indipendente delle ROI ha osservato la stessa attenuazione delle macchie e persistenza delle campiture/morfologia.

I valori completi dei12 punti, l'identità dei metadati applicati e i limiti sono conservati separatamente in `albedo-r1-point-analysis.json` e `.md`, prodotti prima della lettura visiva. Nessun rapporto di luminanza viene convertito in esposizione o parametro da applicare al prodotto.

## Addendum — ritorno ordinary acquisito

**PASS dei gate diagnostici statici A ordinary → B albedo → A ordinary ricreato**, nella posa fissata. Non è un A/B/A prestazionale e non è un PASS fotografico.

- `ordinary-return-f32.json` riporta cached=fresh RGBA `e4435ce3a0a45e243c19dea24e5bc1133f6db1c8fd5ca168e94e644b1c6c9045`, identico all'A iniziale/canonico; statusCOMPLETE_IDENTICAL_F32,stable/cacheStateQualified=true. In tutti e tre gli owner cached/fresh hanno uguali digest RGBA, digest alpha e witness.
- Alpha completo di A/B/A: stesso `29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c`,18248224 B. Tutti i12 alpha bit coincidono fra i tre; il ritorno conserva tutte le48 parolebit RGBA, ID/UV/pixel e valori numerici di A.
- `ordinary-return-native.json` riporta PNG `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`,2909134 B,2474×1844. I campi scena/applicati confrontati A/ritorno sono esatti; differisce soltanto weatherTime fra i clocks(16.0191→142.8257). Console salvate albedo e ritorno: entrambe array vuoto.

Fonti aggiunte: returnF32JSON23863 B,SHA256 `1e1f59cfd983f05fc6d2cc983f0048e702561b681163a371cdcf19e24baa78de`; returnNativeJSON12485 B,SHA256 `00318965986735ee895f7d8e3cd632710217c5525ec94644998733498ddf14c0`. La nota numerica precedente resta il record della fase pre-return; questo addendum chiude quel requisito pendente senza riscriverla. Nessuna nuova GPU o causa globale dedotta dalla chiusura del gate.
