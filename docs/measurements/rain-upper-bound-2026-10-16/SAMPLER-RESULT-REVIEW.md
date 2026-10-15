# Revisione indipendente del risultato sampler

2026-10-16. Esaminati soltanto `sampler-gpu-result.json` e
`RAIN-UPPER-INDEPENDENT-REVIEW.md`. Nessuna nuova esecuzione GPU/browser, bake,
build o modifica al prodotto. La verifica locale è limitata a lettura,
aggregazione dei contatori e ricalcolo dell'integrità JSON.

**Esito:** il PASS è sostenuto dai dati salvati per questi campioni sul backend
Apple `metal-3`, adattatore non fallback. Soddisfa la qualificazione numerica
campionata richiesta dalla prova; non rende universale il bound del filtro.

| Evidenza | Risultato |
| --- | ---: |
| Dataset / UV f32 | 14 / 39.614 |
| UV strettamente nel dominio produttivo | 37.598 |
| Endpoint/fuori dominio, usati per verificare clamp | 2.016 |
| Campioni GPU con R positivo | 16.520 |
| Falsi R positivi sulle due mappe interamente R=0 | 0 su 2.018 query |
| Output non finiti / errori echo UV / errori non catturati | 0 / 0 / 0 |
| Violazioni bound G, slack o attachment al guard | 0 |
| Massimo G sopra il massimo halo, fra i campioni R>0 | 5,72672×10⁻⁹ |
| Minimo slack reale `guardedCeiling - (base+.3)` | 11,795163 m |
| Minimo slack della prova avversaria G+un codice | 30,398369 mm |

Per tre growth f32 (`1`, `1.25`, `1.470588207244873`), l'attachment è esattamente
zero al ceiling incluso e al successivo f32, primo punto che il confronto `<=`
salta. Non è soltanto una tolleranza su G o un errore medio. Anche l'envelope
avversario di un codice G resta a zero. Questi risultati sono coerenti con il
guard `3/255 + 2^-15 km`, senza consumarne tutto il margine aritmetico.

La mappa reale seed 72 riusata ha halo G massimo 196/255, base decodificata
1,805882353 km e 1.336 texel R positivi. Le sue 26.497 query includono 8.464
campioni GPU R>0, con slack minimo 85,795283 m. Il witness massimo include G 193/194
su corner R=0 e G 178/180 sui corner R>0: conferma perché il massimo va cercato
anche nell'halo, senza limitarsi ai texel R positivi.

Il massimo errore G rispetto all'interpolazione ideale CPU è 0,002051591873
(0,000762670882 per la mappa reale). **Questo non è overshoot del massimo halo**:
misura anche la diversa precisione dei pesi/coordinate. Non contraddice il PASS
e non dimostra interpolazione CPU/GPU identica.

## Provenienza e integrità

- File risultato SHA256: `1647cdd4c8026f069c456f9593516f0bbc0111d4ce81c2d07602de5a1df6e56a`.
- Payload SHA256 ricalcolato con `JSON.stringify` dopo aver escluso `integrity`: `145eaae407ef646c035685af0b31ca3bdf9be97255d2616d51e64513e55a3ea0`; coincide.
- WGSL eseguito: `ac28684c0407c6d659238fda6fe7b5b502822966943913dfbb96237953e1c190`, coincide con lo shader inizialmente revisionato.
- Runner eseguito riportato: `a255b8588ba89d2432487472e44c0e7150dbc564dc3b3a440366f9fec17ada37`, diverso dalla release iniziale dopo la strumentazione del root. Conservare questa versione insieme al risultato; il suo diff non è stato riaperto in questa revisione limitata ai due documenti.
- Mappa reale: `c8f6dc2c8abb0717ec3051c0f958648ec541604f3718eb0f7621cb047d961fe2`.
- Il report registra `deviceDestroyed=true` e `perMapResourcesDestroyed=true`; non è una misura esterna dell'assenza di leak.

## Cosa resta escluso

Restano esclusi UV non campionati, altri dispositivi/driver e una garanzia
normativa universale sull'overshoot numerico del sampler. Sono verificati tre
reciproci di altezza, non l'intero continuo di growth. La prova analitica resta
subordinata a crescita positiva nel range qualificato, halo completo dei byte
correnti, filtro/clamp/mip invariati e guard in `rp.y=position.y-drift.y`.

Questo è compute WebGPU autonomo: non prova binding/format reali di Three.js,
aggiornamento dell'uniform al cambio mappa, fase d'ingresso, sequenza t/ds/jitter,
trasporto nube/pioggia completo, pixel o accettazione visiva. Non misura FPS,
throughput o convenienza del guard; il tempo wall dell'audit comprende il runner
e le sue attese. Questi restano i gate separati del confronto renderer che il
root sta eseguendo. Nessun nuovo bake è stato effettuato per questa revisione.
