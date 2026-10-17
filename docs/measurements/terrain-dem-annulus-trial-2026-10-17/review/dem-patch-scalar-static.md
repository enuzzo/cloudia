# Patch DEM125m — review indipendente prima del solo scalare

17 ottobre2026. **PASS statico limitato; nessuna esecuzione del runner, mesh, modello, test, build, GPU o modifica prodotto.**

Freeze esaminato: `dem-patch-scalar/PRE-RUN-FREEZE.json`, SHA256 `fc5005ab2b685a6474665b525f0da7421f5f2825ea7e9b67360faa3b865e6e16`. Verificati per sola I/O21/21 pin byte/SHA, senza differenze; `run/` assente al controllo. Runner SHA `fce5b33c9fdb0b04dfbc42dca5bde573393a03b2d956b2867e9dd6cc178a018d`; launcher `ac1029af2aee3d481cc4a7765569bed81b8fcedb650602e6cc6aa38f1bc52188`.

- **Query diagonale corretta.** `terrainMesh.ts:141–145` ordina SW,NW,NE,SE e usa[0,1,2]/[0,2,3]. Sul nuovo reticolo125m i centri62,5m e gli endpoint sono esatti in binario: il lookup baricentrico canonico(:192–196) assegna½ a SW/NE e0 al terzo vertice. Il runner applica prima `Math.fround(terrainMeshSurfaceY(...))` a ciascun endpoint, come il buffer positionsFloat32(:158); la media corrisponde a quella superficie. Non sostituisce la sfera o il sampler con formule nuove.
- **Confronto esatto di scopo.** Sono i589.824 centri±48km di POINTS precedente (Z poiX), stessa reference bilineare+sfera F64 e stessa maschera canonica coast>=0. Il runner autentica run/resultA, sei digest geometrici dichiarati e SHA dello stream raw completo; poi usa soltanto il holdout4.718.592B dall’offset4.730.888. Non usa B31,25 né ricostruisce A. Il risultato salva tutti gli erroriF64 gzip e digest mask, non solo sommari.
- **Gate e limiti.** RMSland strettamente minore; p99/max assoluti globali non maggiori; p99=sortedabs[floor(.99*(n−1))]. Accumulo quadrati compensato, nessuna tolleranza. Un child10CPU/20wall, RSS Darwin terminale<=384MiB da wait4 sul PID; RSS è gate finale, non prenotazione o kill durante il calcolo. Cache esterna, no-install, pin e ignore1 prima/dopo, run esclusivo/no retry. Nessun blocker concreto individuato per l’unica esecuzione root.

## Fattibilità topologica successiva — un requisito bloccante pratico

La proposta archiviata `docs/measurements/terrain-grid-alignment-trial-2026-10-17/review/terrain-dem-node-patch-next-action.md` (SHA `fcdc0f093bce99d30ebbc1dc916b3b24c0bcaee1fef083dc796ebb71d08aa392`) non presenta un’impossibilità strutturale evidente. Core±48 su nodi125m; outer tagliato sulla linea canonica `C=Math.fround(94*.512)`; annulus conforme che includa tutti i midpoint del bordo esterno conservato. I bound dichiarati822.873V/1.644.720T/46.068.576B restano sotto1M/2M/64MiB; sono bound di payload, non costruzione misurata o piccoRSS. Normali incidenti sul raccordo da ricalcolare, senza identità shading promessa.

**Non lasciare il lookup attuale come se fosse drop-in.** `terrainMeshHitAt`(:173–201) sceglie ring/cella32m e range contigui `cellFirstIndex`; `TerrainMesh.surfaceY`(:484) alimenta il clamp camera in `GPUSceneEngine.ts:512`. Un core125m assegnato a una vecchia cella può dare hit errati/null; il null consente il fallback analitico di `landscape.ts:48–52`. Servono routing aritmetico core, piccolo indice seam e lookup canonico outer, con chiusura sui bordi e verifica che ogni punto del dominio abbia la faccia realmente rasterizzata. È il requisito da soddisfare nell’implementazione, già riconosciuto nella proposta; nessun secondo blocker trovato.

Un PASS scalare è soltanto potenzialità necessaria del centro-cella: non prova raccordo, lookup, errore continuo, normale, ombre, costoGPU o qualità fotografica. FAIL ferma la proposta prima della topologia, senza cambiare diagonale/risoluzione.

Fonti canoniche lette: terrainMesh SHA `00c170a8d4653817720b9dddc8eb10d647671128602dac55a1de52fe55216d72`; terrainDEM `335dfde27717448fa58b7e8d26fc4ce684a1d42ed6ead007f36fb345fe9dd386`; DEM `92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d`.
