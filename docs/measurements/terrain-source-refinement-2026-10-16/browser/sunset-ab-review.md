# Addendum — confronto A/B Tramonto da PNG salvati

**PASS incrementale di non regressione visibile per questa posa.** Ho aperto entrambi i PNG nativi2474×1844 con `view_image`. Non vedo un nuovo reticolo/speckle, strappi o fori della mesh, né una regressione evidente del profilo costiero. Il beneficio sulle creste è poco leggibile nel contrasto basso: **non rivendico un miglioramento convincente al Tramonto** solo da questo confronto.

Questo addendum aggiorna il limite della review precedente: ora la baseline abbinata è disponibile, quindi non si tratta più di un controllo della sola immagine candidata. Le review precedenti restano conservate, senza riscriverle.

## Compatibilità verificata dai JSON

Entrambe: main, ultra384 passi, volume256³/dettaglio128³, output=internal2474×1844, t60 paused. Le componenti della camera riportate coincidono: origin `[15.45970789077028,7.558173047097125,2.780613896133632]`, target `[.3515625,3.119140625,-.0546875]`, yaw `1.385286984640259`, pitch `.2811279826464208`, ground1/approach0. Sunset amount1, stessa direzione Sole `[-.9519445346424992,.031731484488083314,.30462225108559976]`, haze1.6/overcast0, skyIntent sunset, skyPending false, atmosphere progress/blend1.

Differenza dichiarata: rain baseline **0**, candidata **6.977058283793074e−10**, entrambe targetRain0. Il residuo è visivamente trascurabile in queste immagini; non dichiaro identità completa di tutti gli input o bitmap.

## Lettura e limiti

Le silhouette dei monti lontani e la costa restano coerenti fra A/B. I crinali e i versanti interni sono scuri e velati: eventuali piccoli difetti e le vecchie patch shadow non sono ben osservabili con questa luce. Nessuna conclusione correttiva sulle ombre, né qualifica globale di fotorealismo, materiale/foresta, nube o rain curtain. Una sola posa statica non qualifica movimento, altre camere, tutto il core o FPS.

| File | Byte | SHA256 |
|---|---:|---|
| stable-main-sunset-native.png | 1.663.003 | `0b259ab4c22958f0c8d83c7f20a5739db82272d284b80ade66e80d37070989c2` |
| refine-main-sunset-native.png | 1.668.288 | `02bec7fddafd7889c7dcf3d20bd5c10d371f9fa8adddd6fb041643df2655ef8e` |

Originali preservati. Nessun crop aggiuntivo, browser, GPU, modello, sampler, test o benchmark eseguito per questa review; soltanto lettura dei file salvati e scrittura di questo addendum.
