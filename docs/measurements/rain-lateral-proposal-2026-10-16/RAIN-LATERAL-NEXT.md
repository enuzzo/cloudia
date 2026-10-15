# Prossima ipotesi: intervalli vuoti comuni di pioggia e nube

Proposta congelata, 2026-10-16. Nessuna patch prodotto o esecuzione GPU.
Il guard verticale v42 è ritirato: A/B/A 14,208752 / 13,065621 / 13,466442 invii/s,
immagini A/B identiche, nessun vantaggio dimostrato nella variazione temporale.
Il prodotto è tornato ad `a1efb8e`, secondo il root; nessuna operazione Git qui.

## Unica proposta

Usare un **prisma laterale conservativo a otto lati**, combinato con un batch
nel vuoto continuo della nube. Non serve una nuova texture né una ricerca della
base locale: il box pioggia esistente fornisce già quattro lati; si aggiungono
soltanto i due slab `x+z` e `x-z`, calcolati una volta per raggio.

Sulla CPU, dalla mappa RG8 già disponibile, ogni centro con Rbyte>0 contribuisce
il suo intero footprint bilineare: rettangolo di semilati deltaX=10/64 e
deltaZ=7/64 km. Per n=(1,1) e n=(1,-1), conservare:

```text
lower_n = min_R>0 dot(n, centre) - (abs(n.x)*deltaX + abs(n.z)*deltaZ)
upper_n = max_R>0 dot(n, centre) + (abs(n.x)*deltaX + abs(n.z)*deltaZ)
L_n = lower_n/growth.y + min(0, 2.5*dot(n,wind))
U_n = upper_n/growth.y + max(0, 2.5*dot(n,wind))
```

Le coordinate runtime sono `rp=position-drift`; non sommare nuovamente drift ai
piani. Intersecare i due nuovi slab con il rain interval originale fornisce un
intervallo conservativo in cui la pioggia può esistere. Prima e dopo quel tratto
la pioggia è zero. **Il box originale resta quello usato per near/far, rainRegion,
entry jitter, t e ds**: il prisma è soltanto un certificato aggiuntivo.

## Perché include emissione, shear e vento

Un R filtrato positivo richiede un texel R positivo nel footprint del lookup
finale. I rettangoli includono quindi il supporto, anche ai bordi; non occorre
leggere G per costruire questi piani. Il source lookup finale usa
`xz=rp.xz-wind*s`, con `s=.32*max(0,guessBase-rp.y)+sourceShear`.
Nel rain box corrente rp.y>=-4.75, guessBase<=2.5 e sourceShear<.155, dunque
`0<=s<7.25*.32+.155=2.475<2.5`. L'estrusione `[0,2.5]*wind` include lo
spostamento, anche per componenti del vento negative. Il massimo G locale
sull'halo di emissione NON limita guessG: la prima lookup può leggere sentinella
255 lontano dall'emissione. La proposta conserva intenzionalmente il bound
2.5 globale del trasporto già usato nel rain box.

Questa è una prova geometrica per il filtro/modello corrente. Prima di una
patch vanno qualificati il padding esterno dei piani e il ray/slab f32, inclusi
raggi paralleli e quasi paralleli. Il PASS sampler ciclo9 è utile ma non prova
queste nuove proiezioni o l'errore dell'inversa del raggio. Non si dichiara qui
un epsilon numerico universale.

## Unione con il certificato della nube e conservazione della fase

Armare il batch soltanto con un mask cloud fresco zero, un suo certificato
continuo valido e un intervallo pioggia certificato vuoto. Usare il certificato
cloud già discusso con `H=emptyStep-stepSize` e gate esplicito che l'intero
tratto reference rimanga sotto iceStart: fuori dal box cloud il limite maxAbsX
del Jacobiano generale non basta da solo nella transizione ghiacciata.

Il batch può evitare nuove trasformazioni/lookup cloud e rain mentre entrambi
i mezzi sono zero. Deve tuttavia **ripetere in ALU gli avanzamenti originali**:
ricalcolare ordinaryStep/mediaStep e i clip dei confini originali, fare ogni
addizione f32 `t+=sampleStep` e rispettare il numero virtuale di iterazioni 8192.
`n*.006` o atterrare sul nuovo confine del prisma cambia fase e campioni. Fermare
il batch prima che il prossimo avanzamento lasci un certificato, poi riprendere
il percorso originale. Non rinnovare il certificato cloud senza un lookup fresco.
Dove uno dei due mezzi può essere occupato, conservare i passi originali.

Nella posa corrente emptyStep=.0546875 e stepSize=7/384 km: H=.0364583333 km,
quindi un certificato copre circa sei avanzamenti da 6 m. Il replay evita lavoro
costoso per campione, ma mantiene un piccolo loop ALU. Servirà una prova GPU
delle sequenze t/ds e dei contatori; il solo replay CPU non garantisce identico
codegen f32 dopo la trasformazione del loop.

## Potenziale già misurato: geometria soltanto

Unico calcolo leggero, 16,84 ms CPU, senza volume: mappa seed 72 già esistente,
pose/camera dal controllo, griglia 64×36; nessun altro esperimento dopo lo stop.

| Misura | Risultato |
| --- | ---: |
| Area laterale del vecchio AABB estruso | 36,10265 km² |
| Area del prisma a otto lati | 31,06118 km² (-13,9643%) |
| Area del vero hull convesso, solo riferimento geometrico | 28,81516 km² (-20,1855%) |
| Raggi che attraversano il rain AABB | 1.815 su 2.304 |
| Intero intervallo pioggia escluso dal prisma | 283 raggi |
| Intervallo escluso solo in parte | 669 raggi |
| Lunghezza rain AABB fuori dal prisma | 14,4135% |
| Lunghezza anche fuori dal cloud AABB, proxy più restrittivo | 4,1330% |

Le percentuali sono opportunità geometriche **prima** di opacità e clip del
terreno. Non misurano i campioni effettivamente eseguiti o il risparmio GPU.
Manca il mask cloud reale lungo i raggi: può certificare più del suo AABB, mentre
l'early exit per transmittance può eliminare già gran parte dell'opportunità.
Non convertire 14,4% di lunghezza in 14,4% di FPS. La posa riguarda solo congestus
seed 72, tempo 60, vento .55; altre viste/famiglie non sono qualificate.

## Gate prima di applicare

Verificare CPU supporto filtrato/piani con R minimo, bordi, vento firmato e range
growth; certificato cloud continuo fuori box; f32 slab e fase del batch sulla
GPU; confronto immagini e A/B/A con code completate e durata sufficiente.
Vista l'opportunità limitata e la variabilità misurata, questa resta una
proposta da selezionare, non un'ottimizzazione pronta o un guadagno promesso.

Artefatti esterni: `rain-lateral-potential.py` e `rain-lateral-potential.json`.
Lo script riusa solo la mappa e i report; output e metodo dichiarano i limiti.
Mappa SHA256: `c8f6dc2c8abb0717ec3051c0f958648ec541604f3718eb0f7621cb047d961fe2`.
