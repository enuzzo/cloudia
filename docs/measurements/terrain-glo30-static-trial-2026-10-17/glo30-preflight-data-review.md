# Review indipendente dei dati del preflight GLO30

17 ottobre2026. Sola lettura di script/freeze/JSON salvati e aritmetica sui
riepiloghi; autenticati i due input con SHA256. **Nessun modello ripetuto,
nuovo punto, build o GPU. Nessun blocker concreto rilevato nella corrispondenza
degli input o nel PASS numerico dichiarato.** L'adozione resta subordinata al nativo.

## Corrispondenza degli input

- Nuovo CDM1: `glo30-dem/glo30-62_5m-recomputed-coast.cdm1.bin`, SHA
  `79f84ba70848724549f65c4d4f6758041f10068dc9885156894c36e7bc2c4cd1`.
  Il wrapper autentica questo file prima del run. Il witness richiede2049²,
  passo0,0625km, origine−64/−64km. Sono gli stessi nodi/estremi del preprocess.
- Holdout: `glo30-dem/holdout-native-m.f64le.bin`, SHA
  `be7e34ad823f6499773c556dc6f05524665df1c3a93a26d8703cfb05632b65e9`.
  Lunghezza147456×8B; Float64LE in metri. Preprocess e witness concordano su
  `x/z=−48+(4*i+0,5)*0,0625`, i0..383, Z esterno/X interno. Sono centri fuori
  dai nodi62,5m usati per selezionare il refinement; riferimento campionato
  direttamente dal mosaico GLO30 nativo, non dal raster62,5m.
- Il riferimento nativo è antecedente a clamp/mask/quantizzazione. Il witness
  applica `max(0,native)` e converte m→km una volta. I due errori mesh usano
  lo stesso target sferico `terrainMeshSurfaceY`; rasterOnly confronta quote
  in km, riportandole in metri. Il segno è **ricostruzione−riferimento**.
- Il candidato usa dal nuovo grid height/gradient, ma rimpiazza ogni coast con
  `oldSample(x,z).coastKm`. La selezione dell'holdout è identica per A/B:
  **vecchia coast strettamente>0**,83424/147456 punti. Non viene impiegata la
  nuova maschera favorevole né la coast legacy requantizzata. La nuova
  triangolazione può comunque cambiare l'interpolazione raster della coast.
- Baseline ricostruita e verificata prima di B sui quattro buffer storici
  posizioni/normali/surface/indici. È parità di questi quattro buffer, non
  certificazione dell'intero renderer. Source129 e due input sono autenticati
  dal wrapper; witness SHA`20ec1083acd1c4f3ebcd8abde0d16537d68b1335e198513c60c2e65c2658a1f6`.

## Risultato e limiti

| Misura sugli stessi83424 punti | Canonico | GLO30 candidato |
|---|---:|---:|
| RMS contro nativo |14,636787m|13,102917m|
| Media firmata |−0,025780m|+0,007880m|
| Min/max firmati |−110,516636/+116,149681m|−113,174502/+117,501491m|
| Max assoluto osservato |116,149681m|117,501491m|
| Vertici |591788|619667|
| Triangoli |1182550|1238308|
| Payload geometrico |33127816B|34689040B|

L'aritmetica salvata è coerente: RMS=√(sumSq/n), rapportoB/A**0,89520446**,
riduzione**10,47955%**. Supera il gate fissato prima del run (rapporto≤0,9),
con margine contenuto. Migliorano53078 punti (**63,624%**), peggiorano29806
(**35,728%**),540 uguali; la somma è83424. Il massimo assoluto peggiora di
**1,351810m**: il PASS medio non è un limite massimo né un miglioramento ovunque.

Il raster62,5m da solo ha RMS**3,482476m** contro lo stesso riferimento;
la mesh candidata13,102917m. La rappresentazione continua a perdere parte del
dettaglio della fonte su questi punti, nonostante la fonte più fitta. Non è
corretto dedurre terreno geografico accurato, né sottrarre quadraticamente i due
RMS come componenti indipendenti: gli errori sono correlati e il confronto mesh
include superficie sferica/interpolazione Float32. Questo è un confronto di
**fedeltà alla fonte DSM**, comprendente vegetazione/edifici, non rilievo a terra.
Il holdout non è un nodo di fit, ma deriva dallo stesso mosaico geografico; non
è un dataset indipendente. Cambiano sia quote sia facce selezionate: il risultato
non isola il contributo della fonte da quello della nuova triangolazione.

Cap rispettati:2362369 probe<2400000,619667V<1M,1238308T<2M,
34689040B<64MiB. Rispetto al canonico:+27879V,+55758T (**+4,715%**),
+1561224B (**+4,713%**). Sono payload statici, non tempo GPU/RSS/60FPS.
Controlli salvati: normali finite con errore unità massimo4,25e−8, winding
positivo, indici/celle contigui, massimo20 triangoli/cella. Il massimo globale
height3,026km comprende anche il terreno procedurale esterno; non va confuso
con Hmax2,152625km dell'asset misurata.

`run.json`: exit0, CPU4,672694s, wall4,298412s, piccoRSS1061519360B;
gate20CPU/40wall/2GiB rispettato. RSS è accettazione terminale misurata,
non un limite preventivo di allocazione. Nessuna inferenza FPS o artistica.

Prossimo gate già previsto: bundle statico validato e confronto nativo a camera,
luce e qualità identiche; un'immagine insufficiente non viene salvata dal PASS RMS.
Nessuna richiesta di altri campioni o cap modificati da questa review.

Record letti: `mesh-preflight/{witness.ts,run.py,PRE-RUN-FREEZE.json,pre-run-review.md}`,
`mesh-preflight/run/{run.json,stdout.json}`, `glo30-dem/holdout-native-m.metadata.json`.
SHA `run.json`: `1d84c4cf2ecd5cb3b9ff2b53cdfecf814dd1fbb29c292295478b28f77a347a88`;
SHA `stdout.json`: `7e6da3c235fb4474250f5dd959fe1d54a5bb8e891b611335eb736e98f6dd0f6d`.
