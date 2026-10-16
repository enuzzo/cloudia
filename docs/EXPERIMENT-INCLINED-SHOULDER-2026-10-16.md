# Spalla inclinata sotto l'incudine — miglioramento locale

Il candidato 14.1, confrontato con il baseline `08c33cb`, viene promosso localmente per rendere più sostanziale la connessione tra corpo superiore e sorgente dell'incudine nella famiglia sheared. Il profilo globale a uncino/U resta aperto: questa verifica non assegna un PASS fotografico generale.

## Problema e modifica

I collar esistenti partono dalla testa e arrivano alla calotta, lasciando scoperta una regione più bassa. Le sezioni individuate sul baseline reale dei seed 74, 77 e 80 risultano prive di densità dopo erosione anche a macro 256³ e dettaglio 128³.

Una sola massa ellissoidale inclinata collega il corpo superiore alla sorgente dell'incudine. Gli ancoraggi e le dimensioni derivano dall'anatomia contratta della cella; i parametri geometrici sono euristici e verificati sulle forme e viste archiviate. Le masse, decorazioni e sequenze casuali precedenti sono conservate. Il campo ruotato resta 1-Lipschitz e confluisce nella medesima densità usata da occupazione e bake della luce.

Restano macro 256³, dettaglio 128³, 384 passi nominali, output pieno e i coefficienti di luce, materiale ed erosione. La guida morfologica del progetto orienta la forma; i riferimenti WMO non convalidano questa parametrizzazione numerica.

## Verifiche numeriche e test

I 31 test mirati passano, comprese le 26 verifiche volume precedenti. La nuova regressione richiede soltanto presenza di densità fine nella sezione prima vuota del seed 74, senza soglie artistiche o modifica delle soglie esistenti.

A 256³, gli hash di densità R, RGBA completo, tramonto RG e dettaglio RGBA dei seed 72 e 73 coincidono con il baseline. Rivalutando tutti i 140.692.504 campioni esclusi dal prefilter su dieci volumi seriali, nessuna densità viene persa. Tutti e sei i margini macro dalle facce rimangono invariati; minimo sheared 1,03515625 km. Il controllo è CPU, distinto da campionamento GPU e giudizio visivo.

| Seed | x km | y km | τ Z baseline | τ Z candidato |
| --- | ---: | ---: | ---: | ---: |
| 74 | 0,560923 | 4,045844 | 0 | 13,816658 |
| 77 | 0,472604 | 3,699297 | 0 | 11,575198 |
| 80 | 0,526504 | 3,978208 | 0 | 8,971558 |

[Prove CPU, sorgenti e replay](measurements/inclined-shoulder-2026-10-16/README-it.md). [Risultati completi 256³](measurements/inclined-shoulder-2026-10-16/proof/comparison-256.json).

## Risultato browser e limiti

Il root e la revisione anatomica hanno esaminato frontali 74/77/80 e quarter, lato e retro 74. Il sostegno sotto la calotta risulta più continuo, senza la nuova parete cilindrica vista nei tentativi precedenti. La sorgente diventa più spessa e rotonda; l'uncino e la U globale persistono. I tramonti 74 sui due lati mantengono rilievo e separazione ombra/lume nelle immagini osservate, ma non hanno una coppia baseline completa.

La scena è configurata a output nativo 2560×1440; i JPEG restituiti sono 1280×720. Camera di confronto dichiarata dal root: mira `[0, 2.7, 0]`, tempo nube 60 s. Le immagini includono un banner diagnostico; il raggio vicino di 1 km non indica distanza dalla superficie. Matrici camera complete e PNG nativi senza perdita non sono archiviati per ogni scatto.

| Confronto | Baseline | Candidato |
| --- | --- | --- |
| 74 frontale | [JPEG](measurements/inclined-shoulder-2026-10-16/browser/baseline74-front0.jpg) | [JPEG](measurements/inclined-shoulder-2026-10-16/browser/shoulder1-74-front0.jpg) |
| 74 retro | [JPEG](measurements/inclined-shoulder-2026-10-16/browser/baseline74-rear0.jpg) | [JPEG](measurements/inclined-shoulder-2026-10-16/browser/shoulder1-74-rear0.jpg) |
| 77 frontale | [JPEG](measurements/inclined-shoulder-2026-10-16/browser/baseline77-front.jpg) | [JPEG](measurements/inclined-shoulder-2026-10-16/browser/shoulder1-77-front.jpg) |
| 80 frontale | [JPEG](measurements/inclined-shoulder-2026-10-16/browser/baseline80-front.jpg) | [JPEG](measurements/inclined-shoulder-2026-10-16/browser/shoulder1-80-front.jpg) |

[Posizioni, metadati e limiti delle catture](measurements/inclined-shoulder-2026-10-16/browser/capture-state.json). I contatori istantanei nei DOM non sono una prova FPS. Nessuna misura aerial/FPS è inclusa in questo archivio.

Il gate fotografico generale resta aperto, insieme alle verifiche specifiche di pioggia/virga, moto ravvicinato, paesaggio, UI e prestazioni. Il checkpoint dimostra il miglioramento locale dichiarato.
