# Qualifica integrata v50 — 16 ottobre 2026

**Goal attivo. Miglioramento locale della spalla e coerenza del mezzo aereo;
fotografia generale e 60 FPS sostenuti restano aperti.**

## Sorgenti e build

Il parent è `08c33cb`. La versione integrata è identificata da
`observatory-v50-quality-checkpoint`; comprende la spalla inclinata e il
coefficiente aereo comune. Le prove isolate dei due interventi sono negli
archivi [spalla](../inclined-shoulder-2026-10-16/README-it.md) e
[foschia](../aerial-consistency-2026-10-16/README.md). L'A/B/A della foschia usa
l'anatomia originale ed è distinto da questa versione integrata.

La copia esterna congelata conserva 108 file di input. Tutti coincidono con
il checkout qualificato; 96 confronti di sorgenti incorporati nei sourcemap
coincidono con la copia. Sono registrati 24 asset finali, senza discrepanze.
`source-manifest.json` e `build-provenance.json` conservano byte e SHA256.
Le build rimangono esterne a Dropbox, nella cartella locale `Cloudia-QA-2026-10-16-cycle14`.

Suite completa: **255 test, 37 file PASS**. TypeScript, build app e successiva
build hero riusciti. I quattro log sono gzip lossless, con SHA e byte degli
originali in `compressed-originals.json`. Rimane l'avviso Vite sulle dimensioni
dei chunk; non è un errore di compilazione.

## Browser e misure

Una sola scena attiva, nessun altro bake, build, test o probe durante le
misure. Seed 74, target esplicito `[0,2.7,0]`, avvicinamento zero, yaw zero,
pitch 0,36 rad, vento 55%, dispersione zero, pioggia circa 80%, cielo assestato.
Output e interno **2560×1440**, macro 256³, dettaglio 128³, **384 passi nominali**,
flusso completo, nessuna ablazione, densità R8 confermata in entrambi gli estremi.
Il raggio diagnostico `surface=1` è misurato dalla mira e non dalla superficie;
con avvicinamento zero non determina il raggio panorama di 16 km.

| Percorso effettivo | Stato | Durata misurata | Invii/s | Mediana / p95 rAF |
| --- | --- | ---: | ---: | ---: |
| Worker reale | t60 in pausa | 30,0192 s | 26,1499 | 17,60 / 67,20 ms |
| Main | convezione e pioggia animate | 90,0222 s | 24,9605 | 33,40 / 50,30 ms |

Sono controlli funzionali di due condizioni differenti, non un confronto
prestazionale fra thread né un vantaggio sul baseline. Il valore è cadenza
di invio, **non FPS presentati dal compositore**. La prova main registra tempo
nube 60,9822→152,9205 s; lo snapshot iniziale precede anche i due secondi di
riscaldamento, che non entrano nella durata misurata di 90 s.

I prefissi finali confermano tutti i 785 e 2247 invii. I timestamp hanno invece
782/785 e 2245/2247 draw completi: restano rispettivamente tre e due draw senza
campioni, e sei/zero pass non associati al ledger. Nessun pass invalido,
ambiguo o duplicato. I raw sono conservati integralmente e il riepilogo mantiene
anche coverage e diagnostica; il ledger non viene dichiarato completo.
Le somme dei pass GPU non sono durata del frame o throughput isolato.

Main e worker mostrano la scena integrata e i due lati del sole basso;
console warning/error vuote nelle catture archiviate. Le fotografie del cambio
luce sono sparse e non certificano una transizione video continua. Le immagini
prima/dopo il moto mostrano condizioni osservate, senza sostituire l'accettazione
artistica del movimento. La cattura main subito dopo la chiusura del pannello
ne conserva una traccia della dissolvenza UI.

## Esito visivo e prossime cause

La spalla sostiene meglio l'incudine nei seed e nelle viste documentate;
la sagoma a uncino/U rimane. La foschia elimina coefficienti diversi per tipo
di oggetto nel modello omogeneo; le coppie Sole/Pioggia/20% non dimostrano un
vantaggio artistico generale. Cortina regolare, virga debole quasi invisibile,
resa naturale del paesaggio e correttezza del terreno restano da risolvere.

La [diagnosi ravvicinata](../../EXPERIMENT-NEAR-LIGHT-CAUSALITY-2026-10-16.md)
ricostruisce il gradiente effettivo e il plateau preclamp. La revisione scalare
provata svuota il fronte: non è stata applicata. I replay trasferiti sono
passati dopo la conclusione delle misure; `archive-verifications.json` registra
l'esito osservato. La [nota FPS](fps-next-cause.md) è una proposta successiva,
non implementata in v50: il compilatore potrebbe già eliminare il lavoro duplicato.

Restano aperti tutti i gate generali: anatomia fotografica delle tre famiglie,
luce ravvicinata/in moto, pioggia e virga naturali, terreno, UI e 60 FPS.

## Anteprima e integrità

Anteprima ordinaria animata: `http://localhost:4196/?seed=74`, Sole, output
nativo, pulsante Pausa disponibile, senza banner di camera diagnostica.
Il canvas DOM è 2560×1440 su viewport CSS 1280×720. I JPEG restituiti dal
browser sono **1280×720**, non PNG o readback nativi senza perdita.

```sh
python3 docs/measurements/quality-v50-2026-10-16/verify.py
```

Il verifier controlla payload e originali gzip senza lanciare il renderer.
Il manifest non include il proprio hash. Nessun push, merge o deploy.
