# Narrow cloud post-flow — proposta esterna, non applicata

16 ottobre 2026. Una sola candidata: seconda mask **R8 128³**, lettura discreta
**textureLoad** dopo flow, prima di fine/macro. Nessuna modifica al prodotto,
GPU, installazione o nuova generazione del volume. Il guadagno FPS resta ignoto.

Il macro256 e il dettaglio128 provengono esclusivamente dalla cache rain-work;
seed72, tempo60, forcingTime0 ricostruito, camera/rain80% originali. Il guard
certifica solo densità cloud zero **nel punto corrente**. Broad alpha, support,
flow, rainRegion, jitter, sampleStep, t, cutoff e integrazione co-locata rimangono
identici. Non si certificano intervalli e non si salta alcun segmento.

## Generazione e contratto

`build-narrow.ts` chiama la funzione originale `bakeOccupancy` con macro256 e
scratch128, `additional=[.001,.001,.001]`: nessun halo termico, perché flow è già
sottratto. L'additional è un budget ALU di **1 m**, non un nuovo warp materiale.
Si estrae alpha come R8; i raggi di dilatazione restano **[2,2,2]**. Ogni macro
R>0 conta, senza soglia .002, erosione o selezione per fase. Il supporto finale
può solo restringersi con erosione/materiale/massFactor/fragments.

La lettura usa `floor(clamp(coord,0,1)*dimensions)`, poi `min(dimensions-1)` e
conversione i32. Non usare round, dimensions−1 nel prodotto o indirizzamento
repeat. `textureLoad(...,0)` restituisce il texel byte, senza interpolazione o
mipmap. Clamp float prima della conversione evita overflow per coordinate finite
esterne al dominio. Si riusa la **stessa coord** che alimenta macro e luce.

## Prova geometrica per 256/128

Sia h la cella mask, h/2 il macrotexel, W=[.08,.06,.08] km il warp massimo.
Un macrocorner positivo contribuente può distare al massimo h/2 dal punto macro
filtrato. Il centro del seed `floor(macroIndex/2)` dista al massimo h/4 dal centro
del macrocorner. Prima del warp, il punto local dista quindi dal seedcenter al
massimo **W+3h/4** per asse. Le celle nearest dei seed±2 coprono fino a **2,5h**:
il margine minimo alla prima cella esclusa è **1,75h−W**.

| Asse | h mask (m) | W (m) | Margine residuo geometrico (m) |
|---|---:|---:|---:|
| X |78,125|80|56,71875|
| Y |66,40625|60|56,2109375|
| Z |54,6875|80|15,703125|

Il budget ALU di 1 m lascia almeno **14,703125 m** residui. Flow, crescita e
reference condivisi non introducono errori relativi aggiuntivi: il confronto
parte dalla medesima coord f32, dopo flow. Vicino al supporto normalizzato i
termini sono limitati e il budget è molto più largo degli arrotondamenti f32 di
warp/extent, somma e indice. Il prodotto per128 è una scala binaria esatta per
coordinate f32 finite nell'intervallo clamped. Questa prova non si estende
automaticamente ad altri rapporti di risoluzione.

Per i bordi, clamp non espande le distanze e i seed di faccia marcano anche il
texel di faccia: un punto oltre dominio carica quel texel, senza wrap. Il
contratto residuo è quello del **macro già esistente**: campionamento lineare
con footprint trilineare locale, valori finiti/range UNORM e risultato zero se
tutti i corner sono zero. Non si assume che un nuovo filtro R8 preservi lo zero,
perché non viene usato. Il [contratto sampler WebGPU](https://www.w3.org/TR/webgpu/#sampler)
e i [limiti numerici WGSL](https://www.w3.org/TR/WGSL/#floating-point-accuracy)
non equivalgono a una prova di pixel parity su qualsiasi dispositivo: resta
necessaria la qualifica GPU finita ai bordi/half-texel/warp firmato.

Se il load narrow è zero, ogni macrocorner che potrebbe contribuire è zero;
quindi warped=0 e il gate originale warped>=.002 fallisce. L'intero corpo
fine/macro/erosione/micro/luce può essere evitato. Ice resta calcolato prima del
guard; tutti i rami originali, inclusi alba/sunset, ghiaccio e diagnostiche,
restano byte-identici dentro il guard. Nessun continue viene aggiunto.

## Audit e saldo misurato nel modello CPU

861.511 macrocorner positivi →114.575 seed; nessun cubo seed±2 contiene texel
non marcati (prefix sum esaustiva). 6144 casi assiali coprono ogni macroindice,
endpoint del supporto, warp firmato, guard firmato e facce; PASS. Un caso Z
mostra che raggio1 perde un corner realmente contribuente: raw=.4352, warpZ=−.08, fine.r=0/fine.b=1, erosione=.38 e rho≈.089>gate. La R8 marca171.377
texel, **8,1719%** del dominio. Build+audit finale: circa253 ms, solo CPU/cache.

| Griglia | Load R8 aggiunti | Fine+macro evitati | Saldo chiamate risparmiate | Quota loop |
|---|---:|---:|---:|---:|
|16×9|29.669|45.152|15.483|4,826%|
|32×18|115.627|177.912|62.285|4,919%|

Nella griglia32×18:76,934% dei broad>0 sono narrow0; tutti hanno raw macro=0,
densità=0 e nessuna differenza di trasmittanza. Hash sequenza candidato e
baseline identici in entrambe le griglie. Nel solo rainRegion il saldo è52.973
chiamate; fuori è9.312. Macro-light/sunset/ice/micro non vengono conteggiati
come risparmio aggiuntivo: erano già irraggiungibili nei punti certificati.

Il saldo include il costo del load R8 e supera il pareggio semantico del50%,
ma riguarda solo **chiamate nel sorgente**: nessuna conversione in tempo GPU,
fetch hardware o FPS. Cache, divergenza, branch, registri e binding aggiuntivo
possono annullare il vantaggio. Nessun beneficio dimostrato in Sole, moto,
worker/mobile o altre pose. Il modello CPU conserva i limiti del port originale
(filtri ideali, flow CPU/half, alcuni intermedi f64, nessun modello FMA GPU).

## Integrazione proposta e gate ancora aperti

`cloudShader.patch` contiene soltanto il guard concreto e il nuovo argomento;
non è un pacchetto prodotto completo. Il root deve collegare la R8 mediante
CloudVolume/worker transfer, texture RedFormat+UnsignedByteType+NoColorSpace,
128³, no mipmaps, clamp esplicito, e gestirne cleanup e caricamenti annullati.
Costo persistente aggiuntivo: **2 MiB CPU +2 MiB GPU**; il builder scratch crea
transitori8 MiB RGBA +2 MiB seed +8,19 MiB difference, oltre all'output2 MiB.
L'audit prefix separato aggiunge temporanei che non servono nel prodotto.

Prima di promuovere: wiring/compilazione e lifecycle; audit GPU dei punti
avversari e almeno un confronto immagine invariato; poi A/B nella stessa posa
pioggia, qualità256/128/384 e output pieno, usando metriche di invio e somme
pass separate. Accettare solo con vantaggio reale; non aumentare passi o cambiare
quadratura per compensare. Il risultato attuale giustifica **una prova isolata**,
non un'adozione.
