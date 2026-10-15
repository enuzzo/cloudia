# Esperimento: banda intermedia da circa 26 m

15 ottobre 2026. Confronto successivo al checkpoint `76f449a`.

**Esito: variante respinta.** La sola aggiunta di erosione alla scala intermedia
non rende leggibile la struttura ravvicinata nelle tre pose confrontate. Le
immagini restano morbide all'80% e quasi uniformi al 95–100%; la misura GPU
aumenta. La banda candidata non viene mantenuta nel codice attivo. La patch
rimane recuperabile in
[`experiments/meso26-erosion12.patch`](experiments/meso26-erosion12.patch), insieme
alle evidenze positive e negative conservate qui.

## Modifica candidata e provenienza

La baseline mantiene il dettaglio ordinario, con strutture intorno a 104 m,
e l'erosione metrica già esistente. La candidata aggiunge un lookup del canale R
del dettaglio a frequenza `1.2`, corrispondente a strutture intorno a 26 m,
con erosione massima `0.12` e peso `1 - ice`. Il materiale CPU usato dal bake
della profondità ottica valuta la stessa banda. Nessuna normale artificiale,
nessun nuovo modello luminoso e nessuna ricostruzione temporale sono introdotti.

I due assemblati sono identificati separatamente dai manifesti, con hash SHA256
dei sorgenti e degli artefatti:

- [Baseline, `observatory-v25-comparison`](measurements/meso-baseline-build-2026-10-15.json).
- [Candidata, `observatory-v26-meso-experiment`](measurements/meso12-candidate-build-2026-10-15.json).

Gli hash di `volume.ts` e `cloudShader.ts` nei due audit CPU corrispondono
ai rispettivi manifesti. La banda intermedia è un esperimento di materiale:
non è una nuova qualificazione dell'anatomia o del prodotto completo.

## Confronto a camera fissa

Entrambe le build usano il raggio diagnostico `comparisonSurfaceKm =
0.6045067691053366`. È la distanza dal target usata dal dolly, non una misura
del distacco da ogni filamento. L'override di confronto salta la ricerca della
frontiera: la modifica della densità non può spostare la camera fra A e B.

Nei report baseline `surfaceEstimateKm = 0.4` è soltanto il valore iniziale
inutilizzato della sonda. **Non è la distanza applicata o una misura valida.**
La candidata registra `null` per evitare questa ambiguità. Per ricostruire il
confronto contano `comparisonSurfaceKm`, target e origini esplicite.

Le origini dei report browser sono numericamente identiche nelle coppie,
senza arrotondamento applicato per il confronto:

| Avvicinamento | Origine world `[x, y, z]`, km |
| --- | --- |
| 80% | `[0.4296875, 2.9365234375, 1.1639784268955404]` |
| 95% | `[0.4296875, 2.9365234375, 0.712093643489751]` |
| 100% | `[0.4296875, 2.9365234375, 0.6045067691053366]` |

Per ciascuna coppia coincidono anche target, support bounds, forma, seme,
direzione solare, stato meteo e condizioni di rendering:

- Seme `1571198069`, tempo della nube 60 s dall'inizio alla fine della misura,
  pausa attiva, orbita disattivata, yaw/pitch zero.
- Scenario Sole, lato sinistro, transizione completata, pioggia e dispersione
  zero, vento 55%, nessun fulmine automatico o in anteprima.
- Main thread WebGPU, Three r186, adapter Apple / Metal-3, flusso completo,
  sonda `full`, senza ablation.
- Output e buffer interno entrambi **1672 × 941**, macro **256³**, dettaglio
  **128³**, **384 passi nominali**, nessun TAA o downscale. La sonda di camera
  è saltata in entrambi gli assemblati di confronto.

Queste pose fissano l'origine, non la distanza dalla superficie della diversa
densità candidata. L'audit CPU candidato conserva anche una propria stima della
frontiera, `0.601407791004431` km, ma non la usa per collocare la camera: applica
il raggio baseline fissato sopra.

## Immagini e risultato visivo

Le sei immagini sono catture del rendering reale. Tutte e tre le coppie sono
state riesaminate: all'80% il grande margine della nube rimane poco definito;
al 95% e al 100% dominano campi luminosi quasi uniformi. La candidata cambia
leggermente luminosità e distribuzione dei toni, ma non risolve l'aspetto di
nebbia sfocata. Questo è un esito negativo conservato, non un'accettazione
fotografica.

| Pose | Baseline | Candidata | Report baseline | Report candidata |
| --- | --- | --- | --- | --- |
| 80% | [Immagine](measurements/meso-2026-10-15/meso-baseline-near80-sun.jpg) | [Immagine](measurements/meso-2026-10-15/meso12-candidate-near80-sun.jpg) | [JSON](measurements/meso-2026-10-15/meso-baseline-near80-30s.json) | [JSON](measurements/meso-2026-10-15/meso12-candidate-near80-30s.json) |
| 95% | [Immagine](measurements/meso-2026-10-15/meso-baseline-near95-sun.jpg) | [Immagine](measurements/meso-2026-10-15/meso12-candidate-near95-sun.jpg) | [JSON](measurements/meso-2026-10-15/meso-baseline-near95-30s.json) | [JSON](measurements/meso-2026-10-15/meso12-candidate-near95-30s.json) |
| 100% | [Immagine](measurements/meso-2026-10-15/meso-baseline-near100-sun.jpg) | [Immagine](measurements/meso-2026-10-15/meso12-candidate-near100-sun.jpg) | [JSON](measurements/meso-2026-10-15/meso-baseline-near100-30s.json) | [JSON](measurements/meso-2026-10-15/meso12-candidate-near100-30s.json) |

## Tempi misurati

Ogni misura dura circa 30 s, dopo 2 s di warmup. Le durate esatte e i campioni
grezzi rimangono nei JSON collegati sopra.

| Pose | Variante | rAF/s | GPU media, ms | GPU p95, ms | Intervallo rAF p95, ms | Intervalli >33,34 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 80% | Baseline | 59,9944 | 22,3934 | 24,7726 | 17,60 | 0 |
| 80% | Candidata | 59,9978 | 23,6865 | 27,0664 | 17,50 | 0 |
| 95% | Baseline | 59,9974 | 27,0144 | 29,0980 | 17,60 | 0 |
| 95% | Candidata | 59,9964 | 33,5990 | 43,9091 | 17,30 | 0 |
| 100% | Baseline | 55,2630 | 33,8093 | 35,5860 | 33,30 | 60 |
| 100% | Candidata | 47,9301 | 39,5528 | 40,9600 | 33,40 | 148 |

La GPU media osservata cresce del 5,77% all'80%, del 24,37% al 95% e del 16,99%
al 100%. Al massimo avvicinamento passa da 33,81 a 39,55 ms, mentre la cadenza
rAF scende da 55,26 a 47,93 al secondo. Il confronto non sostiene la promozione
della candidata in assenza di un miglioramento visivo.

Sono singole misure per posa, con ordine baseline 80/95/100 seguito da candidata
80/95/100; non sono un A/B alternato. Il tempo simulato resta identico, ma
orari di acquisizione, stato termico e carico esterno possono differire. Non si
attribuisce causalmente tutta la differenza alla sola lettura aggiunta.
Timestamp GPU e intervalli rAF sono osservazioni distinte, non campioni
necessariamente accoppiati. I rAF/s non misurano le immagini presentate dal
compositor; non si deducono fps presentati dall'inverso del tempo GPU.

I dump console [baseline](measurements/meso-2026-10-15/meso-baseline-console.json)
e [candidata](measurements/meso-2026-10-15/meso12-candidate-console.json) sono
entrambi `[]`: nessun errore presente nei log acquisiti.

## Audit CPU e limiti dell'indicatore

Il confronto numerico usa l'audit baseline già conservato
[near-density](measurements/near-density-cpu-2026-10-15.json) e quello
[candidato a camera fissa](measurements/meso12-fixed-density-cpu-2026-10-15.json).
Le origini CPU registrate coincidono fra le due serie alla precisione stampata.
La baseline usa la propria frontiera; la candidata riusa quel medesimo raggio
come override. Le pose non vengono ricalcolate sulla frontiera candidata.

Il CV seguente è il rapporto fra deviazione standard e media delle cinque
sorgenti luminose medie dei raggi dichiarati. Ogni media del raggio è pesata
per contributo all'opacità. Non è il contrasto dei pixel dell'immagine finale.

| Pose | CV baseline | CV candidata | Variazione relativa del CV | Variazione della sorgente media |
| --- | ---: | ---: | ---: | ---: |
| 80% | 54,8211% | 54,8635% | +0,08% | +3,85% |
| 95% | 17,4610% | 18,3344% | +5,00% | +5,02% |
| 100% | 5,3564% | 5,8864% | +9,89% | +4,97% |

Al 100% il +9,89% relativo del CV equivale a circa **0,53 punti percentuali**
assoluti. L'incremento della luminosità media di circa 4–5% non dimostra una
migliore struttura del materiale. Le immagini reali prevalgono sul solo
indicatore numerico: l'obiettivo visivo non è raggiunto.

Gli audit usano cinque raggi, quadrature midpoint da 3/6 m, la stessa griglia
macro 256³ e dettaglio 128³, e la sorgente prima di aerial e tonemapping.
Non eseguono WGSL, non leggono il risultato GPU e non certificano tutte le
direzioni o il moto. Inoltre il bake della nuova erosione ai centri macro,
spaziati circa 27–39 m secondo l'asse, può sottocampionare la banda da 26 m:
aggiungerla sia al materiale sia al bake non garantisce una luce risolta alla
sua frequenza.

## Conservazione e stato finale dell'esperimento

I sei JPEG, i sei report grezzi e i due dump console sono copie byte per byte
degli originali in `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-15/`,
verificate mediante SHA256; gli originali sono preservati. Manifesti e audit
CPU restano nei rispettivi percorsi già indicati.

La sola banda meso viene rimossa dal materiale attivo e rimane nella patch
archiviata. Il confronto a camera fissa e i suoi metadati rimangono strumenti
diagnostici espliciti; non sostituiscono la sonda ordinaria. Una successiva
revisione della luce o del suo costo richiede un esperimento distinto, con
baseline, immagini e misure proprie. Nessun risultato di questa prova conferma
qualità fotografica, fluidità animata o comportamento worker/mobile.
