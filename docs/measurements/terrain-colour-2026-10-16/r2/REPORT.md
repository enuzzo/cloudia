# S2 palette R2 — correzione comune, variazione relativa conservata

**Candidato esterno non adottato. Una sola variante, nessun fitting.** R1 è
stata respinta perché collassare i quattro endpoint forestali a una cromia ha
appiattito il materiale. R1, foto e freeze restano conservati senza sovrascrittura.
R2 parte dai 119 file della base v54 congelata e cambia solo tre righe di colori,
un commento e rendererVersion `observatory-v55-s2-palette-r2-trial`.

## Formula fissata prima del calcolo

Pesi Y=(.2126,.7152,.0722). Per classe 10 si usa la media RGB aritmetica a peso
uguale dei quattro endpoint originali; per classe 30 dei due endpoint.
`chromRef=centroid/Y(centroid)`, `F=targetMedianY1/chromRef` per componente.
Per ogni endpoint: `raw=old*F`, `new=raw*Y(old)/Y(raw)`.

| Classe | Centroide RGB originale | F comune RGB |
|---|---|---|
|10 alberi |[.04675,.06550,.03325] |[1.057287867,.978926544,1.174041088] |
|30 erba |[.08400,.10250,.04900] |[1.166478093,.944168438,1.316543552] |

Target mediani S2 rinormalizzati a Y1: alberi
[.835143317,1.083371861,.659570302], N 80.090; erba
[1.034633732,1.021889894,.681180286], N 2.628. Nessuna modifica bare/shrub LOW_N,
crop/built/acqua, geometria, normali, grain, illuminazione o classi geografiche.

| Endpoint | Y attuale | RGB originale | RGB R2 |
|---|---:|---|---|
| denseForestLo | 0.0360272 | [.019,.042,.027] | [0.0201232843,0.0411861688,0.0317540467] |
| denseForestHi | 0.0644584 | [.039,.075,.035] | [0.0413725972,0.0736658648,0.04122933] |
| openForestLo | 0.0581332 | [.054,.062,.032] | [0.0569707081,0.0605628639,0.0374884829] |
| openForestHi | 0.0781224 | [.075,.083,.039] | [0.0791420341,0.0810925364,0.0456983559] |
| grassLo | 0.0768572 | [.063,.085,.037] | [0.0737941414,0.0805885121,0.0489149615] |
| grassHi | 0.1125512 | [.105,.120,.061] | [0.122134335,0.112980276,0.0800823793] |

Il fattore comune moltiplica ogni rapporto R/G per F_R/F_G e ogni B/G per
F_B/F_G. La rinormalizzazione di Y è scalare e non modifica questi rapporti.
Pertanto **tutte le differenze logaritmiche fra endpoint sono conservate**:
log(R_i/G_i)−log(R_j/G_j), e analogamente B/G. Non c'è il collasso di R1.
Variazione luminosa di canopy/stand/moisture e contrasti relativi di tinta
restano; la tinta assoluta si sposta secondo il solo fattore comune.

## Verifica numerica e limite

Una seconda derivazione con Decimal a 50 cifre riproduce esattamente tutti
18 componenti Float32 dei sei endpoint. Su 14 contrasti logaritmici indipendenti,
residuo massimo in aritmetica reale3,89e−16, dopo f32 **1,744e−7**.
Y di ogni endpoint: errore reale≤1,39e−17, residuo f32 **4,038e−9** assoluto,
6,265e−8 relativo. `verification.json` conserva formula, hash e prove.

Il centroide degli endpoint dopo la rinormalizzazione individuale non è
forzato a coincidere col target: alberi R/G/B a Y1 differiscono di
[−.000440185,+.000121147,+.0000961045]; erba
[−.000210339,+.0000752794,−.000126340]. È un residuo della formula fissata,
non viene corretto con un secondo gain o una diversa pesatura.

La conservazione riguarda Y del colore autoriale. L'illuminante RGB colorato
può cambiarne Y finale: alba, cielo azzurro, ombre e pioggia richiedono GPU reale.
Non si preserva una distribuzione percettiva completa né una mediana renderizzata.
S2 è un composito osservato già illuminato, non albedo o una calibrazione fisica.
Le classi 10/30 possono includere piantagioni e condizioni stagionali diverse.

## Costo e qualifica ancora aperta

Nessuna nuova espressione runtime, texture, lettura, rumore, branch o pass.
Normali matte/slope grain, ombre reali, geometry/DEM e le frazioni WorldCover
sono identici alla base. CPU/tests/build non dimostrano FPS o miglioramento
fotorealistico; il root qualificherà il candidato alla porta 53754.
La preferenza per geografia reale comprensiva di abitati a FPS uguali resta
compatibile: questa prova cromatica non modifica la rappresentazione geografica.

🌟 Giudizio richiesto prima dell'adozione: confronto costa, interno e montagna
con la base già catturata, poi pioggia; verificare se la minore dominante
giallo-verde aiuta senza perdere leggibilità e differenze di tinta degli stand.
Nessun'altra variante viene aperta da questo report.

`PROTOCOL.md` e `derivation-freeze.json` precedono il calcolo. Sorgente/patch
recuperabili in `terrainSurface.before.ts`, `terrainSurface.after.ts`,
`trial-source.patch`; manifest 119 file in `trial-source-manifest.json`.
Notice proposto separato: `NOTICE-S2-PALETTE-PROPOSED.txt`.
