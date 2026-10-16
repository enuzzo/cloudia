# Seed 617 — confronto macro densità A/B 256/128, R2

**Due run CPU conclusi entro budget. R3 non adottata: il root segnala corpo 617 a cuscino e corpo vicino che riempie la vista; è un giudizio visivo distinto da queste metriche CPU.**
Un solo processo Bun A e un solo B sequenziali, stesso binario e script,
risoluzione 256³/detail128³, seed 617. B è partito solo dopo exit 0 e validazione
indipendente del JSON A. Nessun nuovo run dopo questi due.

R1 resta FAIL del nostro guard interno 1 GiB: baseline terminato/reaped e nessun
JSON finale. Non era un requisito del prodotto. Root ha verificato 64 GiB RAM e
ha autorizzato questo nuovo R2 con guard 2 GiB (3,125% RAM), CPU 180 s/wall 240 s per
processo invariati. Per applicare davvero il nuovo limite, l'unico literal del
self-guard diagnostico JS è cambiato 1→2 GiB; SHA comune R2 nuovo ma identico A/B.
Questa eccezione è stata comunicata prima del run, con patch e script R1 conservati.
Non è stato modificato alcun calcolo della generazione o valore di densità.

## Sorgenti e budget

| Lato | Snapshot immutabile / manifest SHA | Wall | CPU | RSS highwater |
|---|---|---:|---:|---:|
|A v55 baseline |cycle21/v55-final/source ·30c5448e… |21,431 s |21,578 s |1.138.638.848B |
|B anatomia R3 |cycle22/anatomy-r3-v55-source ·e65c9209… |20,383 s |20,582 s |1.141.800.960B |

Tutti i 119 file verificati prima del run. Script copiati e src symlink ai soli
snapshot dichiarati. Monitor Popen diretto libproc 50 ms, self-RSS ai progressi,
controllo highwater esatto dopo exit; nessun ps. Entrambi exit 0, processi attesi
/reaped, JSON finiti e con qualità/seed/schema validi. Tempi e RSS sono evidenza
del budget, **non una misura GPU/FPS o un confronto causale delle prestazioni**.

## Risultati del confronto indipendente dei JSON

| Metrica | A | B | Differenza |
|---|---:|---:|---:|
|Densità integrata macroR [densità×km³] |14,56573057 |15,03127138 |+0,46554081 / **+3,1961%** |
|Frazione voxel R>0 |0,03532410 |0,03628582 |+2,7226% relativo |
|Componenti bulk 6 vicini, R byte≥41 |8 |9 |+1 componente |
|Massa bulk nel componente maggiore |99,99760403% |99,99763126% |+0,00002723 punti percentuali |
|Profilo superiore, 256 colonne |identico |identico |0 colonne più alte/basse |
|Facce outer/second con R>0 |0/0 |0/0 |nessun nuovo contatto osservato |

Centroide world Δ=[+23,768,+21,339,+4,525] m; spread Δ=[−4,599,−12,189,−5,798] m.
La massa aggiunta si concentra nella fascia world Y 2–3,5 km: +0,489896;
fra 0,9–2 km c'è una riduzione −0,031055; sopra 3,5 km +0,006701.
Il massimo incremento di sezione è a y=2,96973 km (+0,0242557), mentre il massimo
decremento è a y=1,87402 km (−0,00393019). Sono somme di sezioni, non una
ricostruzione degli incrementi/decrementi voxel per voxel. Le quote sono worldY,
non altitudine sul mare. Non c'è contraddizione fra centroide più alto e spread
Y minore: il cambio registrato redistribuisce soprattutto il corpo centrale,
mentre il profilo massimo per colonna resta invariato.

Il conteggio bulk 8→9 non va chiamato miglioramento della connettività: il
componente dominante resta circa 99,9976% e i residui sono minuscoli; il criterio
macro R byte≥41 e 6 vicini non rappresenta le wisps, erosioni fini o densità deformata
per ogni raggio. Non verifica automaticamente il raccordo visivo con l'incus.

## Dominio e clipping: osservazione circoscritta

SupportBounds identici:
min[−3,21484375,−.16808594,−2,211015625],
max[4,26953125,6,27355469,2,265703125] km. Sono bounds conservativi con pad,
non gli estremi esatti della sola geometria. Il controllo legge sei facce,
ognuna con strato esterno e secondo strato: indici 0/1/N−2/N−1. Tutti R zero,
second-layer max byte 0 in entrambi i run. Non emerge nuovo contatto con gli
strati campionati; **non è una prova universale di assenza di clipping**: lo
strato esterno è forzato a 0 dalla generazione e non si osserva il campo fuori
texture, tutte le possibili deformazioni o gli altri seed.

## Riproducibilità e interpretazione

`pre-run-freeze.json`, input-manifest e i due manifest sorgente conservano le
identità. `qa-morphology.original.ts`, common e guard-only patch mostrano che
momenti/profilo/connettività originali restano invariati; l'estensione legge
soltanto supportBounds, strati e SHA del payload macro generato. Gli array
volumetrici non vengono salvati: gli SHA nel JSON registrano i payload del run,
non una prova indipendente ricalcolata o un full replay.

`A-baseline.json`/`B-candidate.json`, control/validation e log sono lossless.
`comparison.json` e CSV conservano differenze globali, tutte le 256 sezioni e tutte
256 colonne. `verify-comparison.py` ricalcola da questi JSON con Decimal i delta,
verifica hash/sorgenti/budget e non importa né riesegue il generatore.
Nessun risultato del vecchio preflight R3 è stato usato come sostituto.

🌟 Lettura operativa: sul seed 617 il dato misurato è una variazione globale della densità
del +3,20%, con inviluppo superiore e bounds stabili. Questo sostiene una successiva qualifica visiva del raccordo e dei
volumi interni; non dimostra che l'immagine sia più credibile. Nessun GPU,
browser, prodotto, build, FPS o modello fisico è stato qualificato qui.

## Limiti di qualifica rimasti aperti

R1 RSS FAIL è conservato con SHA in `R1-evidence-reference.json`. La precedente
qa-approach separata conserva stato **WRAPPERFAIL**: il monitor ps fallì, il
Bun scrisse un JSON completo ma il codice di uscita non fu catturato. Questo
A/B morphology ha propri exit0/reap validi; non rettifica quella qualifica
precedente. Copie lossless dei due record in `prior-approach-*`.

Il root ha ritirato R3 sulla base della propria qualifica visiva; nessuna
conclusione CPU qui ne cambia il verdetto. R4 è una variante futura distinta,
non eseguita o qualificata da questo archivio. `root-art-verdict.json` distingue
la decisione riportata dall'osservazione diretta di questo agent.
