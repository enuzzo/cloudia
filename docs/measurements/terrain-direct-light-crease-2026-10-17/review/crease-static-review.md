# Crease normals — review statica indipendente

17 ottobre 2026. **Nessun blocker concreto rilevato nel contratto dichiarato.** Solo lettura di helper/test congelati, integrazione esterna terrainMesh e witness/wrapper preparati da root. Nessun test, import eseguito, mesh, modello, bake, GPU, browser o modifica sorgenti. Il PASS è della revisione statica; esecuzione bounded e gate visivo restano necessari.

## Algoritmo e topologia

- `terrainCreaseNormals.ts:59–71`: CSR corretto. Le occorrenze dei corner sono contate prima del prefisso; il limite valenza usa il conteggio originale. L'inserimento scorre i corner in ordine di indici, quindi conserva l'ordine originale delle facce a ogni vertice.
- `:118–132`: la condivisione del solo vertice non basta. Il secondo indice comune identifica un edge effettivo; l'union-find collega componenti tramite angoli compatibili. La radice minima e la visita stabile rendono deterministici i gruppi e i nuovi ID.
- `:90–101`: confronto angolare squared coerente anche oltre90°; casi0/90/180 espliciti. Per45° cos²=.5 include il wedge esatto senza epsilon adattivo. Overflow/degenerazione falliscono esplicitamente.
- `:134–155`: gruppo unico conserva le normali originali; componenti separate ricevono somme Float64 dei vettori area nello stesso ordine delle facce. Duplica soltanto position/surface del vertice interessato, mantenendone i bit; cambia normale e riferimento di quel corner. Non modifica gli input, ordine/winding delle facce, numero di triangoli o coordinate per-corner.
- Integrazione `terrainMesh.ts:354–365`: l'opzione è limitata a normalMode geometry. cellFirstIndex/cellTriangleCount sono riusati; il lookup heightAt usa gli indici nuovi con le medesime coordinate dei corner. La continuità geometrica è conservata anche quando i vertici coincidenti non condividono più la normale. Caster/receiver position, DEM e materiale WGSL non sono sostituiti dal helper.

**Limite semantico rilevante:** gruppi edge-connected sono transitivi. Un edge più ripido della soglia può rimanere raccordato a un endpoint se un fan alternativo di edge dolci riconnette le facce (`:29–33`; test hard-adjacency). Non è un bug rispetto a questa API, ma non si deve descrivere il trial come separazione di tutti gli edge>45°. Non prova che45° sia una soglia fisica o artisticamente utile. Il helper non certifica manifoldness: per geometrie non-manifold collega le coppie compatibili che condividono quell'edge; qui la sorgente è la mesh terrain già costruita.

## Limiti e memoria

Cap verificati prima delle grandi allocazioni pertinenti:700.000vertici/1.300.000triangoli, valenza128. Il cap output viene verificato per ogni split prima di assegnare nuovi ID: nessun troncamento/fallback. Scratch è CSR + vettori area + piccoli array locali; nessuna edgeMap globale. La ricerca locale costa Σ d(v)(d(v)−1)/2 test: finita e limitata dai cap, ma **non garantisce20s**. Al massimo dichiarato, il bound grezzo è247.650.000 coppie; non è una previsione della mesh reale.

Accounting `:159–177` coerente: capacità output =32B×capacityVertices + una sola copia indici; slicing finale aggiunge le tre attribute arrays esatte, senza contare due volte l'index condiviso fra capacity/result. `nominalOwnedPeakTypedArrayBytes` è payload dei typed array posseduti dal helper durante il ritorno: **esclude gli input presi in prestito, oggetti JS, GC, allocator e RSS del processo**. La distinzione è già nei commenti, da preservare nel report. Nessun nuovo lavoro per-frame è introdotto dal calcolo statico; numero di vertici GPU e costo reale cambiano e restano da misurare.

## Verifica preparata e scope

Gli8 test piccoli coprono piano/bit, wedge duro,45° incluso, vertex-only, transizione lungo fan, hard-edge riconnesso, cap e input invalidi. Sono stati letti, **non eseguiti da questa review**. Il witness root confronta prima/dopo i4 digest storici v59, ogni corner position/surface, numero indici e normali finite/unitarie. È il controllo pertinente prima della GPU; non certifica immagine, tempo GPU, miglioramento delle chiazze o60FPS. Wrapper20s CPU/40s wall con gate terminaleRSS2GiB: un cap di accettazione, non un hard cap di memoria né un tempo garantito dall'algoritmo.

## Freeze letto

- `terrainCreaseNormals.ts`: 11259B, SHA256 `52e5b8e20e9db3d2f6187e47631aac5115755fbdf368acb03545756638b00297`.
- `terrainCreaseNormals.test.ts`: 7296B, SHA256 `e2be4755ad11eaa4e6103f3e1fa8df67e203e06d5c42b45651962d559daa68bc`.
