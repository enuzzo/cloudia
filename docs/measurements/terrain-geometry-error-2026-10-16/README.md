# Errore geometrico della mesh v58 rispetto al DEM

Misura unica del16ottobre2026, base runtime v58/9080780 e checkpoint documentale
236821e. Prodotto invariato e goal attivo. Il programma confronta tutti i591.361
nodi sorgente nel quadrato chiuso ±48km col piano dei triangoli Float32 effettivi.
Non modifica, raffina o renderizza la mesh; non è una misura FPS.

`preflight/` conserva i9file55715B del freeze e l'unico `run/` completato.
Il risultato integrale è2.532.734B SHA256
`5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27`.
`pre-run-root-review.md` precede il run; `post-run-hash-verification.json` attesta
che124sorgenti e19input espliciti sono rimasti invariati. Il manifest sorgente
locale è quello v58, SHA21cda2a0… . Asset DEM e dipendenze non sono duplicati.

CPU combinata1,711925s, wall1,428565s, somma conservativa dei picchiRSS932.610.048B,
terminale exit0, entro20sCPU/40swall/2GiB gate finale. Il limite OS CPU è sul
child; CPU combinata e RSS sono gate terminali. I tempi non comprendono la
successiva analisi/curazione dei JSON e non qualificano startup browser o FPS.

Le categorie landMask/seaMask sono soltanto coast>=0/coast<0 del materiale.
Sui334.589nodi landMask: RMS24,684m, errore minimo−261,539m e massimo+209,990m;
positivo significa mesh sotto il DEM. Ring4 è campionato solo fino±48km,
non fino al suo bordo65,536km. Le medie sono sui nodi, non integrali areali.

`preparation/` preserva il launcherR1 ricostruito invertendo la sola patch,
l'errore Python `os.getxattr` della preparazione I/O e il passaggio a Darwin
ctypesR2. Non era partito Bun, non esisteva run/ e non era stato campionato il
DEM. Non dichiarare R1 come copia fatta prima della correzione o tentativo mesh.
L'eccezione whitespace riguarda soltanto il diff raw, preservato con hash esatto.

`next-split-proposal/` contiene un helper e test **preparati ma non eseguiti**.
Non fanno parte della mesh misurata e non sono una futura implementazione
qualificata. Nessun risultato del presente pacchetto dimostra il loro effetto.

Il verificatore saved-evidence alla radice usa solo la libreria standard Python.
Controlla integrità e coerenza aritmetica dei risultati senza ripetere Bun,
campioni DEM, mesh, test o GPU. Esempio dalla radice del repository:

```sh
python3 docs/measurements/terrain-geometry-error-2026-10-16/verify_geometry_archive.py \
  --runtime-source . \
  --external-root /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle28
```

Senza i riferimenti esterni verifica solo i byte archiviati e i vincoli salvati.
Lo stream di errori Float64LE è hashato durante il run ma non conservato:
il digest non ricostruisce i valori omessi e la verifica non ricalcola i massimi
su591.361nodi. Il risultato è un errore **osservato rispetto al campo disponibile**,
non accuratezza del DEM, massimo continuo, causa delle scaglie shadow, prova
fotografica, benchmark o autorizzazione ad adottare nuovi triangoli.
