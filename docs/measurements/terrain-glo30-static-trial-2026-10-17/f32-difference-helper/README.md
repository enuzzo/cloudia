# Confronto packed RGBA32F — helper puro CPU

`comparePackedRGBA32F(before:Uint8Array, after:Uint8Array, width, height)`.
File sorgente e7 test piccoli; nessun import Engine/Three, GPU o modello.
Non modifica i due input e non crea copie complete. Solo due DataView sopra
gli ArrayBuffer originali; rispettati byteOffset e lunghezza anche non allineati.
Buffer SharedArrayBuffer rifiutati; input normali in proprietà del chiamante,
immutabili durante il confronto. Se si parte da DataView, creare un view
Uint8Array dello stesso buffer/offset/length, senza copiarne i byte.

Contratto: payload tightly packed RGBA32F nell'endianness nativa dell'host,
come il compattatore di readback esistente. Endianness esplicita nel report.
Dimensioni intere1..8192, bytes esattamente width*height*16, massimo96MiB
**per input**. Nessun padding di riga. x/y sono indici nella sequenza packed
fornita, senza flipY o conversioni colore/depth.

Risultato deterministico:

- changedWords/pixels e conteggi separati RGB/alpha, più quattro conteggi canale;
- boundingRect minimo `{x,y,width,height}`, intervalli semiaperti, oppure null;
- maxFiniteAbsDelta globale/percanale solo dove ENTRAMBI i valori sono finiti;
  null se non esiste alcuna coppia finita,0 quando le coppie finite coincidono
  numericamente (può includere un cambiamento bit+0↔−0);
- NaN/+Inf/−Inf per ogni input, transizioni finite/nonfinite, coppie entrambe
  nonfinite e parole cambiate che coinvolgono nonfiniti; payload NaN confrontati
  come u32, non normalizzati dal passaggio a Number;
- signedZeroChangedWords esplicito;
- prime24 differenze PIXEL in ordine row-major, non le24 più grandi:
  x/y, maschera canali1R/2G/4B/8A, tutti i4u32 e4valori prima/dopo.

Nei soli esempi i valori nonfiniti e−0 diventano stringhe JSON esplicite:
`NaN`, `+Infinity`, `-Infinity`, `-0`; gli u32 conservano comunque il bit pattern
esatto. +0/−0 e NaN di payload diverso contano come cambiamenti anche con
maxdelta finita0/null. Ogni statistica nonfinite copre TUTTE le parole, anche
quelle bit-identiche. Nessuna soglia epsilon e nessun punteggio artistico/FPS.

Complessità O(width*height), memoria ausiliaria O(1) più massimo24 esempi.
Nessuna stima di tempo GPU o RSS. Per correlare differenze a pixel visibili,
root deve mantenere la stessa convenzione di orientamento del proprio packer.

Test: conteggi/box/max; offset nonallineati/padding/immutabilità; NaN payload,
±Inf/±0 e JSON; tutto nonfinite; limite24 e ordine; estremi Float32 finiti;
dimensioni/formato/cap rifiutati. Non usano readback o render.
