# Certificato laterale non convesso — decisione per il ciclo11

2026-10-16. Ricerca e stima CPU esterna, nessuna patch prodotto/GPU/browser o nuova
cottura. Riutilizzata la cache256³/128³ del contatore ciclo10, seed72, posa A/B/A.

## Decisione

**Non suggerisco un ciclo11 prodotto per il raster a una lookup per tentativo.**
Una griglia conserva rientranze che il prisma convesso riempie, ma il certificato
continuo della nube limita comunque il tratto utile a circa36,46m. Nel modello
32×18 il recupero lordo128² è6,81% delle chiamate texture originali; pagare una
nuova lookup per tentativo lascia0,53%, prima di ALU, upload e divergenza. A64² il
saldo è−0,83%. Sono conteggi semantici CPU, **nessuna previsione di tempo o FPS**.

L'opzione resta selezionabile se emergerà un modo dimostrato per evitare quasi
tutte le interrogazioni fallite o riusare dati già letti. Non propongo un'altra
cache o una patch GPU sulla sola possibilità teorica del vuoto laterale.

## Fonti primarie e trasferimento al caso corrente

- [Levoy, *Efficient Ray Tracing of Volume Data*,1990](https://www.cs.ucdavis.edu/~ma/ECS177/papers/levoy_raytrace_vol.pdf):
  enumerazione gerarchica dello spazio e terminazione per opacità. Il principio
  pertinente è certificare regioni trasparenti, senza confondere la loro presenza
  geometrica con lavoro visitato prima dell'early exit. I nostri conteggi usano
  proprio il percorso baseline fino a T<.006; non trasferiamo i suoi speedup.
- [Amanatides e Woo, *A Fast Voxel Traversal Algorithm for Ray Tracing*,1987](https://doi.org/10.2312/egtp.19871000):
  attraversamento incrementale di celle. Utile per trovare l'uscita da una cella
  vuota, ma il nuovo confine non deve diventare un nuovo punto di integrazione:
  qui va preservata la successione originale di addizioni f32 di t e ds.
- [Chen, Hesser e Männer, *Fast Volume Deformation Using Inverse-Ray-Deformation and FFD*,2001](https://www.graphicon.ru/html/2001/Visualization/Chen_Hesser_Manner.pdf):
  i raggi inversamente deformati e la lunghezza dei tratti locali condizionano
  l'efficacia dello space leaping. Nel nostro caso il certificato rain non
  sostituisce il bound continuo cloud sotto crescita/shear/flow. Nessun risultato
  del loro renderer è assunto come previsione per Cloudia.

Sono precedenti di metodo; le formule, il raster e la decisione sottostanti
sono una derivazione specifica da precipitation.ts/cloudShader.ts/emptyTraversal.ts.

## Set da rasterizzare e prova di inclusione

Sia S l'unione dei footprint **bilineari** dei texel RG8 con Rbyte>0. Per un texel
(x,z), il rettangolo è centro±un texel, clippato al dominio UV[0,1]; non basta la
cella del texel o il solo suo centro. Il lookup finale ha un test UV strettamente
interno e usa clamp-edge: se tutti i contributor R sono zero, il risultato deve
essere esattamente zero. Il PASS sampler ciclo9 sostiene questa premessa per il
backend/dataset provato, senza dimostrare ogni GPU o ogni pipeline futura.

Con rp=position−drift e g=growth.y, il supporto laterale appartiene a:

```
world:     rp.xz in S/g + [0,2.5]*wind
material:  g*rp.xz in S + [0,2.5]*g*wind
```

**Il fattore g nell'estrusione materiale è indispensabile durante la crescita.**
La prima lookup G può leggere la sentinella lontano dalle colonne: un massimo G
locale all'emissione non limita guessBase. Si conserva il bound globale2.5 già
usato dal rain box, derivato da descent*.32+sourceShear, con rp.y>=−4.75 e crescita
attuale height<=1. Anche ammettendo un codiceG di overshoot, il massimo teorico
è circa2,48 e rimane sotto2.5; questa tolleranza non autorizza growth futuri diversi.

La prova include ogni shear scelto dal G filtrato senza derivarne la pendenza:
è un'unione sull'intero segmento di spostamento. drift è sottratto una volta;
weather/rainTime/sheets/streaks/evaporazione possono solo ridurre il contributo
rispetto a R>0. Non si usano per dichiarare nuove celle vuote.

## Architettura selezionabile, senza implementazione prodotto

Raster CPU conservativo128² del set sopra: una cella è occupata se il suo
rettangolo chiuso interseca almeno un rettangolo sorgente estruso. Occorre
intersezione poligono/cella, non campionamento al centro. Contatti, segmenti
sottili e bordi si marcano occupati; si conservano così i buchi risolvibili senza
creare falsi vuoti. Le celle esterne vengono trattate come occupate/fallback.

Un byte per cella può contenere d, la distanza discreta Chebyshev alla cella
occupata più vicina: d=0 occupata; d>=1 certifica il quadrato di celle di raggio
d−1 attorno alla cella corrente. Una `textureLoad` non filtrata R8 evita che una
interpolazione inventi un valore di distanza.128²=16KiB;64²=4KiB. Non è una SDF:
d*cellSize non è una distanza euclidea sicura da usare direttamente come passo.

Tentare solo dopo un **mask cloud fresco zero**, nel rainRegion e con gate
continuo sotto iceStart. H=min(emptyStep−stepSize,clip originali). L'endpoint
materiale è m1=m0+g*ray.xz*H. Se m0 e m1 stanno nello stesso quadrato certificato
con margine, tutto il segmento laterale vi sta, perché il quadrato è convesso.
Basta una lookup e confronti; il prototipo preferisce questo test al DDA con
divisioni per raggi quasi paralleli. Se non contiene tutto H, fa fallback.

Quando entrambi i mezzi sono certificati zero, il batch deve riprodurre gli
avanzamenti originali f32 e i clip, compreso il contatore virtuale8192. Non
sposta rainNear/Far, non cambia jitter, non atterra sul bordo del raster. Il
certificato cloud non si rinnova senza un'altra lettura reale. Flow/fine warp
restano coperti dal loro halo già esistente; il gate esplicito
reference.y+growth.x*H+.001<iceStart evita di estendere il Jacobiano generale
oltre il suo maxAbsX nella zona pioggia esterna alla nube.

## Precisione e aggiornamenti da qualificare

Il raster diagnostico aggiunge1m materiale ai footprint e restringe di1m il
quadrato certificato. È un margine del modello CPU, **non una qualifica f32 GPU**.
Per una prima prova controllata con |origin|<=16km,t<=32km,|drift|<=1km e
g<=1/.88, il solo errore delle normali operazioni f32 del punto materiale è
limitabile con gamma5*g*(16+32+1), circa0,017m.1m lo supera ampiamente, ma serve
anche includere uniform, origine/scala raster, footprint UV, cast/index, eventuale
riassociazione e replay t. Numeri non finiti/out-of-range devono fare fallback;
nessuna divisione quasi zero viene usata nel certificato endpoint proposto.

Per la prima posa pausa basta un raster della coppia(g,wind) esatta caricata.
In animazione non si può riusare un raster vecchio: cambia il segmento estruso.
Un'opzione successiva è costruire per un intervallo quantizzato di
B=2.5*g*wind e dilatare il set per l'intera incertezza del bin, compresi i due
assi. La coppia metadata/bin va pubblicata atomicamente; fuori bin o durante
update si disattiva il certificato. Sorgente RG8 nuova richiede sempre rebuild;
drift non richiede rebuild nello spazio rp. Questa gestione non è implementata
né inclusa nei conteggi. Upload e CPU/worker costano anche se il modello ottico
resta invariato.

Il raster riempie buchi più piccoli delle sue celle, i contatti conservativi e
il padding ne chiudono altri. L'estrusione lungo tutto[0,2.5] riempie già alcuni
buchi reali dipendenti dalla quota. Una gerarchia OR/min-max non li recupera:
raggruppa solo celle note. Una piramide128² completa sarebbe circa21,3KiB R8,
ma più livelli aggiungono lookup/rami; non è scelta qui dato il saldo marginale.

## Stima leggera eseguita, non benchmark

Una esecuzione del port già esistente, cache riusata e sequenza t/ds/rho/T con
SHA256 identico alla baseline32×18.899,71ms per accounting; costruzione dei due
raster+distanze64,51ms complessivi, senza warmup né benchmark di aggiornamento.
Sono tempi diagnostici Bun di questa esecuzione, non un costo renderer previsto.
Le nuove geometrie sono f64 e il filtro del port è ideale; niente prova GPU.

|Misura sulla stessa posa|64²|128²|
|---|---:|---:|
|Cella materiale X/Z|122,66/71,91m|61,33/35,95m|
|Celle occupate dal raster sorgente, prima bordo fallback|3.261|12.842|
|Area occupata, prima bordo fallback|28,763km²|28,317km²|
|Punti rainRegion certificati lateralmente vuoti|38.253|46.710|
|Di questi, mask cloud zero|29.162|35.300|
|Tentativi lookup, dopo esclusione dei batch già selezionati|83.404|79.473|
|Certificati/batch riusciti|4.260|5.047|
|Campioni successivi evitabili|21.272|25.199|
|Chiamate originali potenzialmente rimosse|72.843|86.186|
|Quota lorda sulle1.266.166 chiamate baseline|5,753%|6,807%|
|Saldo dopo una lookup per tentativo, ALU esclusa|−0,834%|+0,530%|

Il bordo fallback aggiunge208/428 celle occupate, oltre alle aree riportate.
Zero R positivo/pioggia positiva osservato nelle celle vuote; zero contributi
positivi nei batch selezionati. Tutti gli invarianti baseline passano, nessuna
sorgente modello cambiata durante il run. Questi sono controlli discreti CPU,
non una prova del certificato continuo sulla GPU.

Per confronto, il prisma aveva29.167 punti mask0 fuori supporto e6,539% lookup
lorde potenziali, senza nuova texture e senza prezzo degli slab/ALU.128² recupera
6.133 punti mask0 rispetto a quel conteggio, ma appena0,268 punti percentuali di
lookup lorde nel diverso criterio di batch completoH. Non è un confronto di
throughput. I70.606 mask0/rain0 comprendono anche evaporazione e attachment: un
raster solo R non certifica automaticamente questi casi o tutti i55.598 mask0/R0.

## Gate per riaprire, altrimenti fermarsi qui

Prima di un ciclo11 prodotto servirebbe una revisione che superi chiaramente
il costo delle proprie interrogazioni nel contatore, preservando i certificati
continui. Poi: fixture RG8 sparse/minR/bordi/clamp; vento firmato e crescita;
aggiornamento asincrono/stale metadata; coordinate f32 vicino alle celle e ai
vertici; percorso cloud sotto/sopra ghiaccio; replay GPU t/ds/cutoff; lifecycle;
immagini abbinate e misure A/B/A con code completate. Nessun gate è anticipato
come superato dalle sole percentuali CPU.

Artefatti esterni: [script](rain-work/rain-nonconvex-estimate.ts),
[risultato](rain-work/rain-nonconvex-estimate.json),
[contatore e limiti](rain-work/RAIN-WORK-REVIEW.md).
Script SHA256 `089cde14525d91105748c054a4dcd92600b6a2cd66a628e9a6e7d4c92e8aa2ae`.
Sequenza baseline/prova SHA256 `a0c2dfd79e1900dce9a677fceecbd5bfcfc138a2e94cd430938f4c4c7bf3ca7a`.
