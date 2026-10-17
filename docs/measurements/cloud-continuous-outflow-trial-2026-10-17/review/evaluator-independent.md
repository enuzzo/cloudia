# Valutatore dell’inviluppo: bound uniforme e costo prima del run

17 ottobre 2026, ciclo44. **Diagnosi matematica indipendente, source-only; nessuna ricetta, test, modello, raster, GPU o benchmark eseguito.** La proposta del precedente trial resta non implementata in questa nota e il suo FAIL resta invariato. Ho letto `review/next-structural-action.md`, il kernel di `src/cumulonimbus/volume.ts` e `inclinedShoulder.ts`; ho coordinato le condizioni con rain e anatomy. Le dimostrazioni seguenti sono in aritmetica reale. La fattibilità computazionale non è ancora verificata.

## Contratto fissato prima dei dati

Per ciascuno dei due segmenti neck→top e top→cap, i tre centri e raggi sono quelli canonici già trasformati/contratti. Nessun nuovo draw RNG e nessun raggio correttivo.

`c(t)=c0+t*dc`, `r_i(t)=r0_i+t*dr_i`, `m(t)=min_i r_i(t)>0`, `0≤t≤1`.

`phi(t,p)=m(t)*(1−norm((p−c(t))/r(t)))`.

L’inviluppo continuo è `F(p)=max_segmenti sup_t phi(t,p)`. La griglia di parametri è preparata una volta dai keyframe e dal dominio, poi resta **identica per ogni posizione p**. Non c’è una ricerca del massimo, raffinamento o scelta dei campioni per voxel.

Il root ha fissato prima di qualunque run:

| Quantità | Valore |
| --- | --- |
| Risoluzione macro nativa | 256³ sul box 10×8.5×7km |
| Passi voxel XYZ | 10/256, 8.5/256, 7/256km |
| Tolleranza del campo | `epsilon=min(10,8.5,7)/256/8=7/2048=.00341796875km` |
| Livello negativo coperto a256 | `b=.35km` nel valore del kernel |
| Unica smooth-union con il campo precedente | `k=.16km` |
| Massimo numero di kernel campionati | 4096 |
| Massimo visite voxel/kernel locali | 256000000 |
| Scratch locale/tile | ≤16MiB |

Questa epsilon è una soglia del **campo scalare** derivata dalla griglia nativa prima dell’immagine. Non è un errore di opacità, luce, gamma, densità finale, né una garanzia di distanza Hausdorff della superficie. Un campo 1-Lipschitz fornisce un bound superiore alle variazioni spaziali; non fornisce il bound inverso necessario a tradurre un errore di campo in spostamento della superficie.

## 1. Riscrittura che evita un bound inutilmente mal condizionato

Pongo `A(t)=diag(m(t)/r_i(t))`. Allora

`phi(t,p)=m(t)−norm(A(t)*(p−c(t)))`, con `0<A_ii≤1`.

Questa forma conserva la cancellazione dei raggi proporzionali. Nel caso di sola traslazione, il suo termine di costo è al più `norm(dc)`, senza moltiplicarlo per `rmax/rmin`. Un bound ottenuto separando brutalmente `m*norm((p−c)/r)` resta valido, ma può imporre una griglia molto più grande del necessario.

Le tre funzioni `r_i(t)` sono affini. Il minimo è continuo e affine a tratti; i suoi cambi avvengono alle intersezioni delle coppie di raggi, calcolabili una volta. Ci sono al più tre tratti attivi del minimo. Partizionare anche alle intersezioni inattive aggiunge soltanto suddivisioni ridondanti, senza introdurre adattività spaziale.

## 2. Bound uniforme in t sul dominio dichiarato

Sia `D=[L_i,U_i]` un AABB finito che comprende il dominio raster più l’halo corretto. Per un intervallo `I=[u,v]` in cui il minimo è `r_k(t)`, definisco:

`P_i=max(|L_i−c_i(u)|,|L_i−c_i(v)|,|U_i−c_i(u)|,|U_i−c_i(v)|)`.

Questo massimo sui quattro estremi copre ogni `p∈D` e `t∈I`, perché il centro è affine.

`alpha_i=max(r_k(u)/r_i(u), r_k(v)/r_i(v))≤1`.

Il rapporto di due funzioni affini con denominatore positivo è monotono oppure costante, quindi i due estremi bastano. Inoltre

`A_ii'(t)=(dr_k*r0_i−r0_k*dr_i)/r_i(t)^2`.

Perciò

`beta_i=abs(dr_k*r0_i−r0_k*dr_i)/min(r_i(u),r_i(v))^2`

è un bound uniforme di `abs(A_ii')`; per `i=k` il numeratore è zero. Un bound utilizzabile per il kernel è

`M_I=abs(dr_k)+sqrt(sum_i (alpha_i*abs(dc_i)+beta_i*P_i)^2)`.

**Conclusione:** per ogni `p∈D` e `s,t∈I`,

`abs(phi(t,p)−phi(s,p))≤M_I*abs(t−s)`.

La dimostrazione usa la disuguaglianza triangolare per la norma e il bound di ciascuna componente di `d[A(p−c)]/dt`. Non richiede che la norma sia derivabile in `p=c(t)`: la norma è 1-Lipschitz e la curva vettoriale è assolutamente continua. I cambi del raggio minimo sono finiti e il bound si concatena attraverso di essi.

Per affermare questo errore su **tutto D comune**, i `P_i` di ogni segmento devono essere calcolati sullo stesso D comune. Un bound calcolato soltanto sul box più piccolo di un segmento non certifica automaticamente il kernel non clippato nel resto del box complessivo.

## 3. Griglia fissa ed errore del massimo

Per ogni intervallo attivo, preparare prima del raster

`N_I=max(1,ceil(M_I*(v−u)/(2*epsilon)))`

e la griglia uniforme dell’intervallo, con entrambi gli estremi inclusi. Gli estremi condivisi possono essere deduplicati; neck/top/cap devono restare campioni esatti dei tuple endpoint, senza ricostruirli con un’interpolazione numerica che li sposti.

Ogni `t` dell’intervallo dista al più `(v−u)/(2*N_I)` dal campione più vicino. Per `G(p)=max_j phi(t_j,p)`:

`0≤F(p)−G(p)≤epsilon` per ogni `p∈D`.

L’errore è **unilaterale**, perché i campioni sono un sottoinsieme della stessa famiglia continua. Il massimo fra i due segmenti non somma gli errori: se entrambi hanno errore ≤epsilon, anche il loro massimo ha errore ≤epsilon. Non esiste qui una prova globale `O(delta_t²)`: anche una semplice traslazione con raggi costanti può avere una cuspide quando il centro passa per p.

Una singola griglia uniforme su tutto il segmento è anch’essa valida usando `M=max_I M_I` e `N=ceil(M/(2*epsilon))`; la suddivisione fissa ai cambi del minimo riduce soltanto la sovrastima del bound e rimane indipendente da p.

## 4. Lipschitz spaziale: nessun fattore epsilon aggiuntivo

Per ogni t fissato,

`abs(phi(t,p)−phi(t,q))≤norm(A(t)*(p−q))≤norm(p−q)`.

Il sup continuo F e il massimo finito G mantengono quindi la costante spaziale **1**, senza moltiplicarla per il numero di campioni e senza aggiungere `epsilon/voxel`. Il campo `max(−b,G)` è ancora 1-Lipschitz. Anche la smooth-union polinomiale già presente conserva questa proprietà: le due derivate rispetto agli input sono nonnegative e sommano a1; rispetto a un solo input è nonespansiva. Un’unica unione con il vecchio campo non amplifica il bound epsilon del nuovo input, a parità dell’altro campo.

Questo riguarda i kernel matematici globali. Il trilineare di campioni di una funzione 1-Lipschitz **non deve essere dichiarato a sua volta 1-Lipschitz**: componenti di gradiente ammesse separatamente possono produrre una norma maggiore di1. La prova di supporto usa invece il margine già esistente di una diagonale voxel completa per coprire i vicini di interpolazione.

## 5. Halo negativo: .35 nel kernel non equivale a .35 su XYZ

L’AABB unione degli endpoint `c_i±r_i` contiene il livello positivo della famiglia, perché tali estremi sono affini in t. Per il livello negativo `phi≥−b`, il raggio sull’asse i diventa

`r_i(t)*(1+b/m(t))`.

Definisco

`rho_i=max(r0_i/min(r0), r1_i/min(r1))`.

È il massimo esatto del rapporto `r_i/m`: infatti `r_i/m=max_j r_i/r_j`, e ogni rapporto affine positivo ha il suo massimo a un endpoint. Basta quindi espandere l’AABB positivo degli endpoint di **`b*rho_i` per asse**. Per i tre keyframe si può usare l’unione dei due box così costruiti. Fuori da questo dominio ogni kernel della famiglia è strettamente inferiore a−b. Non occorre uno sweep del volume né un solver in t.

Il vecchio padding cartesiano .35 non prova questa proprietà per ellissoidi anisotropi. La correzione qui riguarda soltanto il nuovo operatore; questa nota non allarga né modifica i lobi canonici.

## 6. Perché il trunc a−.35 è invisibile alle soglie native dichiarate

Scrivo `S_k(a,q)` per la smooth-union del vecchio campo a con il nuovo q, e suppongo `q≤−b`. Se `a≥−b+k`, allora `a−q≥k` e `S_k(a,q)=a`: nessun cambiamento. Se `a<−b+k`, per monotonia

`S_k(a,q)≤S_k(−b+k,−b)=−b+k`.

Quindi omettere un contributo inferiore a−b può cambiare il campo soltanto dove **sia il risultato incluso sia quello omesso rimangono sotto `−(b−k)`**. Con b=.35 e k=.16, questa soglia è−.19.

Nel generatore nativo256:

`supportMargin=.13+sqrt(10²+8.5²+7²)/256=.13+sqrt(221.25)/256<.19`.

Il termine di carving è nonpositivo e il bias sottratto alla densità è `(.025−.017*ice)≥.008`. I cambi confinati sotto−.19 producono quindi densità zero e sono sotto la soglia negativa del bake di supporto in entrambe le versioni. Il fatto che il primo loop salti soltanto `field<−.3` non invalida il risultato: nell’intervallo intermedio la formula della densità restituisce comunque zero.

Questo giustifica separatamente il trunc locale del nuovo operatore **a256**, rispetto al suo corrispondente campo globale, sotto le formule attuali di blend/carving/supporto. Non dimostra che l’array raster troncato sia globalmente 1-Lipschitz. Una formulazione globale di riferimento è `H=max(−b,F)` e `H_grid=max(−b,G)`: mantiene la costante1 ed errore ≤epsilon; la sua differenza dall’omissione locale rimane nella banda negativa appena dimostrata irrilevante.

Per dimensioni diverse, `.35` non va riusato senza prova: una scelta conservativa è `b≥max(.35,supportMargin(size)+.16)`, con il necessario margine numerico. A32/64 il vecchio .35 non soddisfa la disuguaglianza del supporto. Se in futuro si vuole certificare anche il **campo non clippato** F sotto−b, non basta il raster locale con floor−b: la sua garanzia uniforme è per H, mentre il bound della sezione3 resta quello di F/G valutati matematicamente.

## 7. Costo deterministico prima di ogni raster

Il numero di campioni dipende dai keyframe e dal bound, non dall’immagine. Il preprocess deve produrre il numero effettivo K, ogni centro, `A_ii=m/r_i`, m e il box di supporto negativo di ciascun campione. All’interno dei suoi limiti, l’ellissoide usa esattamente lo stesso kernel; fuori dal livello−b può essere saltato nel massimo clippato.

Con `h_i=BOUNDS_SIZE_i/size` e gli stessi arrotondamenti conservativi dei vecchi lobi:

`start_ij=max(1,floor((c_ij−r_ij*(1+b/m_j)−BOUNDS_MIN_i)/h_i−.5))`.

`end_ij=min(size−2,ceil((c_ij+r_ij*(1+b/m_j)−BOUNDS_MIN_i)/h_i−.5))`.

Il costo massimo delle visite del raster locale è noto prima del modello:

`W=sum_j product_i max(0,end_ij−start_ij+1)`.

Ogni visita richiede una sola radice quadrata e un numero fisso di operazioni vettoriali; nessun solver per voxel. Precalcolo O(K), valutazione O(W), più un passaggio sul dominio locale per l’unica smooth-union. **Non** applicare una smooth-union per campione: cambierebbe l’operatore e il risultato crescerebbe con K. Serve prima il MAX puro dell’intera famiglia e poi una sola unione k=.16.

Uno scratch Float32 locale richiede `4*V_tile` byte: il tetto16MiB corrisponde a4194304 valori. Se è suddiviso in tile, la stessa lista globale di t deve restare valida in ogni tile; le eventuali visite di halo aggiuntive vanno comprese in W. Per4096 kernel, sette coefficienti Float64 per kernel occupano229376 byte nominali; indici, contenitori JS e altri temporanei sono separati e non ancora misurati.

I limiti root sono `K≤4096`, `W≤256000000`, scratch≤16MiB. **Non posso ancora assegnare K/W concreti o promettere fattibilità:** non ho eseguito alcuna ricetta per ottenere i keyframe. Questi conteggi vanno prodotti dal futuro prepare/preflight autorizzato e congelati prima del raster. Se superano i limiti, il metodo si ferma; non si allarga epsilon o si riduce la griglia dopo aver visto un’immagine. Un conteggio sotto budget non prova secondi CPU, qualità nativa o FPS.

## 8. Limite numerico da rendere esplicito nell’implementazione

Le formule certificano l’errore in aritmetica reale con raggi positivi e dati finiti. Il calcolo Float64 di intersezioni, M, griglia e kernel, seguito dalla memorizzazione Float32, non è automaticamente una prova bit-exact di quel limite. È necessario documentare separatamente roundoff e arrotondamento conservativo di M/N, inclusi endpoint, minimi quasi coincidenti e soglie di trunc. Non compensarli con un coefficiente estetico o con una costante Lipschitz superiore inventata. Le prove sui campioni futuri possono trovare un difetto, ma da sole non sostituiscono un bound uniforme.

**Conclusione operativa:** la discretizzazione fissa ha una dimostrazione uniforme utilizzabile, mantiene la costante spaziale1 e permette un conteggio locale prima del raster. Non è ancora dimostrato che il numero di campioni e visite rispetti i tetti scelti; non emetto un PASS di fattibilità, di render o di qualità.

## Addendum prima di qualunque dato: bound globale del campo clippato

Il root propone un bound più economico per il target operativo `H=max(−b,F)`, senza cambiare epsilon, keyframe o banda. Lo confermo in aritmetica reale. Con `u=(p−c)/r`, nella regione in cui `phi>−b` vale `norm(u)<1+b/m`. Sul tratto di minimo `m=r_k`, pongo

`C_I=sqrt(sum_i (alpha_i*abs(dc_i))^2)` e `B_I=max_i abs(dr_k*r0_i−r0_k*dr_i)/min(r_i(u),r_i(v))`.

Un bound indipendente dalla posizione p è quindi

`M_I_clipped=abs(dr_k)+C_I+(1+b/min(m(u),m(v)))*B_I`.

Derivando `phi=m−m*norm(u)` nella regione attiva si ottiene

`abs(phi')≤abs(m')+norm(A*c')+max_i abs(m'−m*r_i'/r_i)*norm(u)`.

Il numeratore dell’ultimo coefficiente è costante sul tratto; le maggiorazioni sopra lo contengono. La funzione `max(−b,phi(t,p))` è assolutamente continua in t, con derivata zero fuori banda e il bound precedente quasi ovunque dentro. Attraversamenti della soglia e cuspidi della norma non invalidano l’integrale. La stessa griglia fissa `N_I=ceil(M_I_clipped*length(I)/(2*samplingBudget))` certifica pertanto

`0≤H−Hgrid≤samplingBudget` **globalmente in p**, dove `Hgrid=max(−b,max_j phi(t_j,p))`.

Non si promette più, con questo bound attivo, `F−G≤epsilon` per i valori non clippati molto negativi: quella era la proprietà del bound su D delle sezioni2–3. Il cambiamento è esplicito e precedente ai dati; il livello di superficie, la banda e la tolleranza fissati restano gli stessi. Rimangono necessarie la qualifica del roundoff e le verifiche statiche K/W/memoria, senza nuova promessa di fattibilità.
