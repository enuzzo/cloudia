# Review nativa indipendente — luce emettitore

17 ottobre 2026. **FAIL del gate artistico prefissato, su questa posa.** Ho visto entrambe le PNG complete e la ROI `[900,1240,1800,1820]` a900×580 senza resize, filtri o modifica degli originali. Nessun verdict del root era stato comunicato prima della review.

La candidata riduce molto il pannello grigio chiaro della baseline, ma principalmente convertendolo in un'ampia zona scura quasi uniforme sotto la nube. La ROI mostra la cortina più vicina al tono del mare: non emergono aperture, piani davanti/dietro o articolazione credibile dei rovesci. Nell'immagine intera la base della nube risalta maggiormente sopra quella zona scura; questo non basta a far leggere profondità della pioggia.

Non vedo la nuova palizzata netta del precedente trial broad: questo è un esito diverso, e il difetto non va attribuito a bande periodiche non dimostrate. Il FAIL è invece il criterio già fissato **semplice darkening senza sufficiente articolazione/profondità**. Ridurre la visibilità di un velo artificiale può alleggerire la scena, ma non dimostra la cortina credibile richiesta. Nessun fitting suggerito per salvare questa variante.

## Identità e confronto

| PNG nativa2474×1844 | Byte | SHA256 |
|---|---:|---|
| Baseline `docs/measurements/terrain-source-refinement-2026-10-16/browser/refine-main-rain-native.png` | 2585113 | `0dd971b684b29c9d9855a405878d903da025eb729f17832dda813ac50051fa1b` |
| Candidata `emitter-light-main-rain-native.png` | 2569912 | `fa80da6695f7f3eafd2a3dab134beaab804894e1fe57018bd3ee167a0c3f08d8` |

La baseline fresca `emitter-audit-native.json` dichiara lo stesso SHA del bitmap archiviato. I JSON fresco/candidato mostrano stessa camera, luce applicata e qualità ultra384, macro256³/detail128³, output/internal2474×1844, seed74/t60, forcing/precipitationTime0 e flow60. Pioggia CPU fresh=.7999999999999992 contro candidata=.7999999883073284: conversione IEEE754float32 verificata per entrambe **.800000011920929**. weatherTime dei due owner differisce, quindi non dichiaro identità dell'intero stato CPU.

Crop deterministici senza resize: `independent-emitter-light-baseline-roi.png` SHA `d1f4525fdb622583a4fbcff1719095890beb386705a4a8b6ab7a1f23479d5cab`; `independent-emitter-light-candidate-roi.png` SHA `e59884ba685384eca153b05b41ed0fe5275a4fe693ac36376af3642c3b59ad81`.

Scope: sole immagini salvate e controllo piccoli metadata. Nessun browser/GPU/test/modello/bake, nessun product edit; PNG originali preservati. Non è giudizio sull'animazione, FPS o accettazione artistica globale. La correttezza statica della formula e la variazione dell'audit non sostituiscono questo gate visivo.
