# Cache difference R2 — review indipendente dei risultati salvati

17 ottobre 2026. **PASS della riproduzione e della coerenza aritmetica dei report; il confronto bit-exact resta FAIL, senza causa unica identificata.** Sola lettura dei JSON R1/R2 e aritmetica dei sette record; nessun replay dei buffer completi, modello, test, browser o GPU.

## Riproduzione esatta R1 → R2

| Campo | R1 ordinary audit | R2 difference audit |
|---|---|---|
| Stato | FAIL_F32_DIFFERENCE | FAIL_F32_DIFFERENCE |
| stable / cacheStateQualified | true / true | true / true |
| RGBA cached | `04239524bbd9181fda93fc4a207ff450edd0a92cf6c470a09a0e6134ceb2caab` | identico a R1 |
| RGBA fresh | `d7dfd69b584300db49db81af4224caa0bf93952636628872cc43ea541eab6b8d` | identico a R1 |
| Readback richiesti | 2 | 4 |

Le due strutture cached/fresh (dimensioni, byte, formato, hash e scope) coincidono esattamente fra i report. Entrambi riguardano2474×1844, 72.992.896 byte packed /73.169.824 byte restituiti. R2 è un nuovo owner strumentato; il suo rendererVersion cambia intenzionalmente. Coincidono i campi di scena selezionati: seed/famiglia, camera completa, qualità256³/128³/384/output, materiale, meteo, luce, terreno, pause/orbita e flow/ablation. Nei clock applicati cambia soltanto weatherTime; simulazione60, forcing0 e precipitazione0 restano identici. Non si pretende identità di tempo wall, UUID o contatori fra owner.

## Differenza RGBA circoscritta

Il report R2 dichiara confronto su **18.248.224 parole /4.562.056 pixel**:

- 21 parole cambiate, in7 pixel;7R,7G,7B, **0alpha**.
- Bounding box raw `{x:284,y:897,width:2,height:5}`; non è un conteggio di pixel PNG e non viene trasformato in una diagnosi geografica.
- Max delta assoluta finita per R/G/B: `.0033917909022420645 / .005331589374691248 / .002869958523660898`; alpha0.
- Tutte le parole comparate sono finite; zero NaN/Inf prima/dopo e zero cambi signed-zero.

Sono conservati tutti7 i pixel cambiati, entro il cap24 esempi. Ho verificato dai valori/bits salvati: maschera7 in ogni record, alpha bit-identica, conteggi21 e7, bbox e massimi per canale ricostruiti esattamente. I21 valori RGB fresh sono tutti inferiori al cached. Non è stata ricostruita dal file una differenza globale su array raw: il conteggio all-target deriva dall’helper della qualifica, mentre questa review controlla il report e l’intera lista di differenze emessa.

**Zero differenze alpha è un risultato su tutto il target, non soltanto sui dodici vecchi campioni.** Quindi non è osservato alcun cambiamento dei bit di distanza/miss in questa vista. Non prova identità globale della geometria, delle normali, dei triangoli vincitori o di tutte le viste possibili. Il piccolo numero di parole non annulla il gate bit-exact e non quantifica costo/FPS o accettazione artistica.

## Attachment shadow separato

R2 legge prima/dopo l’attachment colore shadow R32F2048²,16.777.216 byte:

- cached `efedb5fbf752b8c0149234759a4fe233db6b4db30bf6934b054ba4e8e3dfae0a`;
- fresh `9eab703e2aa50491e4b05042d2d5bcde17294c27a02e6319c4bee2f6a12af0ee`.

Le hash diverse dimostrano che **la mappa colore shadow è cambiata**. Non danno numero, posizione, segno o grandezza delle differenze R32F. I contatori indicano una submission aggiuntiva sia per colore (149→150) sia per shadow (1→2), con hit invariati ed epoch incrementate. Questa co-occorrenza con i sette pixel RGB non identifica una causa unica: non sono letti depth, UBO actual, receiverGPU o caster winnerID; non attribuisco il fenomeno a shadow, driver, rounding o cache CPU.

Il PNG dopo il fresh stabile e il FAIL visivo già acquisito sono evidenze separate. Nessuna nuova qualifica weather/worker/FPS suggerita; il root chiude il checkpoint e ripristina la preview ordinaria.

## File esaminati

- `browser/candidate-first-f32.json`: 23587 byte, SHA256 `d9795acbc454becdb823c8c087beacaa9540aa5fbe08342a1dcd5c0291506f48`.
- `browser/difference-first-f32.json`: 31312 byte, SHA256 `0641eba9e20a0f60af04ca69545ddb2b692c8bbcfc8187dff49665b04b69eb22`.
