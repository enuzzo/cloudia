# Shader ledger — lettura numerica indipendente dei 12 receiver

17 ottobre 2026. Solo aritmetica sui due JSON salvati; nessun nuovo raggio, modello, shader, build, test, browser o GPU. **Il risultato sostiene una differenza locale fra normale geometrica e smooth, non un difetto di upload né una spiegazione globale di tutte le scaglie.**

## Prerequisiti effettivi

`browser/shading-ledger.json` è `COMPLETE_IDENTICAL_F32`, stable/cacheStateQualified/shadingQualified true; distance e values gate true. Cached, fresh e restored hanno lo stesso fullRGBA `07fa43ec…` e fullalpha `29a4e015…`, conformi al B v61. I quattro hash degli array CPU installati coincidono con i canonici attesi. I 36 alpha dei tre modi corrispondono ai 12 witness ordinari. Questa è una prova della posa e del gate diagnostico; non legge le normali del compiled shader ordinario direttamente e non ricostruisce la mesh.

La luce applicata è Sun [-.6681265923,.7126683652,.2138005096]. Ho ricalcolato i dot dei vettori salvati e la Y lineare dell’RGB ordinario con (.2126,.7152,.0722). Gli ID rimangono storici: “artifact” non significa che quel pixel sia oggi più scuro del suo controllo.

| ID | dot macro | dot final | CPU face dot storico | Δ rough° | Vsky | Vsun | Y ordinaria |
|---|---:|---:|---:|---:|---:|---:|---:|
| L1-artifact | -0.0541658 | -0.0547647 | -0.0557752 | 0.049164 | 0.8706251 | 0 | 0.01346179 |
| L1-control | -0.0415103 | -0.0414545 | -0.0462314 | 0.013106 | 0.8750718 | 1 | 0.01169125 |
| L2-artifact | 0.2116745 | 0.2116664 | 0.0481566 | 0.000823 | 0.8649011 | 1 | 0.03578513 |
| L2-control | 0.1014759 | 0.1015021 | 0.2579603 | 0.008313 | 0.8665355 | 1 | 0.02511584 |
| L3-artifact | -0.1467972 | -0.1467963 | -0.2433448 | 0.000652 | 0.8435119 | 1 | 0.01298923 |
| L3-control | -0.0050814 | -0.0050814 | -0.0813305 | 0.000000 | 0.8843902 | 1 | 0.01370731 |
| C1-ocean | 0.7134456 | 0.7134456 | 0.7134522 | 0.000000 | 0.8799987 | 1 | 0.02265959 |
| C2-coastal-lowland | 0.7063952 | 0.7055911 | 0.7037152 | 0.108825 | 0.8799793 | 1 | 0.13049289 |
| C3-plain | 0.7146873 | 0.7146873 | 0.7146730 | 0.000000 | 0.8799953 | 1 | 0.02401469 |
| C4-ridge-L1 | 0.2212815 | 0.2212815 | 0.3251958 | 0.000000 | 0.9311195 | 1 | 0.03771798 |
| C5-ridge-L2 | 0.3851338 | 0.3851338 | 0.2153805 | 0.000000 | 0.9581981 | 1 | 0.02382076 |
| C6-ridge-L3 | 0.4449932 | 0.4449932 | 0.4148446 | 0.000000 | 0.9495929 | 1 | 0.02034086 |

## Cosa cambia l’interpretazione

**Le macro-normal GPU sono coerenti con le normali vertex interpolate storiche, una volta normalizzate.** La massima differenza di componente sui 12 casi è 1,86e−5. A L2 il CPU interpolato normalizzato dà dot .211676758/.101484658, quasi gli attuali .211674480/.101475887. I valori .048156554/.257960281 appartengono invece alle normali delle due facce. Il ribaltamento del contrasto solare è quindi già prodotto dallo smoothing, non evidenza che Three carichi i buffer sbagliati o che la cache sostituisca la normale. I quattro hash uguali non eliminano questa differenza semantica fra faccia e attributo interpolato.

**Il roughness non causa qui il ribaltamento o un passaggio attraverso dot 0.** Sui12 casi lo spostamento angolare massimo è 0,108825° (C2), sui sei L è0,049164° (L1-artifact). A L2 il diffuse riportato cambia rispetto al macro dot di circa−8,1e−6/+2,6e−5. L1 e L3 restano sul lato negativo del dot e diffuse=0; togliere il rough non farebbe apparire lì la luce diretta. Questo esclude il rough come causa di quei sei specifici zero crossing, senza qualificarlo globalmente.

| Coppia | Y artifact | Y control | Contrasto firmato(Yart−Yctrl)/(Yart+Yctrl) | Rapporto Yart/Yctrl |
|---|---:|---:|---:|---:|
| L1 | 0.01346179 | 0.01169125 | +0.07039053 | 1.151441 |
| L2 | 0.03578513 | 0.02511584 | +0.17519085 | 1.424803 |
| L3 | 0.01298923 | 0.01370731 | -0.02689818 | 0.947613 |

- **L1:** diffuse 0 in entrambi, benché Vsun sia 0/1; la visibilità shadow non può modulare il diretto nullo. Il pixel storico artifact è più chiaro del 15,14%, mentre il suo Vsky è leggermente inferiore. Il solo proxy skylight non spiega quel segno: colore/miscela materiale e gli eventuali rami acqua/costa restano necessari nell’interpretazione.
- **L2:** entrambi Vsun 1, Vsky quasi uguale; il diffuse smooth è circa 2,085 volte maggiore sul pixel artifact, che è più chiaro del 42,48%. La normale smooth rende il contributo diretto coerente con questo segno, ma non permette di assegnare tutta la differenza RGB alla normale: albedo osservato e composizione rimangono spazialmente diversi.
- **L3:** diffuse 0 e Vsun 1 in entrambi; Vsky è .843512/.884390, circa−4,62%, dello stesso ordine del rapporto Y−5,24%. È compatibile con un contributo del proxy ambientale, non una separazione causale da albedo o mix costiero. I rapporti R/G/B non sono uguali, quindi la variazione non è un semplice fattore scalare uniforme dimostrato.

## Unico passo causale pratico proposto

**Trial esterno: usare la normale geometrica della faccia soltanto nel termine diffuse diretto, conservando la normale smooth/rough per tutti gli altri termini.** Non sostituire interamente le normali, non modificare mesh/albedo/skyVisibility/shadow e non ripetere il crease 45° già ritirato. La normale geometrica può venire dalle derivate della posizione mondo nello stesso frammento, orientata al verso radiale, con normalizzazione protetta e fallback alla normale esistente per derivate degeneri. Derivate prima dei branch; nessun nuovo lookup o binding, nessun rebuild DEM/mesh. Cross, normalizzazione e controllo di finitezza hanno comunque costo ALU da misurare se il gate visivo passa.

È una prova/correzione candidata della coerenza fra superficie visibile e illuminazione diretta, **non una deduzione che lo smoothing sia un bug**: le normali smooth sono una scelta legittima e il faceting può peggiorare l’immagine. La variante deve essere immutabile e cambiare una sola dipendenza del diffuse, senza cambiare il proxy ambientale o i colori per farla vincere.

Predizione prefissata dalla geometria storica, non garanzia GPU bitexact: a L2 il diffuse artifact dovrebbe scendere da .211666 a circa .048157, quello control salire da .101502 a circa .257960. Nei quattro L1/L3 il diretto dovrebbe restare 0. Quindi L2 discrimina la causa diretta, mentre L1/L3 sono controlli della mancata spiegazione universale. Acquisire una sola nativa alla stessa posa e le ROI già fissate, con fullalpha invariata; niente sweep. PASS soltanto se i crinali diventano più credibili senza introdurre facce/diagonali evidenti. Se compaiono faceting o nessun beneficio, FAIL e stop: non aumentare il peso o fit dei colori e non dichiarare risolti L1/L3.

Il confronto CPU storico resta Float64/ray e non è il receiver GPU bitexact; le previsioni riguardano questi punti selezionati e non tutta l’immagine. Il ledger da solo non attribuisce ogni contrasto al solo N, né frequenza globale delle scaglie, winner shadow, fotorealismo o FPS.

## Provenienza

- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle37/browser/shading-ledger.json`: 62893B, SHA256 `b0fc343ea49b161f6f7922fcd086852137d93e383d8fb2bdb76b64790d37cadc`.
- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle31/browser/installed-shadow-witness.json`: 62341B, SHA256 `ec3187ebc895e0aed4e3bd723d995e0196aa2825fa3167ea4e03c78898348d43`.
