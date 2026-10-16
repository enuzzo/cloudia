# Terreno: prototipo CPU con gradienti analitici, 2026-10-16

Il prototipo funziona sul campo originale e rimuove dal percorso runtime l'albero di valutazioni interval del noise. **Non è applicato al prodotto e non è promosso:** con il limite principale di 16 campioni restano 666 raggi unresolved su 5198; con 64 campioni ne restano 292. Non abbiamo una misura GPU, di compilazione shader o di FPS per questa alternativa.

## Risultati completi della griglia

Stessi 14 raggi mirati più quattro pose camera da 48 × 27 pixel, con ingressi f32 esatti del fixture precedente. Il limite rimane 256 visite, 48 elementi di stack e tolleranza geometrica di 1 m. La strategia scelta usa il punto centrale; l'ablazione che campiona al fronte è conservata ma risolve meno raggi.

| Strategia | Cap campioni | Hit con witness | Miss inclusi outer-envelope | Unresolved per cap | Unresolved contatto | Campioni totali |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Centrale | 16 | 1911 | 2621 | 666 | 0 | 31226 |
| Centrale | 32 | 2110 | 2623 | 465 | 0 | 39801 |
| Centrale | 64 | 2283 | 2623 | 291 | 1 | 52065 |
| Fronte, ablazione | 16 | 1671 | 2620 | 876 | 31 | 29088 |
| Fronte, ablazione | 32 | 1902 | 2623 | 531 | 142 | 39943 |
| Fronte, ablazione | 64 | 2029 | 2624 | 314 | 231 | 53393 |

Il cap 16 lascia il 12,81% della griglia irrisolto; il cap 64 il 5,62%. I 14 raggi mirati risultano 10 hit, 3 miss, 1 unresolved con cap 16/32 e 11 hit, 3 miss con cap 64. Questo PASS limitato ai 14 non sostituisce la griglia: il caso `low-x-16-dy0` richiede 60 campioni. Ogni unresolved conserva nome, indice, motivo e conteggi; nessun fallback lo trasforma in hit/miss.

Con cap 16, il gruppo home-down conserva 394 unresolved, level-sea-miss 40 e coastal-horizon 231, oltre al caso mirato. Con cap 64 restano 174, 5 e 113 rispettivamente; l'ultimo gruppo contiene il singolo contatto numerico. I 1296 raggi low-clamped-up sono miss in entrambe le varianti centrali.

## Dati, costo e cosa è stato ridotto

Il quadtree copre `[-512,512]² km`, con celle da 32 km esterne, 2 km nella regione `[-128,128]²` e 250 m in `[-32,32]²`. Sono 109141 nodi da 48 byte: **5238768 byte, 4,996 MiB**. La preparazione CPU misurata ha richiesto 8,63 s; il binario è ricostruibile dallo script e ha SHA256 `69b2b49c06eddb8c582b9f1b14cdb944f707488fd73a4f5f17d6e261f62b12c4`.

Il replay CPU dell'intera griglia ha impiegato86,8 ms con cap 16 e83,8 ms con cap 64; la differenza riflette anche warmup e non prova che64 sia più veloce. Sono osservazioni di wall time Bun su questo Mac, non benchmark GPU. Il cap 16 esegue 106949 visite, 48982 inclusioni di gradiente e 250382 letture di nodi, con mediana 2 campioni e massimo 98 visite. Ogni nodo richiederebbe tre letture RGBA32F. Il cap 64 arriva al massimo 147 visite, entro il limite 256.

Il vecchio comparatore globale LH = 5,72 richiedeva 7430 campioni sui soli 14 raggi, con massimo 1728 per raggio. Il nuovo percorso ne richiede al massimo 60 sui 14 quando lasciato arrivare al witness; il normale cap 16 interrompe ancora il caso difficile. Non si deve confondere questo confronto di operazioni con un guadagno FPS. Anche il costo renderer resta aperto: un campione di terreno esegue sei noise; cap 16 consente fino a 96 noise per pixel e cap 64 fino a 384, oltre ai bounds e alle letture metadata. Nella griglia cap 16 la media è circa 6 campioni e 48 letture di nodi per raggio, cioè fino a circa 144 texel se ogni nodo legge i tre record. Questi conteggi restano troppo alti per presumere 60 FPS a qualità piena senza una strategia GPU e una misura reale. Aumentare soltanto i cap non è il prossimo passo.

Il vantaggio architetturale concreto è che il nuovo tracer non esegue noise-cell enumeration o `tb_mix×8` per costruire bounds: le derivate sono dati offline. Il piccolo `runtime-inclusion.wgsl` è un disegno non compilato, non una prova di minor costo compiler.

## Due correzioni numeriche concrete

Il ledger locale del noise conteggia gli arrotondamenti frac/cubic/mix usando magnitudini e differenze hash locali. Conserva 32u come fallback, senza scegliere un margine dai soli campioni. Una revisione indipendente ha verificato le formule e il taglio del prefisso con derivate firmate.

Molti contatti erano invece dovuti al confine mare: il punto `sea` ottenuto dalla quadratica non era abbastanza interno per soddisfare il guard radiale. Il nuovo candidato cerca fino a **sea+0,25m**, valuta realmente il campo originale e accetta soltanto se il prefisso è interamente positivo e il witness dista al massimo1m. Questo ha eliminato 630 contatti senza ridurre E e senza introdurre continuità artificiale. La geometria del mare e il campo altezza restano gli stessi; cambia la disponibilità di un witness numericamente interno.

Inoltre 15 vecchi `outer-envelope-miss` avevano relief 0, sea positiva e `start>sea` di circa 5,7e-14 km per due forme quadratiche arrotondate diversamente. Il vecchio precheck li scartava prima del ramo mare. Adesso il bracket mare ±0,25 m ha prefisso radiale positivo e witness CPU occupato. Questi 15 cambiamenti sono registrati esplicitamente come correzioni del confine mare. Nessun precedente hit risolto diventa miss e nessuna coppia di enclosures del terreno risolte risulta disgiunta nel confronto finito.

La regressione dei raggi non unitari ha trovato e corretto il fade che usava il parametro t anziché la distanza fisica t·|ray|. Le scale 0,5/1/2 dei 14 raggi e di un caso mare con relief 0 sono ora coerenti: zero failure su 45 confronti. Raggi nulli/non finiti ed errorScale<1 sono rifiutati.

## Verifica e limiti della prova

Passano 345 rettangoli con 3105 controlli indipendenti di altezza/gradiente/ledger e 10240 controlli su metadata serializzati: zero violazioni. Il massimo rapporto osservato `|Hcpu-Hideal|/E` è 0,1855. Questi controlli comprendono coordinate negative, coste, ridge, confini delle celle, trasformazioni e rettangoli ampi. Sono verifiche finite, non un certificato universale.

Il gradiente appartiene al campo ideale continuo con coefficienti f32 esatti. Il ledger E collega questo campo al sorgente CPU `Math.fround`; il tracer **non assegna una derivata al campo fround discontinuo** e non usa bisezione come prova di continuità. Un hit racchiude la prima entrata nell'insieme occupato con prefisso esterno e un vero punto occupato; non dichiara uno zero letterale.

I budget host sin 2^-23 e pow 2^-22 rimangono ipotesi esplicite qualificate sul corpus. Il padding radiale/clipping e l'aritmetica runtime richiedono ulteriore qualificazione. Nessun ledger universale WGSL/Metal, contraction, trascendentali o coordinate di raggio è dimostrato: `GPUQualified` e `roundingQualified` restano false. La qualità geometrica di 1 m non è stata allentata per ridurre gli unresolved.

Il sorgente terreno verificato ha SHA256 `72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99`. Gli import runtime restano quelli del campo originale, senza una superficie interpolata sostitutiva.

## Tentativo GPU precedente

Il precedente audit terrain-gpu è rimasto bloccato durante la sequenza osservata dal root. **Non è stato recuperato alcun risultato numerico GPU e la causa è sconosciuta.** Le ipotesi compiler/pipeline e DOM/accessibilità restano ipotesi: non è dimostrato un errore del compiler o di Metal. Il record `root-attempt.json`, i runner/sorgenti/manifest originali e `pipeline-followup` non eseguita sono conservati in `previous-gpu-attempt`; il root aveva ancora la tab 30 presente al momento del passaggio.

## Decisione pratica

La rappresentazione a gradienti è un candidato verificabile per ridurre il costo e la complessità del runtime mantenendo il campo originale. Il limite attuale è la ricerca dei witness nei casi complessi e l'ultimo contatto, non una prova di 60 FPS. Il cap 16 non soddisfa ancora la griglia completa e il cap 64 aumenta esplicitamente il lavoro consentito. Servono ulteriori riduzioni dei casi irrisolti e un audit GPU reale separato prima di qualsiasi integrazione prodotto.

Le fonti primarie e l'argomento matematico completo sono in `README.md` e nella revisione indipendente; Hart, segment tracing con bound locali e inclusioni forward giustificano il percorso ideale, mentre il ledger numerico aggiuntivo è parte esplicita di questa implementazione.
