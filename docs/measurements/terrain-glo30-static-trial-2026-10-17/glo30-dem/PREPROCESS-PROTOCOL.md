# GLO30 → CDM1 62,5m: protocollo prima del run

Autorizzato da root17 ottobre2026. Nessuna mesh, GPU o modifica al prodotto.
Quattro originali AWS COG release2021 espliciti N43/N44×E009/E010, token10.
Acquisizione: massimo120MiB totale tile,60MiB singola,90s singolo/240s totale;
nessuna sostituzione GLO90 né retry implicito. SHA256 di tutti gli originali.

Output2049² nodi con estremi inclusivi X/Z±64km e passo0,0625km.
Stessa proiezione del vecchio asset: lat44+z/111.1950802335,
lon10−x/(111.1950802335*cos44°); X Ovest,Z Nord. Quote EGM2008 in metri,
nessuna aggiunta di geoide, esagerazione o noise. DSM, non bare-earth DTM.
Mosaico PixelIsPoint7200², bilineare unico senza+.5, NoData dichiarati rifiutati.
Nessun overview medio: usare il livello base3600² di ciascun TIFF.

Stesso metodo attuale: Hnegativa clamp0, H<0,5m connesso al bordo4-vicini
è oceano e viene posto a0. Coast nuova = distanza euclidea esatta al centro
del campione di classe opposta, meno mezzo passo31,25m, segno positivo terra.
È una maschera derivata, non costa vettoriale o bathymetry.

Due CDM1 con IDENTICI codici H: (A) coast ricalcolata62,5m; (B) coast vecchia
125m bilineare sui nuovi nodi e requantizzata a8m. B non conserva bitwise il
vecchio campo continuo; riportare errore al nodo≤4m e confronto off-node
prefissato. Per il futuro builder usare height/slope da nuovo grid e coast
direttamente dal vecchio sampler, senza pretendere identica interpolazione
della maschera dopo il cambio dei triangoli.

CDM1 header32B LE: magic/side/spacing/minX/minZ; poi u16H×0,125m e i16coast×8m.
Ogni asset16.793.636B. Quantizzazione H≤0,0625m e coast≤4m; nessuna saturazione.
Sorgente nonfinita/NoData, quote>3310m o seam discontinuo oltre1cm fanno FAIL.
Confronto nuovo[::2,::2] con vecchio1025²: coordinate esattamente coincidenti,
stessa origine/estremi; signed/RMS/min/max e terra/mare secondo vecchia coast.
Differenze tra DSM non sono errori contro un rilievo indipendente.

Holdout prefissato:384²=147.456 centri, x/z=−48+(4*i+0,5)*0,0625km,
i0..383, ordine Zsouth→north e Xeast→west. Float64LE in metri dei campioni
bilineari GLO30 nativi sul mosaico originale, PRIMA di clamp/ocean mask/quantizzazione.
Non passare dal nuovo raster62,5m. Primi/ultimi−47,96875/+47,78125km, stride250m.
Lo stesso holdout confronta coast125m originale vs coast requantizzata per
documentare l'errore off-node (rispetto al grid62,5m); nessuna scelta posthoc.

Preprocess una volta, non modello terreno: budget180sCPU/240swall, gate RSS2GiB
tra fasi e terminale; nessun hard-interrupt RSS dentro un decoder o numpy.
Stream input SHA, controlli20centri originali/5corner+origine/seam/codici,
tiny oracolo EDT105nodi prima del run grande. Nessun test/build/app/render.
Conservare bin/gzipmtime0, report, input/license/script SHA; originali e partial
non eliminati. Ogni FAIL resta conservato, nessuna ripetizione automatica.
