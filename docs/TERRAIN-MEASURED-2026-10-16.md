# Cloudia v53 — rilievi misurati per terreno e montagne

Aggiornamento successivo: [v54 copertura reale del suolo](TERRAIN-COVER-2026-10-16.md). Questo documento conserva il checkpoint v53.

16 ottobre 2026. Prodotto locale `13e03f5`. Goal attivo. Priorità del proprietario: eliminare l'aspetto di dune riflettenti e rendere il paesaggio credibile.

## Cambiamento adottato

La forma centrale del terreno proviene dal **Copernicus GLO-90 DSM** di Liguria orientale e Apuane. Quattro tessere pubbliche, ricampionate senza esagerazione verticale su 1025² nodi a 125 m, sostituiscono le dorsali procedurali nella zona centrale. Origine 44°N/10°E, X verso Ovest, Z verso Nord, proiezione equirettangolare locale; quota ortometrica EGM2008 adattata al mare sferico già esistente.

- Dato puro nel quadrato **96×96 km**, ±48 km dall'origine.
- Raccordo separabile e continuo fra 48 e 64 km; oltre 64 km rimane il paesaggio procedurale. Il payload copre 128×128 km, ma questa intera area non è geografia misurata pura nel renderer.
- CDM1: **4.202.532 byte**, quota massima ricampionata **2.146,75 m**, SHA256 `92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d`.
- Quote quantizzate a 0,125 m; errore di quantizzazione massimo 0,0625 m. Questo non è l'accuratezza del rilievo. Una mesh più fitta non aggiunge dettaglio misurato ai dati a 125 m.
- Costa ricavata da soglia e connettività dell'oceano; distanza raster euclidea quantizzata a 8 m. Non è una costa vettoriale ufficiale o una batimetria.

Le normali condivise sono ora pesate per l'area dei triangoli effettivi su tutti i vertici: viene attenuata la lettura dei bordi fra celle del DSM. Il test confronta un oracolo geometrico indipendente e verifica posizioni, superfici e indici invariati. La transizione del materiale sulla costa usa una semilarghezza `max(16 m, 1,5 pixel proiettati)` invece della fascia uniforme di 400 m.

L'asset viene letto una volta all'avvio, con annullamento della richiesta al teardown. Un errore di caricamento è esplicito; non si attiva silenziosamente il vecchio terreno. Main e worker usano la stessa risorsa. Il DEM viene campionato durante la costruzione della mesh: nessun nuovo campione DEM CPU per frame, texture o pass GPU rispetto a v52. Restano i costi della mesh e dei due pass terreno/ombre esistenti.

Fonti primarie: [catalogo AWS](https://registry.opendata.aws/copernicus-dem/), [struttura delle tessere](https://copernicus-dem-90m.s3.amazonaws.com/readme.html), [licenza Copernicus](https://dataspace.copernicus.eu/sites/default/files/media/files/2025-06/copernicus_contributing_mission_data_access_v2_cop_dem_licenses.pdf). Credito e disclaimer integrali sono distribuiti in `public/terrain-data-notice.txt`, con licenza GLO90-F; il pannello Atmosfera li rende accessibili. Sono dati esterni rielaborati, non codice esterno copiato.

## Verifiche e giudizio

|Controllo|Esito|
|---|---|
|Suite snapshot r2|328/328 test, 41 file|
|Typecheck e build app→hero|PASS|
|Byte del payload, header, unità, corner, oceano e provenienza|PASS|
|Raccordo: derivate anche sulle diagonali, errore caricamento e teardown pendente|PASS|
|Browser main, Sole/Tramonto/Pioggia, output nativo 2474×1844|PASS di funzionamento; nessun warning/errore dell'origine osservato|
|Forma delle dorsali e valli rispetto a v52|Miglioramento visivo osservato|
|Fotorealismo complessivo del terreno|**Ancora aperto**: verde, vegetazione, materiali e dettaglio distante semplificati|
|Browser worker, Sole, canvas 2474×1844 e controlli|PASS di funzionamento; nessun warning/errore dell’origine osservato|
|Preview principale|Stesso dist r2 su localhost:4196, Sole, nativa, animazione ripresa|

Le immagini di confronto sono **JPEG della superficie CSS**, non letture del framebuffer nativo. La prima prova DEM conserva bordi chiari e costa morbida; r2 li attenua con normali geometriche e banda costiera più stretta. Il DSM contiene vegetazione e manufatti, non classi di uso del suolo: i biomi restano autoriali. Il materiale opaco e le ombre v52 rimangono approssimazioni, incluse ombre di contatto decametriche e copertura limitata. Nessun PASS fotografico globale ricavato dalla provenienza dei dati o dai test.

Il prototipo precedente di incisione a 400 m è ritirato: non poteva aprire conche profonde 1.611 m e conservava canali in salita. Anche la prima prova di chiome nel materiale è ritirata: la grana risultava troppo uniforme. Entrambi sono conservati nell'archivio esterno; nessuna loro modifica è nel prodotto.

## FPS e intervalli GPU

Main r2, seed 74, tempo 60 s in pausa, vento 55%, dispersione 0%, pioggia 80%, flusso completo, 256³/128³/384, output nativo **2474×1844**. Yaw 1,3852869846402587 e pitch 0,2811279826464208; 30.002,3 ms misurati, 436 intervalli: **14,5322192 invii/s**, mediana 66,7 ms, p95 84 ms, p99 200 ms, massimo 216,7 ms. Prefisso coda completato. Pioggia effettiva registrata 0,799986927810866; il clock meteorologico avanza mentre il tempo della nube resta fermo. Presentazione del compositore non misurata. È una caratterizzazione della nuova scena; nessuno speedup o regressione causale dedotti dalla singola vecchia misura v52 con geografia diversa. **60 FPS non raggiunti.**

Il report v53 conserva 431 draw con copertura timestamp completa e 5 senza dati: nessun campione è inventato per colmare la lacuna. Il diagnostico esterno sui timestamp v52 registra quattro programmi effettivi distinti e 48 coppie render/12 compute. Gli intervalli nube/output si sovrappongono in 12/12 draw. La somma conta più volte parte degli stessi intervalli; anche la loro unione non certifica tempo GPU esclusivo o throughput. Nessuna causa Metal né parallelismo hardware attribuiti. Il diagnostico non modifica Three o il prodotto e non è un benchmark FPS v53.

## Riproducibilità e continuità

Evidenze curate in `docs/measurements/terrain-dem-2026-10-16/`: 41 file, 1.801.413 byte, manifest SHA `55599f04d590596570f880c3a2a57990c871e3b5599fc33b81c26d2a26d4cac6`. Verificatore offline PASS: asset, 113 sorgenti e 28 file di build, raw della misura e archivio timestamp. Il pacchetto esterno completo è `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle19/dem-feasibility/`: 31 payload, manifest SHA256 `33c11bbee2316874e3b85dcd29377057dda9ae6249b9cbef09423b80d526cb32`. Include i quattro TIFF originali, elaborazione riproducibile, controlli indipendenti e figura scientifica; non si copiano ambienti Python o node_modules fra Mac.

Il preflight congiunto corpo/spalla della nube rimane esterno: supera il gate campionato della sella e del becco, ma perde 1,01% di tau al polso e circa 90% nel vecchio raggio del becco. Nessuna promozione senza qualifica visiva; nessun volume/bake nuovo applicato. Restano aperti anatomia, continuità ravvicinata, vegetazione, pioggia integrata, UI e FPS del goal originario. Nessun push o deploy.

Prossimo passo già ricercato, non implementato: ESA WorldCover 2021 N42E009, ritaglio della stessa zona stimato in 9,11 MB tramite Range; aggregazione categoriale propria su 1024² celle da125m. Conservare distinte copertura arborea, coltivi e costruito: alberi non significa bosco naturale, e bare/sparse non significa sola roccia. Ricognizione esterna `cycle19/worldcover-feasibility/`, manifest SHA `0b682cc6e4abf46e2c0547c35114e7e4885ed180fe71778e07446b9bdcda87a3`. Nessun raster di classi scaricato o applicato.

Controllo Git: i dodici file del prodotto in `13e03f5` coincidono byte per byte con lo snapshot r2 testato. Il controllo whitespace del codice passa; l’estratto testuale della licenza conserva intenzionalmente la spaziatura della fonte originale. Nessuna modifica alle dipendenze o ai lockfile.
