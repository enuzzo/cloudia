# Support R8 — verifica indipendente della microprova salvata

**PASS sui punti/casi dichiarati**, distinto dalla futura parità applicativa. Nessuna esecuzione GPU, modello, test o build del reviewer: sola lettura/hash e decodifica dei word salvati.

Report `browser/support-sampling-preflight.json`: **624419 B**, SHA **`fcdd012e9cf32bbc3a2f4cad0376a41b15427c71313867910211ef497de4bedc`**. Protocollo `ec9365c6…` e pagina `1f7ee832…` ancora esatti. Shader salvato uguale al testo della pagina congelata, size128, rgba8unorm/r8unorm e sampler Repeat+Linear/mipmapNearest coerenti.

Verificati **7833 punti**, **31332 word Float32 di input** (stride4, padding zero), categorie 4096 centri/729 interni/1280 piano-zero/1728 clamp; tutti i float finiti. I tre word adiacenti **1056833535/1056833536/1056833537** sono distinti e realmente presenti fra le coordinate x inviate. Per ciascun caso, **15666 word di risultato** ricostruiscono esattamente lo SHA del buffer F32 salvato.

| Caso | Differenze bit / zero | Nonfinite | Coppie zero | Coppie positive | Minimo positivo osservato |
|---|---:|---:|---:|---:|---:|
| byte-ramp | 0 / 0 | 0 | 251 | 7582 | .003921568859368563 |
| binary-step-and-hole | 0 / 0 | 0 | 7077 | 756 | .5 |

I conteggi e maxAbs0 sono stati ricalcolati dai word, senza usare il booleano PASS come prova; ogni caso somma7833 coppie zero/positive. Dimensioni payload8388608/2097152 B coerenti. `validationError:null`, `deviceDestroyed:true` e `pass:true` sono coerenti col percorso della pagina precedentemente rivisto, che pubblica soltanto dopo drain/readback e chiusura del device.

**Limiti preservati:** nel campo binario il minimo positivo campionato è .5; questi ULP non dimostrano comportamento per ogni coda filtrata positiva molto piccola. Il foro sintetico non è coperto esplicitamente dai punti, come segnalato prima dei dati. Non vengono aggiunti punti, soglie o nuovi gate dopo il risultato. Il PASS resta locale a questi campioni/device; non dimostra universalità del filtro, integrazione/upload Three, parità del PNG applicativo, frame animati, velocità o presentazione. La successiva verifica nativa completa rimane necessaria.
