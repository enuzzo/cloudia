# Emissione macro/fine — review indipendente dei dati

**Non propongo il prossimo native sulla sola evidenza attuale.** Ho letto result/hook/run, entrambe le RG8 da8192 B e il confronto PNG già esistente; PPM e PNG decodificano gli stessi pixel. Nessun modello, test, nuova immagine o coefficiente aggiunto. Le statistiche supplementari usano soltanto i due piccoli buffer salvati.

La prova numerica è valida nel proprio ambito: exit0,0.621920CPU child,0.585650s wall,130.449.408 B RSS terminale; macro originale e reducer con accessor coincidono negli8192 byte, hash degli input fine/macro invariati, cinque bake originali completati. È una singola generazione64/64, seed74.

| Osservazione post filtro | Macro | Fine |
|---|---:|---:|
| Somma codici R |133660|123177 (−7.8430%)|
| Texel R>0 |953|927|
| Base decodificata pesata da R |1.019668km|1.033617km|

Nessun R aumenta e nessun nuovo texel diventa positivo. I26 texel persi avevano tutti Rmacro=1 o2, complessivamente29 codici, solo.02170% della somma originale. Sono tutti sul bordo originale8-connesso; i nuovi zeri restano collegati all’esterno e non aprono fori interni chiusi in quella topologia discreta. Il baricentro si muove di circa+.248m in X e−7.749m in Z; il support bound cambia soltanto sul lato Zmax, di un texel (.109375km).

La variazione **non è una scala globale esatta**: rapporti fine/macro sul supporto comune p50=.86897, p95=1; TV delle distribuzioni normalizzate=.036242 e correlazione=.997486. Nel confronto salvato, però, l’ingombro e la massa continua rimangono sostanzialmente gli stessi; il delta si distribuisce sul medesimo blob. Rispetto al compito di ottenere vere articolazioni/aperture, prevale una pulizia/attenuazione non uniforme, senza una nuova organizzazione convincente dell’emissione. La topologia R>0 serve a descrivere questi byte, non è una soglia artistica universale: aperture ottiche possono esistere anche con R positivo.

**G e alone:** sui927 texel comuni positivi il delta di base ha mediana+23.53m, p95+70.59m e range−47.06…+141.18m. Il massimo dell’alone a Rzero in entrambe le mappe è+1.42353km (x24,z51), ma lì nessuno degli8 vicini è fine-positivo e il massimo vicino macro è appena1. Limitando l’osservazione ai120 texel di alone adiacenti a un fine-positivo, maxAbsDeltaBase=.52941km (x42,z24, delta negativo), con massimo vicino fineR=3 e macroR=5. Questi cambiamenti di base presso sorgenti deboli non vanno ignorati né presentati come un guadagno di struttura nel nucleo; l’interpolazione G è un limite separato per un eventuale futuro native.

Conclusione limitata: diagnostico tecnicamente riuscito, ma evidenza insufficiente per motivare adesso un’implementazione/render mirato alle cortine credibili. Non equivale a dimostrare che il fine sia inutile o che256/128 darebbe lo stesso risultato. I soli output post filtro non isolano quanto dipenda dal campo fine, dal threshold o dal filtraggio; non suggerisco sweep o compensazioni. Nessuna adozione, prova GPU, meteorologica o FPS viene dedotta.

## Provenienza

- `result.json` SHA256 `b56c72b1f3ecf3186117530fcbe2a1328709eaeed34fc5ba3d035ba5f20ef0d9`
- `hook.json` SHA256 `3421cd5865b0e25cefe563d6f05f17e1ab2a44112bc36828ae48f071ecd0dbb8`
- `run.json` SHA256 `b4fac74506509c0c36cbf7e8cb9daaeabc17906090eb6f8dd8ec9bdb73c5c7b2`
- `macro-rg.bin` SHA256 `342a1098fedf0e0d5a8014419eca6b720a1c0ad8c9aa6819ed9f61e2b1dbd250`
- `fine-rg.bin` SHA256 `f4ee6bf153666d4582f8ab6b26d327b6d90733ef1ae8ba28b2dfdb30de8e67c8`
- `comparison.ppm` SHA256 `a7d68d4a72f495085d9efbc71a76ba05f9a034b29ada7325c4c4708fdc09ecc1`
- `comparison.png` SHA256 `fa477f33b2f86a2c48cda3011a71be47cde410b1c4f17da6fc61a014ebba77f9`
