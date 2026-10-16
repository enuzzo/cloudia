# v48 — R8 soltanto nella variante pioggia

Candidata locale,non promossa. Cambiano soltanto GPUSceneEngine.ts e il suo
test lifecycle rispetto a v47; shader/helper/worker/UI restano identici.

La selezione R8 usa la stessa condizione di useNarrow,targetRain>.001 oppure
rain attuale>.001,e richiede un payload valido. Solo allora densityParameters
aggiunge la texture. Il materiale dry usa lo shader v46 esatto. Durante
l'asciugatura R8 resta attiva finché persiste pioggia sopra soglia; tornando
dry sparisce il binding ma la texture non viene distrutta.

Il report start/end distingue usoR8,stato dry con payload trattenuto e payload
mancante/non valido. Dry mantiene extraCpuPayloadBytes/extraGpuPayloadBytes:
16MiB nominali a256³,senza fingere una misura di upload/residenza GPU.

Mirati31/2,fullsuite230/34,typecheck e app→hero esterne tutti PASS.
Nuove build v48-dist e v48-hero; v47 fonte/build/prove conservati. Verificati
9 file frozen v47 e27 asset contro il manifesto precedente,senza differenze.
Node_modules ignore1 prima/dopo,Git ignored e zero file tracciati.

WGSL estratto dalla proprietà CPU FunctionNode.code in tre file v48-*.wgsl:
- dry v46 SHA d38fe3918e5cf95e2f13a1f6ca9a111a20045b2497600b89118cb7a8200bcb8c
- rain v46 SHA 6d30dc1d1ab7bc99513c451f4fcbdee81c402fe90220d565bb3a6df52c5cb655
- rain R8 v47/v48 SHA a18990471542f55f04269b3a0f525a49dc8ee6908828a552b1c3be50c4ef2e83

Non è compilazione/readback GPU. Le prove v47 comunicate dal root restano
storiche di v47; non costituiscono una misura FPS v48. Root qualificherà
transizioni,moto,worker e prestazioni. Nessun browser/GPU/commit dall'agente.

Patch incrementale v48-selection.patch; completa dalla base6a7df91
v48-vs-v46.patch. Hash e fonti in v48-build-provenance.json e v48-source.
