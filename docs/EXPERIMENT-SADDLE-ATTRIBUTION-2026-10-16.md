# Sella: attribuzione al corpo comune, distinta dal becco

**Nei cinque campioni baseline autorizzati, il supporto macro della sella proviene soprattutto dal core `shared.body`: 94,70–99,21% dei pesi locali.** Il becco precedentemente attribuito appartiene invece al rigonfiamento interno maturo, gruppo 91. Non è stata preparata una nuova variante: il risultato distingue gli owner nei punti campionati, senza spiegare l'intera U o autorizzare modifiche a corpo, erosione o gerarchia.

L'[archivio verificabile](measurements/saddle-attribution-2026-10-16/README.md) conserva protocollo, codice, risultati e report originali. Riusa come dipendenza verificata l'archivio body-bulge per layout, funzioni, sorgenti 10493 e vecchi valori identici, evitando duplicazioni.

## Protocollo e identità della baseline

Prima del calcolo sono stati fissati soltanto cinque campioni già salvati sul raggio del pixel nativo [1408,490], UV centro `[1408.5/2560,490.5/1440]`: indici 144/145/148/151/152, zero anteriore, primo positivo, picco di densità, ultimo positivo, zero posteriore. Nessun nuovo raggio o ricerca di altri pixel.

Camera dell'attribuzione: origine `[0,2.7,16]`, yaw/pitch0, inspection0; t60, vento0.55, dispersione0, stessa baseline 10493 e layout 74 effettivo congelato. Non sono state rigenerate primitive. Densità fine, sigma, macroR8 filtrata e ice dei cinque punti coincidono esattamente con la precedente baseline r1 prima del nuovo trace.

**I 40 byte R8 dei corner sono nuovi.** R1 aveva salvato la macro filtrata, non gli otto byte discreti di questi punti. L'identità dei byte e dei field Float32 è verificata fra le due fasi di questo audit, sugli stessi corner; non viene dichiarata una precedente cache di byte inesistente.

| Campione | Fine esatta | MacroR8 filtrata | Erosione fine | Peso core comune |
|---|---:|---:|---:|---:|
| Zero anteriore | 0 | 0,187153 | 0,229295 | 98,5905% |
| Primo positivo | 0,130826 | 0,325073 | 0,223485 | 98,1751% |
| Picco lungo raggio | 0,560655 | 0,675640 | 0,261719 | 99,2069% |
| Ultimo positivo | 0,011733 | 0,229089 | 0,219936 | 94,7023% |
| Zero posteriore | 0 | 0,101795 | 0,235186 | 96,5492% |

## Cosa produce il tratto tenue

WorldY≈3,417 non è la quota della macro sorgente: reference/moto, flow e warp portano i cinque punti a warpedSourceY≈3,100–3,156 km. Il flowY sottratto vale 0,244–0,275 km. Tutte le coordinate intermedie e i centri fisici degli otto corner sono conservati.

I 40 corner-slot hanno field finale positivo, 0,186285–0,258478. Il carving macro, fra −0,215755 e−0,125886, lascia quattro corner R8 zero negli stencil dei due zeri e dell'ultimo positivo. L'interpolazione mescola questi byte; l'erosione fine azzera i campioni esterni perché raw<E. Tutti e cinque hanno ice 0 / materiale 1. Non è quindi un vuoto macro completamente privo di corpo o un effetto del solo ghiaccio.

Il contributor dominante è il core comune 16, non i suoi billow. Gli altri pesi appartengono a `young.middle`, rigonfiamento maturo e fondazione giovane. Summit, incus e spalla 10493 non hanno peso finale in questi stencil. I pesi derivano dalla catena di unioni e dal filtro R8: non sono massa o RGB additivi. Nessuna ablazione, modello alternativo o variazione di coefficienti è stata calcolata.

Il raw registra tutte le primitive effettivamente valutate dal raster locale: SDF, blend/h, field precedente, passo continuo prima di Float32, arrotondamento, carving, byte R8, filtro e fattori fini. Non è un nuovo SDF diretto al punto interpolato.

## Perimetro e conseguenze

Cinque posizioni sullo stesso pixel, 40 corner-slot per fase e 30 macrotexel distinti; 32 texel dettaglio e 12 flow, senza volume/bake/GPU/app. Il “picco” è massimo di densità lungo il raggio salvato, non un punto di superficie o il massimo di luce. Il pixel non raggiunge τ1; attenuazione e source-corner non ricostruiscono RGB, occlusione completa delle torri o topologia della U.

Il [preflight body-bulge](EXPERIMENT-BODY-BULGE-ORIENTATION-2026-10-16.md) era fallito rispetto alla propria promessa di alimentare questa sella. Aumentare quel raggio non è una necessità artistica o fisica universale. Un'eventuale futura ridistribuzione dovrà considerare insieme owner 91 e corpo comune 16, ma **nessun modello o ricerca di parametri è autorizzato da questo audit**.

```sh
python3 docs/measurements/saddle-attribution-2026-10-16/verify.py
```

Il verificatore legge soltanto dati archiviati: controlla hash, cinque identità scalari, 40 byte nuovi fra le due fasi, replay aritmetico dei prefix e decode/interpolazione/fine, oltre ai pesi 94,70–99,21%. Non importa JS, non campiona field e non ripete il probe. La dipendenza body-bulge è relativa al repository e protetta da SHA; i percorsi esterni di origine non sono necessari per la verifica.
