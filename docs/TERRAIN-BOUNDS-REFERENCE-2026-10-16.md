# Prima entrata nel terreno: riferimento CPU qualificato

16 ottobre 2026, decimo ciclo. **Riferimento esterno, non integrato nel prodotto.**
Il solver attuale conserva le sei iterazioni non racchiuse in un intervallo e
il gate sulla sfera marina: la correttezza dell'occlusione resta aperta.

Il nuovo riferimento attraversa limiti analitici del campo originale in ordine
di distanza. Non interpola altezze da una nuova geometria. Comprende il caso
di montagna oltre l'orizzonte marino documentato nella
[proposta precedente](TERRAIN-CONSERVATIVE-PROPOSAL-2026-10-16.md).
Gli intervalli usano lo stesso hash intero, rumore, costa, ridge e clamp;
le chiamate puntuali al campo sono rinviate all'ultimo metro. Un lookahead
entro quel metro cerca un witness occupato senza scartare il prefisso.

## Risultato e costo

Matrice finita di 14 raggi: 11 hit e 3 miss risolti, intervalli di hit entro
un metro. La superficie CPU con arrotondamenti f32 può essere discontinua:
il risultato riguarda la prima entrata nell'insieme occupato `F <= 0`, non
uno zero reale ricavato dal teorema di continuità.

| Metodo | Chiamate height totali | Mediana / massimo per raggio | Visite | Query dinamiche dei limiti |
| --- | ---: | ---: | ---: | ---: |
| Solo limite globale, diagnostico | 7.430 | 526 / 1.728 | 7.145 | 0 |
| Limiti analitici diretti | 58 | 4 / 11 | 624 | 617 |
| Metadati lazy da 1 km | 64 | 4 / 12 | 1.008 | 452 |
| Metadati lazy da 62,5 m | 64 | 4 / 12 | 1.114 | 304 |

Le poche chiamate height non descrivono tutto il lavoro. Nel caso lazy da
62,5 m, con cache già calda, restano 917 letture dei limiti e 304 query
analitiche, che effettuano 7.336 hash, oltre alle 64 chiamate height.
Non sono tempi o risparmi GPU. Il budget di 128 visite e 16 chiamate height
lascia un raggio `unresolved`; con 256/16 la matrice si risolve tutta
(massimo osservato 200 visite e 12 height). Un limite esaurito deve restare
esplicito, senza attribuire correttezza al vecchio Newton usato come fallback.

Un dominio completo di 1.024 km con celle da 1 km richiederebbe circa 8 MiB
di metadati di base. Con celle da 62,5 m salirebbe a 2 GiB di base e circa
2,67 GiB con la piramide. L'integrazione deve quindi combinare copertura
grossolana e dati locali/sparsi, conservando il campo originale.

## Qualificazione e limiti

Controlli finiti superati: 9.675 campioni height/costa, 9.000 di rumore,
1.161 sotto-rettangoli, 4.608 trasformazioni delle ottave e 6.912 termini
ridge. Una scansione di controllo di 62.740 punti a passo 5 m non trova
occupazione precedente ai risultati; il passo finito non esclude ogni
possibile dettaglio. La review ha corretto il precheck di uscita dalla
sfera per raggi non unitari; regressioni con lunghezza 0,5 e 2 conservano
gli stessi intervalli fisici entro 0,4913 m.

Il contratto numerico è CPU `Math.fround`, con margini dichiarati per le
funzioni host (`sin` e `pow`) e per il calcolo radiale in binary64. Le prove
non certificano universalmente WGSL/Metal, riassociazioni o ogni GPU.
Typecheck standalone superato. Nessun bake, query GPU o prova browser
eseguiti da questo riferimento.

[Archivio completo e manifesto SHA](measurements/terrain-bounds-2026-10-16/manifest.json):
script, matrice, risultati per raggio, review, verifiche e copia esatta del
terreno sorgente `72a15a3c…90d99`. Gli script originali conservano import
assoluti del checkout canonico e rifiutano uno SHA differente. Il prodotto
non è stato modificato dal riferimento. La candidata coarse+sparse per GPU
è il passo successivo, ancora da qualificare e misurare.
