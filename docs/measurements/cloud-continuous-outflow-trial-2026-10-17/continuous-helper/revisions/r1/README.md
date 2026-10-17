# Inviluppo continuo: griglia t fissa, errore e costo prima del modello

Proposta esterna del 17 ottobre 2026, base canonica v61/c349, non la traslazione R1 ritirata. **Helper e nove test preparati, nessuna esecuzione.** Non è un modello generato, una prova di fattibilità economica o un’autorizzazione GPU.

## API e composizione

`prepareContinuousOutflow([neck,top,proximalCap], options)` accetta tre tuple `[cx,cy,cz,rx,ry,rz,blend?]` già contratte. Options richiede esplicitamente `maxFieldErrorKm`, `negativeBandKm`, `grid:{min,size,resolution}`, `maxKernels`, `maxRasterVoxelVisits`, `maxEnvelopeBytes`. Il blend in input non è usato dal helper.

Restituisce `kernels[{lobe,start,end}]`, `raster{start,end,voxelCount,bytes}`, `stats` e un piccolo `sample(x,y,z)` di riferimento. Start/end sono indici globali inclusivi, clippati all’interno nativo 1..N−2 e al tile comune. Lobe è una tupla immutabile di sei numeri; le copie non conservano riferimenti alle primitive sorgenti. Il helper non alloca né rasterizza il tile.

L’owner deve accumulare i kernel con **MAX duro** su un Float32 locale e fare **una sola** smooth-union .16 con il field originario. Una smooth-union per kernel dipenderebbe dal numero dei campioni e non implementerebbe questa proposta. `sample` valuta il MAX finito intero, senza trunc e senza smooth-union; non è il percorso consigliato per tutti i voxel.

## Bound matematico, in aritmetica reale

Su ciascuno dei due tratti `c(t)=c0+t*dc`, `r(t)=r0+t*dr`, `m(t)=min(r(t))` e `phi(t,p)=m(t)−length(D(t)*(p−c(t)))`, con `D_i=m/r_i`. Si dividono gli intervalli ai crossing dei raggi; nel tratto dove il minimo è `r_k`:

`D_i'=(dr_k*r0_i−r0_k*dr_i)/r_i(t)^2`.

Per il **medesimo dominio comune D** contenente tutti i centri voxel del tile, porre `alpha_i=max_I(m/r_i)`, `beta_i=abs(dr_k*r0_i−r0_k*dr_i)/min_I(r_i)^2` e `P_i=max_(p in D,t in I) abs(p_i−c_i(t))`. Allora

`M_I=abs(dr_k)+sqrt(sum_i (alpha_i*abs(dc_i)+beta_i*P_i)^2)`

limita `abs(dphi/dt)`. Ogni intervallo I riceve `n=max(1,ceil(M_I*length(I)/(2*epsilonSampling)))` passi uniformi, con entrambi gli endpoint. La griglia è preparata una volta, indipendente da p. Il massimo campionato G è unilaterale: `G<=F_continuo` e `F_continuo−G<=max_I(M_I*length(I)/(2n))` nel dominio dichiarato. Il bound resta valido ai crossing perché questi sono campioni e separatori espliciti. Non si assume un errore quadratico: sulla centreline di sfere in traslazione il massimo ha una cuspide e il bound lineare è necessario.

Ogni kernel ellissoidale resta 1-Lipschitz nello spazio, quindi lo è il MAX finito **non troncato**. Non si estende questa proprietà al campo raster troncato o al suo interpolante trilineare. Epsilon è errore del campo in km: non è distanza della superficie, né errore di una sola unità UNORM8 di densità. Il carving dipendente dal campo può amplificare la variazione.

## Dominio negativo e raster

Il livello `phi>=−b` estende ciascun raggio di `b*r_i/min(r)`. Un semplice halo cartesiano .35 sarebbe insufficiente per un’ellissoide schiacciata. I rapporti fra raggi affini positivi hanno estremi agli endpoint: il helper usa per asse `rho_i=max_keyframes(r_i/min(r))` e ingrandisce l’AABB positiva di `b*rho_i`. Il dominio d’errore comprende anche i voxel aggiunti dall’arrotondamento floor/ceil di quel box.

Ogni kernel ha un box negativo proprio, più stretto. Fuori dal dominio negativo comune i kernel del loft sono sotto −b. Per la truncation dopo un’unica smooth-union .16, richiedere separatamente `b>=supportMargin+.16+slack`, dove `supportMargin=.13+hypot(10,8.5,7)/N`. A256 il valore canonico .35 è sufficiente; per fixture piccole va derivato `max(.35,supportMargin+.16+slack)`. Questa motivazione riguarda la nuova operazione, senza correggere retroattivamente i vecchi raster dei lobi. Sotto quel limite densità/carving e pre-filtro luce devono essere motivati nel contratto owner, non dalla sola 1-Lipschitz del MAX continuo.

## Precisione numerica e limite esplicito

`CONTINUOUS_OUTFLOW_ROUNDOFF_SLACK_KM=1e−6` riserva 1mm del budget per la preparazione f64 e il tile Float32. Il helper usa il resto per la griglia e rifiuta condizioni numeriche estreme. Registra il bound di rounding Float32 stimato dal massimo modulo dei valori nel box di un kernel e una guardia f64 proporzionale al condizionamento; **questa guardia ingegneristica non è una prova formale di ogni operazione JS/Math.sqrt, di un upload GPU o di bit-parity**. `analyticErrorBoundKm` è la prova in aritmetica reale; `fieldErrorBoundKm` include la riserva dichiarata, la cui adeguatezza richiede la successiva qualifica numerica limitata. Non nascondere questa distinzione dietro un PASS dei test.

## Gate congelati prima di conoscere i keyframe effettivi

Per il primo preflight autorizzato a root: epsilon `min(10,8.5,7)/256/8 = .00341796875km`, massimo4096 kernel,256.000.000 visite box+merge e16MiB di tile Float32. La preparazione di cinque prefix (74/77/80/72/73), con solo i tre sheared preparati, ha budget6sCPU kernel/10swall/384MiBRSS. **Ancora non eseguita.** Nessun parametro aumenta dopo un FAIL.

Costo registrato: `W=sum_j prod_i(end_ji−start_ji+1)+tileVoxelCount`. Sono visite candidate, circa una radice/kernel per visita, non millisecondi o FPS. L’owner deve confrontarle con le273 primitive ritirate e la vecchia spalla prima di un full bake. I cap fermano la preparazione prima di qualsiasi raster/volume; il tile non viene allocato dal helper. Il costo iniziale può risultare non conveniente: in quel caso stop, senza ridurre risoluzioni, aumentare epsilon/cap o chiamare la proposta fattibile perché compatibile.

I test sintetici coprono il massimo continuo noto di una sfera in traslazione, la cuspide/errore unilaterale, crossing di min-radius, halo anisotropo, cancellazione per scale proporzionali, pendenza spaziale del MAX, copie/costi e rifiuti dei cap. Non sono una generazione reale o un confronto artistico. Nessun test/typecheck/Bun/build/prefix/modello/GPU è stato eseguito da questo agente.
