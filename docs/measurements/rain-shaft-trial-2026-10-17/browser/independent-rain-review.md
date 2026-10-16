# Review indipendente Rain shafts — 2026-10-17

**Verdetto: FAIL del gate artistico incrementale prefissato, su questa posa.** La candidata introduce separazioni visibili nel velo di pioggia, ma le separazioni leggono come bande verticali quasi rettilinee nella stessa cortina liscia. Non mostrano aperture con profondità e stratificazione sufficientemente credibili. Non è una promozione artistica, né una valutazione FPS.

## Input e metodo

| Input | Byte | SHA256 |
|---|---:|---|
| Baseline v59 `docs/measurements/terrain-source-refinement-2026-10-16/browser/refine-main-rain-native.png` | 2.585.113 | `0dd971b684b29c9d9855a405878d903da025eb729f17832dda813ac50051fa1b` |
| Candidata `rain-shafts-main-native.png` | 2.589.151 | `665ee2e54bcde7ea2fcdeaa5fafceb9fde6a6e376ab93e3638d0af9350864389` |

Entrambe PNG RGBA 2474×1844. Posa/luce/qualità matched come dichiarato dal proprietario della cattura; questa review non riesegue la scena né certifica autonomamente i metadati. Ho aperto entrambe le immagini complete con `view_image`, poi entrambi i crop nativi esattamente `[900,1240,1800,1820]` (900×580), senza resize, filtri, contrasto o modifica agli originali.

Il gate ricevuto prima dell'ispezione era: **vere aperture/profondità e cortine credibili; semplice darkening/attenuazione o nuova palizzata/periodicità = FAIL.** Nessun esito atteso è stato comunicato.

## Osservazioni visive

- **Baseline:** sotto la nube, verso il mare, un velo grigio ampio e molto uniforme copre una fascia verticale. Il bordo destro è già piuttosto verticale; la profondità del rovescio si legge poco.
- **Candidata, immagine intera:** la differenza è visibile soprattutto nella metà inferiore. Il velo viene separato da fenditure scure, mentre nube, costa e rilievi mantengono sostanzialmente la stessa lettura. La grande massa liscia del velo resta dominante.
- **Candidata, ROI nativa:** due separazioni principali, circa alle X native 1090 e 1410, proseguono quasi verticalmente per gran parte dell'altezza osservata. Le fasce grigie rimaste hanno larghezza e tono relativamente costanti: l'impressione è di pannelli o pilastri affiancati. Vedere il mare più scuro attraverso una fenditura aumenta la separazione tonale, ma qui non basta a far leggere piani di pioggia davanti/dietro, bordi irregolari o rovesci con sviluppo diverso.
- Non vedo una nuova regressione evidente della costa o delle creste in questa coppia; i problemi noti di ombre e il terreno non sono il criterio di successo del trial Rain.

Il FAIL non richiede di sostenere che l'effetto sia *soltanto* un oscuramento: la distribuzione cambia visibilmente. È la sua organizzazione a bande verticali e la profondità poco leggibile a non superare il gate. Una singola still non dimostra periodicità matematica, quindi non attribuisco frequenze o ripetizioni regolari misurate.

## Crop derivati e limiti

| Crop senza resize | SHA256 |
|---|---|
| `independent-baseline-rain-roi.png` | `d1f4525fdb622583a4fbcff1719095890beb386705a4a8b6ab7a1f23479d5cab` |
| `independent-candidate-rain-roi.png` | `ea9e92212bc81e71c6f313a82af17716958e65880b3f2bbd260804bca31d19cd` |

Questa conclusione riguarda l'immagine salvata e la ROI fissata, non una prova del campo fisico, dell'animazione o della qualità globale della pioggia. Nessun browser/GPU, modello, bake o test eseguito. Nessuna sorgente o PNG originale modificata. I crop sono derivati di sola QA visiva; la decisione di adozione resta al root.
