# R2 actual mesh — review numerica indipendente saved-only

17 ottobre2026. **NUMERICPASS; qualifica complessivaFAIL per memoria. Nessuna adozione/GPU/retry.** Nessuna nuova source-eval, sfera, sampler, mesh, modello, test o build. Sola analisi dei due streamF64 e dei record salvati; maschere da nodi coastDEM e quattro codici al centro, stessa fonte e segno>=0.

Gli input actual sono ora conservati in `revisions/r2-resource-fail/mesh-witness/run/{A,B}`: verificati anche dopo lo spostamento i due SHAresult e gzip, identici ai dati analizzati prima. Araw `ef4836da…2189d` coincide con l’intero stream canonico e il fitstorico; Braw `ff89b192…a461f` contiene tutti1.181.185erroriF64. Nessuna regressione locale scartata.

| Gate | A | B | Esito |
|---|---:|---:|---|
| Fit RMSland(m) |11.641356606813309|4.900162232700192|PASS|
| Fit p99abs globale(m) |36.111329337759734|17.45730365128484|PASS|
| Fit maxabs globale(m) |96.06550239192968|68.53439660095573|PASS|
| Holdout RMSland(m) |7.386759891967312|3.3821611657065103|PASS|
| Holdout p99abs globale(m) |25.00927650918605|10.406288282261755|PASS|
| Holdout maxabs globale(m) |87.02977014615732|29.6560186900221|PASS|

P99sortedabs agli indici585446fit/583924holdout; RMS con math.fsum dei quadrati. Maschera fitland334589/holdoutland334018.

Le prime quattro bande fisicheA già congelate sono **byte-identiche F64 in ogni punto**:275625nearfit e274576nearholdout; RMS/p99/max e tutti i loro punti rimangono quindi identici. Nella quinta banda32,768–48km: fitlandRMS14.011065196→.000089889m, holdout9.574390118→3.973938561m.313148farholdout oltreJ coincidono esattamente con lo scalare precedente (delta massimo0m). I2100holdout nella fascia interna sono misurati, senza inventare un’equivalenza allo scalare.

Regressioni conservate: fitland190054migliori/**2peggiori**/144533uguali; globale315709/27/275625. Peggior aumento landfit+.000146912m. Holdoutland136412migliori/**53430peggiori**/144176uguali; globale261501/53747/274576. Peggior aumento landholdout+26.717804014m aXZ[−33.0625,−.6875]: A+2.938214676m, B−29.656018690m. Beneficio aggregato reale su questa reference non significa miglioramento di ogni punto.

Confronti che il launcher non aveva raggiunto per il FAILrisorse, ora verificati dai JSONsalvati: fingerprintXYZsurface esatti per620910inner e460149outer facce, più5queryinner e5outer esatte.32oracle seams completi, maxdelta4.440892098500626e−16km. Recordtopologia: tutti i vertici usati,1024edgeesterne,Euler1. Non è una nuova esecuzione degli invarianti.

Costi registrati separatamente: A3.666785CPU/3.331050458wall/1196032000BRSS; B6.912233CPU/6.295945250wall/**1740881920BRSS**, terminal0 ma oltre cap1610612736B di130269184B. Il picco riguarda tutto il child(builder+verifiche+salvataggio), non isola il builder né misura residencyGPU. Il launcher resta **FAIL_STOPPED**: la verifica indipendente saved-only non trasforma il comando inPASS né completa retroattivamente il controllo inputpostB non raggiunto. Nessun aumento del cap o nuovo run da questa review.

Bpayload osservato858119V/1715212T/48042352B, lookup3060396B e1498885sampleCalls: entro i capgeometrici, distinti dal FAILRSS. Reference dello stesso DEMbilineare, non ground truth indipendente, errore continuo o artPASS. Tutte le5bande/all/land, digest e conteggi sono in `source-patch-r2-saved-data.json`34398B,SHA `f70c998c8d4a9b253efc8594816e785c80b70d7a4c7387193f3e8220810a8516`.
