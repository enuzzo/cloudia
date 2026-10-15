# Qualificazione del prototipo terreno — ciclo 7, 15 ottobre 2026

**Esito: prototipo CPU verificato sul campione locale; nessuna promozione nel renderer.**
La gerarchia trova l'intersezione della propria griglia bilineare e risolve i due
casi mirati. La griglia è però una nuova rappresentazione approssimata del terreno:
non costituisce un limite conservativo della funzione procedurale originale.
**FPS e tempi GPU del prototipo non sono stati misurati.** I tempi CPU sotto non
permettono di stimarli a 3344×1882, né di dichiarare raggiunto il requisito prestazionale.

## Stato reale dopo l'interruzione

I run 125 m e 62,5 m erano entrambi già terminati con exit 0 e output completi prima
dell'interruzione. La verifica successiva ha soltanto letto i JSON e controllato
SHA e copie; non è stato rieseguito il prototipo. Nessuna generazione di volumi
nube, prova GPU, build prodotto, modifica a sorgenti o handoff.

Il primo tentativo aveva ritardato l'uscita per un timeout del loader Bun sul
`tsconfig.json` Dropbox. I due risultati finali qui qualificati provengono invece
dalla directory Documents/Codex, con import dalla copia locale pinned di
`landscape.ts`. Nessuna cartella di dipendenze o cache è stata installata o creata.

## File e provenienza

- [Script CPU](terrain-heightfield-prototype.ts), con import locale e controlli SHA.
- [Copia esatta del sorgente terreno](landscape-source-copy.ts).
- [Risultato 125 m](terrain-heightfield-prototype.json).
- [Risultato 62,5 m](terrain-heightfield-prototype-62m.json).
- [Ipotesi architetturale](HEIGHTFIELD-PROPOSAL.md), distinta da questa qualificazione.
- SHA-256 script, identico a quello registrato in entrambi i JSON:
  `1a16391934b016026cf8417288eb2fc03e00d7f4e2a4b4a4d7a97b77847dfbe5`.
- SHA-256 del sorgente originale, della copia locale e dei riferimenti nei JSON:
  `72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99`.
- SHA-256 JSON 125 m: `0cfb0c2da678a91bc67c6306c1e05f63033186154b5ca99a464bf5634c81ddbf`.
- SHA-256 JSON 62,5 m: `94a6acf3633818ae1e85484e0369099480ef9f35a16dc18ff4977b28e897d15e`.

Il sorgente originale era ancora leggibile al controllo finale e coincideva con
la copia. Lo script mantiene il suo guard sull'originale: l'esecuzione futura
richiede quel percorso leggibile, oltre alla copia locale e a Bun. Per riprodurre,
dalla directory di questo report:

```sh
bun terrain-heightfield-prototype.ts terrain-heightfield-prototype.json 512
bun terrain-heightfield-prototype.ts terrain-heightfield-prototype-62m.json 1024
```

Questi comandi ricostruiscono solo il piccolo heightfield CPU e i suoi test;
non sono comandi di benchmark GPU o di generazione della nube.

## Modello e metodo

Il dominio è 64×64 km, x/z in `[-32,32]`. I nodi memorizzano in R32F la quota world-Y
ottenuta dalla funzione procedurale radiale originale e dalla curvatura terrestre.
Fra nodi, il nuovo campo è bilineare in world-Y; non si interpola prima l'altezza
radiale per poi ricostruire esattamente la sfera. La misura dell'errore comprende
questa ricostruzione e la quantizzazione R32F, non errori di esecuzione GPU.

Le gerarchie CPU contengono min/max di tutti i figli, incluso il livello foglia.
In aritmetica esatta i bounds sono validi per l'interpolante bilineare perché è
una combinazione convessa dei quattro nodi. Non racchiudono automaticamente la
funzione procedurale fra quei nodi. Eventuali tolleranze conservative f32 e il
solver WGSL restano da verificare, non sono dimostrati da questi risultati CPU.

Le celle sono visitate in ordine front-to-back tramite una lista CPU ordinata.
La sostituzione del raggio nel bilineare produce una quadratica: sono considerate
entrambe le radici, limitate all'intervallo della cella, mantenendo la più vicina.
Un DDA percorre tutte le celle come riferimento del traversal e del pruning,
ma condivide lo stesso solver foglia: non è una seconda implementazione indipendente
della quadratica. Due casi a soluzione chiusa verificano separatamente due radici
in avanti e tangente. La futura DDA gerarchica senza stack proposta per WGSL non
è stata implementata o misurata da questo prototipo.

## Errore di rappresentazione

Ogni run valuta gli stessi 10000 punti interni Halton2/3 nel dominio 64 km,
altri 10000 nel dominio centrale 32 km e 2048 punti su ciascuna delle due diagonali:
24096 valutazioni procedurali per run, aggiuntive alla costruzione dei nodi.
Le coordinate query sono quantizzate f32 in entrambi i modelli. L'errore è
`worldY_bilineare − worldY_procedurale`, in metri. Max e percentili sono assoluti.

| Campione | RMS125m | Max125m | RMS62,5m | Max62,5m |
|---|---:|---:|---:|---:|
|10000 punti interni64km |1,495m |27,819m |0,555m |14,231m |
|10000 punti interni32km |1,511m |26,838m |0,555m |14,327m |
|2048 diagonale x=z |1,064m |13,062m |0,437m |8,309m |
|2048 diagonale x=−z |1,588m |31,894m |0,650m |13,104m |
|6269 punti transizione costa,0≤coast≤13km |1,749m |27,819m |0,662m |14,231m |
|1018 punti presso costa,abs(coast)≤1km |0,0618m |0,2956m |0,0158m |0,0759m |

Nel dominio 64 km, il p95 assoluto passa da 1,555 m a 0,338 m e il p99 da 7,782 m a 2,244 m.
Le medie con segno sono prossime a zero, ma non cancellano le code d'errore.
Il caso peggiore 125 m è a `[-9.828125,9.828125]`, errore −31,894m; quello 62,5 m è a
`[-7.00390625,13.397144317626953]`, errore −14,327m. Le creste possono quindi essere
abbassate sensibilmente. Presso la costa la media con segno è positiva: i dati
non supportano neppure un errore di un solo segno.

Il piccolo scarto sul solo witness non era indicativo della fedeltà complessiva.
Non si può descrivere il nuovo campo come analitico conservato, upper bound,
precisione sub-metrica garantita o terreno già accettabile nell'immagine.

## Intersezioni mirate e costo CPU del traversal

| Caso | Griglia125m | Griglia62,5m |
|---|---:|---:|
|Witness: distanza hit |23,137603956km |23,137643829km |
|Witness: distanza dal crossing procedurale già archiviato |circa0,078m |circa0,038m |
|Witness: residuo radiale sulla funzione originale |+0,0703m |+0,0328m |
|Witness: bounds controllati/nodi visitati/foglie |37/11/2 |45/12/1 |
|Witness: celle nel riferimento DDA |180 |358 |
|Montagna senza sea-hit: distanza hit |20,736862136km |20,734328511km |
|Montagna senza sea-hit: bounds/nodi/foglie |93/25/2 |101/27/2 |
|Montagna senza sea-hit: celle DDA |167 |332 |

Il secondo caso usa origine`[16.4296875,-3.8,0]`, raggio`[-1,0,0]`:
`groundIntersection` restituisce null, ma la griglia trova la montagna. La sfera
del mare non deve quindi essere il gate della ricerca del terreno.

Sul campione 324 raggi CPU di quattro origini, entrambi i run producono 138 hit e
186 miss-in-domain, concordando con il DDA. Non sono miss globali sul pianeta.
Non ci sono unresolved nel campione, neppure con budget 64 **nodi visitati**.
Questo budget non equivale a 64 lookup o 64 bounds controllati.

| Contatore sui324 raggi |125m |62,5m |
|---|---:|---:|
|Bounds controllati: media/p95/max |22,60/69/109 |24,68/73/117 |
|Nodi visitati: media/p95/max |5,91/18/29 |6,45/20/32 |
|Foglie testate: media/p95/max |0,512/2/3 |0,534/2/3 |
|Massimo stack CPU |9 |9 |
|Celle DDA: media |365,28 |730,07 |
|terrainHeight procedurali durante query |0 |0 |

I casi verticali sul bordo, separati dal campione 324, arrivano a 133/149 bounds
controllati rispettivamente. Non vanno nascosti dietro il max della tabella.
Con budget 8 nodi, i due witness tornano esplicitamente unresolved, distanza null e
primo intervallo ancora pendente; non diventano hit o miss fittizi. I due test a
soluzione chiusa danno prima radice 0,4330127018922193 e tangente 0,8660254037844385,
coerenti con i valori attesi registrati nei JSON.

## Costruzione, memoria e FPS non misurati

| Risorsa/tempo CPU registrato |125m,512² celle |62,5m,1024² celle |
|---|---:|---:|
|Valutazioni procedurali di authoring |263169 |1050625 |
|Array quote world-Y |1052676B |4202500B |
|Gerarchia min/max completa |2796200B |11184808B |
|Totale payload CPU del campo+gerarchia |3848876B, circa3,67MiB |15387308B, circa14,67MiB |
|Costruzione CPU |60,528ms |179,886ms |
|Query/probe CPU |24,638ms |40,568ms |
|Misura errore CPU |24,233ms |26,781ms |
|Totale CPU interno registrato |111,456ms |249,474ms |

Sono misure interne performance.now del programma standalone, senza warmup
statistico o controllo di carico; non sono frame time né FPS. Nessuna texture
GPU è stata creata. I nodi procedurali sono calcolati una volta durante authoring;
la query usa la griglia. Il costo globale della scena non è misurato.

La proposta separata cita un esempio core 64 km/62,5 m e far 512 km/250 m, con circa
33,36 MiB CPU e GPU se si trasferiscono quote R32F e bounds RG32F non-leaf. È una
stima dimensionale, non una risorsa già costruita o qualificata. Non è stato
misurato l'errore della griglia 250 m né la zona lontana, e non sono stati implementati
stitching fine/coarse, dominio completo, taper esterno, oceano o DDA gerarchica GPU.

## Limiti che restano aperti

- La griglia locale 64 km non copre tutto il dominio navigabile o l'orizzonte.
- Gli errori campionati non certificano un massimo matematico fra i punti;
  la rappresentazione non è conservativa dell'originale procedurale.
- Nessuna misura di pixel, silhouette, costa, moto, normal shading o qualità visiva.
- Nessuna misura a 3344×1882, di FPS, GPU time, traffico texture, divergenza o registri.
- Nessun trasferimento worker/main, lifecycle/device-loss o nuova binding nel prodotto.
- Nessuna dimostrazione di costo bounded accettabile del futuro traversal WGSL;
  il budget non può essere semplicemente troncato e dichiarato risolto.
- Il confronto DDA condivide il solver foglia; le prove GPU/f32 restano separate.

**Decisione:** conservare il prototipo e i risultati come evidenza numerica e base
di progetto. Non promuovere il heightfield nel prodotto e non sostenere FPS o
accettazione fotografica con questi numeri. Nessuna modifica prodotto è stata
eseguita in questo sottotask.
