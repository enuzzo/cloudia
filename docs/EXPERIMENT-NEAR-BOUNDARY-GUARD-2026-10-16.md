# Guardia del bordo: modello interno non promosso

La guardia conservativa preserva il supporto positivo nel perimetro campionato, con le ipotesi indicate, ma elimina quasi tutta la variazione interna ipotizzata. **Il modello non viene promosso e non viene avviata un'app candidata.** Non sono stati prodotti nuovi render, immagini, misure FPS o giudizi artistici.

L'[archivio portabile](measurements/near-boundary-guard-2026-10-16/README.md) conserva i due pacchetti originali congelati, input lossless e un verificatore offline indipendente. Non comprende cache o volumi.

## Ipotesi esaminata

Il precedente scalare `.6→.5` aumentava il carving anche sul fronte non saturo, svuotando tutti i 13 punti appena dentro la nube. Il modello successivo, fissato prima del calcolo, mantiene lo stesso campo negativo ma limita la modifica all'interno già saturo:

```text
I1 = I0 + .1*smoothstep(.04,.28,F)*smoothstep(1,1.25,U0)
```

F è il campo dei primitivi; U0 il valore prima di limitarlo all'intervallo 0–1; I regola l'erosione applicata. Non si aggiunge un rumore o una frequenza. I nodi con U0≤1 restano invariati, ma quelli interni modificati possono influenzare celle miste del bordo. La guardia verifica quindi le otto celle adiacenti usate dall'interpolazione trilineare, la miscela dei valori degli otto voxel più vicini: 27 corner distinti nel vicinato 3×3×3.

## Provenienza chiarita prima del probe

Un confronto esatto tra i vecchi metadata frozen `08c33cb` e il trace baseline `10493` aveva fallito. Il prefisso autoriale dei primitivi seed 72 è identico; è stato dimostrato che la differenza deriva dagli arrotondamenti sin/cos dei runtime Bun 1.3.11 e Node 26.11.0.

Dei 2.589 primitivi, 299 hanno differenze solo nei centri, al massimo `4,4408921×10⁻¹⁶` km. Scambiando esclusivamente i risultati delle 12.666 chiamate sin/cos tra i due runtime, ciascuno riproduce esattamente tutti i cinque array dell'altro; RNG, argomenti, ordine e contrazioni coincidono. La differenza di provenienza è quindi spiegata, senza dedurre l'identità di ogni valore preclamp da una precedente uguaglianza dei buffer finali.

La prova della guardia usa **Node 26.11.0 e le stesse primitive baseline `10493afa7f6d90389c39e17b2cad79397dfdac01` per vecchio e provvisorio**. Prima sono stati verificati i 252 byte originali e tutti i byte del modello fisso, poi ricostruiti soltanto 209 vicini mancanti. Totale: **461 nodi, zero discrepanze rispetto ai byte originali della cache**. Nessuna rasterizzazione o generazione di volumi 32³/64³/256³.

## Guardia e risultato

Per forcing zero, il limite flow deve includere l'arrotondamento half: `.1800537109375`. Con micro-erosione e ghiaccio, i bound sono `E(i)=.6950537109375+.065i` e `M(i)=1−.99766i`: E limita l'erosione fine, M la frazione minima di materiale residuo. Ogni corner vecchio e **provvisorio completo** deve superare `E+float32(.002)*(1−E)/M`, più uno slack numerico esplicito `2⁻¹⁶`. La quota per ice comprende warp Y massimo 0,06 km e padding `2⁻¹⁴` km.

Le 55 proposte toccano 176 celle distinte, tutte liquide nel perimetro: il massimo locale padded è ancora almeno 1,059602 km sotto iceStart. Il minimo ammesso è 178/255. Nel peggior corner accettato resta un margine macro di 0,00236035 sopra la soglia padded; il bound di densità fine è 0,00979026, superiore a 0,002.

**Sopravvivono 12 cambiamenti; 43 vengono ripristinati.** Il confronto usa tutti i vicini provvisori prima del filtro. Poiché `vecchio ≥ filtrato ≥ provvisorio`, i revert possono soltanto alzare i minimi e non invalidano quelli già qualificati. Tutti i 13 punti front+5m e il raggio debole alle vecchie τ1/τ3 restano esattamente invariati; nessuno dei 52 punti o 394 campioni centrali viene svuotato.

| Nove UV validi, vecchie profondità | Baseline | Senza guardia | Con guardia |
|---|---:|---:|---:|
| Densità media a τ1 | 0,685707 | 0,652230 | 0,685143 |
| CV densità a τ1 | 4,766201% | 6,338465% | 4,798513% |
| CV alla distanza media di contributo | 3,653275% | 5,356654% | 3,690451% |
| CV densità a τ3 | 7,626554% | 10,238678% | 7,626554% |

CV è la deviazione standard divisa per la media dei campioni di densità; non misura il contrasto dell'immagine.

Nel centro gli attraversamenti τ1/τ3 arretrano di soli 0,071/0,061 m, rispetto ai 2,735/4,739 m del provvisorio non filtrato, sulla vecchia finestra. La variazione residua non giustifica ora il costo di un'app candidata: è un esito operativo negativo, senza una nuova valutazione visiva.

Il certificato riguarda i vicinati campionati, campi fini/flow fissi e forcing zero. Gli slack sono margini ingegneristici; il percorso GPU completo, l'intera frontiera, dinamica, forcing positivo, ghiaccio positivo, RGB e prestazioni restano aperti. Non viene cercato un nuovo parametro per aggirare questo esito.
