# Riorientamento del rigonfiamento interno: preflight ritirato

**Il modello fallisce il controllo necessario e viene ritirato.** La massa lascia i due vecchi campioni del becco, ma il raggio della sella perde ulteriore supporto. Non sono stati avviati volumi 32³/64³, bake, build, app o confronti fotografici. Il prodotto rimane sulla geometria v50/10493 con la spalla inclinata già promossa come miglioramento locale.

L'[archivio portabile](measurements/body-bulge-orientation-2026-10-16/README.md) conserva tutti gli originali, modello e campionatore congelati, input e risultati, con hash e verifica offline indipendente.

## Ipotesi isolata

La precedente attribuzione aveva identificato il rigonfiamento laterale interno del maturo come causa del becco. Una semplice rimozione avrebbe aperto ulteriormente la U. Qui si prova una sola redistribuzione: ruotare rigidamente quel gruppo verso la tangente della spalla 14.1, alimentando il tratto ascendente invece di rasare la sporgenza.

La selezione usa il summit più alto, la sua fondazione e la spalla con massima proiezione positiva verso l'altra fondazione, rispetto all'asse alla quota del core. Include il core e i discendenti effettivi: **91 riferimenti distinti**, senza selezione per indice o seed. È j0 nel74 e j1 nei77/80; 72/73 restano identici. La rotazione minima riguarda centri e assi ellissoidali, dopo decorazione e contrazione originali. Nessun nuovo coefficiente, RNG autoriale o ricontrazione globale.

Si conservano primitivi, raggi locali, volume ellissoidale, blend e ordine dell'unione; testa/collo, giovane, incus, altri gruppi e campo/ancoraggi della spalla non vengono mutati. Questo controllo differisce dalla sostituzione globale PLUME e dalla rotazione del cap alto già ritirate. WMO Plate5 fornisceva una guida morfologica al corpo che si espande verso l'outflow, senza convalidare questa trasformazione.

**Conservare il volume dei primitivi non conserva massa ottica:** sovrapposizioni, carving, quota e materiale modificano la densità risultante.

## Gate congelato e risultato

Prima di confrontare il modello sono stati riprodotti esattamente i tre raggi originali, i sei stencil completi e i loro 48 byte R8. È stato usato il layout effettivo 10493 archiviato, senza rigenerare primitive o dedurre dal precedente audit trigonometrico 72 un'identità automatica sul 74.

Il quarto raggio, sella, è stato fissato prima del calcolo al pixel nativo **[1408,490]** su 2560×1440, UV centro `[1408.5/2560,490.5/1440]`. Camera dell'attribuzione: origine `[0,2.7,16]`, yaw/pitch0, ispezione0; t60, wind0.55, dispersione0, stesso campo fine/flow/materiale/estinzione e stessa finestra completa near→far. Non è la camera della scena ordinaria.

Condizioni necessarie congiunte: diminuzione di densità nei due vecchi stencil del becco **e** aumento di integrale fine/τ sul raggio sella.

| Dato salvato | Baseline | Modello |
|---|---:|---:|
| Densità al vecchio becco τ1 | 0,770251 | 0 |
| Densità al vecchio becco τ3 | 0,474717 | 0 |
| τ sulla sella, finestra completa | 0,666904 | 0,654876 |
| Integrale di densità fine sulla sella | 0,0370502 | 0,0363820 |
| Supporto positivo sulla sella | 7 passi | 6 passi |

I due stencil del polso restano identici; sul suo raggio completo τ cala leggermente. L'esterno rimane esattamente invariato. Il core74 sale 0,471897 km e arretra lungo Z 0,428363 km: il cambiamento non alimenta il vuoto richiesto. **Nessuna taratura successiva o ricerca di altri pixel per salvare il FAIL.**

I bounds ruotati comprendono correttamente sd≥−0.35; i margini analitici del gruppo alle sei facce sono positivi. I box dei lobes, contati algebricamente a 256, aumentano di 1,302% sul 74, 0,587% sul 77 e 1,597% sul 80. Non sono misure di bake o GPU/FPS, né una prova dell'intero supporto dopo unione e carving.

## Limiti e verifica

Un solo probe CPU su richiesta: quattro raggi e dodici stencil dettagliati complessivi, nessun volume intero. La ricostruzione CPU non è readback GPU, ricostruzione RGB o prova dell'intera fotografia. **FAIL del gate campionato; nessun nuovo giudizio artistico da screenshot.**

```sh
python3 docs/measurements/body-bulge-orientation-2026-10-16/verify.py
```

Il verificatore usa soltanto la libreria standard Python e legge l'archivio senza estrarlo. Controlla hash e dimensioni, 48 byte R8 e digest originali, 465 campioni baseline salvati, aritmetica del gate, selezione e 91 riferimenti unici, matrici/bounds/costi dai dati conservati. Non esegue il campionatore JS o calcoli di campo. L'uguaglianza completa dei sei stencil durante il probe rimane anche un'asserzione registrata con digest; non viene rigenerata qui.
