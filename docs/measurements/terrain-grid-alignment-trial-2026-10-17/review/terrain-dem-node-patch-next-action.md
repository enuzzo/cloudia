# Patch sui nodi DEM: prima un controllo scalare necessario, senza costruire mesh

17 ottobre 2026. Proposta read-only successiva al FAIL A32/B31,25, conservato integralmente. **Nessuna implementazione, nuovo spacing, modello, build o GPU eseguiti.** Il prossimo passo non è ancora un trial topologico.

🌟 **Primo passo concreto: protocollo e budget prima dell'unica esecuzione root.** Misurare la sola potenzialità del holdout di una patch uniforme125m, con diagonale SW→NE e gli stessi589.824 centri/mask già congelati in `terrain-grid-audit/POINTS.json`. Ogni centro cade sulla diagonale della sua cella. Per ciascuno dei due endpoint opposti usare esattamente `Math.fround(terrainMeshSurfaceY(x,z,hDEM))`, come il `position.y` canonico Float32; la quota interpolata al centro è la loro media. Il riferimento resta `terrainMeshSurfaceY` sul bilineare canonico al centro. **Non sostituire questa trasformazione sferica con una formula nuova.** Si ottengono errori F64 confrontabili con A senza costruire patch, seam, normali, indici o frame.

Applicare la parte **holdout** dei criteri già congelati da root su RMS land e code/estremi: se manca il guadagno RMS o peggiorano p99/max richiesti, stop prima del codice topologico. Non cambiare diagonale, punti o algoritmo per passare. Il fit sui nodi sarebbe quasi nullo per costruzione, ma non prova il holdout: già nel piano, due triangoli restituiscono al centro `(hSW+hNE)/2`, diverso dal bilineare di una cella non planare. Questo controllo è necessario, non sufficiente; non qualifica vicino, bordi, ombre o fotografia.

**Fattibilità topologica entro i cap, soltanto se quel controllo giustifica proseguire:** core chiuso±48km su769² nodi, due triangoli per ciascuna delle768² celle; nessun fan a quattro facce. Raccordare il suo bordo alla linea canonica ring4 con indice94, cioè agli **actual Float32 vertex coordinates** `C=Math.fround(94*.512)` (~48,127998km), senza promettere48,128 esatto. Conservare la geometria canonica fuori C, inclusi i green già esistenti; ricomporre soltanto la fascia48→C.

| Componente | Vertici | Triangoli |
|---|---:|---:|
| Core125m |591.361|1.179.648|
| Outer canonico conservato, limite superiore |231.512|460.496|
| Seam fra i due bordi, senza vertici interni nuovi |0 aggiuntivi|≤4.576|
| **Totale superiore** |**822.873**|**1.644.720**|

Derivazione: outer base ha31.080 vertici ring4 più4×49.920 dei ring5–8, e60.384+4×99.840 triangoli. Al bordo ci sono752 edge canonici; la singola passata può aggiungere al massimo752 midpoint/green esterni. Bordo core:3.072 vertici; bordo outer:≤1.504. Un annulus triangolato conforme senza vertici interni ha `T=Ninterno+Nesterno≤4.576`. Payload `32V+12T≤46.068.576B` (~43,94MiB), sotto1M/2M/64MiB. Lookup, temporanei e RSS non sono compresi né misurati.

**Lookup non drop-in:** l'attuale `terrainMeshHitAt` ricava il ring/cella dalla griglia32m e da range contigui ([terrainMesh.ts:173](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/terrainMesh.ts:173)). Serve un caso aritmetico core125m con due facce, un piccolo indice statico per il seam e il lookup canonico fuori C; non assegnare una faccia125m soltanto a una vecchia cella32m. Il seam deve includere tutti i midpoint del bordo conservato per evitare T-junction. La geometria esterna può restare esatta, ma le normali incidenti sul nuovo raccordo vanno ricalcolate: nessuna promessa di identità dello shading al bordo. La politica geometrica delle normali e il sampler rimangono quelli canonici.

Il conteggio è un bound di fattibilità, non un risultato di costruzione o costo. Un successo scalare non basta per promuovere mesh/GPU: occorrono implementazione e verifica del raccordo/lookup e budget reali. Questa è l'unica direzione proposta, senza un'altra ricerca di risoluzioni.
