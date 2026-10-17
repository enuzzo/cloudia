# Cloudia — normali e fattori di luce del terreno

17 ottobre 2026, ciclo41. **Diagnostica qualificata; prodotto v61 invariato, fotorealismo ancora aperto e goal attivo.** La scelta dell'utente è conservare la geografia reale quando non richiede lavoro aggiuntivo per gli FPS. Le aree abitate restano nella stessa texture del suolo, senza edifici3D, nuova geometria, campionamenti o pass aggiuntivi dovuti alla loro presenza. Non è una misura di costo esattamente nullo, né una promessa di60FPS in ogni meteo.

## Che cosa è stato letto

Owner esterno `diagnostic-v61-shading-ledger-r1`, base prodotto commit `8a9535f9cb849292f5dd868020ef7f514567109a`. I141hash prodotto restano quelli del manifest `2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73`. Nessuna modifica al materiale ordinario, alla sua costruzione/nodo, a geometria, shadow, asset o qualità.

Dodici pixel storici, stessa camera/Sole/seed74/t60 fermo, output2474×1844,256³/128³/384/fullflow. Tre materiali diagnostici clonati separati restituiscono normale macro firmata, normale dopo il dettaglio e `(D,S,V)`: diretto Lambert, proxy cielo e visibilità solare. Cambia soltanto il return finale della libreria. Nessuna uniform mode aggiunta al materiale ordinario. Il compilatore può eliminare operazioni diverse: non è identità della pipeline ordinaria né una misura del suo costo.

Tre draw nel BBOX fissato x64/y610/w2137/h491 (1.049.267pixel),36copie RGBA32F1×1/576B nominali restituiti. Target e mesh già installati. Nessun target grande o rebuild del modello durante l'audit; il viewer inizializza normalmente il proprio terreno all'avvio. Clear sentinella(-8192,-8192,-8192,1), distanza positiva/finite e controllo dei bit alpha contro i receiver ordinari. Ripristino materiale e redraw ordinario completo, con invalidate colore+shadow, prima di qualsiasi await; ripristino indipendente degli stati renderer/target/scissor. `allSettled` di copie e drain prima del dispose dei cloni. Lifecycle riserva la Promise prima dell'esecuzione e attende l'audit prima del teardown; cambi di generazione scartano il report tardivo.

Le letture intere cached/fresh/restored sono sequenziali e soggette al cap96MiB packed; non vengono conservati tutti i buffer interi. Peak GC/allocator/driver non misurato. Three r186 può saltare il destroy interno dello staging buffer se mapAsync rigetta: il drain delle Promise non certifica deallocazione in quel caso. Nessun errore osservato in questo run.

## Parità e provenienza: PASS

- Tre target interi Float32: **`07fa43ec5de6d77b9bdf83d5a78e73cb607ae573d875ce382b3c28f909fb2fb9`**, identici alla v61.
- Alpha su tutti4.562.056pixel: **`29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c`**;36/36parole distanza diagnostiche identiche ai dodici receiver ordinari.
- Quattro array CPU attualmente installati hashati, senza rebuild: posizione7.101.456B, normali7.101.456B, surface4.734.304B, indici14.190.600B; tutti corrispondono ai quattro digest canonici. Non è un readback dei vertex buffer GPU.
- Nuova acquisizione PNG dopo il ripristino:2474×1844/3.599.836B, **`6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9`**, identica al bitmap v61 già salvato. Metadata freschi e bitmap originale rihashato: nessun duplicato base64 ritrasferito.
- Cache/input/restore/drain qualificati, tre draw diagnostici e uno ordinario di ripristino. Console osservata vuota. Protocollo e freeze144sorgenti `f9c855d5ca1c52d710521b28b05c29be1c00a101d10cea2dab3b445f805bcd1a` precedono il run integrato.

Riferimento storico CPU: dodici face/corner/receiver, camera e Sole esatti rispetto alla posa v61, blocco builder/lookup/camera e dipendenze autenticati. Il report browser storico non hashava i quattro array e la ray query CPU non certifica il primitive winner GPU. I nuovi hash migliorano la continuità del contenuto CPU, senza annullare quel limite. La normale vertex CPU interpolata e normalizzata concorda con la macro GPU entro1,86e−5 per componente; non emerge un upload sbagliato.

## Che cosa indica il campione

I nomi artifact/control sono etichette storiche, non una classificazione di macchie scure nella v61. L1 eL2 hanno oggi Y maggiore nel punto artifact; L3 minore. Analisi offline indipendente:80gatePASS, errore massimo di lunghezza normale7,07e−8 e residuo fra D letto e max(dot(n,Sun),0)1,73e−8.

| Coppia | D artifact / control | S artifact / control | V artifact / control | Y artifact / control |
| --- | ---: | ---: | ---: | ---: |
| L1 | 0 / 0 | .870625 / .875072 | 0 / 1 | 1,15144 |
| L2 | .211666 / .101502 | .864901 / .866535 | 1 / 1 | 1,42480 |
| L3 | 0 / 0 | .843512 / .884390 | 1 / 1 | .94761 |

Il dettaglio sposta le normali al massimo0,1088° nei12punti e0,0492° nei seiL; nessun attraversamento dello zero diretto. Non giustifica una nuova regolazione della roughness. L1 eL3 hanno D0 in entrambi i membri: cambiare V non può modificare quel termine diretto, anche dove V diL1 è0. Materiale/ambiente e trasporto restano da separare; non è un'attribuzione di tutta la fascia.

A L2 la differenza del diretto è già nella normale macro, rapporto2,0853. Le facce CPU storiche hanno ordine opposto, dotSun~.048157/.257960; le loro normali vertex interpolate predicono invece la macro GPU. È coerente con lo smoothing previsto, senza dimostrare un bug o che usare facce piatte migliori la fotografia.

**Nessuna correzione globale adottata da questi soli dati.** Niente nuovo bias, angolo crease, intensità rough, palette o gain. Le fasce dei crinali e la credibilità complessiva restano aperte.

## Prossimo confronto concreto, non ancora eseguito

Una sola variante esterna: sostituire esclusivamente D con il Lambert della normale geometrica del fragment ricavata da derivate di posizione, orientata Y+ per questo heightfield senza overhang. Derivate fuori da branch, normalizzazione protetta e fallback macro per degenerazione; nessun blend/cap da adattare all'immagine. Conservare macro/albedo/S/rough/materiale/WorldCover/UV/geometry e tutto il resto. È distinto dal crease45° respinto: non cambia gruppi di smoothing o vertex buffer.

Predizione locale: forte cambiamentoL2, D ancora0 aL1/L3. Il rischio di introdurre facce/diagonali è concreto. Prima ordinary bit-exact, poi una sola candidata nativa e ritorno A, stesse ROI1:1 e review indipendente; FAIL/stop se nuove facce artificiali o nessun beneficio. Nessuna adozione o serie di angoli/tuning implicita. Worker/meteo/moto/FPS soltanto dopo un eventuale gate visivo positivo.

## Verifiche e continuità

**600test/55file, typecheck e build APP PASS** sul freeze. Test nuovi: helper14, probe mock13 e lifecycle12; nessun modello reale o GPU nei test del probe. Hero non ricompilata in questa diagnostica, nessuna modifica prodotto da qualificare lì. Nessuna misuraFPS questo ciclo. I precedenti ABA Sun vicini a60 restano limitati a quelle prove; pioggia pesante~19invii/s precedente non rimisurata.

Preview ordinaria4196 ripristinata: v61/Sole/nube matura animata,14sinistra/3giù, output nativo2474×1844; screenshot e console[] salvati. Owner48736 mantiene il server della build finale cycle36; QA53784/session18443 chiuso intenzionalmente exit0. Nessun install/lock edit; node_modulesignore1 prima/dopo. node_modules2/ e4201 estranei intatti. Nessun push/deploy.

[Archivio riproducibile](measurements/terrain-shading-ledger-2026-10-17/README.md):38payload/777.947B, manifest **e862c7beee687482057f26b3dfe9db06adec28190ad13f30ff4fe1e8c18355c5**. Overlay6file rispetto alla base141, manifest esperimento144, protocollo, report interi, provenienza, script analitico e due review. Workspace completo esterno cycle37. Verifica saved-only controlla byte/contratti e i141sorgenti correnti, senza nuovo replay modello/GPU o accettazione artistica. Anatomia/vicino, pioggia/virga, terreno/UI e60FPS globali restano aperti.

Fonti primarie consultate: [Three r186 normal accessors](https://github.com/mrdoob/three.js/blob/r186/src/nodes/accessors/Normal.js), [renderer/scissor/readback](https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/Renderer.js), [WebGPU readback implementation](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/utils/WebGPUTextureUtils.js). Il codice installato r186 è stato letto anche localmente.
