# La mesh perde rilievo presente nel DEM: misura completa del core

16ottobre2026. **Goal attivo; prodotto v58 invariato.** Il confronto numerico
sui591.361nodi originali del DEM nel core ±48km conferma una perdita geometrica
consistente. Sui334.589nodi con maschera coast>=0 lo scarto RMS è24,684m;
nei casi peggiori osservati la mesh supera il campo di261,539m o resta sotto
di209,990m. Questi valori giustificano un trial di raffinamento locale della
geometria; non dimostrano ancora un miglioramento dell'immagine o delle ombre.

## Risultati e significato

Errore definito in metri come Y del campo DEM con curvatura terrestre meno Y
dei triangoli Float32 effettivi. Positivo: il triangolo abbassa il rilievo;
negativo: il triangolo riempie l'avvallamento rispetto ai dati disponibili.
La sorgente resta Copernicus/GLO90 ricampionata a125m, senza nuova esagerazione
verticale. Lo scarto non è una stima dell'accuratezza geografica del DEM.

| Ring / passo celle | Nodi coast>=0 | RMS sui nodi coast>=0 | Massimo assoluto osservato |
|---|---:|---:|---:|
| 0 /32m | 36 | 0,213m | 0,729m |
| 1 /64m | 3.696 | 2,015m | 14,374m |
| 2 /128m | 23.296 | 8,056m | 62,100m |
| 3 /256m | 117.505 | 16,107m | 138,415m |
| 4 /512m, solo entro±48km | 190.056 | 30,071m | 261,539m |

Il core intero include256.772nodi coast<0: RMS globale18,578m, RMS della sola
maschera coast<0 0,955m. Il suo estremo−84,564m indica una quota mesh sopra il
campo presso un nodo con quota DEM zero; non va attribuito automaticamente a
una costa fisica errata o a uno specifico artefatto del PNG. Le categorie sono
quelle della maschera materiale e le statistiche sono sui nodi, non medie areali.
Ring0 ha soltanto36nodi della categoria terra: il suo RMS non rappresenta una
grande popolazione di montagne. Ring4 non è misurato fino al bordo65,536km.

Il punto con massimo errore assoluto è X−36,625km/Z0,750km: campo269m sopra il
livello di riferimento, mesh261,539m più alta nel corrispondente Y sferico.
Coordinata e codici sorgente sono conservati. Non è stato scelto un nuovo punto
per rilanciare un test: è il massimo del set completo prefissato.

## Metodo e limiti del run

Snapshot v58:124sorgenti congelati SHA-manifest21cda2a0…, DEM pin92b28f01…,
Bun1.3.11 arm64 e Three0.186.0. Una sola mesh reale465.409vertici/929.792triangoli,
26.050.592B di payload; statistiche e17facce salvate del witness precedente
coincidono esattamente. Nessun raggio o algoritmo di shadow map è coinvolto.

Tutti i nodi [128…896]² del DEM1025², passo125m, sono enumerati per Z poi X.
Il lookup usa i triangoli reali della mesh, inclusi fan e cuciture. Sono salvati
conteggi, somme compensate, RMS, istogrammi signed da1m e top8 estremi di ogni
gruppo globale/per ring e categoria. Nessuna scelta adattiva dei punti.
Lo stream Float64LE degli errori ha4.730.888B, SHA256
`6e5ff2fecacc6a7928dc927f341906f04b369cbbd976357d31f63d2faedf191a`;
è stato hashato, non conservato. Non ricostruisce i valori mancanti.

Run unico terminato exit0: CPUchild1,664310s, CPUwrapper0,047615s,
CPUcombinata1,711925s, wall1,428565s. Picco child898.826.240B, wrapper33.783.808B;
somma conservativa932.610.048B entro2GiB. Hard limit OS20sCPUchild; gate finale
20sCPUcombinata/40swall inclusa preflight/RSS. Non è residenza simultanea o
misura del carico globale della preview; non misura il rendering o gli FPS.
I tempi interni distinguono costruzione1008,0ms e query182,9ms nel processo Bun,
senza trasferirli alla velocità del browser o ad altri dispositivi.

La preparazione I/O ha scoperto che il Python locale non espone os.getxattr.
Il launcherR1 è conservato come ricostruzione byte per byte dalla patch;
DarwinR2 legge lo stesso attributo con l'API nativa a6argomenti. Nessun Bun,
mesh o sampler era partito in quella preparazione. Il freeze finale precede
l'unico run, e19input/124sorgenti coincidono anche dopo. Nessuna dipendenza
installata, lockfile o cartella Dropbox modificati; ignore#P=1 verificato.

## Trial successivo autorizzato, ancora da qualificare

È in preparazione esterna una sola passata locale red/green: identificare le
facce originali che perdono i nodi disponibili, inserire midpoint condivisi e
spostarli sul medesimo sampler. Figli contigui nella cella originale, lookup
bounded, normali e bounds finali devono restare coerenti. La soglia ingegneristica
iniziale5m non è un requisito fotografico o certificato di errore continuo.
La griglia128m può ancora perdere i nodi125m non allineati; non limitare per
principio l'analisi alle sole celle256/512m. Una sola passata512→256m mantiene
un residuo possibile e non promette125m ovunque.

L'helper di suddivisione e i test qui conservati sono proposte non eseguite.
La futura selezione e la verifica sulla stessa griglia sono una misura di fit,
non un holdout indipendente; servono poi test topologici, confronto nativo alla
stessa posa, worker/lifecycle e costi reali prima dell'adozione. La tecnica
shadow per singolo triangolo scartata nel ciclo precedente resta esclusa.

La scelta statica locale conserva il contratto attuale della cache e l'assenza
di costruzione CPU perframe. È una decisione per Cloudia, distinta dai
[geometry clipmaps di Losasso/Hoppe](https://hhoppe.com/proj/geomclipmap/),
che aggiornano griglie annidate al movimento della camera. Il riferimento
[GPU Gems sul raffinamento](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-5-generic-adaptive-mesh-refinement)
aiuta a distinguere suddivisione e spostamento e la coerenza dei bordi; i suoi
risultati prestazionali storici non sono misure trasferibili a Cloudia.

## Stato verificabile

[Archivio](measurements/terrain-geometry-error-2026-10-16/README.md) con codice,
freeze, risultato integrale e verificatore saved-evidence senza replay.
Output originale2.532.734B SHA256
`5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27`.
23payload/2.645.221B, manifest SHA256
`d1b16590f0dadce6cab84e67270e0629b3d1503c922b6eaefa8b4acdb6c9fdef`.
Verificatore saved-evidence exit0: inventario,8input locali/19esterni,
124sorgenti,18aggregate e160nodi estremi con codici DEM sparsi PASS. Non
ricostruisce la mesh o lo stream e non convalida il futuro split.
Il prodotto e la preview4196 restano v58 Sole animata a2474×1844;256³/128³/384
e output pieno preservati. La geografia reale e gli abitati nel materiale restano
attivi. Fonte reale, correttezza numerica e credibilità fotografica sono gate
distinti; anatomia/vicino, pioggia, moto/UI e60FPS stabili globali restano aperti.
