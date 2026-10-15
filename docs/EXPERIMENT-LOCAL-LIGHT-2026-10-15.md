# Luce locale con coda macro: audit del potenziale

15 ottobre 2026. **Solo audit CPU della baseline liquida 18/km.** Nessun
modello aggiunto al renderer, nessuna cache GPU costruita e nessuna immagine
prodotta da questa variante. Il goal di qualità ravvicinata resta aperto.

Script: [`qa-local-light.ts`](../scripts/qa-local-light.ts).
Report completo: [local-light-potential-cpu](measurements/local-light-potential-cpu-2026-10-15.json).

## Metodo e identità controllata

Una sola nube 256³/dettaglio 128³, seme 1571198069, tempo 60 s, vento 55%,
Sole sinistro; cinque raggi frontali a 80/95/100% con origine fissata dal raggio
baseline 0,6045067691053366 km. Il campo di flusso è il riferimento half-float
16³ filtrato. La quadratura di camera usa passi 3/6 m; quella verso il sole
2/4/8 m nel primo tratto di 128 m. La coda usa la cache verde esistente.

La sostituzione corretta è `tau = tauCache(q + L*sun) + integral(0,L,sigma ds)`.
Sommare l'integrale locale a `tauCache(q)` conterebbe il primo tratto due volte.
Il mezzo omogeneo di controllo ricostruisce tau 9,36 con errore inferiore a
1,8e-15; la doppia somma aggiungerebbe erroneamente 1,4976. Questo controllo
verifica l'identità analitica, non l'accuratezza della cache reale quantizzata.

`q` è già la coordinata materiale risultante dal flusso filtrato. L'ombra locale
valuta il materiale statico del bake, con warp/erosione ordinari una sola volta,
senza riapplicare il flusso e senza `flow.a` o microerosione della camera.
È la stessa approssimazione di luce statica co-deformata, non trasporto esatto
nello spazio world dinamico. L'occlusione del cielo rimane quella precedente.
La nuova tau solare entra nelle formule esistenti di luce diretta e multiple.

## Risultato sui cinque raggi

Valori della quadratura camera 3 m / ombra 2 m, prima di aerial e tonemapping:

| Avvicinamento | CV sorgente baseline | CV sorgente ibrida | Sorgente media baseline → ibrida |
| --- | ---: | ---: | ---: |
| 80% | 54,8211% | 55,7865% | 0,301495 → 0,308641 |
| 95% | 17,4610% | 16,3595% | 0,266968 → 0,268828 |
| 100% | 5,3564% | 4,8439% | 0,258744 → 0,262024 |

Il CV confronta cinque sorgenti medie pesate per contributo all'opacità: non è
contrasto fra pixel finali. La sorgente si schiarisce, ma la variazione fra raggi
**diminuisce al 95% e al 100%**. L'audit non sostiene questa specifica sostituzione
come soluzione alla nebbia uniforme; la sua cache GPU viene rinviata.

## Convergenza e limiti

I passi ombra 2/4/8 m danno risultati vicini; anche la quadratura camera 6 m
conferma il segno del cambiamento del CV. È convergenza numerica della funzione
approssimata qui descritta, non prova visiva, WGSL o misura di costo GPU.
La cache originale è UNORM8 con tau massima 16 e passo circa 0,06275; il bake
campiona densità fine ai centri macro, distanziati circa 27–39 m. Differenze
locali possono riflettere quantizzazione e sottocampionamento oltre al dettaglio.

Cinque raggi, un seme, sole alto e fronte fisso non qualificano altre famiglie,
sole basso, orbita o moto. Nessuna interpolazione spaziale di una futura cache
vicina è simulata. Nessun risultato garantisce un miglioramento fotografico
o esclude un diverso modello locale; prima di costruire una cache occorre
identificare una risposta luminosa che migliori realmente l'immagine.
