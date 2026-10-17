# Sezione storica a64³ — diagnosi dal sorgente e tre keyframe salvati

17 ottobre 2026. **Conclusione: regressione geometrica compatibile con la sostituzione pianificata; non un effetto del pruning della luce.** Nessun errore concreto d’integrazione trovato nella lettura, ma i soli dati salvati non separano quantitativamente ritiro dei collar, rimozione14.1, errore di approssimazione, discretizzazione ed erosione. Non trasformo questa diagnosi in un’esenzione dal test: il FAIL rimane e non va nascosto cambiando aspettativa.

Letture: `continuous-source/src/cumulonimbus/volume.ts`, `inclinedShoulder.test.ts`, `preflight-r2/result.json`; log completo `run/R2A-full-tests.log`2161B SHA `fa4ea808740b5ccf70fe5d926bee042461f9a21581337c5f9b21fba92e73e1f4`,589/590. Nessuna nuova generazione/prefix/helper invocation/rumore/volume/test/GPU. Ho effettuato soltanto algebra su tre keyframe già salvati, due interpolanti a t=.5 e l’interpolante neck→top alla Y del test; dettagli in `section64-keyframe-scalars.json`.

## Perché il support-prune è escluso causalmente

Il test chiama `sampleCloudDensity(volume,volume.detail,x,y,z,ice)`. A `volume.ts:101–117` questa funzione legge esclusivamente envelope R e detail RGB. `dataR` è quantizzato e scritto a484–485, prima del loop di support-prune493–500. Quest’ultimo riusa `density` per i bake della luce e scrive soltanto G/B/A e sunset a501–513. `bakeOccupancy` modifica detail A, che quel campionatore non legge. Quindi un errore del support-prune può compromettere luce/occupazione, **ma non può azzerare la densità restituita da questo specifico test**.

La banda del nuovo raster è una questione distinta: a64 il wrapper usa b=.522414668447555 e tolleranza campo .013671875. Il floor è negativo; non tronca intenzionalmente un kernel positivo. Il punto è dentro la box positiva globale salvata del loft. Il tiny confronto AABB/scanline passato è ulteriore evidenza contro una semplice perdita sistematica della traversata, non una prova esaustiva di ogni voxel della ricetta64. Non è stato ripetuto alcun raster per chiudere quest’ultimo limite.

## Cosa dicono realmente i keyframe

Sezione fissata dal test: x=.5609226029381325,y=4.0458440042043025,96Z prefissate. Keyframe canonici contratti salvati: neck `[-.2272187499071064,3.8957850052633507,−.3413771115830025]`; top `[.04280943884321254,4.609379100715798,−.3413771115830025]`; cap `[.7617447139716137,5.110570309875346,−.21269783235155046]`. I6parametri completi sono nel JSON scalare, identici ai dati del preflight.

Per un singolo kernel, il massimo su **tutte le Z** a quella X/Y si calcola esattamente come `min(r)*(1−sqrt(((x−cx)/rx)^2+((y−cy)/ry)^2))` e cade a z=cz. Risultati, in unità di campo km, non densità:

| Kernel/interpolante prefissato | Miglior valore possibile lungoZ |
|---|---:|
| neck salvato |−.04911085310460049|
| top salvato |−.00913962873859855|
| cap salvato |−.6901456905930692|
| metà neck→top |+.06834179124750321|
| metà top→cap |−.24312222771426464|
| neck→top con centroY uguale alla Y del test, t=.21028621158336283 |+.010586118298710668|

Quindi **nessuno dei tre endpoint da solo contiene la sezione a quella X/Y**, per qualunque Z. Il continuo può comunque aggiungere campo positivo fra neck e top: il midpoint lo dimostra. Sarebbe sbagliato dire «loft geometricamente vuoto» o usare questa tabella come massimo dell’intero inviluppo. La tabella mostra però che il punto storico è sul fianco esterno del nuovo percorso e che l’occupazione intermedia non garantisce profondità sufficiente dopo bias/carving e fine erosion.

Il nuovo operatore non domina il vecchio campo:273 primitive dei collar vengono ritirate, la14.1 è rimossa e i keyframe nuovi non sono i suoi vecchi anchor (14.1 usava start foundation→top al68% ed end cap.x+.28*cap.rx/cap.y−.1*cap.ry). Conservare le tuple neck/top/cap non conserva il supporto di quella massa inclinata. Carving, soglia e fine erosion non sono stati adattati al nuovo campo. Questo rende la perdita della sezione **una regressione plausibile e coerente col cambiamento strutturale scelto**, non una prova di un bug nella banda della luce.

Restano non misurati il massimo esatto del loft lungo l’intera sezione, i suoi voxel64/warped lookup reali e i contributi rimossi a quei punti. Senza tali dati non attribuisco percentuali o una causa esclusiva fra i fattori geometrici/discreti. Non eseguo nuove ricerche di parametri né suggerisco di spostare la sezione del test. Il FAIL a64 non prova da solo un FAIL fotografico a256; quest’ultimo è stato valutato separatamente sui PNG salvati.
