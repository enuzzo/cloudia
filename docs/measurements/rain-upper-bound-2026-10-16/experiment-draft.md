# Pioggia: limite superiore del calcolo ottico · bozza ciclo 9

**STATO: CANDIDATA SPERIMENTALE, VERDETTO IN ATTESA DELLE MISURE.**
La patch congelata è stata applicata ai quattro file del prodotto per la prova.
Non è ancora una soluzione promossa e non chiude l'obiettivo di qualità/FPS.
Base: `a1efb8e489d31c417ebb2dd6b06cbc2e8dfaca1c`.
Patch dei tre sorgenti: SHA256 `d93626af66c702ae5c2542914316b9e356d69adf08f92cfe2e6ce87d43bac16a`;
il quarto file contiene i sette nuovi test unitari.

## Problema e risparmio cercato

Il box della pioggia arriva alla quota di riferimento 2,8 km anche quando tutte
le sorgenti della mappa RG8 emettono più in basso. Il raymarch conserva campioni
fino a 6 m in questo intervallo; sopra il termine dell'attacco verticale, il
calcolo ottico può comunque eseguire due letture rainMap, due letture detail e
la relativa matematica per ottenere estinzione nulla. Il tentativo elimina solo
questo lavoro nullo, mantenendo ogni punto di campionamento della scena.

Il risparmio effettivo dipende dai raggi e dall'occlusione: non è garantito che
ogni pixel attraversi lo strato alto o che la riduzione di letture aumenti gli FPS.

## Algoritmo e motivo dell'halo

1. All'upload della mappa, `precipitationMaxBaseReference` cerca i texel con R
   codificato positivo e il massimo G nel loro vicinato di un texel, diagonali
   comprese e indici ritagliati ai bordi. Ritorna `Bmax=3*maxG/255−0,5` oppure
   `null` se non esistono sorgenti codificate.
2. `maxBaseRef` viene aggiornato insieme alla mappa ad ogni installazione del
   volume, anche quando è vuota. Main e worker condividono questo percorso.
3. Una volta per raggio si calcola
   `rainCeiling=0,72+(maxBaseRef−0,72)/growth.x+0,3+guard`.
4. Si esegue il blocco ottico originale soltanto se
   `rainRegion && rp.y<=rainCeiling`, con `rp=position−drift`.
   Sopra il limite, estinzione e sorgente pioggia conservano gli zeri iniziali.

R e G filtrano indipendentemente. Un G alto con R=0 può contribuire accanto a un
R positivo: limitare la ricerca ai soli G con R>0 sarebbe scorretto. La mappa
reale seed 72 lo dimostra: il massimo dell'halo è **G=196, R=0**, vicino in diagonale
a **R=2, G=168**. La base massima decodificata è **1,8058823529411767 km**.
Fonte: [audit della mappa](rainmap-seed72-audit.json).

Con interpolazione bilineare non negativa, un R filtrato positivo implica un
contributor R positivo; gli altri tre contributor G distano al massimo un indice.
Il massimo sull'halo comprende quindi ogni quota che può contribuire. Guess e
shear scelgono il final UV, senza invalidare questo massimo globale.

## Margine e contratto numerico

Il margine è `3/255 + 2^−15` km, ossia **11,795223460477941 m**:

| Componente | Budget | Contratto |
|---|---:|---|
| Filtro G | 11,764705882 m | Overshoot non maggiore di un codice UNORM8 rispetto al massimo dell'halo. |
| ALU e upload f32 | 30,517578 mm | Copre conversione, ordine delle operazioni, divisione e confronto dell'attacco nel range attuale. |

Il budget del filtro usa `growth.x>=1`, equivalente all'altezza attuale non
superiore a uno. Il sampler è lineare, senza mipmap, dati lineari e clamp ai bordi;
ClampToEdgeWrapping viene ora dichiarato esplicitamente. Serve anche che un'impronta
con tutti i contributor R=0 restituisca R=0. L'uguaglianza al limite esegue il
blocco originale. Il massimo deriva dai byte RG8 effettivi, quindi non richiede
un secondo margine per i momenti di base prima della quantizzazione.

La [review indipendente](RAIN-UPPER-INDEPENDENT-REVIEW.md) distingue la prova
matematica dalla precisione del sampler: un codice G non è un limite ULP universale
ricavato dalla specifica. Cambi di filtro, formato o range di crescita richiedono
una nuova qualifica.

## Qualità preservata e verifiche concluse

Restano invariati: macro 256³, dettaglio 128³, 384 passi nominali, output pieno,
passo massimo pioggia 6 m, beta liquido 18/km e ghiaccio 6,5/km, box pioggia con
tetto 2,8 km, rainNear/rainFar/rainRegion, union box, jitter, t/ds, densità e luce
nube, sorgenti pioggia e integrazione co-locata. Nessuna texture, cache temporale,
TAA o riduzione di risoluzione aggiunta; viene introdotto un solo scalar uniform.

- **7 test unitari passati e build applicazione passata**, comunicati dal root.
  [DA COMPLETARE: riferimento al log e identificativo del build candidato.]
- **9 gruppi del repro CPU passati**, inclusi byte RG8, R/G indipendenti, sentinel,
  bordi, perturbazioni numeriche e sei raggi sintetici con t/ds e media identici.
  I campi analitici non sono il volume corrente e non eseguono WGSL.
  [Risultato](rain-upper-bound/repro-result.json), [manifest](rain-upper-bound/manifest.json).
- **Audit sampler GPU PASS: 39.614 query, 14 dataset, 16.520 R positivi effettivi**,
  con fixture estreme e mappa reale 64² seed 72. Nessuna violazione rilevata per
  zero-R, allowance G, attacco al limite/primo f32 escluso o valori non finiti.
  [Report completato](sampler-gpu-result.json), [console](sampler-gpu-console.json).

L'audit GPU usa compute WebGPU standalone sul dispositivo Apple/metal-3 osservato:
non è una prova su tutti gli UV, altri driver/dispositivi o sull'intera pipeline
Three. Il primo tentativo non completato resta distinto dal report PASS. Il test
numerico non dimostra equivalenza fotografica né vantaggio prestazionale.

## Risultati browser da inserire

**[DA COMPLETARE: rendererVersion candidato, build/asset SHA e stato esatto.]**
Verificare corrispondenza di camera/target, seed, t, pausa, meteo, transizione,
wind, viewport/DPR, buffer reale, qualità e modalità timing prima del confronto.
I controlli disponibili sono [timing stages](control-rain-30s.json) e
[timing off](control-rain-timing-off-30s.json); confrontare ogni candidato con la
stessa modalità. Non mescolare le due serie per attribuire un guadagno.

| Metrica | Controllo corrispondente | Candidata | Esito |
|---|---|---|---|
| Submission rAF/s, durata e pacing p95/p99 | [DA INSERIRE] | [DA INSERIRE] | [DA VALUTARE] |
| Prefisso finale confermato e drain finale | [DA INSERIRE] | [DA INSERIRE] | [DA VALUTARE] |
| Cadenza con conferma del prefisso, inclusa la coda finale | [DA INSERIRE] | [DA INSERIRE] | [DA VALUTARE] |
| Somma timestamp render, media/p95 e campioni, solo timing stages | [DA INSERIRE] | [DA INSERIRE] | [DA VALUTARE] |
| Console e confronto delle immagini | [DA INSERIRE] | [DA INSERIRE] | [DA VALUTARE] |

**[DA COMPLETARE: report candidato, schermate, ripetizioni e differenze di stato.]**
La cadenza rAF misura submission; il prefisso conferma completamento del lavoro
in coda, non presentazione. La somma dei timestamp dei pass è diagnostica, non
il reciproco degli FPS. **FPS presentati dal compositor: non misurati.**
Una singola coppia resta esposta a temperatura, ordine temporale e carico esterno.

## Decisione ancora aperta

**[DA COMPLETARE: mantenuta oppure ritirata, con motivazione e riferimenti.]**
Occorrono insieme correttezza delle immagini e guadagno misurato a qualità
invariata. Qualifica worker, mobile e scena in movimento: **[DA COMPLETARE]**.
Fino al verdetto il renderer resta sperimentale; nessun FPS sostenuto dichiarato
e nessuna chiusura dell'obiettivo complessivo.
