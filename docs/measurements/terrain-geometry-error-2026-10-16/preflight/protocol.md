# Preflight geometrico R2 — intero core, preparato e NON eseguito

Sostituisce il progetto locale su 17 facce; l'originale è conservato in `cycle27/next-geometry-protocol-local17-r1.md` (SHA `5d2b1c982e8fcce17bd2f1109aee52e1e1dfe315fe9624329cc93ee657400fb9`). Nessun Bun, test, mesh, DEM sampler, kernel, GPU o browser è stato avviato durante questa preparazione. Il futuro run richiede la revisione del programma e dei limiti da parte di root.

## Input e piano chiusi prima del run

Base v58 `908078042bda26471d57cb6a27d69dbec8655c3f`, directory immutabile `../../Cloudia-QA-2026-10-16-cycle27/source`, **mai checkout live o candidate-source**. Manifest 124 sorgenti SHA `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`; CDM1 `src/cumulonimbus/assets/liguria-apuane-dem.bin` SHA `92b28f01e75692c8fba744f6b1161df578c29daa76d8d278ee20a8ce87ba071d`. Programma, wrapper, protocollo, input precedenti e dipendenze selezionate sono elencati con byte/SHA in `PRE-RUN-FREEZE.json`, senza auto-inclusione ciclica.

Il programma importa gli helper reali `decodeTerrainDem`, `sampleTerrainDem`, `createDemTerrainSampler`, `terrainSurfaceSample`, `buildTerrainMeshData`, `terrainMeshSurfaceY` e `terrainMeshHeightAt` della snapshot. Costruisce **una sola mesh baseline** con opzioni effettive dell'engine: 256 celle per lato, 9 livelli, passo base .032 km, normali geometriche. Attesi 465.409 vertici, 929.792 triangoli, 4.096 celle fan e 26.050.592 B di buffer geometria. Non costruisce TerrainMesh, renderer, caster o shadow map.

Prima della misura richiede statistiche mesh identiche al witness già salvato `cycle27/positive-witness/result.json` SHA `f416a5fc3aa706186cc2f08811d7a35192153297f91486e31e6202409ed034cc`, e identità esatta degli indici e dei tre vertici Float32 per le **17 facce** receiver/caster/blocker già congelate: 249937, 249939, 358458, 370841, 370842, 379379, 379929, 379930, 385738, 386018, 386019, 386020, 388890, 388891, 389947, 389948, 389949. Esse verificano la riproduzione della baseline e non selezionano i punti della nuova misura. Mismatch: stop, nessuna riparazione o tolleranza aggiunta.

La griglia deve essere esattamente CDM1: 1025² nodi, estremi ±64 km, passo .125 km, height code ×.000125 km, coast code ×.008 km. Enumerare **tutti i nodi** con indici X/Z da 128 a 896 inclusi, nell'ordine Z crescente poi X crescente: **769² = 591.361** punti nel quadrato chiuso ±48 km. Nessuna esclusione per acqua, pendenza, errore, foto o maschera. Nessun nuovo raggio, ricerca di ROI, midpoint, campione edge/interior, variante o raffinamento. I nodi sorgente sono indipendenti dai futuri midpoint usati per selezionare eventuali split; non rappresentano però un massimo continuo dentro ogni cella bilineare.

Ogni nodo comporta una chiamata a `sampleTerrainDem` e una a `terrainMeshHeightAt`. Hard cap **600.000 punti/query per helper**; non è un obbligo raggiungerlo. Le 465.409 chiamate del sampler per costruire la mesh sono un costo separato, dichiarato come `buildSampleCalls`, e non sono nascoste nel cap di misura. `sampleTerrainDem` deve riprodurre esattamente il codice h/coast del nodo. Coordinate e h non vengono spostate o arrotondate per ottenere un esito.

## Valore misurato e output limitato

Per ogni nodo:

```
Ydem = terrainMeshSurfaceY(x,z,sampleTerrainDem(grid,x,z).heightKm)
Ymesh = terrainMeshHeightAt(actualFloat32Mesh,x,z)
e[m] = 1000*(Ydem-Ymesh)
```

Positivo significa mesh sotto il campo DEM curvo; negativo mesh sopra. Null/nonfinite nel lookup interrompe il run. Questo non è errore lungo la camera, distanza normale, accuratezza fisica del DSM, spostamento del pixel o parità con raster/ombre GPU.

Aggregate prefissate: globale e cinque ring scelti con la stessa regola di `terrainMeshHeightAt` (raggio quadrato max(|x|,|z|), soglie Float32 4.096/8.192/16.384/32.768/65.536 km). Ogni aggregate contiene **all**, **coast>=0** e **coast<0**; la categoria deriva dalla maschera materiale salvata e non afferma una nuova verità fisica di terra/mare o land cover. Conteggi delle due maschere e dei ring devono partizionare il totale. Le medie sono per nodo, non medie areali dell'intero dominio continuo.

Per ciascuna delle 18 aggregate: count, somma compensata signed, somma compensata dei quadrati, signed mean, RMS, minimo/massimo signed, massimo assoluto e numerosità dei pari merito; conservare coordinate/codici/quote degli **8 massimi assoluti, 8 positivi e 8 negativi**. Pari merito: ordine row-major crescente, senza conservare una popolazione piatta enorme. Queste liste sono fissate prima del run, non una ricerca successiva di punti favorevoli.

Istogramma signed fissato: bin da 1m in [-5000,5000), più underflow/overflow, 10.002 contatori per aggregate. Nessun valore viene tagliato per le statistiche. Digest SHA256 dell'intero stream di errori: un Float64 little-endian per nodo, senza header, stesso ordine Z/X, esattamente 4.730.888 B alimentati al digest. Lo stream è processato a blocchi e **non salvato**. Esso attesta l'ordine/ripetibilità di un futuro run, ma non consente di ricostruire valori omessi o statistiche di nuove ROI senza ricalcolo autorizzato.

Output `run/result.json` ≤4MiB: statistiche, istogrammi, raw dei casi estremi prefissati, metadata/associazioni delle 17 facce, digest dei buffer mesh e dello stream, tempi delle fasi. **Nessun JSON da 591.361 righe, nessun volume/mesh intera o raster conservato.** `stdout.log` è un riepilogo; `stderr.log` registra solo fasi/progresso. `run.json` conserva stato terminale e limiti. Nessun risultato esiste al momento della preparazione.

## Budget e lancio futuro, singolo tentativo

Unico child Bun 1.3.11 arm64 pin per hash, stesso Three 0.186.0 esistente; nessuna installazione, lockfile o nuova cartella di dipendenze. Le importazioni si risolvono dal `source/node_modules` già protetto e verificato da root; il wrapper ricontrolla `ignore#P=1` prima/dopo. Non crea cartelle rigenerabili in Dropbox.

Budget: **20s CPU**, **40s wall** inclusa verifica input, **2GiB RSS gate**. Wrapper stdlib con Popen, child PID reale e heartbeat ogni5s; `RLIMIT_CPU=20s`, watchdog wall, kill del solo proprio process group e `wait()` terminale. Accettazione CPU: somma CPU wrapper+child ≤20s; RSS: somma conservativa dei due picchi terminali `getrusage` macOS ≤2GiB. Il gate RSS è terminale, **non** un limite di memoria imposto dal sistema né una misura della somma residente simultanea. Nessun `ps`, retry, fallback, incremento budget o secondo child. Lo script verifica piattaforma macOS arm64 prima di interpretare `ru_maxrss` come byte.

Comando previsto, **non eseguito**:

```
cd /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle28/geometry-preflight
python3 run.py --execute-reviewed-r2
```

`run/` viene creato con `exist_ok=False` prima della verifica: anche un fallimento preflight consuma il tentativo e resta recuperabile. La root del pacchetto è stata a sua volta creata esclusivamente quando assente. `PRE-RUN-FREEZE.json` include programma/wrapper/input prima di qualsiasi esecuzione. Un seguito a FAIL richiede diagnosi e nuovo protocollo esplicito; questo documento non autorizza il run.

## Interpretazione e gate successivi separati

Questa misura può falsificare la premessa di una correzione geometrica se gli errori osservati sui rilievi risultano piccoli rispetto alla modifica proposta; non assume a priori una soglia in metri che l'utente non ha fissato. Valori elevati indicano errore di approssimazione disponibile, senza dimostrare che sia la causa delle scaglie. Non scegliere dopo i dati un percentile/soglia conveniente o nuove ROI per salvare una variante.

Solo dopo il preflight: eventuale singola passata conforme red/green con selezione camera-indipendente, ownership/cella originaria preservata, normali e bounds aggiornati; confronto identico sugli stessi nodi e, se necessario, **protocollo separato** per campioni edge/interior. Una passata 512→256m non certifica 125m. Nessuna variante viene costruita qui. Native A/B per credibilità di creste/costa e assenza di pattern restano indispensabili; 6/12 pixel e statistiche non sono gate artistici. Benchmark/FPS restano una qualifica distinta. Il trial caster/clipping è scartato e non viene riproposto.
