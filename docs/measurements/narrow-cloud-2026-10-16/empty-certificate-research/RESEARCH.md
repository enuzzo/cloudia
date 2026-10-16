# Certificato cloud-empty dopo flow — ricerca CPU condizionale

2026-10-16. Pacchetto separato dal narrow-binario congelato. Nessuna modifica
prodotto/GPU o nuova cottura. Una BFS dalla mask esistente e un replay CPU32×18;
il root ha autorizzato la finestra CPU fra i suoi benchmark. CPU ora libera.

## Esito e prossimo gate

Il potenziale merita **soltanto una qualifica del filtro flow**, prima di una
candidata prodotto. Il modello CPU evita circa9,94% delle chiamate semantiche
rispetto al narrow binario, senza cambiare t/ds/pioggia. Ma i conteggi con errore
sampler0/1/2m sono scenari, non errori misurati né un contratto hardware provato.
La loro stabilità non giustifica scegliere1m come epsilon reale.

Serve distinguere due affermazioni: un massimo osservato da un audit finito e
l'ipotesi che lo stesso envelope valga **a ogni coordinata** del percorso. La
prima è qualificabile sul device della sessione; la seconda non segue da sola
dai campioni. Senza una garanzia documentata o una strategia più conservativa,
una versione gated resta un esperimento su quel backend, non equivalenza per
qualsiasi GPU/browser/futuro aggiornamento.

## Distanza esatta e geometria

La mask128³ originale ha171.377 celle occupate. La BFS multi-source a26vicini
calcola D, distanza Chebyshev minima in indici dalla cella occupata più vicina:

- D=0: occupata; D>=1: vuota. È **l'inverso** della semantica binaria255occupata/
  0vuota; riusare il vecchio test `load>0` senza adattamento sarebbe errato.
- Ogni cella di distanza in indici<=D−1 dalla cella corrente è vuota. Da qualsiasi
  punto di quest'ultima, R=(D−1)*min(cellKm) è un raggio L∞ conservativo. Nessuna
  distanza euclidea interpolata viene assunta.
- Clamp della coord sul box è non espansivo: una proiezione al bordo non aumenta
  il moto. Il certificato riguarda il set di celle con indirizzamento clamp.
- La R8D può sostituire la R8 binaria: stessi2MiB persistenti, nessuna nuova
  texture. Decodifica prevista `u32(round(textureLoad(...).r*255))`, da qualificare
  per tutti i codici usati, non la sola vecchia coppia0/255.

BFS:2.097.152 celle visitate, maxD59, mapping occupied/D0 esatto;64 confronti
brute-force indipendenti contro tutti i seed confermano il minimo. Tempo131,77ms
comprensivo dell'audit, riferimento Bun locale, non costo GPU. Nessun volume
ricostruito; il solo output nuovo è distance-r8.bin da2MiB.

## Bound pessimista del flow interpolato ideale

F è l'interpolante trilineare clamp dei nodi16³. Cap XYZ in km:
A=[.42,.82,.34], ampliato di2ULP binary16 al cap:
Aguard=[.42048828125,.8209765625,.34048828125]. Questo copre prudentemente la
quantizzazione dei nodi; la correttezza del cap prima della scrittura GPU resta
una premessa da verificare. Non è un bound della precisione del filtro.

Con celle flow h=[.625,.53125,.4375]km:

```
|∂F_i/∂r_j| <= B_ij = 2*Aguard_i/h_j
local(p) = reference(p) - F(reference(p))
```

Sotto iceStart, il Jacobiano reference J ha righe:
[g_y,−g_y*wind.x*k,0], [0,g_x,0], [0,−g_y*wind.z*k,g_y],
con0<=k<=1.5/6.2. Per ogni componente local_i si massimizza
||(e_i−gradientF_i)J||2 sugli8vertici del box gradient e sui2endpoint di k;
la norma è convessa in ciascun parametro, quindi questi vertici danno un bound.
È pessimista perché ammette gradienti indipendenti anche se non coesistono.

Per la posa attuale growth=[1,1,1], windF32=[.26420006156,.09009438008]:
L_i=[3.513787,6.310839,3.114990], quindi **L=6.310839** da worldL2 a localL∞.
Il prodotto di norme∞ più rozzo dà11.140189. Il ray è unitario; errori f32 di
normalizzazione/coordinate devono essere compresi nel guard aritmetico.

Il frame è costante per l'intera integrazione: questa cache non sopravvive al
fragment/frame e non può attraversare aggiornamenti di flow, vento o growth.
Il flow.a non serve al bound XYZ; un raw macro nullo fallisce il gate prima
che erosione/materiale possano contribuire.

## Contratto additivo necessario e timer

Sia Fnative il filtro GPU e Fideal l'interpolante degli **stessi** nodi half.
L'ipotesi richiesta, non ancora qualificata, è per ogni coordinata rilevante:

```
||Fnative(r) - Fideal(r)||∞ <= epsSampler
||localNative(p1) - localNative(p0)||∞ <= L*|p1-p0| + 2*epsSampler
Hdistance = max(0, (R - 2*epsSampler - localArithmeticGuard)/L)
```

Il fattore2 è indispensabile: l'errore può avere segno opposto ai due endpoint.
Lo start viene certificato nella sua cella post-flow effettiva; non si usa una
cellula derivata da reference non spostato. Il counter usa flow CPU/half ideale,
quindi le distanze visitate sono una stima delle opportunità, non readback GPU.

Guard del modello:1m locale,1m su ice,30,5176mm sul clock (`2^-15`km). Il timer
è f32 e strict`t<until`; il margine clock è largo rispetto all'ULP di t nel
dominio corrente<=32km. Questi guard non si sostituiscono a epsSampler.
Si limita H anche a `(iceStart-reference.y-iceGuard)/growth.x`, usando il bound
unit-ray |dy/dt|<=1, e a far−t. Nessun certificato usa il Jliquido oltre iceStart.

Con epsSampler0 e il guard locale, D2 dàH8,51m; D3 17,17m; D4 25,84m. Sono già
possibili successivi punti6m. Non si allungano passi o segmenti: broad, rain,
ds/t/jitter/cutoff sono sempre originali. Nel ramo broad>0, un timer valido
salta solo flow+narrow; i campioni rain continuano identici. Fuori dal timer si
eseguono flow e load D; un nuovo certificato può nascere solo da questa lettura.

## Risultato sui576raggi della posa reale

Stessa origine/target e simulationTime60 del contatore archiviato, forcingTime0
inferito dalla sequenza UI. Port storico e array cache originali; il source
cloudShader.before è esplicitamente quello congelato, non il nuovo shader live.
La baseline di confronto qui è il **narrow binario**:1.203.881 chiamate semantiche,
non il vecchio totale1.266.166. Un solo replay CPU:1,19s, nessuna variazione
sorgente modello durante l'esecuzione.

|epsSampler per lookup, ipotesi|0m|1m|2m|
|---|---:|---:|---:|
|Punti broad>0 con flow+narrow evitati|59.820|59.818|59.762|
|Di questi nel rainRegion|57.177|57.176|57.123|
|Letture flow/narrow fresche rimaste, ciascuna|55.807|55.809|55.865|
|Certificati armati|15.453|15.454|15.518|
|H medio dei certificati armati|30,26m|29,94m|29,71m|
|Chiamate semantiche evitate,2per punto|119.640|119.636|119.524|
|Ulteriore quota rispetto al narrow binario|9,938%|9,938%|9,928%|
|Totale chiamate del modello candidato|1.084.241|1.084.245|1.084.357|

Tutti gli scenari: nessuna cella occupata, raw o rho positivo scartato; hash
sequenza CPU t/ds/support/rho/rain/T identico alla baseline. Il timer viene
interrogato nei115.627 punti broadpositivi; il costo ALU di compare, decode,
H/ice e uniformL non è tradotto in chiamate texture né prezzato. La sostituzione
D/binary non aggiunge una lookup: si risparmiano2letture per punto cached.
I test del contatore sono discreti e condizionali al modello, non una prova
continua del filtro nativo o un'ottimizzazione GPU già applicata.

## Ricerca primaria: cosa garantisce e cosa no

[WebGPU§7 Samplers](https://www.w3.org/TR/webgpu/#samplers) definisce linear come
interpolazione di due texel per dimensione; [WGSL textureSampleLevel](https://www.w3.org/TR/WGSL/#texturesamplelevel)
usa il livello esplicito. Non ho trovato qui un epsilon assoluto in metri o un
numero minimo di bit frazionari per il filtro3D RGBA16F. La nota WebGPU sul
comportamento implementation-dependent segue l'anisotropia: non la uso come
prova che la normale interpolazione possa avere un errore arbitrario.

[Metal Shading Language4.1§8.7.2,pp378–379](https://developer.apple.com/metal/Metal-Shading-Language-Specification.pdf)
precisa conversione half→float lossless e float→half round-to-nearest-even.
È una regola sui valori memorizzati, non una garanzia sui pesi dell'interpolazione.
La ricerca nelle sezioni texture/sampler/precisione non ha fornito un limite
numerico dei pesi utilizzabile come garanzia1m. Il PDF ufficiale datato2026-06-04
è conservato esternamente con SHA, per verificare questa lettura limitata.

Una derivazione evidenzia perché non basta il formato half. Se ciascuna frazione
trilineare ha errore<=eta, per campo bounded±A_i il telescoping dà:

```
|erroreFiltro_i| <= 2*A_i*(etaX+etaY+etaZ) + erroreAritmeticoFiltro_i
```

A_y≈.821: ipotetici8bit frazionari a nearest darebbero fino a9,62m,10bit circa
2,41m,12bit circa0,60m, **prima** dell'errore di calcolo del filtro. Questi non
sono bit attribuiti ad Apple. Vulkan espone subTexelPrecisionBits, ma un requisito
Vulkan non si trasferisce al device Metal/WebGPU e non viene usato per il guard.

La conversione UNORM8→f32 di Metal§8.7.1 ha invece precisione specificata; per i
codici D0..59, `round(load*255)` ha un margine enorme rispetto a metà intero.
Resta comunque da testare la decodifica nel percorso GPU effettivo.

## Proposta di gate finito, senza implementazione ora

Qualificare il filtro sul device della sessione con texture16³ RGBA16F e query
f32 identiche sulle due strade. CPU interpola i medesimi byte half, senza usare
un diverso flow analitico/trig. Fixture: costanti con segno, rampe per asse,
checkerboard estremi vicino ad Aguard, corner basis, bordi/clamp e frazioni fitte
con ULP attorno ai confini. Confrontare massimo/RMS errore XYZ, salti fra punti
vicini e la disuguaglianza L*delta+2eps; includere il campo reale come dataset
separato. Verificare anche endpoint del compute e decode di ogni D usato.

Un eventuale eps viene proposto **dopo** quei risultati e deve dichiarare margine,
fonte e campo di validità. `architecture=metal-3` non identifica da solo una GPU,
una versione shader o una garanzia: registrare adapter, browser/runtime, kernel,
formato e stato del test. Su esito negativo/configurazione diversa: percorso
narrow binario originale. Un PASS finito non dimostra l'envelope continuo su
query non campionate; se si pretende equivalenza rigorosa senza tale ipotesi,
questo gate è insufficiente e il timer non va promosso.

Nessun nuovo audit GPU, shader candidato o benchmark viene avviato da questa
ricerca. Prima di ulteriore prodotto servono anche controlli nelle pose Sole
ravvicinate, dove compare/decode possono aggiungere costo senza cache utile.

## Artefatti

- bounds.py/json: derivazione leggera del bound; nessuna lettura volume.
- distance.ts/json e distance-r8.bin: unica BFS esatta dalla mask congelata.
- count-empty.ts e work-32x18.json: unico replay e scenari0/1/2m.
- manifest.json: SHA dei payload, con fonti primarie locali separate.

La cache macro/dettaglio/flow è solo riusata esternamente, non duplicata qui.
Il pacchetto narrow/gpu-audit congelato non è stato mutato.
