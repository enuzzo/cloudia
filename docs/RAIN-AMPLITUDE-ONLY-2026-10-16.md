# Pioggia: cache della sola ampiezza A — 2026-10-16

**Gate CPU circoscritto: 256³ PASS; 128³ FAIL del massimo tau. Nessuna promozione.**
Una sola esecuzione autorizzata sui 576 raggi storici, senza nuovi stati, sweep,
volume, GPU, browser o modifica renderer. Il risultato non misura immagine o FPS.

L’[audit tecnico precedente al run](measurements/rain-amplitude-only-2026-10-16/alternative-audit/AUDIT.md)
confronta questa rappresentazione con la preintegrazione adattiva: A-only richiede
meno integrazione e rimuove il difetto di fase della precedente A/s. Non rende
ancora conveniente una cache GPU; nessun nuovo trial di preintegrazione è eseguito.

## Rappresentazione e contratto

Il campo originale è `sigma=.85*amount*A*(.35+1.3*streak)`. La candidata interpola
solo A half e conserva la lookup guessG, s/xz e streak **originali** ad ogni punto
6 m. Applica `A_eff=validUV?q.A:0`, con la stessa UV originale; nessun gate sulla
column.R originale, che richiederebbe la lookup da sostituire. q.A raw e A_eff
sono diagnostiche separate. **Zero punti UV fuori dominio** in questa posa:
il ramo falso è presente nel codice ma non esercitato dalla prova.

Interpolare A cambia l’ampiezza, il supporto e potenzialmente bordi/virga/contrasto.
I vecchi errori sigma/tau di A/s non si trasferiscono: potevano contenere
cancellazioni fra ampiezza e spostamento. Il nuovo replay è dunque necessario;
non è una rinomina del PASS ottico precedente o un allentamento dei gate.

La baseline governa quantità, clock, t/ds/jitter/clip e cutoff; cloud+rain sono
integrati nello stesso segmento. Macro 256³, dettaglio 128³, 384 passi nominali e output pieno restano
il contratto. Nessun salto di passo o separazione arbitraria dei due mezzi.

## Misure e provenienza

[Protocollo](measurements/rain-amplitude-only-2026-10-16/PROTOCOL.md) e
[addendum UV](measurements/rain-amplitude-only-2026-10-16/PROTOCOL-UV-ADDENDUM.md)
sono congelati prima del run. Il [report raw](measurements/rain-amplitude-only-2026-10-16/result.json.gz)
conserva tutti i record per raggio e i witness con corner half/pesi.

|Misura|128³|256³|Gate congelato|
|---|---:|---:|---|
|Mapping p99 / massimo, m|0 / 0|0 / 0|≤.75 / ≤1.5: PASS / PASS|
|Delta tau assoluto massimo|.01106115476|.00336424015|≤.01: FAIL / PASS|
|Delta tau medio, tutti i 576 raggi|.00062254859|.00018611414|≤.002: PASS / PASS|
|Delta tau medio, 247 raggi rain-positivi|.00145177315|.00043401516|Informativo; non diluito dai vuoti|
|Delta T finale massimo|.00510805845|.00144976377|Informativo, nessun nuovo gate T|
|Massimo errore T lungo il prefisso|.00535303354|.00182515383|Informativo|
|A0 → A_eff positiva / positiva → 0|3.986 / 0|1.868 / 1|Supporto cambiato|
|Continuazioni censurate oltre cutoff baseline|4|1|Nessuna integrazione del seguito|

Bun 1.3.11 arm64, exit 0, 2,137 s interni all’audit: durata dell’oracle lazy CPU,
non rebuild GPU o tempo renderer. Dieci sorgenti di ab2e122 corrispondono
esattamente ai sourceHashesAfter del manifest storico; sun.ts viene dallo stesso
commit. Tutte le guardie precedenti restano; il controllo sorgenti è rafforzato
ai dieci SHA. Le sole riscritture dei sorgenti storici sono i percorsi dichiarati.

La [baseline riprodotta](measurements/rain-amplitude-only-2026-10-16/historical-replay.json.gz)
coincide in tutti i counters e lookup: 246.399 iterazioni, 206.466 rainRegion,
91.572 contributori positivi, sequenceSHA `a0c2dfd79e1900dce9a677fceecbd5bfcfc138a2e94cd430938f4c4c7bf3ca7a`.
Il run confronta xz e coordinate streak sui 206.466 punti, inclusi A0: zero
mismatch e digest uguali. Il residuo massimo sigma del solo raggruppamento f32,
con A/s originali senza cache, è 2,384185791015625e−7 /km, registrato separatamente.

Gli input sono v40: seed 72, t=60, rain=.8, pitch −.92, 2560×1440; rainTime=0 è inferito
dalla sequenza UI storica. Non è la posa v50 2112×1844/pitch +.2811. Le T candidate
sono valutate soltanto sul prefisso baseline: 4/1 seguiti rimangono censurati,
non nuovi rendering completi. L’[indice witness](measurements/rain-amplitude-only-2026-10-16/witness-index.json)
individua i raggi massimi e censurati. Nessuno sweep segue il FAIL 128³.

## Cosa l’archivio permette di verificare

Il [verificatore offline indipendente](measurements/rain-amplitude-only-2026-10-16/verify_archive.py)
ricostruisce SHA, trasformazioni, counters dai record baseline, statistiche tau/T
per-ray e gate. Usa soltanto Python standard, senza array o import del renderer.
Le coordinate complete dei 206.466 punti non sono serializzate: **controlla
l’uguaglianza dei digest registrati, senza ricalcolarli**. Ricostruisce la
statistica dei massimi T registrati per raggio, non ogni traiettoria T interna.
Supporto, distribuzioni A/sigma e residuo f32 restano diagnostica registrata.

L’[inventario durevole](measurements/rain-amplitude-only-2026-10-16/archive-manifest.json)
conserva protocolli, script originali/adattati, trasformazioni, snapshot piccoli,
manifest input lossless, raw output/per-ray/witness e log. I tre JSON grandi
(result, baseline riprodotta e baseline storica) sono gzip mtime0; il
[record di compressione](measurements/rain-amplitude-only-2026-10-16/compression-record.json)
dichiara SHA/dimensioni compressi e originali. Dopo decompressione non cambia un
byte. L’identity R1 completo è congelato fuori Dropbox; il verifier può comparare
i tre originali byte per byte tramite `--frozen-root`, anche lanciato da /tmp.
Nessun array binario, clone Git, dipendenza o dist è copiato. I percorsi assoluti originali sono
conservati: gli script non sono un replay autonomo. Il verifier offline lo è.

## Decisione

🌟 **Solo il 256³ giustifica la verifica successiva di formato/rebuild/native.**
R16F 4/32 MiB è solo payload ipotetico, non heap/VRAM misurata: l’oracle usa Map di
packed RG16F(A,s), ignorando s cached. La successiva
[microprova GPU R3](RAIN-AMPLITUDE-GPU-FORMAT-2026-10-16.md) qualifica il formato
sulle sole griglie 16×2×3 e 17×2×3: core pack+copy e Tier1 opt-in con pack/unpack
prima dello store passano lo stesso witness. Tier1 non è abilitata dalla policy
del device prodotto; il PASS non qualifica il campo A completo o RNE portabile.
Fallback core buffer+copy R16F mantiene 8/64 MiB vivi, più eventuale pubblicazione
doppia. Il rebuild conserva fino a tre lookup per nodo.

Prima della cache si valuta un trial delle sole guardie esatte attachment0 ed
evaporation0 sul percorso originale: nessuna nuova memoria o approssimazione.
È la priorità successiva, perché parte del lavoro eliminabile non richiede A
cached. La presente qualifica CPU resta circoscritta e valida come prerequisito;
non equivale alla scelta di integrare la cache.

Sampler nativo, flow GPU, altri amount/growth/tempi, transizioni, supporto continuo,
sourceRGB e qualità visiva restano aperti; nessuna riduzione di costo o aumento
FPS è dimostrato. L’aerial v50 usa k=.006+.004*haze, ma non serve per tau/T e
non viene simulato. L’obiettivo generale di qualità e fluidità rimane aperto.
