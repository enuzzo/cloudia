# Review visiva indipendente — trial Sun R1

**Verdetto: FAIL; non adozione.** Il trial introduce un artefatto evidente e diffuso sul terreno, senza un miglioramento visibile dei vecchi segni sufficiente a compensarlo.

Ho aperto entrambe le PNG originali con view_image, senza generare immagini derivate, usare browser/GPU o eseguire test, bake o analisi dei pixel. Confronto della stessa posa, secondo la registrazione fornita da root; bitmap nativa 2474×1844. I rettangoli seguenti sono indicazioni visive approssimate, top-origin, non nuove selezioni numeriche di campioni.

| Evidenza | SHA256 |
|---|---|
| [Baseline](baseline-native.png) | af8877ac93db6fcd50ab3ceece43ac1a40fc7d21c41151afb3a9620ca7586be5 |
| [Trial R1](browser/trial-main-sun-terrain-native.png) | 576b35cc44d09b7fe271bbec942dc9f9cd4d0a5105a82dafd17b43ffb766bdc6 |

## Cosa cambia nell'immagine

| Zona nativa approssimata | Osservazione indipendente |
|---|---|
| Pianura destra, x1500–2473 / y380–990 | Compare una trama molto fitta di piccoli trattini e macchie scure, con file e diagonali regolari. La baseline mantiene superfici più continue. Il disegno del trial attraversa il mosaico del suolo, anziché seguire in modo credibile bordi dei boschi, strade o ombre dei rilievi. |
| Fascia costiera in basso a sinistra, x0–1050 / y1170–1843 | File di trattini quasi paralleli, talvolta più larghi, punteggiano la terra fino alla costa. La ripetizione è particolarmente leggibile sulle aree relativamente piane e crea un effetto tratteggiato artificiale. |
| Rilievi sinistri, x0–1000 / y600–1250 | Ai segni scuri larghi già presenti si aggiungono numerosi triangolini e punti isolati, distribuiti anche sui pendii. Non leggo questa variazione come creste più incise o maggiore ricchezza della vegetazione. |
| Catene lontane, circa x600–2473 / y130–410 | Una puntinatura più tenue, organizzata in strisce oblique, rimane percepibile attraverso la foschia. Il difetto non è confinato alla costa o al primo piano. |

Il mare resta visivamente uniforme e privo di questa trama nelle aree aperte osservate. La nube mantiene posizione e aspetto sostanzialmente uguali nel confronto visivo; questo non è un controllo di identità byte/pixel. La regressione dominante è sul terreno.

I vecchi segni larghi nel settore sinistro rimangono riconoscibili, per esempio il cuneo scuro vicino a x70/y855 e i gruppi lungo le creste più a destra. Non vedo una pulizia convincente di quei difetti. Il dato preciso «12 pixel RGB invariati» è stato comunicato da root: non è stato ricalcolato in questa review.

## Interpretazione e limite

La periodicità, l'allineamento e la diffusione su pianure, pendii e montagne lontane impediscono di accettare il risultato come ombreggiatura naturale. Il trial peggiora chiaramente la continuità del paesaggio. La PNG dimostra questa regressione; non identifica da sola se l'origine sia nel trasporto dei corner, nelle coordinate UV, nel clipping o in un altro passaggio del raster.

I 440 test, typecheck e build comunicati da root restano evidenze statiche distinte. Non annullano il FAIL visivo e questa nota non li riesegue. Conservare il trial come evidenza negativa; nessuna promozione artistica o prestazionale e nessun nuovo parametro o intervento dedotto automaticamente dal confronto.
