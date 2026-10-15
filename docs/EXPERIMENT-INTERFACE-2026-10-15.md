# Interfaccia liquida centrata: esperimento v30

15 ottobre 2026. **Variante respinta.** Il profilo con gain 32 non rende
leggibile il dettaglio locale nel fronte all'80%: il materiale resta sfocato.
L'esperimento non viene adottato, come già i soli rilievi
[v29](EXPERIMENT-SURFACE-BILLOWS-2026-10-15.md). La qualità artistica resta aperta.

Il [manifesto candidato](measurements/interface32-candidate-build-2026-10-15.json)
identifica `observatory-v30-interface32-experiment`, sorgenti e build.
La [patch v30](experiments/interface32-v30.patch) è relativa a `76f449a` e include
sia i rilievi v29 sia il profilo nuovo: è un'alternativa alla patch v29,
**non va applicata insieme a essa**.

## Formula e limiti fisici

Il passaggio viene applicato dopo `addLiquidSurfaceBillows`, lasciando invariati
selezione, RNG e disposizione dei **96 rilievi** di v29. Detto f il campo dopo
carving/unione e I la frazione di ghiaccio, con clamp nell'intervallo [0,1]:

```text
g0 = 10 + 4 I;       p0 = clamp(g0 f)
g1 = 32 + (14 − 32) I
p1 = clamp(g1 (f − 0.5/g0) + 0.5)
rhoNuova = rhoEsistente * p1/p0
```

Il rapporto vale zero se p0 è nullo e uno per ghiaccio completo. Il punto medio
normalizzato rimane f=0,5/g0 anche nelle fasi miste; il profilo del ghiaccio
completo e i nuclei già saturi restano invariati nel canale R. Le modulazioni
esistenti vengono mantenute tramite il rapporto, senza moltiplicarle due volte.
L'implementazione non amplia il supporto della condensazione.

La conservazione dell'integrale vale per una colonna planare uniforme con fase
e modulazione costanti, **prima dell'erosione fine**. Non prova conservazione
globale su forme curve, modulazione variabile, campioni quantizzati o dopo
l'erosione. Il campo post-carving non è una distanza esatta. Inoltre i texel
macro misurano circa 27–39 m: 1/32 non dimostra un'interfaccia GPU risolta di
31,25 m. Filtraggio lineare, deformazione fine e luce restano quelli esistenti.

Restringere la rampa centrata non riduce il cammino libero medio del nucleo.
Nell'esempio planare con modulazione interna 0,8 e beta=18/km, il cammino nel
nucleo uniforme è `1/(0.8*18) = 69,44 m` in entrambe le varianti. Misurando dal
vecchio livello f=0 e assumendo f uguale alla distanza, tau raggiunge uno a
**119,44 m in entrambe**, perché l'area della rampa centrata è conservata.
È un calcolo illustrativo pre-erosione, non una misura della nube renderizzata.

La maschera e tutte le cache luminose vengono rigenerate dalla nuova densità.
Non si aggiungono texture GPU o letture nello shader. Restano beta liquido
18/km, ghiaccio 6,5/km, macro 256³, dettaglio 128³ e 384 passi nominali.

## Confronto reale e costo osservato

| Variante, fronte 80% | Immagine | Report | rAF/s | GPU media, ms | GPU p95, ms |
| --- | --- | --- | ---: | ---: | ---: |
| v29, sola geometria aggiunta | [JPEG](measurements/surface-billows-2026-10-15/surface-billows-front80-sun.jpg) | [JSON](measurements/surface-billows-2026-10-15/surface-billows-front80-30s.json) | 59,9964 | 22,9120 | 26,9353 |
| v30, geometria e interfaccia | [JPEG](measurements/interface32-2026-10-15/interface32-front80-sun.jpg) | [JSON](measurements/interface32-2026-10-15/interface32-front80-30s.json) | 59,9950 | 23,4170 | 27,1319 |

Entrambe usano raggio fisso `0.6045067691053366` km, target
`[0.4296875, 2.9365234375, 0]` e origine esattamente identica
`[0.4296875, 2.9365234375, 1.1639784268955404]` km, anche rispetto alla
[vecchia baseline frontale](measurements/meso-2026-10-15/meso-baseline-near80-30s.json).
I support bounds cambiano con il profilo; la mira fissa impedisce che spostino
la camera. La sonda è saltata. Coincidono seme 1571198069, tempo 60 s in pausa,
Sole a sinistra, vento 55%, pioggia/dispersione zero, transizione conclusa,
yaw/pitch zero, orbita e lampi spenti, flusso completo, nessuna ablation.

Il rendering reale IAB è main thread WebGPU Apple/Metal-3, Three r186, output e
interno 1672×941, senza TAA o downscale. Il [dump DOM](measurements/interface32-2026-10-15/interface32-front80-state.txt)
conserva lo stato UI; il [dump console](measurements/interface32-2026-10-15/interface32-console.json)
è `[]`. La resa rimane morbida: non compare il dettaglio locale richiesto.

Le misure durano circa 30 s dopo 2 s di warmup, con 146 campioni GPU ciascuna.
Il +0,505 ms medio osservato è una singola coppia non alternata: orario, stato
termico e carico esterno possono differire, quindi non è un costo causale
isolato. Circa 60 callback rAF/s non attestano 60 fps presentati dal compositor.

## Verifica, archivio e ripristino

Durante la candidata passano 35 test volume/luce, controllo TypeScript e build;
non viene eseguita l'intera suite da 147 test sul modello candidato. La guardia
visiva e la misura sono reali sul main thread; non qualificano worker, mobile,
moto, altri semi o altre condizioni luminose.

Quattro file privati `interface32-*` — JPEG, report, DOM e console — sono copiati
byte per byte nella cartella delle misure, con SHA256 verificati e originali
preservati. `volume.ts` e i relativi test sono già ripristinati a `76f449a`;
beta resta 18/km. Il sorgente successivo v31 conserva gli strumenti di confronto
della camera, senza adottare i modelli v29/v30. La patch conserva l'esperimento,
non un risultato approvato o una chiusura dell'obiettivo.
