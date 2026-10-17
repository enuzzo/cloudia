# GLO30 static mesh — review visiva nativa

17 ottobre 2026. **FAIL del gate di credibilità fotografica: miglioramento locale della geometria insufficiente, senza ragione per procedere a weather/worker/FPS.** Ho ispezionato con `view_image` il PNG completo candidato e le due coppie di ROI originali 1:1. Nessun rendering, modello, test, build o modifica sorgente.

Il PNG esaminato è esclusivamente `candidate-after-forced-native.png`: 2474×1844, 2.977.207 byte, SHA256 `90c8db0b4d7b9b3d4d31f80cf770007138359ede99fd3d1ce23b93ddac678e65`, acquisito dopo il fresh ripetuto. I metadati indicano seed74, Sole assestato, t60 in pausa, forcing/precipitazione0, niente orbita, output nativo e384 passi nominali. Il confronto usa la baseline canonica `90641c32…` nei box fissati dal ledger: primario [0,560,1000,1000], secondario [700,540,1030,780], senza ridimensionamento o modifica tonale.

## Giudizio indipendente

1. **La forma cambia un poco, la lettura generale resta troppo levigata.** Nel primario alcune creste e pieghe risultano più articolate e meno semplici del riferimento: non considero il candidato identico o privo di qualsiasi differenza utile. Tuttavia dominano ancora lunghi versanti arrotondati e uniformemente lisci; i bacini si leggono come una superficie modellata e sfumata, più che come terreno montuoso con roccia e incisioni riconoscibili. Sul frame completo la maggiore risoluzione della sorgente non produce il salto di credibilità cercato.
2. **Il materiale continua a spiegare poco della superficie.** Rimangono ampie campiture verde/grigio/beige e una transizione luminosa molto continua sulle pendenze. Non emerge una tessitura rocciosa convincente né una chiara differenza di struttura fra roccia e copertura vegetale nelle ROI. Questo è un giudizio sull’aspetto: non classifica i pixel WorldCover e non separa albedo, normali, ambiente o luce diretta.
3. **I segni scuri restano evidenti e alcuni diventano più frequenti visivamente.** Il primario candidato mostra numerosi piccoli trattini/puntini e frammenti scuri sulle creste e sulle facce inclinate, oltre a chiazze più larghe. Nel secondario persiste la chiazza scura del versante centrale e compaiono altri piccoli segni nelle vicinanze. Non li leggo come convincente dettaglio geologico: interrompono la continuità della superficie. L’immagine non dimostra che siano shadow acne, geometria, normali o un altro termine del materiale; non attribuisco una causa senza la query diagnostica prevista.

Non propongo soglie, bias o sweep dopo questa immagine. Il risultato non è un materiale finale, non è un PASS artistico e non informa sugli FPS. L’eventuale miglioramento misurato CPU della fedeltà geometrica non risolve da solo il difetto percettivo visto qui.

## Limite del tentativo cache

Il primo audit actual `04239524…` cached / `d7dfd69b…` fresh resta **FAIL_F32_DIFFERENCE**, anche se il fresh successivo è stabile. Non è stato catturato qui il PNG del primo cached: questa review non può localizzare visivamente le differenze fra quei due target, stimarne la gravità o cancellare il FAIL. La sola immagine dopo il fresh non prova la correttezza della cache. Il prossimo run R2 di localizzazione è una diagnosi separata, non un’estensione della qualifica artistica.

## Provenienza dei ritagli letti

| File | SHA256 |
|---|---|
| `baseline-primary-roi.png` | `435a18cbd0730c3f0328b110bf77e0d13a3b804174673826971ee21cd9f64b52` |
| `candidate-primary-roi.png` | `e82183204966262e5ac425b7fdf2dd5218666e8809659abb124503c28dfebfb6` |
| `baseline-secondary-roi.png` | `f463179eebbf4a86907cad5b12f668a67420bfb40b1db1568522178fcb1080b1` |
| `candidate-secondary-roi.png` | `e33d1e73d4bef15ab5d31d7664cf0139d3f4f84eaef9dc4bbdebaef11151ee88` |

Le dimensioni e gli SHA sono stati letti dai file locali e coincidono con il ledger. Nessun nuovo crop o trattamento è stato generato da questa review.
