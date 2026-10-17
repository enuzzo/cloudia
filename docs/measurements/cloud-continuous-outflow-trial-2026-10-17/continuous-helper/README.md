# Inviluppo continuo: griglia t fissa, errore e costo prima del modello

Proposta esterna del 17 ottobre 2026, base canonica v61/c349, non la traslazione R1 ritirata. **Helper R3 e quattordici test preparati, nessuna esecuzione.** Non è un modello generato, una prova di fattibilità economica o un’autorizzazione GPU.

## API e composizione

`prepareContinuousOutflow([neck,top,proximalCap], options)` accetta tre tuple `[cx,cy,cz,rx,ry,rz,blend?]` già contratte. Options richiede esplicitamente `maxFieldErrorKm`, `negativeBandKm`, `grid:{min,size,resolution}`, `maxKernels`, `maxRasterVoxelVisits`, `maxEnvelopeBytes`, `maxRowSetupCount`. Il blend in input non è usato dal helper.

Restituisce `kernels[{lobe,start,end}]`, `raster{start,end,voxelCount,bytes}`, `stats` e un piccolo `sample(x,y,z)` di riferimento. Start/end sono indici globali inclusivi, clippati all’interno nativo 1..N−2 e al tile comune. Lobe è una tupla immutabile di sei numeri; le copie non conservano riferimenti alle primitive sorgenti. Il helper non alloca né rasterizza il tile.

L’owner deve accumulare i kernel con **MAX duro** su un Float32 locale e fare **una sola** smooth-union .16 con il field originario. Una smooth-union per kernel dipenderebbe dal numero dei campioni e non implementerebbe questa proposta. `sample` valuta `MAX(−b,kernel preparati)` senza smooth-union; non è il percorso consigliato per tutti i voxel. Il tile owner parte da **−b**, non da −Infinity. La tabella dei kernel è quella di R2, senza cambiamenti ai t/centri/raggi. R1 e R2 sono conservate rispettivamente in `revisions/r1` e `revisions/r2`. R3 modifica soltanto le visite raster e il relativo accounting dopo il preflight AABB fallito.

## Bound matematico, in aritmetica reale

Su ciascuno dei due tratti `c(t)=c0+t*dc`, `r(t)=r0+t*dr`, `m(t)=min(r(t))` e `phi(t,p)=m(t)−length(D(t)*(p−c(t)))`, con `D_i=m/r_i`. Si dividono gli intervalli ai crossing dei raggi; nel tratto dove il minimo è `r_k`:

`D_i'=(dr_k*r0_i−r0_k*dr_i)/r_i(t)^2`.

Per il **medesimo dominio comune D** contenente tutti i centri voxel del tile, porre `alpha_i=max_I(m/r_i)`, `beta_i=abs(dr_k*r0_i−r0_k*dr_i)/min_I(r_i)^2` e `P_i=max_(p in D,t in I) abs(p_i−c_i(t))`. Allora

`M_I=abs(dr_k)+sqrt(sum_i (alpha_i*abs(dc_i)+beta_i*P_i)^2)`

limita `abs(dphi/dt)` sul dominio comune. R2 aggiunge un bound per il campo clippato `h(t,p)=max(−b,phi(t,p))`. Quando phi>−b, `u=(p−c)/r` soddisfa `length(u)<1+b/m`; fuori banda h è costante. Quindi, ponendo `B=max_i abs(dr_k*r0_i−r0_k*dr_i)/min_I(r_i)`, anche

`M_active=abs(dr_k)+sqrt(sum_i(alpha_i*abs(dc_i))^2)+(1+b/min_I(m))*B`

limita la variazione di h. Si usa `M_used=min(M_box,M_active)` sul dominio comune; nessuna dipendenza dal singolo voxel. Min/max sono assolutamente continui anche agli ingressi/uscite della banda. Ogni intervallo I riceve `n=max(1,ceil(M_used*length(I)/(2*epsilonSampling)))` passi uniformi, con entrambi gli endpoint. La griglia è preparata una volta, indipendente da p. Il campo campionato clippato è unilaterale: `Hgrid=max(−b,G)<=H=max(−b,F_continuo)` e `H−Hgrid<=max_I(M_used*length(I)/(2n))` nel dominio dichiarato. Fuori dall’AABB negativa H/Hgrid sono entrambi −b; non si rivendica F−G sotto quella banda o fuori dalla griglia nativa all’interno del suo prolungamento geometrico. Il bound resta valido ai crossing perché questi sono campioni e separatori espliciti. Non si assume un errore quadratico: sulla centreline di sfere in traslazione il massimo ha una cuspide e il bound lineare è necessario.

Ogni kernel ellissoidale resta 1-Lipschitz nello spazio, quindi lo è il MAX finito e il suo massimo con la costante −b **prima del raster**. Non si estende questa proprietà al campo raster troncato o al suo interpolante trilineare. Epsilon è errore del campo in km: non è distanza della superficie, né errore di una sola unità UNORM8 di densità. Il carving dipendente dal campo può amplificare la variazione.

## Dominio negativo e raster

Il livello `phi>=−b` estende ciascun raggio di `b*r_i/min(r)`. Un semplice halo cartesiano .35 sarebbe insufficiente per un’ellissoide schiacciata. I rapporti fra raggi affini positivi hanno estremi agli endpoint: il helper usa per asse `rho_i=max_keyframes(r_i/min(r))` e ingrandisce l’AABB positiva di `b*rho_i`. Il dominio d’errore comprende anche i voxel aggiunti dall’arrotondamento floor/ceil di quel box.

Ogni kernel ha un box negativo proprio, più stretto. Fuori dal dominio negativo comune i kernel del loft sono sotto −b. La rasterizzazione locale con floor −b equivale al MAX clippato: fuori dal box negativo di un kernel, il suo valore è sotto il floor e non contribuisce. Per l’introduzione di questo floor prima di un’unica smooth-union .16, richiedere separatamente `b>=supportMargin+.16+slack`, dove `supportMargin=.13+hypot(10,8.5,7)/N`. A256 il valore canonico .35 è sufficiente; per fixture piccole va derivato `max(.35,supportMargin+.16+slack)`. Questa motivazione riguarda la nuova operazione, senza correggere retroattivamente i vecchi raster dei lobi. Sotto quel limite densità/carving e pre-filtro luce devono essere motivati nel contratto owner, non dalla sola 1-Lipschitz del MAX continuo.

## Precisione numerica e limite esplicito

`CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM=1e−6` riserva 1mm del budget per la preparazione f64 e il tile Float32. Il helper usa il resto per la griglia e rifiuta condizioni numeriche estreme. Registra il bound di rounding Float32 stimato dal massimo modulo dei valori nel box di un kernel e una guardia f64 proporzionale al condizionamento; **questa guardia ingegneristica non è una prova formale di ogni operazione JS/Math.sqrt, di un upload GPU o di bit-parity**. `analyticErrorBoundKm` è la prova in aritmetica reale; `fieldErrorBoundKm` include la riserva dichiarata, la cui adeguatezza richiede la successiva qualifica numerica limitata. Non nascondere questa distinzione dietro un PASS dei test.

## Gate congelati prima di conoscere i keyframe effettivi

Per il primo preflight autorizzato a root: epsilon `min(10,8.5,7)/256/8 = .00341796875km`, massimo4096 kernel,256.000.000 valutazioni sd+merge,16.000.000 setup di righe e16MiB di tile Float32. La prossima preparazione di cinque prefix (74/77/80/72/73), con solo i tre sheared preparati, ha budget6sCPU kernel/10swall/384MiBRSS. **R3 non eseguita.** Il primo preflight AABB ha terminato sul74 a256.603.112 visite parziali, sopra il cap, senza raster/fullmodel/GPU; resta FAIL conservato da root. Nessun parametro geometrico, epsilon o cap viene aumentato.

Costo R3: `R=pointVisits`, `S=rowSetupCount`, `B=rowBoundaryCheckCount`, `U=tileVoxelCount`. `guardEvaluations=S+B`; il cap raster rimane `R+S+B+U<=256000000`. S conta **ogni** coppia(z,y) del box, prima dei reject, e ha anche il cap16.000.000. `kernelAabbVoxelVisits` conserva il conteggio nominale precedente, senza usarlo come nuovo cap. Il runtime ripete le guardie già valutate in prepare: per la generazione completa riportare `totalGenerationKernelEvaluations=R+2*(S+B)` e `totalGenerationWork=R+2*(S+B)+U`, oltre a2S setup complessivi. Le radici della sola inversione analitica (`rowAnalyticRootCount`) e i confronti della ricerca X sono separati; non sono gratuiti. Nessuna previsione di millisecondi o FPS.

## Enumeratore R3: medesimo campo Float32, nessuna row-array trattenuta

`forEachContinuousOutflowRow(kernel,grid,negativeBandKm,visit?)` emette callback `(z,y,startX,endX)` inclusivi. Prepare senza callback e raster con callback usano lo **stesso enumeratore**. Non alloca milioni di righe: trattiene solo contatori scalari. Le enclosure `kernel.start/end` restano quelle di R2.

1. Una ricerca binaria sui **voxelCenter forward canonici** trova le due X che bracciano cx e sceglie la distanza discreta minima; non presume esatto il round dell’inversa. Coordinate: `min+(i+.5)/N*extent`, nello stesso ordine del raster volume.
2. Ogni riga valuta sd al vero picco X discreto, con l’espressione canonica `(1-sqrt(((px-cx)/rx)^2+((py-cy)/ry)^2+((pz-cz)/rz)^2))*min(rx,ry,rz)`. Se il picco è sotto/equal al floor reale −b, tutta la riga non può cambiare il MAX Float32. Non c’è un reject basato sul solo radicando YZ arrotondato.
3. Per le altre righe il guess è `extentX=rx*sqrt(max(0,(1+b/m)^2-(dy/ry)^2-(dz/rz)^2))`. Floor/ceil con **un voxel X extra contato** produce un intervallo, sempre ampliato per includere il picco discreto e limitato al vecchio AABB.
4. Si valutano con sd canonico i due vicini immediatamente esterni, se presenti. Se un valore è sopra−b o NaN, oppure il guess non è finito, si ripiega sull’intera vecchia riga AABB. NaN al picco ferma esplicitamente il calcolo. Nessun NaN causa un reject silenzioso.

Su ciascun lato del picco, le distanze X e la formula sd canonica sono monotone. Se il primo punto omesso è≤−b, tutti gli altri punti omessi su quel lato lo sono; la conversione fround è monotona e non può aumentare il MAX iniziato da fround(−b). Il controllo conserva anche il caso b=0/zero con segno perché usa il confronto sd **prima** del rounding. L’accuratezza del guess non serve alla correttezza: influisce solo su visite/fallback. Non viene aggiunto padding geometrico, né modificato sd; il voxel extra e tutte le verifiche sono conteggiati. Rimane la distinzione già dichiarata sulla prova formale dell’implementazione floating-point; i test confrontano tutti i bit su fixture finite.

Il callback deve ricalcolare **sd con ordine canonico identico**: non riassociare la somma usando un YZsum precomputato. La struttura del campo, l’ordine dei kernel, il MAX nel locale e l’unica smooth-union finale rimangono quelli di R2.

I quattordici test sintetici preparati coprono anche il floor lontano e la distinzione H/F, oltre al massimo continuo noto di una sfera in traslazione, la cuspide/errore unilaterale, crossing di min-radius, halo anisotropo, cancellazione per scale proporzionali, pendenza spaziale del MAX, copie/costi e rifiuti dei cap. Non sono una generazione reale o un confronto artistico. I quattro casi R3 aggiunti confrontano l’intero Uint32 del Float32 locale AABB/scanline su anisotropia, bordi/corner, frontiera, picco tra centri e floor con segno. Nessun test/typecheck/Bun/build/prefix/modello/GPU è stato eseguito da questo agente; root ha eseguito i10 testR2 prima di R3, tutti PASS, che non qualificano questo nuovo enumeratore.
