# Review continua del certificato mask0 — ciclo8

Review in sola lettura della patch esterna. Nessun sorgente prodotto modificato,
nessun test, bake, build o esperimento GPU eseguito da questa review.

- Patch SHA-256: `c0fdc421f039ba266b2a16b1ccd354730c2dd07865c40563eb4c64cf6916e854`.
- Candidata shader SHA-256: `aa61a79b7643864498d6c5b9ca6935d8d9e88cdc6a0c58c91abd7a6ab07dca1a`.
- Fonti lette: `emptyTraversal.ts/.test.ts`, `volume.ts` (sampler/occupancy),
  `motion.ts`, `motionField.ts`, binding texture e growth in `GPUSceneEngine.ts`.

**Esito:** la patch mantiene passi e campioni originali ed è giustificata dal
bound continuo nel contratto live attuale. Per non legare la validità alle attuali
famiglie/curve di formazione, raccomando un gate esplicito di fase al rinnovo.
Non è ancora una dimostrazione binaria GPU né una previsione di FPS.

## Dal lookup zero a un intervallo continuo

A 256³/128³, indichiamo con m il passo macro, M=2m quello della mask, W il massimo
fine warp e D il massimo spostamento flow per asse. Un centro macro assegnato alla
mask dista al massimo M/4 dal centro coarse. `bakeOccupancy` dilata di
`R=ceil((W+D+m)/M)` celle. Il filtraggio lineare della mask positiva estende il suo
supporto fino a (R+1)M dal centro assegnato. Per ogni nodo macro positivo, un
lookup mask esattamente zero implica quindi separazione su almeno un asse.

Sottraendo offset dei centri, interpolazione macro, fine warp e flow resta

`margin = (R+1)M − M/4 − (W+D+m) − .001km`,

che coincide con `EMPTY_REFERENCE_MARGIN` per il rapporto 256/128. Il millimetro
non è l'unità del guard: `.001km` è **1m**. I margini risultanti sono circa
65,406m /65,289m /84,859m sui tre assi. È una separazione geometrica continua,
non la sola proprietà dei campioni ordinari a 18 m.

I rates in `conservativeEmptyStep` sono limiti delle norme delle righe del
Jacobiano di cloudReference. Per un raggio normalizzato, ogni coordinata reference
cambia al massimo `rate_i*s` per ogni distanza s nell'intervallo. Se E=emptyStep
supera S=stepSize, il floor assicura E≤safe; quindi H=E−S è strettamente interno
al margine certificato. Se E=S, H=0 e non c'è riuso. I punti a 6 m o i passi più
brevi dell'ispezione possono trovarsi ovunque dentro H: l'allineamento a 18 m non
è necessario. Le prove discrete esistenti sono regressioni, non sostituiscono
questa derivazione continua.

Il flow 16³ half-float non richiede un nuovo bound della sua derivata: l'halo usa
l'intera ampiezza satura D a ogni punto. Filtraggio lineare/clamp è una combinazione
convessa dei valori memorizzati; la quantizzazione half può superare leggermente
una costante decimale D, ma è piccola rispetto al guard 1 m. Non si è eseguita qui
una nuova qualificazione numerica del driver GPU.

## Clamp, crescita iniziale e dominio del Jacobiano

La detail texture ripete per RGB, ma alpha è letta con coordinate clippate fra i
centri estremi (`maskInset=.5/128`): non attraversa il bordo periodico. È equivalente
al sampler clamp CPU per alpha. La proiezione delle coordinate reference sul box
non crea un nuovo supporto più vicino. Il macro R live ha le sei facce esterne a 0;
warp e flow sono già inclusi nell'halo. Mantenere dimensioni, dilatazione, filtraggio,
clamp ai centri e ampiezze è parte del contratto; non generalizzare a sampler o
fixture arbitrari senza rivedere la prova.

Il rate X contiene un termine dipendente da maxAbsX soltanto nella transizione
ice di cloudReference. Il rainbox può superare il cloudbox, quindi quel parametro
non copre automaticamente tutto il dominio della pioggia. Nel modello attuale:

- rainRegion implica `(position-drift).y≤2.8`;
- se height>.723, referenceY<3.5995=minIceStart, quindi la derivata ice è 0 e
  il termine dipendente da X scompare anche fuori cloudbox;
- se height≤.723, siamo prima di 8 s e anvil=.58. Solo congestus può entrare nella
  transizione; gapIce≤.592, maxAbsX≥1.3 e abs(ga−gx)≥.587 danno ratesX>3.1 e
  safeX<.022km, minore di 2*(7/384). E=S e H=0: il riuso è disabilitato.

Questo chiude il caso per le famiglie, growth, rainUpper e qualità attuali.
Non è una proprietà dell'API con MotionState o famiglie future arbitrari.

## Gate esplicito raccomandato, non applicato da questa review

Nel solo ramo di lookup mask fresco, quando rainRegion e support == 0, calcolare H
e armare soltanto se l'intero intervallo resta sotto iceStart nel reference:

```wgsl
let H=max(0.0,emptyStep-stepSize);
if(H>0.0 && reference.y + growth.x*H + 0.001 < iceRange.x) {
  cloudEmptyUntil=t+H;
}
```

`growth.x` è l'inverso della crescita verticale. Usare reference.y prima del flow,
non l'ice del materiale dopo il flow. Il guard 1 m rende prudente il confronto di
fase. Dentro questo intervallo la derivata ice del reference è0; i rates calcolati
restano maggioranti senza richiedere un bound X del rainbox. Il gate aggiunge solo
pochi ALU dopo un mask0 fresco, nessun lookup texture e nessuna modifica ai passi.
Dove non passa si conserva il percorso originale. Non richiede una tabella di
altezze delle famiglie future; non rende però automatici futuri cambi di warp,
flow, growth o sampler. Va misurato separatamente per stabilire l'effetto sugli FPS.

## Controllo della patch effettiva e limiti

La patch attuale arma solo nel ramo `!reuseCloudEmpty`, usa t<until stretto,
limita il riuso a rainRegion e inizializza il timer per ogni raggio/frame. Non
rinnova il timer dagli zeri riusati: ciò avrebbe potuto estenderlo indefinitamente.
Fuori rainRegion esegue il percorso originale. Dentro rainRegion, sampleStep e
clipping non dipendono da support: t, punti pioggia e integrazione restano identici.
Un support che sarebbe diventato positivo può essere ignorato soltanto perché rho
resta 0; non si sostiene che la mask rimanga 0. Sorgente cloud e fase non contribuiscono
quando l'estinzione cloud è 0; la pioggia continua a ogni punto originale.

Restano da verificare sulla candidata completa: shader compilato, confronto GPU
immagine/radiance con stessi t, casi di rinnovo/scadenza e prestazioni native.
Ridurre lookup può essere più lento per branch/registri/divergenza: nessun guadagno
FPS è sostenuto da questa review. Il gate esplicito sopra è una raccomandazione,
non è presente nella patch con SHA riportato all'inizio.

## Addendum: gate applicato dal root, verifica in sola lettura

Sorgente prodotto letto successivamente: `src/cumulonimbus/cloudShader.ts`,
SHA-256 `76cb9177830693ca99a6437b68601a778c9c44b31a427f5e67b6186bbeb528f6`. Il blocco alle righe100–105 usa
`emptyInterval=max(0,emptyStep-stepSize)` e il gate raccomandato su reference.y
pre-flow con guard.001. Arma soltanto dopo lookup fresco e in rainRegion.
Non c'è H>0 esplicito, ma H=0 assegna until=t e il confronto stretto t<until
impedisce ugualmente ogni riuso. Il calcolo sampleStep/clipping è invariato.
Nessun errore aggiuntivo trovato nella revisione di questa versione.
La patch esterna con SHA sopra resta il prototipo precedente senza gate; questo
addendum identifica la versione prodotto distinta, modificata dal root.
Non è stata eseguita alcuna build, prova GPU o modifica prodotto da questa review.
