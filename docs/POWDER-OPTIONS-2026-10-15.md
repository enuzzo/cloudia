# Powder volumetrico: ipotesi condizionata

15 ottobre 2026. **PROPOSTA NON IMPLEMENTATA.** Nessuna nuova cache, immagine,
misura GPU o validazione del modello. Il problema di qualità ravvicinata resta
aperto. Dopo la guardia v39 insufficiente, le varianti sperimentali sono ritirate:
la baseline ripristinata è `b2613c2`, con liquido **18/km** e ghiaccio **6,5/km**.

## Origine e differenza della proposta

La presentazione Guerrilla del 2015 usa `P(d) = 1 − exp(−2d)` insieme a Beer
per approssimare il potenziale di in-scattering che cresce verso l'interno.
Qui `d` viene reinterpretato esplicitamente come spessore ottico adimensionale;
non si trasferisce la scala numerica di densità di quel renderer [1].
Nel 2017 Nubis usa densità dell'intorno a LOD più basso, bias e un profilo
verticale; le note segnalano che annullare l'in-scattering ai bordi li rende
troppo scuri [2]. Queste sono approssimazioni artistiche, non una legge fisica
universale né una calibrazione del materiale Cloudia.

**Premessa necessaria:** la densità corrente deve già contenere variazioni che
il fill luminoso appiattisce. Un powder basato sulla sola densità locale non
ricostruisce lobi assenti e non aggiunge informazione sul trasporto circostante.
Se il segnale utile non emerge, questa proposta non giustifica un'altra prova.

## Una sola formula candidata

```text
L = 0.025 km
sigma = beta(ice) * rho_noMicro
tau_p ≈ sigma * L
P = 1 − exp(−2*tau_p)
g = 1 − 0.20*(1−ice)*(1−P)

source = direct + floor + g*diffuse + flash
```

`rho_noMicro` include materiale, massa, forcing, frammenti e flusso applicati
una volta, prima della microerosione dipendente dalla camera. La massa non va
moltiplicata nuovamente in `sigma`. `beta(ice)` interpola 18 e 6,5/km.
`diffuse` è ambient più la parte delle multiple dipendente da tau, con gli
attuali fattori meteo; `floor` conserva il termine costante `(0.028,0.032,0.04)`
delle multiple, incluso il suo fattore meteo. Il diretto e il flash restano tali.

La stima assume densità omogenea sui **25 m fissi**, non integra l'intorno.
Non usa opacità del segmento, passo di marcia o distanza dalla camera.
Per ingressi fisici non negativi e `ice` in `[0,1]`, `g` resta in `[0.8,1]`;
nel ghiaccio puro e ad ampiezza zero la modifica è identità. Non aggiunge
un altro Beer: estinzione del mezzo e attenuazione solare sono già integrate.

Valori analitici per liquido puro, `rho_noMicro` già comprensiva della massa:

| rho | tau su 25 m, baseline 18 | g, baseline 18 | g, ipotesi 50 ritirata |
| ---: | ---: | ---: | ---: |
| 0,80 | 0,3600 | 0,90265 | 0,97293 |
| 0,20 | 0,0900 | 0,83295 | 0,87869 |
| 0,05 | 0,0225 | 0,80880 | 0,82350 |

**50/km non è attivo:** l'ultima colonna serve soltanto a confrontare l'ipotesi
iniziale. A 18/km anche il corpo con rho=0,8 perde circa il 9,7% del diffuso:
il rischio di semplice oscuramento è maggiore di quanto suggerisse la tabella a 50/km.

## Controllo decisivo e limiti

La formula modifica il fill, senza riproporre fase120 e cielo5 ritirati né
la correzione solare locale128m rinviata dopo il solo audit CPU; vedere
[opzioni luce](LIGHTING-OPTIONS-2026-10-15.md) e
[audit locale](EXPERIMENT-LOCAL-LIGHT-2026-10-15.md).
È un nostro adattamento diagnostico: applicare questa probabilità al fill
esistente non equivale al modello Nubis completo e non dimostra correttezza
energetica. La maggiore articolazione della sorgente non è contrasto dei pixel.

Prima di implementare, verificare il segnale di densità. Un'eventuale sola
guardia frontale80 richiede camera, tempo, luce, meteo e qualità identici,
oltre a un **controllo con fill attenuato uniformemente alla stessa luminanza
media della candidata**. Promuovere soltanto lobi/cavità più leggibili anche
rispetto a quel controllo; CV maggiore e media minore non sono sufficienti.
Un contorno scuro uniforme, alone o aspetto solido/gessoso sono esiti negativi.

Il limite superiore evita nuovo riempimento bianco, il floor e il limite del
20% riducono il rischio di bordi neri, senza eliminarlo. Densità, trasmittanza,
pioggia/virga e paesaggio non entrano nella modifica proposta. Prima di altre
pose servirebbero identità ad ampiezza zero, invarianza al passo, limiti e parità
CPU/WGSL; solo dopo un beneficio visivo si misurerebbe il costo. Il costo atteso
è un'esponenziale per campione liquido interessato, senza texture o bake nuovi:
**non è una misura GPU**. Nessuno di questi controlli è stato eseguito qui.

## Fonti primarie

- [1] [Schneider/Vos, The Real-time Volumetric Cloudscapes of Horizon: Zero Dawn, Lighting, SIGGRAPH 2015](https://d3d3g8mu99pzk9.cloudfront.net/AndrewSchneider/The-Real-time-Volumetric-Cloudscapes-of-Horizon-Zero-Dawn.pdf).
- [2] [Schneider, Nubis: Authoring Real-Time Volumetric Cloudscapes with the Decima Engine, slide 87–91 e note, SIGGRAPH 2017](https://advances.realtimerendering.com/s2017/Nubis%20-%20Authoring%20Realtime%20Volumetric%20Cloudscapes%20with%20the%20Decima%20Engine%20-%20Final%20.pdf).
