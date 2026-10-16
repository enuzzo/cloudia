# Verifica offline exportPNG nativo v57

**PASS del set di sei triplette PNG/metadati/transfer**, con cinque contenuti PNG e cinque bitmapRGBA unici. Una sola esecuzione del verificatore, nessun test/build/GPU/browser o nuovo campo eseguito. Pillow12.1.1 ha verificato la strutturaPNG e caricato interamente ogni immagine. Questo non costituisce visione artistica delle immagini.

| Artefatto | Dimensioni | Byte PNG | Parti UI | SHA256 iniziale |
|---|---|---:|---:|---|
| main74-near60-sun-1280x720 | 1280×720 | 806,716 | 17 | `aee8f81aec6abd38…` |
| main74-near60-sun-native | 2474×1844 | 3,434,897 | 70 | `6251d0458628d4e0…` |
| main74-near95-sun-native | 2474×1844 | 1,083,466 | 23 | `28c99564f6c44fb5…` |
| main74-rain-terrain-native | 2474×1844 | 2,508,514 | 52 | `a913ecef59dc60d1…` |
| worker74-near60-sun-native | 2474×1844 | 3,434,897 | 70 | `6251d0458628d4e0…` |
| main74-sun-terrain-native | 2474×1844 | 2,817,764 | 58 | `af8877ac93db6fcd…` |

Payload PNG complessivo14,086,254B; la copia worker ripete gli stessi3.434.897B della mainnear60. Nessuna deduplicazione o modifica degli originali è stata fatta qui.

Controlli per ciascuna immagine: firma eIHDR,dimensioni e limitepixel,limite32MiB,MIME,byteLength eSHA256 controJSON+transfer; Pillowverify+load; canvas/output/internal coerenti e viewportDPR quando screen; qualitàultra384,macro256³/detail128³ eflow16³; camera finita,ortonormale e rivolta al target; scena74/t60/paused/full/atmosfera stabile; ledger parti contiguo e lunghezza `22+4*ceil(bytes/3)`. Il protocollo include la sesta vista Sole mediante amendmentBeforeSixthCapture: non è stato riscritto per fingere una posa preesistente. La coda di rain sotto0,001 nel presetSole è ammessa perché è la soglia effettiva del ramo dry; i valori originali restano nel DTO.

**Main/worker near60 native:** camera,stato materiale,meteo,luci,qualità e clock uniform applicati equivalenti; PNG SHA e pixelRGBA decodificati identici. Esclusi correttamente captureId/requestId,timestamp/counter/timeOrigin dell’owner,weatherTime e identità locali delle texture cielo. L’identità riguarda soltanto queste due bitmap esportate, non ogni frame/worker o bufferFloat32/compositore.

**Due pose main:** near60 e near95 hanno origine diversa e differiscono sia i bytePNG sia i pixelRGBA decodificati. Non è soltanto un cambiamento di compressione o di metadati PNG. Il contenuto e il dettaglio percepito devono comunque essere valutati guardando le PNG.

**Terreno Sole/Pioggia:** stessa camera,dimensioni,qualità e stato materiale registrati; i percorsi meteo/luci/aerial cambiano intenzionalmente. Il ramo densità è macroRGBA8 aSole edR8 inPioggia,come dichiarato. Il confronto non attribuisce causalmente le macchie a geometria,normali o ombre.

**Provenienza:** schema manifest è un dict di124file (non123),SHA `8dce2ed7a5843104c3b606c4223435d69408d43739712b1f722c7a1fa8a348f2`; verificati byte per byte tutti124 della snapshot native-export-source e30dist. Manifest dist `e976624d4f710cd21dde34352a918a08ac68f31d245932f4dfd0920dcf4e2983`. I risultati già salvati confermano378/378 test in45file e typecheck/APP/hero exit0; nessuna suite è stata rieseguita. Il contatore Vitest101 include gruppi/suite e non va confuso coi45file.

**Clear/console disponibili:** i JSON salvati per main720 eworker registrano textarea vuote,hrefnull e capture riabilitata; il recordworker contiene logs[]. Queste sono osservazioni del collector, non nuove azioni del verificatore. Controlli ordinary/preview e consolemain ulteriori, se raccolti dopo, vanno documentati separatamente: non li si deduce dal decodePNG. La prima provaR1 resta REJECTED_TRUNCATED_TEXT_NO_PNG_SAVED; il successivo recupero valido non cambia retroattivamente il vecchio trasferimento.

**Limite di riproducibilità UI:** le stringhe delle290 parti non sono duplicate nell’archivio. Lo script verifica gli originaliPNG e l’aritmetica del ledger, ma la provenienza da soli controlli visibili resta il record del collector e la relativa cronologia UI; non viene rigiocata offline. Nessuna provaFPS,paritàHDR/float,pixel fisici del monitor o PASS artistico nasce da questo controllo.

Comando eseguito dalla cartella del verificatore:

```sh
python3 verify.py --root .. --require-worker --runtime-source ../native-export-source --dist ../native-export-source/dist --output verification.json
```

Per ripetere senza creare un file nuovo, omettere --output. Le opzioni source/dist sono facoltative: senza di esse si verificano i manifest ed i risultati salvati, ma il report dichiara esplicitamente che i byte dei sorgenti/dist non sono stati riletti. Il pacchetto è portabile con --root; nessun percorso assoluto esterno è incorporato nello script.
