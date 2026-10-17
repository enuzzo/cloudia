# R1 — review statica prima della GPU

**Nessun blocker concreto individuato.** Review di soli sorgenti/test congelati; nessuna esecuzione di helper, test, typecheck, build, browser, GPU o modello. R0 e il suo FAIL restano separati e non vengono riqualificati da questo cambio.

- Il modo è un campo readonly0|1, assegnato solo alla creazione dell'owner. Albedo richiede insieme `profile=1&materialAudit=1&materialMode=albedo`; gli altri casi sono ordinari. Non resta un toggle né un'uniform di modalità. Ogni modo richiede quindi il proprio owner/pipeline.
- Il wrapper WGSL `terrainRasterColour` è tornato byte-identico al canonico:1068 B,SHA256 `ab6615fdad7ba034bd1f081806d8ee9716de2dff7073586c1887508a93211318`. Firme, chiamata e valori della cache sono quelli originali. La factory false/default ritorna direttamente `TERRAIN_SURFACE_WGSL`; true cambia soltanto la riga completa di `ground`, con controllo di occorrenza unica. Fallback e firme restano validi. Mare/acqua interna illuminati e blend costiero sono intenzionalmente conservati.
- Il modo immutabile è descritto in snapshot, firma dell'audit e contesto benchmark. La cache non deve distinguere cambi di modo dentro lo stesso owner perché non possono avvenire. In modo albedo sia `setButtonEnabled` sia `startBenchmark` bloccano le misure di qualità finale; acquisizione e audit restano disponibili con i guard owner/busy/pausa/assestamento/ultimo draw esistenti.
- Da ciascuno dei due readback già presenti si ricavano packed hash, intero alpha hash e12record. L'alpha copia byte12..15 di ogni pixel16B, senza conversione float o endian swap e senza nuova lettura GPU. Gli accessi relativi alla Uint8Array rispettano offset anche non allineati. Buffer fresh massimo24MiB da input massimo96MiB; nessun riferimento al full packed/source viene incluso nel report. Il costo CPU e la nuova allocazione alpha sono reali e dichiarati, non una misura FPS.
- Il selettore originale e i suoi quattro test restano invariati salvo l'import del nuovo helper. I due test alpha aggiunti coprono tutti i6pixel di una fixture3×2, origine righe, NaN/±0/infinito/parole arbitrarie, offset3, input immutato/non-alias e validazione di tipo/shape/caps. La seconda lettura indipendente della factory non ha trovato blocker.

**Gate successivo:** prima di interpretare albedo occorre verificare ordinary owner contro target canonico `e4435ce3…`, PNG proprietario `90641c32…` e12tuple/48parolebit storiche. La sola identità del testo non viene chiamata identità del compilato. Tra ordinary e albedo si confronterà inoltre il digest dell'intero alpha, oltre alle pose/metadati, essendo owner distinti. Non viene anticipato alcun risultato GPU.

SHA256 letti in `cycle34/albedo-source/src/cumulonimbus`:

| File | SHA256 |
|---|---|
| terrainMaterialDiagnostic.ts | a59fee9e58413cd479c7cd8a37073f40fb7d6ad14f07cd93b28133aecc81c9fe |
| terrainMaterialDiagnostic.test.ts | 3d4c70319fedcc6abfac42ff55afc0aea98ffa6e7f01eddf2fca91e8866c7d99 |
| terrainMaterialWitness.ts | 9ed3f42e8eb385c6a4ca9720bf51c100b35dc1c6e97043a266cd84048e315fbf |
| terrainMaterialWitness.test.ts | 1c7d5aad724e6938fb0ecdb2dfabd26e557476b7e90ec6b74070f2b2d94fe306 |
| GPUSceneEngine.ts | c5bd4440bc9a18725e9c7bcd473fd617fab05a393061976b262fe209d40ae79b |
| CumulonimbusApp.ts | e719baefc778d0166722b6dc78267bbac357a34c67578d2ead759b68bbdfc648 |
| sceneMarkup.ts | 69c3d57aec581f9b94dce885c6d908cca5d01cab82b3498cd7a2921f4002b6b0 |
| lifecycle.test.ts | d8a8df1a2d503908b74cac95f84c72e276fefb8da7e4cf58d2adfa14a9a20de9 |
