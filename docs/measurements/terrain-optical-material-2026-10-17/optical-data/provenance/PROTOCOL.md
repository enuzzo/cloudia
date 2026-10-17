# S2 R2 — correzione esclusivamente di memoria, prima del run

Stato iniziale: R1 è conservato integralmente in `../sentinel2-reference/` e ha
fallito il budget RSS: 488.144.896 byte, prima della scrittura degli output.
Non esiste un campo Float32 R1 completo con cui dichiarare una falsa identità.
Root ha autorizzato **un solo tentativo R2**, con lo stesso tetto 402.653.184 byte
(384 MiB). Se fallisce, conservare gli artefatti e fermarsi senza terzo tentativo.
Nessuna modifica prodotto, dipendenza, quota, build, GPU o browser.

## Invarianti del dato

Restano vincolanti sorgenti, algoritmo, maschere e soglie del protocollo R1,
copiato separatamente in `PROTOCOL-R1.md`. Si riusano esclusivamente i quattro
Range già scaricati (71.091.595 byte), senza rete o nuovi download. Prima di
allocare l'accumulatore, verificarne SHA256, dimensione, piano e manifest R1;
verificare anche sorgente, protocollo, witness e failure R1 congelati.

Stessi 24 blocchi nello stesso ordine. Nessuna modifica a Predictor2,
`valid_native`, `segments` o `accumulate`: stesse operazioni float64 e stesso
ordine delle somme. Nessuna normalizzazione o correzione radiometrica nuova.
RGB resta mean condizionale all'area valida; validità separata. Stesso Float32LE,
2048² celle, 62,5 m, dominio ±64 km e assi X Ovest/Z Nord. Stessa divisione
`np.divide(..., out=zeros, where=valid>0)`, cast Float32 e clip della validità.

## Diagnosi e piano di memoria viva

Dimostrato dal codice: R1 conservava 160 MiB di histogram float64 e allocava
64 MiB di RGB+validità completi. Inoltre erano possibili temporanei completi da
20 MiB (`isfinite`), 32 MiB (`coverage error`) e fino a due array da 32 MiB per
il massimo della validità parziale; il lifetime dell'allocator NumPy può variare.
Non attribuiamo i 465,53 MiB osservati a un singolo temporaneo senza profiler.

R2 conserva l'histogram originale da 160 MiB. Il percorso di decode/accumulo
resta quello che ha passato i 24 gate RSS in R1: singolo blocco raw 8 MiB,
DEFLATE e copia raw al massimo circa 16 MiB temporanei, selezioni e bincount
per blocco; nessun intero mosaico. Il vecchio blocco finale viene rilasciato
prima dei witness. I witness mantengono massimo due raw tile (16 MiB).

Validazioni e argmax scorrono 32 righe: histogram view 2,5 MiB senza copia;
score float64 0,5 MiB, confronto finito 0,3125 MiB. L'argmax locale e confronto
strettamente `>` fra stripe mantengono il primo massimo row-major anche nei tie.
Per la scrittura: mean float64 1,5 MiB, RGB Float32 0,75 MiB, validità Float32
0,25 MiB, clip/rounding/byte chunk limitati a poche MiB; nessun output globale
da 64 MiB. Raw e gzip mtime0 sono serializzati insieme per stripe da 32 righe.
Il budget di payload vivo della coda è quindi circa 168 MiB oltre a runtime,
allocator e librerie; il gate RSS reale da 384 MiB rimane l'autorità.

Il processo di accumulo termina prima dell'analisi. Un secondo processo seriale
legge RGB/validità con memmap e WorldCover con memmap, senza histogram vivo.
Usa esattamente le maschere, il lattice, le statistiche e seam del codice R1.
La somma dei picchi di processi che non coesistono non è il picco RSS del run.

## Gate prima e dopo il run

Prima: oracle Predictor2/overlap originale e piccolo test distinto di memoria:
conversione completa contro stripe deve dare byte Float32 identici; argmax tie
su righe separate deve scegliere il primo. Freeze SHA di script, protocollo,
input e patch prima del run. Rifiuto automatico di un secondo avvio R2.

Dopo accumulo: copertura 1±1e−9; finito/nonnegativo; rounding RGB≤2^-24; cinque
witness con lo stesso oracle scalare. **JSON e CSV dei cinque witness devono
essere identici byte per byte a R1**, non soltanto vicini numericamente.
Output raw+gzip devono avere SHA e dimensioni; verifica successiva gzip→raw
streaming. Nessuna affermazione di equivalenza completa a un output R1 inesistente.

Analisi e figura: nessuna soglia nuova. Un solo gain globale 3, clip e OETF sRGB
prefissati; nessuna modifica ai dati. RGB annuale già illuminato, non albedo,
nuvole non certificate, copertura costruita/coltivata conservata e dichiarata.
Il risultato CPU non qualifica un'immagine prodotto né prestazioni o GPU.
