# Scanline R3 — condizioni per conservare il campo finito

17 ottobre 2026. Review matematica e statica indipendente, senza ricette, prepare, test, modello, raster, GPU, benchmark o nuovo output candidato. Il FAIL del preflight R1 e il conteggio parziale256603112 restano immutati. Questa ottimizzazione può cambiare soltanto l’insieme dei siti valutati; griglia t, kernel, raggi, centri, epsilon, banda, blend e limiti precedenti restano fissi. La lettura statica R3 è conclusa sotto i pin riportati più avanti; nessuna esecuzione è stata effettuata.

## Insieme da conservare

Per un kernel fisso con raggi positivi, `m=min(rx,ry,rz)` e floor `f=−b`, il kernel matematico è

`phi(p)=m*(1−sqrt(((px−cx)/rx)^2+((py−cy)/ry)^2+((pz−cz)/rz)^2))`.

Le posizioni che possono aumentare il campo clippato oltre f soddisfano

`((px−cx)/rx)^2+((py−cy)/ry)^2+((pz−cz)/rz)^2 < (1+b/m)^2`.

Per una riga z/y fissata, siano `T=((py−cy)/ry)^2+((pz−cz)/rz)^2` e `R=1+b/m`. In aritmetica reale:

- Se `T>R²`, nessun x della riga supera il floor.
- Altrimenti tutti i siti capaci di superarlo sono nell’intervallo `cx±rx*sqrt(max(0,R²−T))`.

Questa è una trasformazione esatta del medesimo ellissoide di livello negativo, non un nuovo modello. Il conteggio discreto dipende dagli indici dei centri voxel; non coincide automaticamente con il rapporto di volumi ellissoide/AABB.

## Due guard distinti, non soltanto padding X

Il calcolo Float64 di T e del radicando può respingere un’intera riga vicina alla tangente. Aggiungere un voxel ai soli estremi X dopo quel test non recupera una riga già omessa. Serve una maggiorazione conservativa anche nel test YZ/radicando, oppure un’inflazione certificata del livello prima del test.

Una dimostrazione utilizzabile ha forma condizionale: se l’errore assoluto dell’espressione sd effettivamente eseguita è al più delta, racchiudere il livello reale `phi>f−delta` contiene tutti i punti che il calcolo Float64 potrebbe far risultare sopra f. L’errore del calcolo dell’intervallo e della conversione in indici va a sua volta coperto con rounding conservativo/guard; un voxel può essere parte di questa protezione, ma non sostituisce un bound delle operazioni o delle condizioni numeriche.

Le condizioni finite/raggi positivi e il guard ingegneristico non formale già dichiarato dal helper non devono diventare, soltanto per rinomina, una prova universale bit-exact. La sufficienza concreta del nuovo guard va confrontata con le operazioni del sorgente R3 prima del run.

## Floor Float32: criterio esatto di omissione

Il tile nasce da `q0=Math.fround(floor)`; ogni valore memorizzato è Float32 e il massimo usa confronti con sd Float64. `q0` può essere sopra o sotto il floor reale.

Il criterio sufficiente è **`Math.fround(sd_fp)≤q0` per ogni sito omesso**, non una supposizione che floor reale e floor Float32 coincidano. La conversione Float32 è monotona. Se il confronto `sd_fp>tile` fosse falso, non ci sarebbe aggiornamento; se fosse vero ma `fround(sd_fp)≤q0≤tile`, la monotonia impone che l’assegnazione restituisca lo stesso valore già presente. In entrambi i casi il massimo memorizzato non cambia.

Il MAX Float32 così costruito è nondecrescente e coincide con il massimo dei valori Float32 del floor e dei kernel. L’ordine dei kernel non crea un nuovo coefficiente di blend. Il clipping reale resta sufficiente soltanto se il guard contiene gli errori del calcolo sd prima della conversione.

## Operazioni e dominio del riferimento invariati

Per dichiarare identità rispetto al raster AABB R2:

- Gli intervalli X emessi devono essere intersecati con gli stessi start/end del kernel R2; anche gli iteratori YZ devono restare dentro quei limiti. Non aggiungere nuovi siti che il riferimento non valutava.
- La formula sd nel callback conserva gli stessi operatori e la stessa associazione: `((xterm²+yterm²)+zterm²)`. Riutilizzare `yzSum` nello sd cambierebbe l’associazione in `xterm²+(yterm²+zterm²)` e non garantirebbe gli stessi bit ai midpoint Float32.
- Il floor del tile, la sua inizializzazione e l’unica merge `.16` restano quelli R2. Non sostituire la merge su tutto il tile con una merge sui soli siti toccati se si vuole identità del campo, anche nelle regioni negative non visibili.
- L’enumerator non modifica kernel, griglia, campo o RNG. Un callback di raster non deve retroagire sulla selezione delle righe.

## Contatori e limite del nuovo lavoro

Il root ha fissato **maxRowSetupCount16000000 prima di qualunque conteggio reale**; maxKernels4096, total valutazioni sd+merge256000000 e tile16MiB restano invariati. Il gate256M comprende anche le valutazioni sd dei guard, non soltanto il loop X del raster.

Definizioni richieste:

| Contatore | Significato |
| --- | --- |
| rowSetupCount | Ogni coppia(z,y) effettivamente visitata nel box nonvuoto di un kernel, **prima** del culling YZ; comprende anche le righe scartate |
| emittedRowCount | Righe con intervallo X intero nonvuoto dopo guard e intersezione |
| rasterPointVisits | Somma `hiX−loX+1` delle righe emesse; ogni posizione è una valutazione sd del callback, non necessariamente una scrittura nel tile |
| guardSDEvaluations | Valutazioni effettive sd al picco della riga e ai vicini esterni; contate anche quando una riga è scartata o va in fallback |
| mergeVoxelVisits | L’intero passaggio di merge già previsto dal tile R2 |
| totalRasterVoxelVisits | rasterPointVisits+guardSDEvaluations+mergeVoxelVisits, senza presentarlo come tempo o FPS |

I kernel con un asse del box vuoto devono essere saltati allo stesso modo nel prepare e nel runtime. Per gli altri, la somma preventiva `Ny*Nz` consente di respingere il cap righe prima di eseguire le radici delle righe. Se lo z-setup è separato, va dichiarato senza sottrarlo dalle coppie YZ.

La soluzione più verificabile è un unico enumerator stateless, con i medesimi argomenti immutabili, usato sia per il conteggio sia per il callback runtime. Una seconda implementazione delle formule nel conteggio potrebbe divergere. Il callback riceve soltanto `(z,y,loX,hiX)` o un equivalente record; i contatori devono descrivere il loop realmente eseguito. Se il callback termina con errore, non attribuire al runtime parziale i conteggi completi del prepare.

L’enumerazione evita le radici sd nei corner del box, ma aggiunge lavoro per riga e radici degli intervalli. Il prepareR3 esegue le valutazioni dei guard ai siti kernel necessari alla certificazione delle righe; **non** deve essere descritto genericamente come «nessun campione». Rimangono assenti dense field, loop raster completo, bake e modello. Non c’è ancora un conteggio reale nuovo né una prova che il totale rientri nei limiti. Nessun nuovo prepare R1 è stato chiamato per completare il valore parziale.

## Revisione della proposta picco/boundary prima del codice finale

Rain sostituisce il rigetto YZ basato soltanto sul radicando con una verifica sullo **stesso sd Float64 del riferimento R2**. La proposta è matematicamente valida sotto le operazioni monotone finite del riferimento, con le seguenti condizioni esplicite.

La ricerca del picco usa una lower_bound dei centri X **forward**, calcolati con lo stesso ordine `min+(index+.5)/resolution*extent`. La sequenza è monotona per extent>0. I due vicini che bracciano cx, dopo clamp al box del kernel, contengono la minima globale di `abs(px−cx)`. Non si assume che l’indice ottenuto invertendo la formula geometrica sia esatto.

Per raggi positivi, lo sd canonico è monotono rispetto a `abs(px−cx)`: quadrato, divisione per raggio positivo, somma di termini nonnegativi e radice sono monotoni; `1−sqrt` ne inverte il verso. I plateau prodotti dall’arrotondamento non invalidano questa proprietà. Il sito scelto è quindi un massimo discreto della riga.

Se `sdPeak≤floorDouble`, ogni sito della riga soddisfa lo stesso limite e il criterio Float32 precedente ne consente l’omissione. Un picco NaN non deve mai causare un rigetto silenzioso; deve produrre fallback completo o errore esplicito.

Altrimenti la formula geometrica propone soltanto un intervallo: può usare il radicando e il padding1voxel, ma deve includere il picco discreto e restare dentro il box R2. Prima di emettere l’intervallo vengono calcolati sd canonici ai **due vicini immediatamente esterni che appartengono ancora al box**. Se un vicino supera floorDouble, o non è affidabile/è NaN, si emette l’intera riga AABB. Se entrambi i vicini omessi sono≤floorDouble, la monotonia sui due lati del picco dimostra che ogni sito più lontano è anch’esso≤floorDouble. Il MAX Float32 rimane così identico.

La correttezza non dipende più dall’accuratezza dell’inversione geometrica/sqrtguess: una proposta imprecisa aumenta il fallback o le visite, senza autorizzare false omissioni. Le operazioni sd del guard e del callback devono però essere realmente le stesse, con la stessa associazione; questa è una condizione del successivo controllo di sorgente.

Costo sd del runtime completo: `S+B+R`, dove S sono le valutazioni del picco (normalmente una per rowSetup), B le valutazioni effettive dei vicini esterni e R i punti degli intervalli emessi. Anche un punto guard poi rivalutato dal callback conta due volte, perché sono due esecuzioni reali. Il totale del gate è `S+B+R+merge`. Il prepare conta/esegue S+B e prevede R; non esegue R come raster completo.

## Sorgente R3 letto e contabilità del percorso reale

Helper congelato: `continuous-helper/continuousOutflow.ts`,20523B, SHA256 `d87f162bda0303a05ec5e7bab85a68ef2ee3c983e23ddd1bdef54fccbb253de6`. La copia integrata del helper ora ha lo stesso hash. Owner `continuous-source/src/cumulonimbus/volume.ts` osservato con SHA256 `6b8f59bf2258bd5c56f00f436bae73e2a84348882e20716d3cf2279048d9ae8f`; source144 freeze rootR2 `30c3ce126c18d6ce9c5937777452a514caabfee147c373561c7847185ac0f950`.

La lettura conferma lower_bound forward con clamp dei due vicini e scelta della minima abs(dx), inclusione del picco nell’intervallo, verifica di entrambi i vicini esterni realmente dentro il vecchio AABB e fallback completo se uno supera floor o è NaN. Un picco NaN produce un RangeError, non una riga omessa. Il medesimo sd, con la stessa associazione, viene usato dai guard e dal callback owner. Floor e negativeBand provengono dal medesimo prepared valido, dove fieldFloorKm=−negativeBandKm; la prova riguarda questo owner e input, non un Pick arbitrario/mutato con valori incoerenti.

La stateless API è `forEachContinuousOutflowRow(kernel,grid,negativeBandKm,visit?)`. Prepare e runtime la chiamano con gli stessi kernel, griglia nativa e banda. Il runtime valuta esattamente gli x inclusivi emessi; non introduce un secondo culling. L’unica merge resta sull’intero tile, dopo il MAX.

Il helper respinge anticipatamente `rowSetups+candidateRows>maxRowSetupCount`, dove candidateRows=Ny*Nz per ogni box nonvuoto, prima dell’enumerazione del kernel. I guard reali sono contati uno per picco e uno per ogni controllo boundary effettivo. I valori pubblicati sono:

- `kernelVoxelVisits=R`, somma degli span emessi.
- `guardEvaluations=G=S+B`.
- `totalRasterVoxelVisits=R+G+merge`, confrontato con256000000.
- `rowSetupCount=S`, confrontato con16000000.
- `totalGenerationKernelEvaluations=R+2G`, `totalGenerationWork=R+2G+merge`, `totalGenerationRowSetupCount=2S`: comprendono anche l’enumerazione del prepare e non la nascondono come lavoro gratuito.

Radici analitiche del guess, fallback e confronti della ricerca del picco hanno contatori separati. Per una callback runtime completata le somme corrispondono al percorso di codice; nessun conteggio misurato o output raster è stato prodotto in questa review. Un futuro audit che richiama lo stesso enumerator con callback solo-contatore è una verifica di contabilità condivisa, **non un solver geometrico indipendente**; aggiunge un’altra esecuzione dei guard al costo del preflight.

Confronto testuale con la R2 preservata `continuous-helper/revisions/r2/continuousOutflow.ts`, SHA256 `4f96f7ddd4ca298ed89ba23c286de91f6ee121ab7b6a5fcce87e481ae7cde3d5`: l’intero blocco da copia dei keyframe a preparazione geometria/errore/griglia t è byte-identico; anche le espressioni dei bounds negativi di ogni kernel sono invariate. Non ho rigenerato t o valutato kernel per effettuare questo confronto.

## Stato

Nessun blocker concreto trovato nella prova no-false-culling o nel percorso stateless dei contatori R3 per il prepared valido dell’owner. Questa è una conclusione limitata alla lettura matematica/statica; non emetto un PASS numerico, di fattibilità, qualità o prestazioni. Il futuro preflight usa `preflight-r2`, conserva R1 intatto e può eseguire soltanto dopo nuovi pin e autorizzazione del root.
