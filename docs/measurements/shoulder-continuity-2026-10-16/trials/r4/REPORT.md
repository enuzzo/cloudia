# R4 inward joint — TRIAL NOT ADOPTED

16 ottobre 2026. Snapshot esterna122 file, baseline v55; nessuna modifica al prodotto.
Il dist combinato APP + hero è `../anatomy-r4-v55-source/dist/`.

## Modello e provenienza

I119 file originali provengono esclusivamente da cycle21/v55-final/source,
manifest SHA30c5448e87fb60c3bd3fdc8ca133993c49e54503a9950f9da1815fd59883171f.
Tutti gli hash sono stati verificati prima della copia. Le sole differenze esistenti
sono volume.ts e la stringa versione in GPUSceneEngine.ts/lifecycle.test.ts;
i3file aggiunti sono helper/test/scanner. Shader, terreno, WorldCover e CSS v55
sono byte-esatti. Versione metadata: `observatory-v56-inward-joint`.

Da R3 il runtime cambia soltanto il commento e il guard del body lift:
`selected.projection>0 && newRoof>oldRoof`. Il recenter resta condizionato solo a
`selected.projection>0`. Nessun seedif, coefficiente, nuovo cap, ordine/RNG o
nuova primitiva. I18outward mantengono tutto il layout originale; il calcolo delle
quote non modifica il layout. Un inward già coperto recentra comunque la spalla.

La regola coincide intenzionalmente con il vecchio mutant wrong-skip-body sotto
il contratto R3: il contratto è stato cambiato esplicitamente dal root dopo il
FAIL visivo617 di R3. Gli originali R3, i test e il FAIL precedente non sono stati
riscritti. R3 non è stata adottata. R4 resta TRIAL NOT ADOPTED: il root ha ancora
riserve sul vicino74 e il nuovo massimo inward260 richiede giudizio visivo.

Volume R4 SHA52078334f68a827c5d4673483ffa5e53de394d894716985199613b5b3d8e81f1.
Freeze pre-esecuzione SHA7c24b63c348b373f1b0363ae06fb8b8ee14e499870fcbdca6d3116626d73965c.
Manifest sorgenti122 SHA47fa50ddf3ddbe75f76371b96512650e777660dd8462d097ba0d4aaba13c3c95.

## Unico scanner 0..1023

Una sola esecuzione, exit0, kernel RLIMIT_CPU5s, stop soft4.5s. Runtime Bun1.3.11
arm64 (process.version compatibile Nodev24.3.0). CPU riportata3.758317s; wall
3.396363s. Il tempo CPU può eccedere il wall per i thread del processo.
Il comando esatto e il limite sono in checks.json/scanner.log/run-qualification.py.

Il trace R4 legge il volume effettivo congelato. I due prefix bundled baseline/R3,
copiati byte-esatti da cycle21, corrispondono al volume v55 originale e R3; anche
le dipendenze cloud sono state confrontate byte per byte prima del run. Tutti i
confronti avvengono nello stesso runtime. Non si confrontano golden trig Node/Bun.

Il confronto usa stream Float64LE con conteggio lobes, lunghezza tuple e tutti i
componenti: conserva anche il segno dello zero, a differenza di JSON.stringify.
Non alloca campi volumetrici e non chiama raster o bake.

| Proprietà verificata | Risultato |
|---|---:|
| Layout totali |1024/1024|
| Inward R4 esatti R3 |323|
| Outward R4 esatti v55 |18|
| Altre famiglie esatte v55 |683|
| Before-joint esatto v55 e RNG identico |1024|
| Inward con body già coperto, scala1 |197|
| Seed74/77/80 |R4 esatto R3|
| Seed617 |R4 esatto v55, nessun nuovo fullbake617|

I ruoli e le proprietà sono semantici. L'oracolo verifica roof minimo, bottom,
rapporti osservati e offset relativi; non ricostruisce l'affine atteso. Le identità
74/77/80 e i testimoni2/72/73/104/119/188/617 sono in named-witnesses.json,
estratti offline dalle stesse righe: nessun secondo scanner.

### Massimo lift inward — non una garanzia artistica

|Seed|Scala Y osservata|Aumento roof|
|---:|---:|---:|
| 260 | 1.290405714 | 617.857 m |
| 470 | 1.213774304 | 453.848 m |
| 518 | 1.201751553 | 382.089 m |
| 863 | 1.201196730 | 399.890 m |
| 110 | 1.195807505 | 424.304 m |

R4 evita il lift outward617 ma conserva il lift inward: il massimo260 è+29.04%,
quindi superiore al+27.3% del precedente outward617. Non è una soluzione globale
al rischio pillow o al costo visivo del vicino.

### Massimo recenter X/Z

|Seed|Norma spostamento|Proiezione inward prima|
|---:|---:|---:|
| 323 | 972.650 m | 500.418 m |
| 932 | 971.939 m | 620.295 m |
| 917 | 941.805 m | 6.700 m |
| 212 | 937.387 m | 539.099 m |
| 869 | 932.826 m | 485.413 m |

Nota architetturale:917 ha appena6.7m di componente inward, ma il recenter totale
è941.8m, perché la regola riporta sull'intero asse e rimuove anche la componente
perpendicolare laterale. È conforme al modello R4 congelato, ma è una limitazione
artistica concreta; nessun cap o tuning è stato aggiunto. Un'eventuale alternativa
che conserva tale componente appartiene al successivo modello separato.

## Test e build

Typecheck exit0;7/7 test in1file exit0; suite completa348/348 in44file exit0;
buildAPP exit0; buildhero successiva exit0. Il caso7(seed2) prova body invariato
ma recenter necessario anche con roof già coperto. Il mutant reale che aggiunge
erroneamente `newRoof>oldRoof` al recenter è respinto su seed2 dalla distanza
osservata dall'asse feed; source e errore sono conservati, senza layout sintetici.

I119base e i3aggiunti corrispondono al freeze dopo tutte le esecuzioni.
Dipendenze esistenti via symlink, Gitignored e non tracciate, xattr FileProvider1
prima/dopo; nessuna installazione. Nessun browser/GPU o bake dedicato617/full256.
La suite comprende i suoi normali piccoli volumi CPU già esistenti.

## Verifica e limiti

`python3 /percorso/cycle22/anatomy-r4-v55-qualification/verify.py`
legge manifest,122sorgenti,dist,raw e aritmetica delle classifiche/testimoni.
Non esegue JS, layout, volume o GPU; valida le relazioni dei digest salvati e la
coerenza del pacchetto, senza ricostruire i tuple originari dai soli digest.
Conservare le due directory adiacenti source/qualification. Per replay dello
scanner usare un nuovo output JSON e le due references esplicite; il wrapper
esistente rifiuta di sovrascrivere log e risultati. Le reference non sono necessarie
per il normale scanner delle proprietà, ma servono alle identità A/R3 qui registrate.

Il risultato qualifica solo layout e contratti CPU nel range0..1023, non tutti i
seed, supporto/densità filtrata, GPU f32, prestazioni FPS o accettazione artistica.
