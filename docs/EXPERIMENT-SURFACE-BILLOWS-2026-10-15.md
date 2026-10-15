# Rilievi liquidi dopo il carving: prototipo v29

15 ottobre 2026. **Prototipo non promosso come soluzione autonoma.** Le 96
protuberanze aggiunte modificano davvero la geometria visibile, ma il fronte
ravvicinato rimane liscio e sfocato. Il prototipo resta distinto dal successivo
esperimento sull'interfaccia del materiale; nessuna accettazione artistica o
chiusura dell'obiettivo viene dedotta da queste prove.

Il [manifesto v29](measurements/surface-billows-candidate-build-2026-10-15.json)
identifica sorgenti e build `observatory-v29-surface-billows-experiment`.
La [patch archiviata](experiments/surface-billows-v29.patch), copiata prima delle
modifiche successive, conserva `volume.ts` e i test specifici di questo prototipo.

## Diagnosi preliminare a 128³

Il [report CPU billow-survival](measurements/billow-survival-cpu-2026-10-15.json)
confronta l'anatomia precedente con e senza i piccoli lobi figli, mantenendo
identici RNG, posizioni e raggi. È una copia temporanea strumentata a 128³:
non include dettaglio fine, flusso, bake luminoso o rendering GPU.

| Seme | Massa attribuibile ai figli, baseline | Con sola riduzione di k | Variazione della massa totale con k ridotto |
| --- | ---: | ---: | ---: |
| 72 | 0,3359% | 0,000548% | −5,77% |
| 73 | 0,3659% | 0,000493% | −5,70% |
| 1571198069 | 0,3178% | 0,000549% | −5,07% |

La massa attribuibile è `(massa con figli − massa senza figli) / massa con figli`,
non la percentuale di lobi sopravvissuti né una misura di contrasto. Tutti i
centri dei figli liquidi restano dentro il campo dei genitori. Nel seme visivo,
il raggio mediano dei figli è circa 79 m, il raccordo baseline k è 200 m e il
carving effettivo mediano ai loro centri è circa −154 m: molti dettagli sono
sepolti o consumati prima del rendering. La variante riduce soltanto k dei lobi
liquidi aggiunti e dei loro figli in proporzione al raggio; non cambia il carving.
Non recupera il rilievo e riduce la massa: **la correzione del solo k non viene
adottata**. Questi numeri motivano il prototipo successivo senza provarne l'esito.

## Modifica e audit di coerenza

`addLiquidSurfaceBillows` sceglie ancore sul campo già scolpito, vicino al valore
0,07, e richiede densità renderizzata positiva prima dell'aggiunta. Usa un pool
limitato a 512 candidati, proiezione sul campo, normale uscente e distanze fra
centri; tutte le ancore sono scelte prima di modificare il materiale. Il limite
è 96 rilievi, **tutti e 96 effettivamente presenti** nei due report v29.
Il raggio nominale è 120–220 m, con assi variabili e raccordo pari al 18%
dell'asse minore. La densità può solo aumentare nella regione modificata.

Il campo post-carving non è più una distanza con gradiente limitato a uno:
il vecchio salto CPU basato su quella proprietà viene sostituito dalla maschera
di occupazione esistente, costruita dopo i nuovi rilievi e prima della luce.
Siano F/C le risoluzioni macro/maschera e h/H i rispettivi passi su un asse.
Sia la costruzione sia il salto assegnano il centro macro i a `floor(i*C/F)`.
Un campione positivo richiede un texel sorgente j positivo con
`|j−i|h ≤ warpMax+h`, includendo il filtro lineare; allora la distanza fra i
bucket è al massimo `ceil((warpMax+h)/H)`. La dilatazione include questo raggio
e aggiunge il margine del flusso. Un bucket nullo può quindi essere saltato
conservativamente anche con rapporti F/C non interi.

L'alpha della maschera non modifica il dettaglio RGB. Il bake legge la nuova
densità con la stessa deformazione fine ed erosione statica e rigenera tutte
le cache solari/cielo. Le bande protette conservano i byte della densità R,
non necessariamente quelli della luce: il materiale aggiunto può farvi ombra.
Restano le approssimazioni preesistenti della luce co-deformata e quantizzata;
erosione dinamica e microerosione della camera non entrano nel bake statico.

Non vengono aggiunte risorse GPU o letture texture nello shader. Sono riusati
i due campi CPU già allocati e la maschera esistente. Macro **256³**, dettaglio
**128³**, **384 passi nominali**, output/interno **1672×941**, senza TAA o
downscale, rimangono configurati. Il costo di generazione non è misurato qui.

## Guardia visiva e camera

| Vista | Evidenza |
| --- | --- |
| Baseline frontale 80%, camera fissa | [Immagine](measurements/meso-2026-10-15/meso-baseline-near80-sun.jpg), [report](measurements/meso-2026-10-15/meso-baseline-near80-30s.json) |
| v29 frontale 80%, camera fissa | [Immagine](measurements/surface-billows-2026-10-15/surface-billows-front80-sun.jpg), [report](measurements/surface-billows-2026-10-15/surface-billows-front80-30s.json) |
| v29 frontale 80%, sonda ordinaria | [Immagine](measurements/surface-billows-2026-10-15/surface-billows-ordinary-front80-sun.jpg), [report](measurements/surface-billows-2026-10-15/surface-billows-ordinary-front80-30s.json), [stato DOM](measurements/surface-billows-2026-10-15/surface-billows-ordinary-front80-state.txt) |
| v29 panorama | [Immagine](measurements/surface-billows-2026-10-15/surface-billows-panorama-sun.jpg) |

Il confronto fisso riusa raggio `0.6045067691053366` km e target
`[0.4296875, 2.9365234375, 0]`. L'origine all'80% è **esattamente identica**
nei report baseline e v29: `[0.4296875, 2.9365234375, 1.1639784268955404]` km.
L'override salta la sonda. Lo `surfaceEstimateKm=0.4` della vecchia baseline è
un valore iniziale inutilizzato, non una distanza misurata.

Coincidono seme 1571198069, nube in pausa a 60 s, yaw/pitch zero, orbita spenta,
Sole a sinistra, vento 55%, pioggia/dispersione zero, transizione conclusa,
assenza di lampi, qualità completa e main thread WebGPU Apple/Metal-3.
Nella candidata fissa un rilievo nuovo occlude il varco di cielo della baseline:
il cambiamento geometrico arriva al rendering, ma bordi e superfici rimangono
troppo morbidi. Anche la vista ordinaria resta sfocata. Il panorama conserva
la lettura della nube intera, senza dimostrare la qualità ravvicinata richiesta.

La sonda ordinaria trova invece un raggio di `0.7442169983709742` km e colloca
l'origine all'80% in `[0.4296875, 2.9365234375, 1.374623185552281]`: circa 211 m
più indietro. **La posa ordinaria e quella fissa non hanno la stessa camera.**

## Costo osservato e conservazione

Ogni report dura circa 30 s dopo 2 s di warmup, con rendering completo.

| Posa | rAF/s | GPU media, ms | GPU p95, ms | Campioni GPU |
| --- | ---: | ---: | ---: | ---: |
| Baseline v25, fronte fisso 80% | 59,9944 | 22,3934 | 24,7726 | 145 |
| v29, fronte fisso 80% | 59,9964 | 22,9120 | 26,9353 | 146 |
| v29, fronte ordinario 80% | 59,9976 | 21,6192 | 26,4765 | 146 |

La singola coppia fissa mostra circa +0,52 ms di GPU media; orario, condizioni
termiche e carico esterno possono differire. Non è un A/B alternato e non si
attribuisce causalmente tutta la differenza alla geometria. La riga ordinaria
usa un'altra origine, quindi non dimostra un miglioramento di prestazioni.
rAF/s e timestamp GPU non sono fps presentati dal compositor.

I dump console [fisso](measurements/surface-billows-2026-10-15/surface-billows-fixed-console.json)
e [ordinario](measurements/surface-billows-2026-10-15/surface-billows-ordinary-console.json)
sono `[]`. Gli otto file dell'archivio — tre JPEG, due report, due console e un
dump DOM — sono copie byte per byte degli originali privati, verificati con
SHA256; gli originali sono preservati. Anche la patch è verificata identica
all'originale `/private/tmp/cloudia-surface-billows-v29.patch`.

Il prototipo rimane recuperabile e separato dagli esperimenti successivi.
Questo archivio non qualifica moto, altri semi, sole basso, worker o dispositivi
fisici e non chiude l'obiettivo della qualità artistica.
