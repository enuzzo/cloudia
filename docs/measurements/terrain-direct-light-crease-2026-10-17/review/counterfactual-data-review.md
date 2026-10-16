# Controfattuale direct-shadow — review indipendente dei dati salvati

17 ottobre 2026. Solo lettura dei JSON e aritmetica sui12 record già acquisiti; controllo hash/header del PNG canonico. Nessun nuovo raggio, modello, rendering, browser, GPU, test o modifica sorgenti.

**Esito: nei12 pixel prefissati, portare a1 il solo argomento solarVisibility non cambia neppure un bit RGBA.** I tre contrasti artifact−control restano identici. Il ramo di attenuazione direct cast-shadow non spiega quei contrasti campionati in questo stato. Non equivale a una prova sulle intere chiazze, né attribuisce automaticamente il residuo alle normali condivise, all'albedo o all'ambient.

## Parità e condizioni

- `direct-counterfactual.json`: COMPLETE_STABLE_OWNER; probe mode=`force-lit`, COMPLETE, stateRestored/inputsStable true, errors vuoto.12ID/pixel coincidono con cycle31 `receiver-fragments.json`.
- **48/48 componenti f32 ordinarie** coincidono con gli originalTerrainRGBA del ciclo31; ricalcolo dei bit da tutti i numeri JSON coerente con i96 interi live/forced salvati nel ciclo32. I geometryUUID cambiano fra owner indipendenti, come atteso; conteggi e meshGeometryMatches coincidono:591.788 posizioni,3.547.650 indici.
- **48/48 componenti f32 live/forced-lit identiche**, tutti finite; max|ΔRGB|=0, max|Δalpha|=0. Tutte le12 alpha sono distanze positive; nessun debugIsClear. Delta e paircontrast sono stati ricalcolati, non solo accettati dai flag.
- Camera, luce, materiale e meteo coincidono esattamente fra snapshot ciclo31/ciclo32 e metadata prima/probe/dopo. Main, seed74, t60 fermo, orbit false, Sole assestato, rain0, flash0; ultra384, macro256³, dettaglio128³, output/internal/canvas2474×1844. weatherTime avanza12,184→80,6048s fra i metadata native; precipitazione/forcing restano0 e le binding pertinenti coincidono.

## Dodici risultati

V31 è la visibility actualGPU della diagnosi precedente, non una nuova lettura né la verità fisica del terreno. «Parità31» include RGB e distanza. Gli ID artifact/control sono nomi storici, non classificazioni nuove.

| ID | Pixel [x,y] | V31 | ΔRGB forced−live | Alpha identica | Parità31 f32 |
|---|---|---:|---|---|---|
| L1-artifact | [71, 856] | 0 | 0, 0, 0 | sì | sì |
| L1-control | [64, 856] | 1 | 0, 0, 0 | sì | sì |
| L2-artifact | [431, 849] | 1 | 0, 0, 0 | sì | sì |
| L2-control | [431, 844] | 1 | 0, 0, 0 | sì | sì |
| L3-artifact | [903, 651] | 1 | 0, 0, 0 | sì | sì |
| L3-control | [903, 646] | 1 | 0, 0, 0 | sì | sì |
| C1-ocean | [2200, 1100] | 1 | 0, 0, 0 | sì | sì |
| C2-coastal-lowland | [1800, 930] | 1 | 0, 0, 0 | sì | sì |
| C3-plain | [2200, 700] | 1 | 0, 0, 0 | sì | sì |
| C4-ridge-L1 | [170, 805] | 1 | 0, 0, 0 | sì | sì |
| C5-ridge-L2 | [460, 800] | 1 | 0, 0, 0 | sì | sì |
| C6-ridge-L3 | [925, 610] | 1 | 0, 0, 0 | sì | sì |

L1-artifact è il solo punto con V31=0. La sua risposta nulla è informativa: togliere il blocco cast-shadow non cambia il colore lì. È compatibile con contributo diretto nullo o non rappresentabile nel risultato f32; i dati non separano diffuse finale, pesi terra/mare/materiale e altri fattori. Negli altri11 punti V31 era già1: la risposta nulla è il controllo atteso di conservazione.

## Contrasto delle coppie

RGB lineare del target terreno, prima di aerial/nube/film. Segno definito come artifact−control; L2 è quindi più chiaro del suo control nei tre canali, non più scuro.

| Coppia | Contrasto live RGB = forced-lit RGB | Δcontrasto RGB |
|---|---|---|
| L1 | -0.0018275976181, -0.00136287603527, -0.00159423425794 | 0, 0, 0 |
| L2 | 0.00886604934931, 0.00816476158798, 0.00470467656851 | 0, 0, 0 |
| L3 | -0.000262292101979, -0.000342698767781, -0.000298052094877 | 0, 0, 0 |

Queste tre differenze non sono eliminate dal controfattuale. Non si deve inferire da12 pixel che tutta la sagoma visibile abbia la stessa causa. Manca inoltre un controllo positivo che unisca Vlive0 e contributo diretto finale noto positivo: i dati soli non certificano la sensibilità dell'iniezione su ogni tipo di materiale; il contratto mode2 resta legato alla revisione statica della sorgente.

## Cache, alpha e restore

La cache shadow passa requests1821→1823, hits1820→1822, submissions1→1, epoch0→0, valid true: **2 richieste/2 hit/0 nuovi draw shadow**. Sono contatori CPU; non tempi o completamenti GPU. I valori ordinari e la distanza non mostrano cambio di geometria visibile ai punti.

Probe:24 readback,1 draw bbox2137×491=1.049.267pixel,1 restore draw; stesso target,0 nuove allocazioni full-target. Le12 alpha restano bit-identiche fra ordinario e forced-lit e rispetto al ciclo31. elapsed38,2ms probe/38,8ms totale sono durate browser riportate, non costo GPU esclusivo o FPS. Console salvata vuota.

## Native prima/dopo: cosa è verificato

I due JSON ready dichiarano entrambi PNG2474×1844,2.909.134B, SHA256 `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`. Ho verificato bytes/hash/signature/IHDR del PNG canonico già presente in `docs/measurements/terrain-source-refinement-2026-10-16/browser/refine-main-sun-native.png`: corrisponde esattamente a questi valori.

Nel folder cycle32/browser sono salvati i metadata before/after, **non due nuovi file PNG**: per i nuovi capture l'uguaglianza bitmap è quella attestata dai rispettivi exporter, non un confronto indipendente di due trasferimenti pixel nuovamente salvati. Le48 componenti target ordinarie campionate forniscono la verifica raw separata sopra. Non è un nuovo PASS artistico.

Il transfer controfattuale registra16.384+3.173=19.557 caratteri trasportati; il JSON salvato ha19.558B incluso LF finale. Il digest del file completo coincide con `counterfactual-transfer.json.sha256`; questa convenzione di salvataggio non è un troncamento.

## Provenienza SHA256

- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle32/browser/direct-counterfactual.json`: `2e04bc7fb451fbe0dc172046b64d6124bd2b0f80ff728be0df80a9b206ebcdb7`.
- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle31/browser/receiver-fragments.json`: `7a9f5b7b0a09dedd366049db1cd94b28bc89493d7ee0441c4abfbee7dd239436`.
- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle32/browser/native-before-counterfactual.json`: `d8f46791d1e7a8913b6ab7fd4d9dda5f22754a74d6f3cb7790b3de9ca084ccf3`.
- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle32/browser/native-after-counterfactual.json`: `2aa0ebdada0ce0efbb4864af02f8eba6ff6c477f2ad69ed8a63c8cbd51510f59`.
- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle32/browser/counterfactual-transfer.json`: `ea0f50072bec88ff0c75509b7464fc31d2c115cbfe3f3244be6fbcdccab9b796`.
