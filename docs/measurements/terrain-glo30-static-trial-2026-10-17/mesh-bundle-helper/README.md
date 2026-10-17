# TMA1 — bundle statico del terreno, proposta esterna

17 ottobre 2026. Solo codec e test sintetici: nessuna geometria reale generata,
nessun prodotto, build, browser o GPU modificato/eseguito. Non identifica ancora
un asset GLO30 o un URL runtime. La qualifica del modello/mesh resta separata.

## API

```ts
encodeTerrainMeshAsset(data: TerrainMeshData): ArrayBuffer
decodeTerrainMeshAsset(buffer: ArrayBuffer | Uint8Array): TerrainMeshData
loadTerrainMeshAsset(url: string, expectedSHA: string,
                     signal?: AbortSignal): Promise<TerrainMeshData>
```

Il type import `./terrainMesh` è soltanto statico. Il codec non importa Three,
non chiama il builder, non campiona DEM e non dipende dalla sua risoluzione.
Il loader usa `fetch`, stream e Web Crypto del runtime; non aggiunge dipendenze.

**Ownership:** `encode` produce un buffer nuovo e non modifica gli input.
`decode` consuma per contratto la proprietà dell'intero backing buffer: il
chiamante deve rinunciare a usarlo o conservarne alias. Le sei viste restituite
condividono quel singolo buffer e non fanno copie per array. JavaScript non può
imporre esclusività senza copia/detach; non viene promessa una protezione dai
chiamanti che violano il contratto. Anche una window Uint8Array con offset
allineato è ammessa; gli indici del formato sono relativi alla window. Un offset
non multiplo di quattro o SharedArrayBuffer è rifiutato.

## Layout Little Endian, versione 1

Header fisso di 128 byte, poi metadati UTF-8 `{stats: <stats originali>}`, padding
zero fino a multiplo di quattro, poi sei array nell'ordine seguente. Nessuna
quantizzazione: i bit Float32/Uint32 sono copiati direttamente. I numeri delle
statistiche seguono la rappresentazione JSON, non un formato floating binario.

| Offset header | Campo |
|---:|---|
| 0 | 4 byte ASCII `TMA1` |
| 4 | u16 versione = 1 |
| 6 | u16 dimensione header = 128 |
| 8 | u32 dimensione totale della risorsa |
| 12 | u32 numero di byte dei metadati |
| 16 | u32 numero descriptor = 6 |
| 20 | u32 riservato, zero |
| 24 + 16i | descriptor i: u32 ID, offset, elementi, byte |
| 120–127 | riservati, zero |

Gli ID 1–6 fissano tipo, ordine e significato: positions Float32 3V, normals
Float32 3V, surface Float32 2V, indices Uint32 3T, cellFirstIndex Uint32 C²L,
cellTriangleCount Uint8 C²L. Ogni array inizia allineato a quattro byte; tutti i
padding sono zero. I descriptor devono coprire il layout canonico contiguo:
overlap, riordino, gap, byte non reclamati, truncation e trailing sono errori.

`cellTriangleCount` può avere count zero solo senza raffinamento e torna
`undefined`; il consumer mantiene il vecchio calcolo 2/5. Se presente senza
raffinamento deve comunque contenere i conteggi originali. Con raffinamento è
obbligatorio. `cellFirstIndex` contiene offset dentro `indices`, già in unità di
elemento, non numeri di faccia: non deve essere moltiplicato di nuovo per tre.

Cap: 1.000.000 vertici, 2.000.000 triangoli, 64 MiB per i quattro array geometrici;
lookup C≤256, L≤9, C multiplo di quattro e ≥4; metadati ≤64 KiB con profondità e
numero di valori limitati. Sono ammesse fixture più piccole del profilo 256²×9.
I limiti e le formule delle lunghezze sono verificati prima di creare le viste;
la decodifica non alloca array geometrici in base a contatori arbitrari.

La validazione comprende valori geometrici finiti, normali unitarie entro .001
e Y positiva, quota non negativa e costa con segno, indici <V; celle-foro e
intervalli contigui che coprono esattamente gli indici. Confronta contatori,
byte, campioni, bounds e algebra del raffinamento con gli array e il layout.
Gli estremi di quota dichiarati sono confrontati dopo `Math.fround`, perché il
builder li accumula prima di serializzare Float32. Non è una prova che gli
array provengano da uno specifico DEM, né un audit di watertightness o qualità
geometrica: identità/provenienza dipendono dallo SHA atteso e dal manifest asset.

## Caricamento e cancellazione

`load` controlla lo SHA atteso (64 cifre hex), HTTP e dimensione dichiarata;
accumula solo i primi 128 byte prima di allocare il buffer totale bounded,
quindi copia i chunk nella risorsa una volta. Non trattiene un elenco di chunk
né una seconda copia intera. Header minimo/cap sono controllati durante lo
stream; lo SHA256 dell'intera risorsa è verificato **prima** di chiamare decode.
Nessun hash viene calcolato da encode/decode o per frame. Il runtime deve
disporre di Web Crypto, per esempio nel normale secure context dell'app.

AbortSignal è inoltrato al fetch; se abort avviene durante un read, il reader
viene cancellato e il Promise rigettato. Sono controllati anche gli abort prima
e dopo il digest (il digest già avviato non è interrompibile). Errori HTTP,
hash, stream, cap o formato sono espliciti; nessun fallback al builder o retry.
Il buffer caricato è di proprietà della mesh dopo il decode: deve essere
rilasciato con l'owner, senza cache globale implicita.

## Qualifica isolata

I test usano piccoli piani/stitch sintetici, mai il modello reale: roundtrip
bytewise e zero-copy; signed zero; offset allineato; rifiuto di header/layout,
truncation/trailing, cap, stats impossibili, indici/celle invalidi; conteggi
opzionali e raffinamento senza split; digest SHA256 reale e abort prima/durante
stream. Non misurano FPS, RSS reale o la qualità del terreno.

Harness esterno: `vitest.helper.config.mjs` forza Node e disabilita la cache;
`tsconfig.helper.json` usa `rootDirs` per il solo type import del terreno attuale.
`node_modules` è un symlink alle dipendenze esistenti, senza installazione.
Git ignore/non tracciamento e attributo Dropbox `com.apple.fileprovider.ignore#P=1`
sono verificati prima/dopo la qualifica. Il primo setup Python non disponeva di
`os.getxattr`: errore preservato in `qualification-setup-r0.json`, prima dei test;
la verifica usa poi il comando `xattr`. Nessuna dipendenza/lockfile è cambiata.

Log R1: 11 test PASS; typecheck iniziale FAIL per narrowing TS del helper
`fail` dichiarato con arrow. R2 cambia la sola dichiarazione in funzione `never`
e passa. Una successiva review indipendente chiude due verifiche delle stats
(greenFaces non negativo e conteggio nodi dal dominio); la qualifica finale è
registrata nei log e nel FREEZE, senza occultare i log precedenti.
