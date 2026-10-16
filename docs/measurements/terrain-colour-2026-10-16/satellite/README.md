# Sentinel-2 2021 — riferimento RGB lineare, R2

**PASS CPU circoscritto; non albedo, non integrazione prodotto, non accettazione
fotorealistica.** R1 resta conservato in `../sentinel2-reference/`: FAIL RSS a
488.144.896 byte prima di scrivere l'output. L'unico R2 autorizzato ha completato
la stessa aggregazione in 3,409 s, picco **333,781 MiB su 384 MiB**, senza rete.
Analisi successiva in processo separato: 149,172 MiB. I due processi non coesistono.
Nessuna modifica al prodotto, quote, dipendenze, backend, GPU o build.

## Dati utilizzabili

| Campo | Raw | Gzip mtime0 | SHA256 raw |
|---|---:|---:|---|
| `rgb-linear.f32` | 50.331.648 B | 29.610.975 B | `44205c43c1f243766716060b16e7f74948fba3a9366b6f38473d045c066a074e` |
| `valid-area.f32` | 16.777.216 B | 27.419 B | `e89361dccb2b50a515f08ee7fee8500bdd3a535bdce4f5ea6159a736120f12c7` |

Float32LE senza header. RGB interleaved e validità separata; 2048² **celle**
da 62,5 m, bordi X/Z ±64 km, row-major righe da Sud a Nord e colonne da Est a
Ovest. Stessa equirettangolare locale del DEM: lat=44+z/111.1950802335,
lon=10−x/(111.1950802335*cos44°). Campionare al centro `(−64+(i+.5)*.0625)`.
Dato RGB **lineare**: non applicare una decodifica sRGB. La figura usa gain3 e
OETF sRGB esclusivamente per visualizzazione. Non è un asset già pronto con
una BRDF fisicamente calibrata.

Sorgente: quattro COG ESA annual median L2A 2021 v200, overview4 3000²/tessera,
B04/B03/B02/B08, UInt16 scala.0001. Ventiquattro blocchi da quattro Range;
71.091.595 byte originali verificati SHA prima del run e riusati da R1.
Overlap rettangolari esatti nel piano locale in float64. Pixel valido se tutte
le quattro bande hanno DN1..10000; l'RGB è media condizionale sull'area valida,
non RGB×copertura. Celle senza area valida hanno RGB0 e validità0.

## Evidenza e limiti

- `PROTOCOL.md`, `PROTOCOL-R1.md`, `pre-run-freeze.json`: regole congelate;
  `r1-to-r2-memory.patch` mostra la sola riorganizzazione di memoria.
- `result.json`: copertura geometrica max errore3,33e−16; rounding RGB Float32
  max2.950366085e-08. Tutti gli algoritmi decoder/overlap/accumulo e le maschere
  statistiche hanno corpo sorgente identico a R1.
- `source-witnesses.json` e CSV: cinque celle reali, 50 pixel sorgente; primo
  argmax row-major con area parziale0,49913823. Entrambi i file sono identici
  byte per byte a R1. Non esiste un output R1 completo cui confrontare tutto
  il campo: nessuna affermazione di full-field byte identity a R1.
- `verify-offline.py`: solo stdlib; controlla hash di tutti gli artefatti e
  dipendenze, gzip→raw byte per byte, tutti i Float32 e cinque witness con
  decoder Predictor2 scalare indipendente. Non ricalcola tutti i4M overlap.
- `sentinel2-scientific-view.png/.pdf`: nord in alto, Ovest a destra, confini
  delle tessere annotati. `s2-rgb-gain3-srgb.png` conserva la vista2048².

Area valida10.955,4035 km² (66,8665%). Il cross-tab descrittivo sulle frazioni
WorldCover attribuisce5.428,4935 km² invalidi ad acqua/NoData e0,1030 km² alle
altre classi: **non è un33% di terra mancante**. Non è un'intersezione con una
costa vera né una certificazione nuvole. `validity-by-worldcover.json` conserva
le dodici classi e tutti i numeri.

## Cromaticità e lettura della figura

Maschere e soglia LOW_N256 fissate prima di leggere i pixel. Si campiona ogni
250 m con validità≥.99, purezza classe≥.95, NoData/crop/built/acqua≤.01,
Y∈[.02,.60], esclusione euristica grigio-brillante. Nessuna soglia ritoccata.

| WorldCover | N ammessi | Cromia mediana robusta Y1 | Giudizio |
|---|---:|---|---|
|10 alberi |80.090 |[.83514,1.08337,.65957] |numero sufficiente; include oliveti/piantagioni |
|20 arbusti |28 |descrittiva nel JSON |LOW_N, nessuna palette raccomandata |
|30 erba |2.628 |[1.03463,1.02189,.68118] |numero sufficiente |
|60 terreno nudo |10 |descrittiva nel JSON |LOW_N, nessuna palette raccomandata |

Il dettaglio spaziale reale è più informativo di una sola cromia, ma mostra
anche campi, costruzioni, cave e ombre già illuminate. Non può essere applicato
come albedo e poi illuminato di nuovo senza valutare il doppio shading.
La forte variabilità intraclasse resta documentata con percentili10/90.

Euristica nuvole/neve:2.333 celle (non SCL né verità);3.061 canali display
clippati al gain3. Seams adiacenti validi: p95 massimo canale.03262/.03180,
controlli vicini.03035/.02666 su lon10/lat44. Differenze geografiche fra celle
adiacenti non dimostrano da sole un errore radiometrico; nessun livellamento.

🌟 Prossimo passo sensato: giudicare un'integrazione esplicita della struttura
RGB osservata, separando il rischio del doppio shading e del cover umano.
Le sole cromie alberi/erba sono un riferimento verificabile, non una soluzione
completa al requisito di terreno credibile. Nessuna integrazione è autorizzata
con questo archivio, nessun FPS o costo GPU è stato dedotto.

## Verifica e riproducibilità

Usare l'interprete Python esistente; nessuna installazione. Per la verifica
indipendente si può copiare il solo verifier in `/tmp` e passare:

```sh
python3 /tmp/verify-sentinel2-r2.py --archive-root /percorso/sentinel2-reference-r2 --r1-root /percorso/sentinel2-reference
```

`artifact-manifest.json` elenca SHA/dimensione dei payload; esclude se stesso e
il report derivato `independent-verification.json`, per evitare autoriferimenti.
I Range R1 non sono duplicati: `ranges-manifest-r1.json` ne conserva tutti gli
header e SHA; `r2-inputs.json` dichiara esplicitamente le dipendenze originali.
Non rieseguire il preprocess: l'unico tentativo R2 è consumato.

Licenza/credito completi in `NOTICE-SENTINEL2.txt`, fonti primarie in
`SOURCE-LINKS.md`, copie delle condizioni e pagina ufficiale nel pacchetto.
