# R5R2 recenter della sola componente inward — review in corso

**Raccomandazione: favorevole all'adozione del solo fix inward R5R2, condizionata ai controlli finali di integrazione di Root. Nessun PASS anatomico/fotografico generale.** Le immagini B di questa cartella appartengono al nuovo trialR5R2, non ai precedentiB/R3 di `../anatomy-visual/`. Root identifica il volume congelato con SHA `c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`. I protocolli pre-render conservano il proprio stato storico pending e non vengono riscritti.

Regola riferita da Root: sola traslazione `-inner*projection` della componente inward quando positiva; corpo alla baseline, componente perpendicolare conservata. Questa review valuta le immagini, non sostituisce l'audit sorgente/layout della regola.

## Seed74 — quattro coppie viste

| Campione | Osservazione indipendente A→B R5R2 |
| --- | --- |
|40 Sole | Il dente laterale che sporgeva nella cavità scompare. Giovane a destra, cavità centrale e aperture di cielo restano leggibili. Il corpo inferiore appare vicino adA e non mostra il maggiore riempimento/cuscino del vecchioR3. Nessuna nuova mensola, amputazione evidente o apertura artificiale. |
|40 Tramonto | La luce bassa conferma la rimozione del dente senza una nuova piattaforma alta del corpo. La separazione giovane/cavità resta presente; le grandi masse inferiori appaiono conservate nella composizione. |
|60 Sole | Aperture e profilo risultano qualitativamente vicini adA. Non vedo l'anticipata chiusura verso il cielo che accompagnava il bodyliftR3. Entrambe le immagini sono molto morbide e il volume fine resta insufficiente. |
|80 Sole | Il rapporto fra massa chiara, cavità scura e cielo appare simile alla baseline; non si ripete il quasi totale riempimento chiaro visto nel vecchioB/R3 a questo approach. Non è identità pixel o un PASS del vicino: la morbidezza e il basso dettaglio restano evidenti. |

Il beneficio osservato è quindi più mirato diR3: rimuovere una protrusione inward mantenendo la leggibilità del corpo e dello spazio negativo nei campioni74 disponibili. Non viene attribuita una conservazione di massa fisica, τ o RGB finali alla somiglianza delle immagini.

Gli approach40/60/80 sono posizioni del controllo, non distanze in metri. Il protocollo indica avvicinamento col probe reale, senza override target/superficie; non si deduce da questi screenshot una camera mondiale numericamente identica. Il JSON B letto conferma seed74/sheared,t60,vento55%,dispersione0,cielo sunset,1920×1080 interno/output,256³/128³/384,nessun TAA. JPEG CSS1237×922, non framebuffer nativi; i contatori live non costituiscono benchmark.

## Ulteriori coppie esaminate —77/80 vicino e926 macro

- **77,40/60/80Sole:** il lembo pendente della torre matura viene tolto dall'apertura. In B si legge più cielo e resta il corpo chiaro in primo piano, senza il maggiore riempimento diR3. A80 l'apertura sopravvive chiaramente. L'effetto libera la cavità già presente; non vedo un nuovo foro isolato o una massa esterna amputata. La grande U non viene risolta e può risultare più esplicita.
- **80,40/60/80Sole:** scompare/rientra la protrusione interna con effetto più contenuto rispetto a77. Giovane e appendici esterne restano leggibili alla posa40; a60/80 corpo e spazio negativo sono qualitativamente vicini adA. Non emerge il collasso anticipato in bianco attribuito al vecchio bodylift. Entrambi rimangono molto morbidi, soprattutto a80.
- **926,fronte/lato/retroSole:** nella coppia con cielo assestato il massimo componente inward del prefisso non produce un nuovo cuscino evidente. La concavità viene liberata dal lembo interno; giovane e contorni esterni restano distinguibili front/back, sagoma laterale molto simile. Non vedo una mensola nuova, un foro isolato o una perdita del giovane. Questa è una review delle tre foto, non prova di equivalenza ottica o di tutto il volume.

Per926 sono state usate esclusivamente `a926-*` e `b926-*` con cielo blu. I primi scatti `early-sky-b926-*`, dichiarati da Root durante il caricamento della cache cielo, sono conservati da Root ma **esclusi dal confronto**; non vengono usati per attribuire differenze al modello.

## 926 vicino e617 outward

**926near40:** la grande cavità scura a sinistra è già presente inA, con un contorno visivamente molto simile; non viene classificata come nuovo foro isolato del candidato. La protrusione sul bordo della cavità principale viene ritratta, senza il rigonfiamento del corpo. **926near80:** entrambi hanno dettaglio insufficiente; B conserva anche una separazione macro scuro/chiaro e un piccolo lembo di cielo, senza una nuova anticipazione del bianco uniforme.

**617near80/100:** il candidato ripristina un quadro qualitativamente compatibile conA: ampio margine scuro della nube e porzione di cielo/orizzonte. Non si ripete la perdita totale di contesto del bodyliftR3. È un controllo favorevole del comportamento outward, non un PASS del dettaglio vicino: entrambi restano troppo morbidi.

In queste coppie sono visibili differenze nella tinta/foschia del cielo. Il giudizio usa soltanto le grandi sagome, le aperture e i difetti visibili; **nessuna equivalenza di luce, colore, pixel o raggi viene dedotta dalla selezione UI Sole**. Il rapporto numerico617 è stato poi verificato separatamente come indicato sotto.

## Controlli finali917,617 e Pioggia74

**917 macro, tre pose:** le nuoveA hanno cielo blu e sostituiscono soltanto l'uso visivo delle primeA grigie, che Root preserva come `early-sky-a917-*`. Le sagome front/lato/retro risultano molto simili, con giovane e appendici esterne ancora leggibili. Non vedo il raddrizzamento laterale che sarebbe il rischio del recenter completo. L'effetto molto piccolo è compatibile con la componente inward ridotta riferita da Root; questa review non misura la traslazione in metri né certifica identità dei pixel.

**617 camera reale:** il confronto indipendente fra il vecchio rawA e il nuovo rawB conferma uguaglianza esatta dei campi registrati origin,target,surfaceEstimateKm,approach,yaw,pitch e dei flag/override di confronto; anche probe.distance è uguale e found=true in entrambi. Origine[.52734375,3.052734375,.25908496633069245],target[.52734375,3.052734375,.02734375],surfaceEstimate/probe.distance=.23174121633069247km. Il delta463,476m del vecchioR3 è eliminato in questo controllo. Timing e probeAge differiscono; non si dichiara identità dell'intero oggetto camera, della densità o del framebuffer. `camera617-preservation.json` riporta correttamente gli stessi campi.

**Pioggia74 R5R2:** nella coppia finale letta non vedo nuovi gap fra base e cortina, tratti sospesi o sovrapposizioni macroscopiche nuove della pioggia davanti al corpo. La cortina resta larga, uniforme e fotograficamente insufficiente; il termine inferiore è fuori quadro. Una coppia statica non qualifica impatto al suolo, virga completa, movimento o FPS. I JSON UI confermano rain,t60,seed74,vento55%,dispersione0,1920×1080/256³/128³/384; non serializzano l'intensità uniforme effettiva o camera completa.

## Decisione circoscritta e condizioni

Il beneficio utile è la rimozione delle protrusioni inward campionate74/77/80 e926, mantenendo il corpo e le aperture qualitativamente prossimi adA;917 controlla la preservazione laterale e617 recupera il percorso outward della baseline. Non vedo una nuova regressione visiva bloccante negli input finali esaminati. **Preferisco questa correzione minima al vecchio joint con bodylift**, già respinto per compattezza617/costo vicino.

La raccomandazione è subordinata alla suite350, output nativo/regressioni e provenienza delle122 sorgenti d'integrazione che Root deve ancora chiudere. Non sono dichiarati PASS da questo curatore. Non chiederei un nuovo sweep macro completo77/80 come prerequisito di questo fix così circoscritto: i vicini di tre seed inward, il massimo926, il controllo perpendicolare917 e outward617 danno già una base utile per la decisione ristretta. Il giudizio non copre ogni silhouette/famiglia/seed, né costituisce promozione automatica del renderer finale.

Restano esplicitamente aperti grandeU/doppia torre, raccordo macro globale, dettaglio fine molto morbido vicino, cortina uniforme, continuità temporale, qualità fotografica completa e60FPS stabili. Il candidato non va descritto come risoluzione del problema del vicino: evita il peggioramento da bodylift nei campioni osservati, senza risolvere il difetto baseline. La proprietà sorgente corpo/perpendicolare preservati richiede il distinto audit geometrico di Root; le foto non provano massa fisica,τ o RGB invarianti.

Gli scatti non assestati `early-sky-b926-*` e `early-sky-a917-*` restano esclusi dal giudizio finale. Tutte le altre osservazioni sono qualitative: selezionare Sole nell'UI non certifica da solo la luce assestata o un'identità radiometrica. Le prove di moto R3 del dossier precedente non vengono trasferite aR5R2. Nessun browser/GPU, build, runtime, prodotto o archivio precedente è stato modificato durante questa review.

## Originali74 letti — SHA-256

| File | Byte | SHA-256 |
| --- | ---: | --- |
| `a74-near40-sun.css.jpg` | 59690 | `e56545dc5409b6e3c9c12f29a28d24e1d125af1b39d8dcae0cfce47a94e7ace3` |
| `b74-near40-sun.css.jpg` | 58590 | `5001fcd2f484feb9d7167c5acef69fc3035fe24abe0a02143da12f511a6785f0` |
| `a74-near60-sun.css.jpg` | 46827 | `77af9d6cf162970b34761aa91d707302fc2173d16a36c7a18526047991e0a276` |
| `b74-near60-sun.css.jpg` | 45025 | `10e0f808b59898510e827f8fe5602c117543774b5f3e47435a75c522ed7f8962` |
| `a74-near80-sun.css.jpg` | 40029 | `f57fa0162b4d5bd5940906dcafb73b9bba07e54cf039d8d520aed99a87375c8e` |
| `b74-near80-sun.css.jpg` | 39252 | `69b395b78c80213561f1ea16d6cd653deea951ec1fb81b6ecf0c6f1bdfa95452` |
| `a74-near40-sunset.css.jpg` | 60560 | `0c971bd5ed6472f5754946fddf7a884dee4e726b0182d7660bc96f2595ccc540` |
| `b74-near40-sunset.css.jpg` | 59092 | `9262d4573d489cb6cfabf27d1e8495a4def7d58a2efbd0db486dc0cd3d88c279` |
| `b74-near-ui.json` | 483 | `89d1f96b32f14f8ceb12ca0a2a198c942a12d7efb02f8d95aaf7fc197e4a93e5` |

Le copieA utilizzate coincidono con gli SHA dichiarati in `BASELINE-COPIES.json`; nessuna immagine baseline rigenerata dal curatore.

## Ulteriori originali esaminati — SHA-256

| File | Byte | SHA-256 |
| --- | ---: | --- |
| `a77-near40-sun.css.jpg` | 47556 | `0bb5fc59fc6ce8157d81b2d8bd7d11b173bcd3b3d4e9e16f783d71aecd08d9da` |
| `b77-near40-sun.css.jpg` | 47389 | `acf1b5c4b78989130974263e30cbd413017f7aeaa5af5e2d29ba8df030e92793` |
| `a77-near60-sun.css.jpg` | 38488 | `bc2336db7d1468afe61b3ed0f1589ec2e3588e9f26fb1083c2336001c4ffada5` |
| `b77-near60-sun.css.jpg` | 38299 | `12839c5ef17405f990e5787aa8159c3b2ae75eb10c5ec6e3b8bd2b79bd295605` |
| `a77-near80-sun.css.jpg` | 38526 | `2df867c701a60ac9216c6ad0c517619b054a9585a133710d0b534acbcf5936a2` |
| `b77-near80-sun.css.jpg` | 37847 | `3b9f3dc2f6fce2c04aa4f948ec594fbc78c1170e6cc84e63a08da245eef0091b` |
| `a80-near40-sun.css.jpg` | 55945 | `ddbe4dec85ca9dc51b3b926c01c136cc5dac5f5759fbc369bd40100c43f56a9a` |
| `b80-near40-sun.css.jpg` | 56140 | `3a0a94fed7be9ec9e10a58b5be3a46cabb541d7e5aaa977fae02fd7a55a32318` |
| `a80-near60-sun.css.jpg` | 42965 | `683fd4f053066491d0ca9652a1fbd926cad467116feec75368b3b7e6c3078bc2` |
| `b80-near60-sun.css.jpg` | 43086 | `cd7c691c984cdf8682a53ab13cffdb50f59fe4c727ae8f1f9d7469926f4bf641` |
| `a80-near80-sun.css.jpg` | 36392 | `89fad1278230414fd710666bdedff06308b26677f5c5897f71224dee3dbfedc5` |
| `b80-near80-sun.css.jpg` | 36541 | `51e00b6744f461bae0e677caf5324144b1b0b256e777dfe4ced81a87f8e85e9f` |
| `a926-front-sun.css.jpg` | 52497 | `ecc01209576bd3a1808f32da76afdf5459cd42d447e5b29fe6343398d15136ed` |
| `b926-front-sun.css.jpg` | 58993 | `a32c1259af87c39734da9785b39a3326bda289ed52e59b342ac197196cfec69d` |
| `a926-side-sun.css.jpg` | 63711 | `d965ebd838ee7e24c13287d6b6e2f278ede8ab5cbb6c458b480b9512cebe4886` |
| `b926-side-sun.css.jpg` | 63702 | `7b36e381bffc72ea8287561c737b821aa36b3d985dd2ed90d5cff59783b91c97` |
| `a926-back-sun.css.jpg` | 70947 | `97b91a0127129c37d6e766a744923557df435a3eb03ed388813790fee74dafa0` |
| `b926-back-sun.css.jpg` | 71039 | `54f400f773a5aac453074cd347c74f15413b469d3e557d4be26fc66514e9a939` |

## Ulteriori originali926/617 esaminati — SHA-256

| File | Byte | SHA-256 |
| --- | ---: | --- |
| `a926-near40-sun.css.jpg` | 56786 | `947960b53b1e44deb78ef35e57ab9f9c476d6ffbc875a460166804834edc6e8e` |
| `b926-near40-sun.css.jpg` | 57177 | `ef2a9a1e81bbab397c596c25c1e603bcf63c067e33558fcee358a89a3848a45b` |
| `a926-near80-sun.css.jpg` | 38283 | `92ab85fe59b8e7856d0738b49bc045e0b14d46bb92273289a42c2e28ddf91955` |
| `b926-near80-sun.css.jpg` | 38676 | `0687d57bbad0307a71917c26450f7b16749c588c38c7f95cb0e40e8ccedcbe52` |
| `a617-near80-sun.css.jpg` | 32884 | `3b6cb7dde15e3277a22c3318c97ad7ed134c57bf6621fa9140f445c12e52c33c` |
| `b617-near80-sun.css.jpg` | 33815 | `ab53f6304aa0044c964d40f7e9459ef396b4c0171e3b84a399d8f147016ce749` |
| `a617-near100-sun.css.jpg` | 33598 | `369467b2dbdc6ef1721dc8987a792a9a79259af6f70bcd2e6d976ce042068809` |
| `b617-near100-sun.css.jpg` | 33598 | `369467b2dbdc6ef1721dc8987a792a9a79259af6f70bcd2e6d976ce042068809` |

## Originali finali917/pioggia/camera letti — SHA-256

| File | Byte | SHA-256 |
| --- | ---: | --- |
| `a917-front-sun.css.jpg` | 51843 | `2e81cacf4912de10963e4876575f0a0eaf96b2944e5ffe3f721219a6facc2b16` |
| `b917-front-sun.css.jpg` | 51842 | `52db2d8c9e0831134d8ea90a2adb8ae80d05e5732a541d53300f7a0c4215a714` |
| `a917-side-sun.css.jpg` | 63542 | `0b587468baa7371c0222d422157f852253f7127c5acbbdb7968696c7782b3523` |
| `b917-side-sun.css.jpg` | 63512 | `2ef238ba172318a67a792b0afa1d2c0e46472f44e0860f288f98cc5f82f63233` |
| `a917-back-sun.css.jpg` | 70153 | `100335b3ec609a44902991b8b86914f6080eed6d145b03864fb7f32876627e05` |
| `b917-back-sun.css.jpg` | 70156 | `ee300b0a3e5aa06a8b0aa291b386c52e176ca583e191d1c68edcb7cd6558c7b2` |
| `a74-rain-base.css.jpg` | 64087 | `a782c0a4b8b0458dbcc5324aeed4b242e5fe60d289c60f59c5706cffe5f87acd` |
| `b74-rain-base.css.jpg` | 64153 | `bf9d58e3abb56190367d20e41a69646ceee200ab55b7a79d1d61c23ff6c69ce6` |
| `a74-rain-ui.json` | 481 | `ca659314dfc5ef6ebf4128efba5d41dd562ff58b4d7bf2fa621cc0c60e611ece` |
| `b74-rain-ui.json` | 481 | `0a30114394fbac6edb9b9766d8c5b4f16528edd068bb96a21782cde093ee0440` |
| `camera617-preservation.json` | 2352 | `0ef8e55a7c67340cb503685fd80259b78ec666e4fc2bed505a3dbfce66f66335` |
| `b617-near100.raw.json` | 3390509 | `7ba531c9ba93e93650400211fe5e75fa204ade0ddea8a4cb44233790b9109f2a` |
| `../anatomy-visual/a617-near100.raw.json` (baseline preservata, non duplicata) | 3412894 | `0d9323168426c3e76894788e45929975fd76c55f53793aec43814d0ac712ef26` |
