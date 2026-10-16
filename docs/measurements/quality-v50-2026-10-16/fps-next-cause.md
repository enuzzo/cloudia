# Prossima ipotesi FPS: condividere la trasmissione aerea dello stesso passo

**Solo proposta esterna, non implementata né inclusa nel checkpoint v50.** La duplicazione esiste nel sorgente; il costo sul driver non è dimostrato. CSE o altre ottimizzazioni del compilatore potrebbero già eliminarla. Nessuna promessa di FPS o di vantaggio temporale.

## Unica opportunità selezionata

In `cloudShader.ts`, la costruzione di `rainSource` valuta `aerialTransmittance(t,weather.x)` dentro `column.r>0` (riga132 della lettura), poi il ramo comune dopo il gate di estinzioni nulle valuta la stessa funzione con gli stessi argomenti (riga197).

`aerial.ts` contiene un'esponenziale diretta:

```text
exp(-t * (.006 + .004 * weather.x))
```

Fra le due chiamate non cambiano t o weather. Sky, colori e direzione sono anch'essi invarianti nel passo; non vi sono letture con effetti collaterali dentro la funzione aerea. Se la pioggia contribuisce, il secondo punto viene raggiunto necessariamente. Se column.r è positivo ma attachment o evaporation azzerano l'estinzione rain, il primo risultato può essere calcolato senza avere alcun peso nel segmento.

La modifica candidata deve **differire soltanto il mix aereo della sorgente rain** fino a dopo il gate già presente:

```text
calcolo originale di rainExtinction e rainLight
calcolo originale di density/source cloud
se entrambe le estinzioni sono zero: avanzamento originale e continue
A = aerialTransmittance(t, weather.x)   // una valutazione diretta
se rainExtinction > 0: rainSource = mix(sky, rainLight, A)
cloudSource = mix(sky, source, A)
segmento ottico originale
```

Il valore RGB temporaneo che attraversa il blocco cloud può contenere rainLight anziché rainSource: non serve aggiungere una nuova risorsa o una storia fra passi. L'esatta allocazione dei registri resta da verificare nel candidato compilato. L'integrazione continua a usare i medesimi coefficienti e lo stesso `cloudMediaSegment`.

Per estinzione rain positiva, gli argomenti e l'espressione del mix sono identici. Con estinzione rain zero, la sua sorgente è moltiplicata per zero nel segmento e non influisce sull'uscita, sotto il contratto esistente di input finiti. Non modificare le valutazioni di densità, i lookup, jitter, t/ds, clipping, cutoff, passi6m, macro256³, dettaglio128³, 384 passi nominali o output. La classificazione dei passi resta quella originale: non è un nuovo certificato di vuoto.

## Ordine di grandezza, senza trasformarlo in tempo GPU

L'audit CPU storico di `RAIN-WORK-2026-10-16.md`, griglia576raggi, registra125.104 passi con column.r positivo e246.399 iterazioni, di cui150.465 con entrambe le estinzioni nulle. Quindi il ramo comune viene visitato95.934 volte. Con la struttura attuale ciò corrisponderebbe semanticamente a125.104+95.934 valutazioni aeree; il riuso ne conserverebbe95.934.

È un conteggio derivato dal vecchio modello discreto, **non un nuovo profilo v50, un contatore di istruzioni hardware o una stima degli FPS**. Le trasmittanze aeree non cambiano T, ma le pose e i costi compilati devono comunque essere verificati sul candidato reale. Non eseguire una nuova griglia solo per confermare questa aritmetica.

## Witness concreto dopo il checkpoint, se autorizzato

1. Congelare il controllo v50 e una sola candidata che sposti il mix e condivida A, lasciando tutte le espressioni restanti identiche. Conservare template/binding e sorgenti delle due build. Non combinare questa prova con hoist della fase rain, cache o esclusioni aggiuntive.
2. Un piccolo witness del **segmento finale**, non della sorgente rain inutilizzata, deve confrontare vecchio/nuovo RGBA prima del film sui medesimi tuple finite: t0/6m/1km/10km, haze dei preset, rain/cloud singoli e sovrapposti, e column positivo con attachment/evaporation zero. Richiedere bit f32 identici sul backend provato e assenza di non finiti. La sorgente rain isolata può differire quando il suo coefficiente è zero; il segmento deve coincidere. Questa è la verifica di correttezza, non la misura del costo.
3. Il witness di costo decisivo rimane il rendering Three reale, stessa fixture rain nativa e qualità piena, sequenza A/B/A con prefissi completati e condizioni confrontabili. Se non emerge un vantaggio oltre la deriva dei controlli, ritirare la modifica: la duplicazione semantica può essere già risolta dal compilatore, oppure non essere il collo di bottiglia. Anche la stessa immagine non dimostra da sola un guadagno.

Nessun witness, build, replay, GPU o misura è stato eseguito in questo sottoaudit. Durante le misure del root sono state fatte solo letture e analisi del codice.

## Differenza dai tentativi precedenti

La ricorrenza aerial v19, documentata in `OBSERVATORY-2026-10-13.md` e `GOTCHAS.md`, sostituiva l'esponenziale diretta con moltiplicatori fra passi, aveva un drift f32 qualificato e non mostrò un vantaggio consistente. Qui non si introduce una ricorrenza né si cambia l'aritmetica dell'esponenziale: si propone il riuso del risultato per gli stessi t/haze.

Le esclusioni per intervallo vuoto e limite superiore rain sono già state qualificate e ritirate; non vengono riproposte. La narrow mask e R8 rimangono quelle esistenti. GuessG/columnRG e sheets/streak sono letture a coordinate diverse, non chiamate duplicate eliminabili con questa identità.

## Lettura congelata

```text
cloudShader.ts 15570B 652c9514b7dfcee1456d15e9966087b3ff9c6a6ce9741970208cfca3750a248c
aerial.ts         621B a066cfe3664d77e4c448045010fa13c40eefb35add6c163d143bd2bb01af10da
precipitation.ts 5993B 561dace4f0ab9cbba246cefe0c14f23f5406bbabb1a5e3a00799d5d8aa08ce72
medium.ts        1176B ddfd487055e4fde6581ab351345e91fb3466b032dda954c803082a39a9a142d6
```

Precedenti riletti: `RAIN-WORK`, `RAIN-NEXT`, `EXPERIMENT-RAIN-EMPTY`, `EXPERIMENT-RAIN-UPPER`, `EXPERIMENT-NARROW-CLOUD`, `EXPERIMENT-DENSITY-R8`, obiettivo FPS e ricorrenza v19. Nessun file prodotto o documento già congelato modificato.
