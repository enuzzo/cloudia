# Copernicus GLO30 a62,5m — soli dati, due maschere costa

Preparazione esterna autorizzata17 ottobre2026. Nessuna mesh, browser, GPU,
modifica al prodotto, installazione o lockfile. Gli script riusano il metodo
interno cycle19, di cui sono conservate copie e hash in `baseline-source/`.

## Input e output

- `inputs/`: quattro COG originali GLO30 AWS release2021, non overview; URL,
  intestazioni HTTP e SHA256 in `tiles-manifest.json`.
- `License-COPDEM-30.pdf`: licenza ufficiale originale; `NOTICE-COPERNICUS-DEM.txt`
  descrive modifiche e disclaimer. La variante costa legacy deriva anche dal
  GLO90; relativa licenza conservata accanto alle copie di provenienza.
- `glo30-62_5m-recomputed-coast.cdm1.bin`: quote nuove, oceano e costa ricalcolati
  con il metodo corrente a62,5m.
- `glo30-62_5m-legacy-coast.cdm1.bin`: IDENTICHE quote nuove; costa125m vecchia
  bilineare sui nuovi nodi, poi requantizzata8m. Non è identico al vecchio campo
  continuo: gli errori nodali e off-node sono riportati separatamente.
- `.bin.gz`: copie lossless gzip con mtime0; non modificano il formato raw.
- `holdout-native-m.f64le.bin` e metadata:147.456 quote native GLO30 bilineari,
  in metri Float64LE, NON interpolate dal nuovo raster e PRIMA del trattamento
  mare/quantizzazione. Coordinate/ordine prefissati nel protocollo.
- `preprocess-result.json`: dati verificati, confronto alla stessa origine con
  vecchio125m, seam/corner/NoData/quantizzazione, risorse reali del processo.

Il codice prodotto decodifica CDM1 come32B LE+2049²u16H+2049²i16coast, con nodi
estremi±64km. La quantizzazione0,125m non è accuratezza geografica. GLO30 è DSM,
quindi comprende vegetazione/edifici; non vi sono erosione sintetica o scaling
verticale. EGM2008 e proiezione locale sono descritti nel protocollo.

Per il candidato futuro isolato, root userà height/slope dal nuovo raster e
**coast direttamente dal vecchio sampler125m**. La seconda asset documenta una
variante distribuibile, ma non sostituisce quel requisito di identità CPU.
Anche mantenendo il campo coast, nuovi triangoli possono cambiarne
l'interpolazione raster. Nessun confronto artistico o di costo è dedotto qui.

## Riproduzione su una nuova directory vuota

Usare Python3 con NumPy e Pillow già presenti (qui runtime arm64 condiviso,
Python3.12.14/NumPy2.3.5/Pillow12.3.0); nessun ambiente creato in Dropbox.

```sh
python3 acquire-glo30.py
python3 preprocess-glo30.py --baseline /percorso/al/vecchio/apuane-liguria-cdm1.bin
```

Il secondo comando autentica il baseline con SHA256
`92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d`.
È il file canonico125m esistente, non una rigenerazione. Gli script rifiutano
overwrite e retry impliciti; usare un nuovo percorso e conservare un eventuale
FAIL. Non eseguire di nuovo gli script in questo pacchetto congelato.

Acquisizione: max120MiB tile/90s singolo/240s totale. Resampling:180CPU/240wall;
RSS2GiB controllato fra fasi e terminale, senza hard-interrupt durante librerie
native. I limiti della futura costruzione mesh20CPU/40wall/2GiB sono separati e
non sono stati eseguiti qui.

Fonti primarie: [AWS](https://registry.opendata.aws/copernicus-dem/),
[schema COG](https://copernicus-dem-30m.s3.amazonaws.com/readme.html),
[Copernicus prodotto/datum](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM),
[licenza30m](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf).
La nuova restrizione CDSE View Service2026 è distinta dagli accessi S3 pubblici
effettivamente osservati: non usare un fallback implicito GLO90.

## Esito del singolo preprocess

Exit0. CPU11,670453s, wall11,637260s, picco RSS920.977.408B; sotto i limiti
dichiarati. Tutte le quattro tile decodificate Float32 finite, nessun NoData
dichiarato o sentinel−32767/−9999 presente. Il datum EGM2008 è documentato dal
prodotto ufficiale, non ricavato da una misura locale indipendente.

| Output | Bytes | SHA256 |
|---|---:|---|
|CDM1 coast ricalcolata|16.793.636|`79f84ba70848724549f65c4d4f6758041f10068dc9885156894c36e7bc2c4cd1`|
|CDM1 coast legacy requantizzata|16.793.636|`6ef3fb47f90a375e82d8cc91160524207f2851ee72ffe50af9e12482f85943ff`|
|Holdout nativo Float64LE|1.179.648|`be7e34ad823f6499773c556dc6f05524665df1c3a93a26d8703cfb05632b65e9`|

Hmax2152,625m; quantizzazione massima0,0624999988m. Venti centri originali
coincidono entro5,73e−11m. Seam: massimo0,000271885m rispetto al limite1cm.
Sui1025² nodi coincidenti il delta quote nuovo−vecchio è−51,750/+49,125m,
RMS4,028323m nei616.064 nodi della vecchia maschera coast≥0. È differenza fra
derivati DSM, non errore contro terreno vero; nessuna esagerazione verticale.

**La costa ricalcolata cambia sostanzialmente:** delta distanza fino−5736/+944m;
796 vecchi nodi terra diventano oceano e59 viceversa. L'EDT dipende dalla
connettività e da bassi/canali risolti alla nuova scala, quindi questi valori non
sono uno spostamento fisico certificato della costa. Richiedono review separata.
Usare il vecchio sampler coast nel candidato geometrico, come concordato.

Coast legacy requantizzata: errore nodale massimo4m, holdout off-node massimo3m.
**Il campo continuo non è bitwise conservato.** I due canali quote sono invece
identici byte per byte. Entrambe le asset e le relative gzip sono conservate.

`verify.py --baseline ...` verifica manifest, gzip, header, canale H identico,
aritmetica delle differenze/maschere ai nodi coincidenti, holdout e gate salvati.
Non ripete bilineare/EDT, terreno o GPU. `MANIFEST.json` esclude se stesso e
`verification.json` (risultato del verificatore) per evitare dipendenze circolari.
Il freeze della sola acquisizione citava una bozza iniziale del protocollo:
la copia esatta è conservata in `preparation/`, con mappatura hash; il preprocess
usa esclusivamente il successivo `PREPROCESS-PRE-RUN.json`.
