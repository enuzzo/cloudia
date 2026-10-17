# Materiale ottico — review indipendente del primo nativo

17 ottobre 2026. **PASS iniziale della direzione materiale, limitato a questa posa Sole; non PASS fotografico finale e non adozione.** Ho ispezionato con `view_image` i due PNG completi e le quattro ROI1:1 prefissate, senza nuovi crop, rendering, browser, GPU, modelli o ritocchi.

## Differenze visibili che motivano il PASS iniziale

- **La riduzione delle campiture uniformi è netta, non un semplice scurimento.** Nel frame intero B compaiono distribuzioni irregolari verdi/brune e aree chiare molto più differenziate lungo il basso versante e la fascia costiera, anche a sinistra sotto la nube. Alcune zone diventano più scure, altre più chiare: l’effetto non si riduce a un colore globale più intenso. La costa costruita/pianeggiante si legge come un mosaico geografico, invece della precedente superficie grigio-verde poco distinta. Questa è lettura visiva, non classificazione dei singoli pixel.
- **Il primario guadagna struttura cromatica a più scale.** Sui massicci sinistri le zone chiare/grigie sono suddivise in chiazze e fasce irregolari, con copertura verde differenziata sulle pendenze e nei raccordi. I costoni risultano più leggibili che in A, dove dominano larghe sfumature lisce dello stesso materiale. Il miglioramento proviene dal colore spaziale: non lo presento come nuove incisioni o dettagli geometrici. Le forme e le silhouette restano quelle della stessa mesh.
- **Nella posa esaminata non vedo una nuova griglia62,5/125m, una giunzione rettangolare evidente o tessitura terrestre invasiva sul mare.** La costa conserva una separazione leggibile dall’acqua. Non identifico una contraddizione abbastanza evidente da chiamare questo singolo frame “fotografia appiccicata”: la tessitura segue la superficie in modo complessivamente plausibile. La verifica al Sole opposto resta però necessaria per cercare illuminazione incorporata; questa immagine non può escluderla.

## Limiti che restano visibili

Il risultato non ha ancora la credibilità di una fotografia aerea. Alle ROI1:1 la tessitura sui costoni rimane morbida/sfumata: alcune fasce chiare sembrano appoggiate su versanti arrotondati e non diventano una superficie rocciosa con rilievo. Il bosco guadagna variazione geografica, ma non volume di canopia. Aumentare la ricchezza del colore non risolve queste due mancanze.

**Le scaglie/chiazze scure già visibili in A persistono.** Nel secondario resta la chiazza del versante centrale; nel primario rimangono piccoli segni scuri lungo alcune creste/facce. Non li considero risolti, non li attribuisco alle ombre e non vedo qui una prova che la texture li abbia generati. Il PASS sopra riguarda il beneficio ottico nuovo senza una regressione evidente di quel tipo; non è un PASS della pulizia totale del terreno. Se il gate viene applicato letteralmente come assenza di qualsiasi scaglia preesistente, quel requisito resta FAIL e non va occultato.

Non c’è evidenza visiva sufficiente, in queste sole immagini, per chiamare credibile ogni affioramento, campo o nucleo costruito. La vicinanza/lati opposti del Sole possono mostrare meglio blur, incoerenze radiometriche o proiezione del colore. Nessuna promessa su altre pose, bordo48–64km, pioggia/Tramonto, worker o moto. Nessuna previsione o misura FPS ricavata dalla fotografia.

**Scelta operativa:** conserverei la candidata come miglioramento materiale visibile e abbastanza promettente per i controlli già congelati successivi; non aggiungerei gain, gamma o altre varianti dopo questa immagine. L’accettazione finale rimane del root/utente, separata dalla qualifica tecnica e dalla risoluzione dei difetti geometrici/ombreggiatura già aperti.

## File effettivamente ispezionati

| File | Dimensioni | Byte | SHA256 |
|---|---:|---:|---|
| `baseline-a-native.png` | 2474×1844 | 2909134 | `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d` |
| `candidate-b-native.png` | 2474×1844 | 3599836 | `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9` |
| `baseline-a-native-primary.png` | 1000×440 | 257559 | `435a18cbd0730c3f0328b110bf77e0d13a3b804174673826971ee21cd9f64b52` |
| `candidate-b-native-primary.png` | 1000×440 | 375772 | `5d1d4e55fd134e89e3b507498e98f0a8d31ff35f1fde45101287810d37007ea1` |
| `baseline-a-native-secondary.png` | 330×240 | 43987 | `f463179eebbf4a86907cad5b12f668a67420bfb40b1db1568522178fcb1080b1` |
| `candidate-b-native-secondary.png` | 330×240 | 63214 | `5e22f4182b7a7d04490ca1ff004f5e76f7e9c01dca0a7d9e2c409ff8c13823ac` |
