# Materiale ottico — controllo esteso delle luci

17 ottobre 2026. **PASS limitato del controllo visivo esteso: nelle immagini esaminate non emerge una contraddizione di illuminazione incorporata abbastanza chiara da fermare la candidata. Il fotorealismo finale resta aperto.** Ho visto i PNG completi Sole opposto e Tramonto, la ROI primaria1:1 prefissata del Sole opposto e, come riferimento, la stessa ROI del primo B Sole. Nessun nuovo ritaglio, browser, rendering, GPU o modello.

Il Sole opposto cambia in modo evidente la modellazione dei versanti. Nella ROI primaria il fianco chiaro del costone centrale e alcune facce laterali diventano più estesi, mentre altre zone si scuriscono; le distribuzioni verdi/grigie restano ancorate al territorio. Non vedo una grande ombra fotografica rimasta inequivocabilmente sul lato incompatibile con la nuova luce, né un rilievo ottico che sembri ribaltarsi rispetto alla mesh. Questo è un esito visivo circoscritto, non una dimostrazione che il composito sia albedo o che ogni dettaglio della sua illuminazione sia stato rimosso.

Il controllo è meno severo di un’inversione completa della luce: il preset specchia soltanto la componente X del vettore solare, lasciando Y e Z uguali. Una struttura del composito favorita dall’elevazione o dall’altra componente orizzontale può quindi restare compatibile in entrambe le viste. Inoltre manca un A senza ottica alle stesse due luci in questo ciclo: non attribuisco al materiale nuovo ogni difetto che diventa più visibile.

Al Tramonto il terreno assume una risposta complessivamente scura e calda; il mosaico costiero e le aree chiare dei versanti si attenuano insieme alla scena. Non vedo una tessitura diurna rimasta accesa, un nuovo alone chiaro sull’acqua o una cucitura netta del composito. La poca luminanza riduce però la sensibilità del controllo: la perdita di dettagli non costituisce una prova di correttezza fisica o di miglioramento rispetto ad A. Haze passa da1 a1,6 e cambiano anche cielo, colore solare e ambientale: il frame non isola il solo orientamento della luce.

Restano i limiti già annotati: tessitura rocciosa morbida su versanti arrotondati, foresta senza volume di canopia, segni scuri e sottili discontinuità lungo alcune creste/facce. Al Sole opposto alcune fasce chiare risultano più marcate e la forma continua ad avere un aspetto sintetico; non le promuovo a microgeometria e non attribuisco i segni alle ombre. Nella sola posa non vedo una nuova griglia62,5/125m, una tessitura terrestre sul mare o una chiara regressione da “fotografia appiccicata”. Questa assenza osservata non vale per tutti i bordi o tutte le distanze.

**Indicazione operativa:** proseguirei il controllo già previsto della stessa candidata, senza gain, gamma, nuove soglie o altri fit. Queste viste sostengono il beneficio materiale iniziale; non chiudono la richiesta di terreno fotografico, né qualificano pioggia, worker, moto o FPS.

## Riscontro dei file salvati

I metadata confermano camera e materiale nube identici al primo B, seed74, tempo simulazione60 fermo, macro256³/detail128³/384passi e2474×1844 sia output sia interno. I due audit salvati sono `COMPLETE_IDENTICAL_F32`, stable e cacheStateQualified: cached=fresh sull’intero target. L’alpha di entrambi è `29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c` su18.248.224B. È coerenza del target distanza della posa, distinta dal giudizio visivo e dalla radiometria del composito. Gli orologi di acquisizione/weatherTime e gli stati LUT non sono identici; non li presento come stesso draw.

| Vista B | Sun direction | lightSide / sunset | SHA target cached=fresh |
|---|---|---|---|
| candidate-b-opposite | `[0.668126592347077, 0.7126683651702156, 0.21380050955106467]` | 1 / 0 | `35ea017189dcdc2000f5854b61ff7932df80affbc82cf4d858224e0cedfe156f` |
| candidate-b-sunset | `[0.9519445346424993, 0.031731484488083314, 0.30462225108559976]` | 1 / 1 | `a9d724df1ab14490e83c8ca8bdfda4a27815779cc5fab1a7e640ee5b8be8b816` |

| Immagine effettivamente vista | Byte | SHA256 |
|---|---:|---|
| `candidate-b-opposite-native.png` | 3825624 | `0cde923f487f2e2c94f7eef75a5db114403af11785afa8ce776cf66fea4a3582` |
| `candidate-b-opposite-native-primary.png` | 417246 | `37cfa2de1bf525d08b4d6e9264d021e3ad46e99078ea5bc4e3bf3f453998803a` |
| `candidate-b-sunset-native.png` | 2100463 | `e097d0cd67c03be4ec60153110dbce531a231cd4c2b40fd605fd58c094fdcb18` |
| `candidate-b-native-primary.png` | 375772 | `5d1d4e55fd134e89e3b507498e98f0a8d31ff35f1fde45101287810d37007ea1` |
