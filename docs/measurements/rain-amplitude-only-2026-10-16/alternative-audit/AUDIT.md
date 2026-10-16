# Pioggia: prossimo esperimento e fattibilità

16 ottobre 2026. **Proposta congelata prima di qualunque nuovo run.** Nessuna
modifica prodotto, cache nuova, bake, GPU, browser, build o test. I conteggi che
seguono derivano soltanto da formule e dati già archiviati.

## Cosa non ripetere

L’audit A/s ha già eseguito entrambe le phase: 128³ e 256³ falliscono il massimo
mapping di 1,5 m. Il 256³ supera p99 e i gate tau; il risultato condizionato ad
A≥.01 non modifica il gate. Il documento GPU-FORMAT descrive formati e costi,
non una cache GPU qualificata. Nei Markdown cercati non ho trovato una prova
eseguita di ampiezza soltanto né di preintegrazione: quest’ultima compare come
opzione 2 in RAIN-NEXT e nell’handoff, non come trial completato.

## 🌟 Prima scelta: cache della sola A, mapping e streak originali

È una rappresentazione diversa da A/s: per ogni punto runtime conserva la
lookup guessG e **le stesse operazioni f32 per s/xz e la stessa lookup streak**;
sostituisce columnRG+sheets e il calcolo di A con una lookup scalare interpolata.
La guardia UV originale resta. L’errore mapping è quindi zero per costruzione,
anche dove Aoriginale=0; va comunque verificato, senza azzerare s in tali punti.
La fase geometrica è preservata, ma la modulazione di ampiezza può cambiare
bordi, virga e contrasto. Non significa immagine identica.

Il nuovo A è proprio la componente A del vecchio oracle half, con lo stesso
reticolo. Le statistiche già misurate di errore A e supporto rimangono pertinenti:
A0→positivo 3.986/1.868 punti; positivo→0 0/1, per 128³/256³. **I vecchi errori
sigma/tau/T non si trasferiscono**: potevano includere cancellazioni con l’errore
di s. Il replay A-only è dunque una misura nuova, non una rinomina del PASS tau.
Con 0≤streak≤1, il bound puntuale è
`|deltaSigma| ≤ 1.4025 * amount * |deltaA|`, prima dell’errore ALU/half/filtro.

Nominalmente sono tre lookup invece di quattro dove la pioggia contribuisce;
il mapping non viene accelerato. Sulla sequenza storica ci sono 663.140 lookup
rain. Tre lookup in tutti i 206.466 punti rainRegion darebbero 619.398 chiamate:
soltanto 43.742 in meno, circa il 3,45% del vecchio loop. Usando gli zeri A il
budget teorico può avvicinarsi al 12,5% del loop, prima delle comparse spurie.
Sono budget di chiamate su punti fissi, **non tempi o FPS**. Una parte del
vantaggio da A0 consiste nel non leggere streak quando l’ampiezza è nulla:
questa parte sarebbe possibile anche con A originale, senza una cache.

R16F 128³/256³ richiede **4/32 MiB di solo payload campionabile**. Storage R16F
richiede Tier1 sul device effettivo: Metal-3 non la dimostra. Il fallback core
pack2x16float di due A adiacenti→buffer u32→copy R16F mantiene 8/64 MiB vivi,
con stride 256/512 byte e senza shadow CPU raw. Il diretto RGBA16F occuperebbe
16/128 MiB. Doppia pubblicazione, risorse renderer e allocazioni driver sono extra.
Il rebuild resta fino a tre lookup per nodo: circa 6,29/50,33 milioni, più copia.
Ridurre i canali non dimezza il lavoro che valuta A. Non c’è costo dinamico noto.

Invalidano A: mappa/seed, crescita, vento, precipitationTime, amount e drift.y,
perché WET_FLOOR è nel mondo. View/sole/sky possono restarne fuori. In pausa
si può riusare; in moto occorre compute/copy/render completo e pubblicazione
atomica. Usare una cache vecchia o aggiornarla a frame alterni sarebbe un’altra
approssimazione, non autorizzata. Se la cache è invalida, fallback originale.

**Protocollo minimo separato:** riusare esclusivamente i 576 raggi storici e
i due grid, A half dall’oracle precedente, s/xz/streak originali ad ogni punto;
verificare baseline e mapping zero, poi gate invariati tau massimo≤.01 e
media≤.002. Conservare massimi T lungo il raggio, A0↔positivo, per-ray e cutoff
censurati. Nessuna nuova posa, sweep o GPU. Un PASS permetterebbe soltanto di
valutare formato/rebuild e guardie native; non dimostrerebbe qualità o guadagno.
Il protocollo operativo è congelato nella cartella parallela rain-amplitude-only.

## Perché non partire dalla preintegrazione

Con due Gauss per cella trilineare streak, la cella laterale è 3,005 m. Anche
con mapping affine, A costante e DDA gratis, 18/36 m quasi orizzontali richiedono
circa 12/24 letture streak, contro 3/6 originali; gli endpoint cambiano il numero
intero di celle. Il vero mapping guessG→base→max/pow→backtrace è non affine.
Gauss esatto per un cubico non certifica questo composto. Se n è perpendicolare
a wind, n·xz=n·rp.xz: il backtrace non elimina il moto crosswind. Non sono stati
contati i pixel v50; non è una bocciatura universale, ma un costo concreto.

Opzione 2 resta una ricerca successiva: operatori ottici adattivi 18/36 m con
fallback 6 m e nube zero **su tutto l’intervallo**, non soltanto ai campioni.
Min/max di punti e una mask zero puntuale non sono certificati continui.
Con A costante e streak bounded [0,1], il semirange tau su 36 m è
`.01989*amount*A`: A=.1 e amount=.8 consumano già circa .00159 per un blocco.
Bounds larghi possono rendere necessario quasi sempre il fallback.

La sorgente attuale v50 è `Sr(t)=sky+D*exp(-k*t)`, **k=.006+.004*haze**.
Se congelata al centro, l’errore sorgente è limitato da
`|D|*exp(-k*t0)*(1-exp(-k*H/2))`; per haze=2.6 e H=36 m il fattore è≤.0002952,
prima del peso ottico. Il budget è globale e include l’attenuazione della luce
successiva. I gate opzione 2 già proposti sono |deltaT|≤.002 e RGB pre-film
≤.001*max(1,Smax); non sostituiscono i diversi gate A-only.

Se A-only non merita sviluppo, il minimo successivo sarebbe un oracle gratuito
su 128 raggi fissati prima dei risultati, blocchi 18/36 m e riferimento 3 m,
per falsificare il saldo lookup prima di costruire gerarchie. Un PASS di tale
oracle discreto non proverebbe bounds continui. **Questa prova non è autorizzata
né eseguita qui.** Non propongo adesso gerarchie, shader o una nuova cache GPU.

## Limiti e riferimenti

L’archivio storico è v40/ab2e122, pitch −.92, 2560×1440; la posa v50 recente è
2112×1844 e pitch +.2811. Non sono la stessa geometria/camera. Il replay conserva
quantità, clock e traiettoria storici; tau/T non richiede sorgente RGB e non
qualifica l’aerial v50, il flow nativo, il sampler, l’immagine o il throughput.
Macro 256³/detail 128³/384 e output pieno restano contratti, non prove artistiche.

Fonti primarie già discusse in RAIN-NEXT: [Wronski 2014, pp. 21–24](https://bartwronski.com/wp-content/uploads/2014/08/bwronski_volumetric_fog_siggraph2014.pdf)
(separazione in volumi intermedi, senza trasferirne qualità/tempi),
[Engel/Kraus/Ertl 2001, §3.4](https://cgl.ethz.ch/teaching/scivis_common/Literature/Engel2001.pdf)
(modello scalare lineare, non il nostro campo composto),
[Novins/Arvo/Salesin 1992](https://ecommons.cornell.edu/entities/publication/456a7f76-1dd0-4f9f-97eb-4242c19b8606)
(bracket e raffinamento). Nessuna nuova ricerca web o promessa di prestazioni.
