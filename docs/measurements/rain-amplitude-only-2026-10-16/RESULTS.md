# A-only: unico replay CPU storico — 16 ottobre 2026

**Audit completato e valido. 128³ FAIL del gate tau massimo; 256³ PASS dei gate
numerici dichiarati, esclusivamente su questa sequenza storica. Nessuna promozione.**
Una sola esecuzione, Bun 1.3.11 arm64, exit 0, 2,137 s interni all’audit.
Nessun nuovo volume, sweep, stato, probe di bordo, GPU, browser, build o test.

|Misura|128³|256³|Gate preesistente|
|---|---:|---:|---|
|Mapping p99 / massimo, m|0 / 0|0 / 0|≤.75 / ≤1.5: PASS / PASS|
|Mapping unione contributor, p99 / massimo, m|0 / 0|0 / 0|Stessi gate: PASS / PASS|
|Delta tau assoluto massimo|.01106115476|.00336424015|≤.01: FAIL / PASS|
|Delta tau medio, tutti i 576 raggi|.00062254859|.00018611414|≤.002: PASS / PASS|
|Delta tau medio, 247 raggi rain-positivi|.00145177315|.00043401516|Informativo; ≤.002 anche qui|
|Delta T finale massimo|.00510805845|.00144976377|Informativo, nessun nuovo gate T|
|Massimo errore T lungo il prefisso|.00535303354|.00182515383|Informativo|
|A originale 0 → A_eff positiva|3.986|1.868|Supporto cambiato, non prova visiva|
|A originale positiva → A_eff 0|0|1|Supporto cambiato|
|Continuazioni censurate oltre cutoff baseline|4|1|Rendering candidato completo non valutato|
|Nodi oracle lazy valutati|165.344|324.139|Nessuna cache scalare densa allocata|

## Baseline, mapping e guardie

Tutte le dieci sorgenti `git show ab2e122:src/cumulonimbus/*.ts` elencate nel
manifest dati sono byte-identiche ai rispettivi sourceHashesAfter. Anche sun.ts
proviene da ab2e122. Copie originali e runtime sono separate; le sole riscritture
sono i percorsi dichiarati in preparation.json e nei patch transform.

La baseline riproduce **tutti** i counts e lookup storici, non soltanto i tre
principali: 246.399 iterazioni, 206.466 rainRegion, 91.572 contributor rain positivi.
sequenceSHA è `a0c2dfd79e1900dce9a677fceecbd5bfcfc138a2e94cd430938f4c4c7bf3ca7a`.
I 1.613 controlli indipendenti delle formule A/s hanno zero errori; i sei casi
half RNE del vecchio oracle passano. Nessuna guardia originale rimossa.

Per tutti i 206.466 punti la candidata ricostruisce xz e coordinate streak dal
**medesimo s originale** con le stesse operazioni f32, anche quando A=0. Zero
mismatch; gli hash delle coordinate originali e candidate coincidono:
`5b28b63444b0892f75c939e064c1a8bc0b1e1986b9740090affe2818ff07a736`.
La cached s viene ancora calcolata/impacchettata dall’oracle riusato ma non entra
mai nella sigma candidata. Questo runtime CPU non è una cache GPU scalare.

La semantica congelata prima del run è `A_eff = validUV ? q.A : 0`, usando
la UV originale. q.A raw ed A_eff sono conservate separatamente. Nessun gate
column.R viene applicato alla candidata. In questa posa **zero punti hanno UV
fuori dominio**, dunque il ramo UV falso è verificabile nel codice ma non
esercitato dalla misura; raw A ed A_eff coincidono qui. Non è un test dei bordi.

Il massimo residuo sigma del solo riordino delle moltiplicazioni, con A e s
originali senza ricampionamento, è 2,384185791015625e−7 /km. Rimane separato
dall’errore della cache: non si attribuisce ogni differenza f32 alla griglia.

## Interpretazione e limiti

A-only elimina il difetto di fase della precedente A/s senza ritoccare i gate.
Il 128³ fallisce ancora l’ottica massima; il 256³ supera il necessario controllo
numerico su questo stato. La variazione A e il supporto spurio restano reali:
A_eff massimo errore .0751338/.0287489; media .00155511/.000424109.
Un PASS tau non dimostra che i bordi, la virga o il contrasto siano accettabili.

Il percorso originale governa t/ds/jitter/clip/early exit. Sigma cloud+rain è
integrata nello stesso segmento, conservando quantità e fase. Il seguito dei
4/1 raggi che avrebbero oltrepassato il cutoff baseline non è stato generato:
le T qui sono su prefissi fissati, non rendering candidati completi. Raggi con
cutoff candidato anticipato continuano anch’essi sul prefisso baseline.

Gli input sono CPU storici v40: seed 72, t60, rain .8, posa pitch −.92,
2560×1440; rainTime=0 è inferito dalla sequenza UI archiviata. Non sono la posa
v50 2112×1844/pitch +.2811 o flow letto dalla GPU. Non sono stati provati altri
amount/growth/tempi/climi; dopo il FAIL 128 non si avvia alcuno sweep.

Le Map lazy dell’oracle conservano packed RG16F(A,s); le dimensioni ipotetiche
R16F 4/32 MiB non descrivono l’heap misurato. Storage R16F richiede Tier1 device
non verificata. Fallback core buffer pack di due A→copy R16F: 8/64 MiB vivi,
oltre ad eventuale doppia pubblicazione. Il rebuild resta fino a tre lookup per
nodo; non è stato misurato. Sampler nativo, coerenza temporale, sourceRGB,
precisione GPU, memoria driver, immagine, presentazione e FPS restano aperti.
L’aerial v50 usa k=.006+.004*haze: non serve per tau/T e non è simulato qui.

🌟 Il 256³ può passare alla valutazione di formato/rebuild e a guardie native
soltanto su decisione del root. Questo risultato non giustifica un’implementazione
permanente o una previsione di vantaggio. Il 128³ non passa il gate fissato.

## Artefatti

- PROTOCOL.md e PROTOCOL-UV-ADDENDUM.md: congelati prima dell’unico run.
- pre-run-manifest.json: SHA di tutti gli script, copie e protocollo prima del run.
- preparation.json, prepare.py e *.transform.patch: provenienza e riscritture.
- result.json: metriche, per-ray e witness dei due grid; witness-index.json facilita
  l’ispezione dei raggi massimi e censurati senza nuovi calcoli del modello.
- historical-replay.json e run.*.log: baseline riprodotta e log originali del run.
- after-run-manifest.json: inventario finale, input e verifica degli invarianti.

Gli originali cycle10 e phase2 non sono stati modificati. Sunset32 MiB è solo
citato dal manifest storico, non letto: macro/detail/rain/flow sono i quattro
payload verificati size/SHA durante il replay. Dipendenze esistenti verificate;
node_modules ignored/untracked e File Provider ignore=1 prima e dopo.
