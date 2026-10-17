# FaceDirect — review nativa indipendente

**FAIL visivo; non promuovere la candidata.** Giudizio formulato senza ricevere il verdetto del root. Ispezionati entrambi i PNG interi e i quattro ritagli A/B già salvati a1:1, senza resize, correzioni tonali o modifica degli originali. Nessun browser, GPU, modello o test.

La candidata rende più energici alcuni rilievi, ma fa leggere la triangolazione. Nel primario compaiono gruppi di piani triangolari chiari/scuri sul fianco sinistro, nella zona centrale alta e lungo i versanti della cresta in basso. Diverse fasce sono segmentate da diagonali geometriche; sembrano tasselli della mesh, non incisioni o affioramenti rocciosi. L'effetto è già visibile nel quadro intero. La catena lontana, soprattutto nella metà destra alta, assume piani e punte piramidali più espliciti.

La texture ottica mantiene variazione territoriale, ma ora pare appoggiata sopra facce poligonali più visibili. La richiesta dell'utente era allontanarsi dalle dune lisce/riflettenti verso montagne credibili: **questa maggiore nettezza non supera il gate**, perché sostituisce parte della morbidezza con un aspetto low-poly. Non è solo l'assenza di un beneficio: c'è un nuovo pattern artificiale riconoscibile sui versanti.

Nel secondario il fondo terreno a sinistra della nube mostra lo stesso incremento di facce/bande. Non noto spostamenti macroscopici della nube, del mare o della linea di costa; questa osservazione non certifica identità pixel o non regressione globale. I vecchi piccoli segni scuri non sono risolti in modo convincente: il nuovo contrasto delle facce è più esteso e domina la lettura. Non attribuisco ogni segno scuro a un errore shadow.

## Provenienza verificata

| Immagine | Dimensioni | Byte | SHA-256 |
|---|---|---:|---|
| A, bitmap v61 nel repo `terrain-optical-material-2026-10-17/browser/candidate-b-native.png` |2474×1844|3.599.836|`6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9`|
| B, `cycle38/browser/candidate-b-native.png` |2474×1844|3.804.264|`66aa0e659a0975b55960c151caa75eeb1063ae868636256fe44f735d40909d67`|

Pillow ha decodificato i due originali RGBA e confermato l'identità dei pixel di ciascun crop rispetto al proprio originale:

- primario `[left,top,right,bottom]=[0,560,1000,1000]`,1000×440;
- secondario `[700,540,1730,1320]`,1030×780.

Tutti e quattro i confronti crop→originale sono esatti. Nessun nuovo crop è stato prodotto. Gli SHA dei crop sono, nell'ordine A primario/B primario/A secondario/B secondario: `5d1d4e55fd134e89e3b507498e98f0a8d31ff35f1fde45101287810d37007ea1`, `54a7b27cad75eaa9ffa385dba36bee0eca852e3599d1e3a7b5c405c2619d9eb4`, `ea222079319e57a051ed06ff19d3fe76db978bc504e6cc77e110fbcd9708f604`, `633606bbe88c343e5f3f53ed9ef67a2afd1906ad419aa10a03e35b5414683a0d`.

Nei JSON A/B coincidono esattamente camera completa e lighting; output/interno2474×1844, ultra,384passi nominali, macro256³/dettaglio128³, fullflow e pausa. Clocks comuni: simulation60,forcing0,precipitation0,flow60; weatherTime differisce12,7675→8,4334s. La qualifica Float32/alpha comunicata dal root è distinta da questa review e non è stata rieseguita.

Esito limitato alla posa Sole fissa e alle immagini salvate. Nessuna conclusione su meteo diverso, worker, moto, costo o FPS. **Stop consigliato a questa variante**, senza aggiustamento di strength, blend, bias o angolo per salvarla. La v61 resta il riferimento; il fotorealismo generale rimane aperto.

## Addendum — secondaria storica corretta330×240

Il rettangolo storico `[700,540,1030,780]` è PIL **left/top/right/bottom**, quindi330×240. I primi file `*-secondary.png` esaminati sopra erano invece il ritaglio ampliato1030×780 `[700,540,1730,1320]`: restano evidenza supplementare, non la ROI secondaria storica. Le coordinate effettive e la verifica pixel della prima nota erano corrette per quei file; non attestavano la coincidenza con la ROI storica. `browser/crop-ledger.json` rende ora esplicita questa distinzione. La primaria è invariata.

Aperti anche i nuovi `baseline-a-native-secondary-fixed.png` e `candidate-b-native-secondary-fixed.png`. **FAIL confermato anche nella ROI storica:** B spezza il crinale e i suoi versanti in gradini/piani triangolari e diagonali di luce, già leggibili nella piccola immagine1:1. Non emerge una struttura rocciosa credibile che compensi questa tessellazione. Il giudizio non dipende soltanto dall'area aggiuntiva del crop ampliato.

Verifica Pillow: entrambi330×240, pixel esattamente uguali al crop LTRB storico dei rispettivi originali. A coincide anche nei byte PNG con `docs/measurements/terrain-optical-material-2026-10-17/browser/candidate-b-native-secondary.png`, SHA256 `5e22f4182b7a7d04490ca1ff004f5e76f7e9c01dca0a7d9e2c409ff8c13823ac`. B fixed SHA256 `98419d5ed58dd46bfaf03fa1799e85755e1ff0703352bc8b77fc56ba84e3171e`. Nessuna nuova GPU o modifica immagine; addendum append-only alla nota originale3473B/SHA7808d2c0… . Nessuna estensione del verdetto a meteo, moto o prestazioni.
