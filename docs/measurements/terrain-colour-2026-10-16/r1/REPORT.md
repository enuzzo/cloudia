# S2 — proposta minima cromatica, non applicata

Si propone una sola modifica isolata: **tre righe WGSL / sei endpoint RGB**
di alberi ed erba, senza nuovi lookup, texture, rumori, ALU, branch o pass.
Forma/DEM, classi WorldCover, ombre, canopy normal, slope grain, luminanza
intrinseca autoriale e tutta la variazione scalare del materiale restano invariati.
Il prodotto non è stato modificato né la proposta qualificata in GPU.

## Dato e trasformazione

S2 2021 v200, annual median L2A B04/B03/B02/B08, overview4; il riferimento è
riflettanza osservata già illuminata, **non albedo**. Maschere congelate:
lattice250m, validità≥.99, classe≥.95, NoData/crop/built/acqua≤.01, Y∈[.02,.60],
esclusione euristica grigio-brillante. Class10 N80.090; class30 N2.628.
Arbusti20 N28 e bare60 N10 non autorizzano alcuna nuova palette.

Pesi Y=(.2126,.7152,.0722). Si parte dalla mediana per componente di RGB/Y,
rinormalizzata con un'ulteriore divisione per dot(Y,mediana):

- Alberi C10=[.835143317162313,1.083371861017250,.659570301547855], dot(Y,C)=1.
- Erba C30=[1.034633731686594,1.021889893739464,.681180285885947], dot(Y,C)=1.

Per ogni endpoint corrente E: **E′=dot(Y,E)×Cclasse**. Non si trasferisce la
luminanza S2 nel materiale. Le mediane Y osservate, solo descrittive, sono
.0456371 alberi e.0845833 erba: rientrano nelle variazioni luminose già autoriali.
I literal proposti hanno nove cifre significative, sufficienti al round-trip f32.

| Endpoint | Y attuale | Cromia attuale Y1 | RGB candidato |
|---|---:|---|---|
| denseForestLo | 0.0360272 | [0.527379, 1.165786, 0.749434] | [0.030087875, 0.039030854, 0.023762472] |
| denseForestHi | 0.0644584 | [0.605041, 1.163541, 0.542986] | [0.053832002, 0.069832414, 0.042514846] |
| openForestLo | 0.0581332 | [0.928901, 1.066516, 0.550460] | [0.048549555, 0.062979870, 0.038342934] |
| openForestHi | 0.0781224 | [0.960032, 1.062435, 0.499217] | [0.065243401, 0.084635608, 0.051527213] |
| grassLo | 0.0768572 | [0.819702, 1.105947, 0.481412] | [0.079519048, 0.078539595, 0.052353609] |
| grassHi | 0.1125512 | [0.932909, 1.066181, 0.541976] | [0.116449267, 0.115014933, 0.076667659] |

## Perché il verde cambia e cosa matte/grain conservano

La foresta densa corrente ha verde Y1≈1.164–1.166 e rosso.527–.605; S2 ha verde
1.083 e rosso.835: meno sbilanciamento verde nei nuclei densi. La foresta aperta
corrente ha blu.499–.550; S2.660: meno giallo nei versanti aperti. L'erba corrente
ha verde1.066–1.106/blu.481–.542; S2 verde1.022/blu.681, quindi vira verso una cromia
più neutra e meno giallo-verde. È un riferimento misurato, non il giudizio di una foto GPU.

Il fattore umidità forestale `[.88,1]`, i mix canopy/broad/denseCover e tutte
le frazioni WorldCover sono scalari o mix lineari: conservano Y in aritmetica
reale per qualsiasi loro valore. Un piccolo oracle su54 combinazioni estremali/
intermedie dà massimo errore2,78e−17; dopo quantizzazione dei literal f32,
massimo residuo Y sugli endpoint4,06e−9 (relativo6,30e−8). Non è una promessa
bit-exact di compilazione WGSL/FMA o radiance finale.

Il materiale è già diffuse matte, senza speculare. `rough` cambia solo la
normale usata da diffuse e skyVisibility; il suo grain/canopy e il filtraggio
per footprint restano identici. Non c'è una desaturazione RGB nascosta da
compensare: l'effetto cromatico successivo è il prodotto per solar/ambient RGB.
I moltiplicatori scalari direct.90, ambient1.12, ombra e valley non vengono
ritoccati. Il materiale continua quindi ad avere gli stessi chiaroscuri e
scale di grana, salvo la risposta inevitabile ai colori della luce.

## Rischi e limite preciso della conservazione

1. Y intrinseca viene conservata, **non necessariamente Y della radiance sotto
   illuminanti colorati**: dot(Y,E′×L) può differire da dot(Y,E×L). Alba/pioggia,
   cielo azzurro e foschia vanno giudicati con la pipeline reale.
2. Tutti gli endpoint di una classe convergono alla stessa cromia; si conserva
   la variazione luminosa di stand e canopy, ma si riduce la variazione di tinta
   autoriale. I percentili S2 mostrano variabilità vera: questa prova minima
   della mediana non ne ricostruisce la distribuzione o le ombre topografiche.
3. WorldCover10 include oliveti/piantagioni; erba include stati stagionali diversi.
   Non si dichiara bosco naturale certificato. Roccia/cave bianche, arbusti,
   coltivi e costruito restano invariati: LOW_N non viene aggirato. Il desiderio
   di geografia reale comprendente abitati, a FPS uguali, resta un tema distinto
   da questa singola prova cromatica, che non contiene una texture S2.

🌟 Prova consigliata: stesso seed/stato/camera/sole e viewport di tre controlli
costa–interno–montagna, quindi una vista pioggia; confrontare GPU reale e foto
CSS dichiarate, senza chiamare il dato cromatico una qualifica fotorealistica.
Non essendoci lavoro GPU nuovo, il costo è strutturalmente lo stesso; nessun
FPS uguale è però stato misurato. Prima dell'adozione verificare la preferenza
visiva e mantenere il notice di derivazione in `terrain-data-notice.txt`.

## Artefatti

`terrainSurface.before.ts`, `terrainSurface.after.ts`, `palette-only.patch`,
`comparison.json`: sorgente corrente catturato, proposta e numeri completi.
SHA base in comparison.json: c9745e3c727434a32c71e9d1e6ddd52eefb4db73880be10000d1b2c1cc811d87.
Il candidato build esterno successivo aggiunge solo commento esplicativo e
rendererVersion trial: la patch cromatica resta distinta e recuperabile.
