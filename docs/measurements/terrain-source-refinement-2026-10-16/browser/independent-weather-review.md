# Review indipendente PNG salvati — Pioggia e Tramonto

| Gate | Verdetto limitato |
|---|---|
| Pioggia, confronto con v58 compatibile | **PASS incrementale geometria/artifact per questa posa.** Le creste a sinistra conservano l'articolazione più continua già osservata al Sole. Non vedo un nuovo reticolo, speckle diffuso, rottura della costa o foro della mesh. |
| Tramonto, sola immagine candidata | **PASS scout per assenza di un blocker geometrico evidente; confronto A/B NON VERIFICABILE.** Non è una prova di miglioramento o assenza di regressioni rispetto alla baseline, che non è disponibile. |

Tutti e tre i PNG sono stati aperti con `view_image` a partire dai file nativi2474×1844. Nessuna modifica alle immagini, crop aggiuntivo, browser, GPU, modello, sampler, bake o test. Lettura/arithmetic dei soli metadata salvati e hash dei file.

## Pioggia: compatibilità del confronto

Baseline `docs/measurements/terrain-shadow-cache-2026-10-16/browser/v58-rain-B-native.png` contro `refine-main-rain-native.png`.

I JSON confermano seed74/sheared, `ultra`,384 passi, volume256³/dettaglio128³, output=internal=canvas2474×1844, t60 paused, orbit false, flow full, forcing/precipitation uniform time0. Target `[.3515625,3.119140625,-.0546875]`, origin circa `[15.45970789077028,7.558173047097125,2.780613896133632]`, yaw≈1.385286984640259, pitch≈.2811279826464208, ground1/approach0. Densità R8 e specializzazione rain coincidono.

Camera, luce e meteo non sono tutti identici come decimali Float64, ma coincidono dopo quantizzazione Float32; le differenze della posa sono nell'ultima cifra. Meteo assestato: rain≈.8/target.8, overcast.85, haze2.6, atmosphere progress/blend1, skyPending false. `weatherTime` owner diverso (baseline27.0693s, candidato157.8098s), mentre i clock effettivi di simulazione/flow/precipitazione sopra coincidono. La comparabilità è sufficiente per questa review visiva incrementale, **non costituisce bit-parità GPU né identità delle texture sky fra owner**. Dettagli in `independent-weather-compatibility.json`.

Il rilievo vicino e medio a sinistra mostra piccoli crinali/impluvi meno dominati dai grandi piani della baseline; il beneficio è moderato e leggibile anche nel contrasto più basso della pioggia. Costa e pianura destra non mostrano una regressione nuova riconoscibile. Le macchie scure nette sui versanti restano, con contorni in parte diversi: nessuna conclusione correttiva sulle ombre. Il grande velo verticale davanti a mare/costa resta visibile già nella baseline; questa review non ne promuove il realismo e non lo attribuisce al raffinamento. Anche qualità della nube e materiale/vegetazione restano fuori dal PASS.

## Tramonto: singola immagine

`refine-main-sunset-native.png` ha la stessa camera della candidata pioggia, ultra384/256³/128³, t60 paused, output2474×1844. Sunset amount1, skyIntent sunset, atmosphere progress/blend1, skyPending false; direzione Sole circa `[-.9519445,.0317315,.3046223]`.

Non noto buchi, strappi, file regolari di puntini o bordi separati della mesh. La costa appare continua e le sagome montuose rimangono riconoscibili. Tuttavia il terreno è molto scuro e velato dall'atmosfera: i versanti interni e gli eventuali difetti piccoli sono poco leggibili. **Non rivendico creste migliorate al Tramonto, ombre corrette o nessuna nuova regressione** senza baseline abbinata. La tinta arancione e la scena nel suo complesso non sono un PASS fotorealistico.

## Identità degli input

| PNG | Byte | SHA256 |
|---|---:|---|
| v58-rain-B-native.png | 2.508.514 | `9d4d3c19e24bf237691e3d18af0ae4e88b605cfc66c4637269062d72324e16de` |
| refine-main-rain-native.png | 2.585.113 | `0dd971b684b29c9d9855a405878d903da025eb729f17832dda813ac50051fa1b` |
| refine-main-sunset-native.png | 1.668.288 | `02bec7fddafd7889c7dcf3d20bd5c10d371f9fa8adddd6fb041643df2655ef8e` |

Solo pose statiche salvate: nessuna qualifica di movimento, altre camere, tutto il core, ombre, rain curtain, anatomia/volume della nube o FPS. Nessuna adozione implicita dal verdetto incrementale.
