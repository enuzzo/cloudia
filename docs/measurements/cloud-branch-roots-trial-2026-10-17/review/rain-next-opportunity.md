# Pioggia canonica: una possibilità sulla sorgente, nessun nuovo speedup acquisito

17 ottobre2026, ciclo45. **Solo lettura del codice e delle prove salvate. Nessun runner, test, processo di modello, GPU o browser avviato.** Qualità256³/128³/384, output pieno e passo rain6m restano i contratti.

## Percorso effettivo e collo di bottiglia

`GPUSceneEngine.ts:308–316` costruisce una sola RG8 64² da `precipitationFootprint(textures.source)`. In `precipitation.ts:62–112` R deriva dall’integrale della **R macro**, fino aY2.5, soglia.05, area filter e Gaussian5×5; G è la base pesata per quella stessa sorgente. Non è acqua precipitabile simulata.

Nel `cloudShader.ts:97–140`, il rainRegion impone passi≤6m anche quando la nube è vuota. Ogni punto fa guessG→backtrace→columnRG e, se R>0, sheetsG+streakR. Il supporto della nube e la specializzazione narrow/R8 hanno già le ottimizzazioni qualificate. La riduzione sostanziale dei passi richiederebbe risolvere la composizione ottica con la nube, non rimuovere soltanto un lookup.

Il conteggio storico RAIN-WORK trova52,37% delle chiamate semantiche nel ramo rain, ma su576 raggi seed72/v40, tutti sea-miss: **non è il costo globale del v61 o prova del rapporto con i monti attuali**. FPS-OBJECTIVE conserva la pioggia lontana da60; il successivo terrain raster cache porta solo un piccolo beneficio statico e non risolve il loop. Non ho trovato qui un nuovo algoritmo esatto e già sostenuto dai dati che prometta una riduzione grande del lavoro6m.

## Unica opportunità distinta: emettere dalla densità fine già calcolata

La disconnessione concreta è fra sorgente e nube visibile: `volume.ts:432–438` calcola già nel buffer Float32 `density` la **densità dopo fine warp/erosione/materiale**, usata dal bake ottico. La footprint usa invece il canale R anteriore a questo passaggio. Perciò la pioggia nasce da un proxy più pieno, con una base qualificata prima dell’erosione fine. Non è prova che i pixel del velo attuale siano emessi da un punto vuoto, né un bug fisico dimostrato.

🌟 La singola modifica da valutare è costruire **la medesima RG8** da quel buffer fine, prima dei bake luce, mantenendo invariati area filter, Gaussian, soglia.05, gain.85, codificaG e tutti i fattori shader. Niente rinormalizzazione per seed per recuperare l’opacità perduta. SottoY2.5 la fase è liquida nelle famiglie correnti, quindi il buffer ottico normalizzato perβliquid è utilizzabile lì senza attribuire ai ghiacci un’emissione liquida. Serve un reducer indipendente dai moduli renderer, evitando il ciclo `volume→precipitation→volume`.

Questo interviene su **chi emette e a quale base**, non sulla luminosità del velo o sul mapping/streak runtime. Potrebbe legare meglio la forza delle colonne e quindi la virga alla stessa condensazione visibile. Non ripete la rimappatura broad bocciata per pannelli, né la luce all’emettitore bocciata per una macchia scura uniforme. L’audit A/s/A-only non ha provato questa diversa sorgente.

## Paesaggio, costo e limiti

Il terreno attuale fornisce già il primo hit in `terrainRaster.a`; `far` e `rainFar` sono ritagliati a quella distanza e l’estinzione cloud/rain resta co-locata. La sopravvivenza debole dipende da base/forza; quella satura usa il datum marino mondiale, poi è il terreno a occludere. Non propongo una height lookup per goccia o un floor che segua artificiosamente ogni monte.

| Risorsa/lavoro | Cambiamento proposto |
|---|---|
| GPU ordinaria | Stessa RG8 64², stessi binding/lookup/passi; nessun nuovo pass/cache |
| Buffer sorgente | Riusa il Float32 già vivo nel bake, senza conservarne o trasferirne64MiB |
| Riduzione CPU | Stessa struttura di scansione inferiore, spostata nel worker; costo una volta/volume, ancora da misurare |
| Temporanei riduzione | Tre array64² Float32 +RG8:57.344B; stessa scala dell’attuale reducer, ora al picco worker |
| Trasferimento | Un solo RG8 di8.192B, sostituisce la mappa prodotta nell’engine; ownership senza doppie copie |

Il blur/area filter64² può cancellare quasi tutte le differenze piccole: potrebbe risultare soltanto una pioggia più debole. Inoltre una cortina meno opaca può raggiungere più spesso `far` invece del cutoffT.006 e **costare di più**. Nessun miglioramento FPS dedotto dalla possibile maggiore sparsità. Restano emissione statica, flow/dispersione non seguiti causalmente, microfisica assente; non si risolve il problema con un nuovo clock.

## Prova mancante e decisione

Manca anzitutto un confronto attuale RGmacro/RGfine che mostri differenze strutturali di sorgente/base su scala sopravvissuta al filtro, non solo calo medio. Nessun dato archiviato letto lo fornisce. Se quella condizione manca, questa opportunità non giustifica un trial visivo. Se c’è, resta necessario il medesimo guard nativo Rain/virga davanti ai rilievi, a camera/stato fissi: una semplice attenuazione uniforme non sarebbe successo. Solo dopo un beneficio visivo avrebbe senso misurare costo e moto, senza cambiare i gate del goal.

È una possibilità concreta soprattutto per **coerenza dell’immagine**, non il prossimo algoritmo60FPS già dimostrato. Preintegrazione op2 è ancora solo proposta in RAIN-NEXT e i suoi DDA/bounds possono assorbire il risparmio; non la ripresento come novità.

Letture: FPS-OBJECTIVE, RAIN-WORK, RAIN-NEXT, RAIN-AMPLITUDE-ONLY, RAIN-EMISSION-OPTIONS, RAIN-SHAFT-TRIAL, RAIN-EMITTER-LIGHT-TRIAL, EXPERIMENT-RAIN-TERRAIN; sorgenti canonici precipitation/cloudShader/volume/worker/Engine/medium. Nessuna nuova infrastruttura o codice preparato.
