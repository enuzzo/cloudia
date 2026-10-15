# Opzioni future per la luce ravvicinata

15 ottobre 2026. **Nessun nuovo modello adottato.** Fase120 e cielo5 sono ora
implementati, verificati e ritirati nel [quarto ciclo](EXPERIMENT-LIGHT-SOURCE-2026-10-15.md).
Le sezioni seguenti conservano motivazioni e vincoli; non rimettere in coda le
stesse formule come prove ancora da eseguire. Le altre opzioni restano ipotesi.

## Evidenza e problema circoscritto

Il punto di partenza usa ambient da profondità ottica solo verticale, una
miscela di fase fissa e scattering multiplo approssimato dalla sola tau solare.
Due punti con uguale tau verticale ricevono lo stesso ambient anche se uno
vede il cielo lateralmente e l'altro è chiuso fra lobi: manca questa variabile.
È una causa plausibile di luce poco articolata, non una diagnosi già provata.

L'[audit CPU della luce locale](EXPERIMENT-LOCAL-LIGHT-2026-10-15.md), sulla
baseline liquida 18/km, corregge i primi 128 m verso il sole. Il CV delle cinque
sorgenti medie pesate per opacità scende da 17,4610% a 16,3595% al 95% e da
5,3564% a 4,8439% al 100%. La maggiore precisione solare, da sola, non sostiene
quella variante come rimedio alla nebbia uniforme. **Nessuna cache GPU della
variante è stata costruita.** Non è contrasto dei pixel né esclude altri modelli.

## 1. Ambient con visibilità volumetrica multidirezionale

**Provato e ritirato:** v33 usa zenit1/4 e quattro direzioni con y=1/3,peso3/16,
con risposta exp(-.35*m*tau). Nella guardia frontale80 non recupera dettaglio;
l'audit100 rileva oscuramento e minore variazione ambient fra5raggi. Questa
configurazione non è sostenuta come prossimo intervento. Altri cieli/direzioni
non sono automaticamente esclusi da una sola posa.

Proposta: integrare 4–6 direzioni verso il cielo nella stessa densità del bake,
poi combinare la luce incidente con le rispettive trasmittanze. Questo aggiunge
apertura laterale e occlusione fra lobi senza normali ricavate dalla densità.
Per una fase ambient isotropa, usare una media pesata delle trasmittanze:
`V(m) = sum(w_i * exp(-m * tau_i))`, con pesi normalizzati e non negativi.
Non sostituirla con `exp(-m * sum(w_i * tau_i))`.

Una cache scalare precombinata a massa unitaria non conserva tutta la risposta:
`pow(V(1), m)` in generale è diverso da `V(m)`. Se cambiano densità o estinzione,
occorre ricombinare dalle tau direzionali oppure rigenerare la cache; un riuso
approssimato deve essere dichiarato. Non aggiungere un coseno Lambertiano:
lo scattering volumetrico integra radiance × fase senza una normale [1].
Un contributo inferiore richiede una sorgente distinta dal solo cielo superiore.

Un precedente usa luce del cielo mediata sulla sfera con fase isotropa e indica
la convoluzione cielo/fase fra gli sviluppi futuri [2]. Non implementa già la
nostra proposta di auto-occlusione laterale e non ne dimostra il beneficio.

## 2. Miscela di fase legata allo spessore fisico locale

**Provata e ritirata:** v32 con riferimento120m, peso anisotropo.55+.30(1-ice)T,
densità prima della microerosione della camera, solo diretto. Normalizzazione e
invarianza omogenea al passo passano; immagine frontale80 ancora sfocata.
Non ripetere questo modello senza una nuova ipotesi circoscritta.

Proposta economica: variare il peso fra lobi normalizzati già valutati per
raggio, usando tau solare e trasmittanza locale su una **lunghezza fisica fissa**.
La stima da densità locale non è l'integrale della densità circostante.
Non usare l'opacità del segmento di marcia come proprietà del materiale:
passo, qualità e distanza dalla camera cambierebbero anche la risposta luminosa.

Un modello pubblicato lega la fase alla profondità ottica per distinguere zone
rade e dense, bordi frontali e controluce [3]. La lunghezza fissa è una nostra
scelta per evitare dipendenza dal passo. Non importare fattori di intensità
calibrati per altri albedo. Ribilanciare la miscela/scattering multiplo esistenti,
senza sommare altro riempimento uniforme. Costo previsto: poche ALU per campione,
nessuna nuova texture; beneficio limitato se densità e luce sono quasi uniformi.

## 3. Powder: alternativa terza, con rischio di contrasto artificiale

Una risposta limitata che distingua densità rada e corpo denso può articolare
i bordi. La motivazione pubblicata considera anche la densità circostante e la
minore luce ricevuta sui bordi [4]. Riutilizzando solo densità e tau già presenti,
la nostra variante sarebbe una rimappatura economica, non nuova informazione
di trasporto. Rischi: aloni scuri, aspetto solido/gessoso, interno ancora sfocato.
Altri ottavi di scattering tendono a diffondere la luce più in profondità [2]:
aggiungerli non costituisce di per sé una strategia per recuperare dettaglio.

## Costi e condizioni prima di generare nuove cache

A 256³, un canale R8 richiede 16 MiB di payload GPU; R16F ne richiede 32.
Un backing array CPU equivalente raddoppia quei soli payload; RGBA16F richiede
128 MiB per copia. Non sono la memoria totale: considerare vecchie/nuove cache
durante lo scambio, worker e trasferimenti. Una cache scalare richiede una lettura
extra; conservare più direzioni aumenta memoria/letture e costo di generazione.
La griglia macro esistente, circa 27–39 m, resta un limite al dettaglio luminoso.

Prima di una generazione: scegliere una sola ipotesi e un formato con budget
esplicito; coordinare l'esecuzione senza misure concorrenti; preservare parità
CPU/shader, registrazione del warp, cancellazione e scambio atomico delle cache.
Confrontare immagini reali con stessi seme, tempo, luce, meteo, target, origini
80/95/100%, output e cielo assestato; includere fronte, lobo laterale e controluce.
Verificare invarianza al passo e bilancio della fase prima di misurare il costo.
Il probe operativo normale resta attivo fuori dal confronto a camera fissata.
Le prove fase120 e cielo5 sono concluse con esito visivo insufficiente. Il
prossimo esperimento riguarda la [ricostruzione del materiale](RECONSTRUCTION-OPTIONS-2026-10-15.md),
con controllo coerente; nessuna delle varianti ritirate è approvata dal solo CV.

## Fonti primarie verificate

- [1] [Volume Scattering Processes, §11.1.4](https://pbr-book.org/3ed-2018/Volume_Scattering/Volume_Scattering_Processes).
- [2] [Physically Based Sky, Atmosphere and Cloud Rendering, note 61–63](https://www.slideshare.net/slideshow/physically-based-sky-atmosphere-and-cloud-rendering-in-frostbite/78314147), pubblicazione Electronic Arts/DICE, SIGGRAPH 2016.
- [3] [Real-Time Samurai Cinema: Lighting, Atmosphere, and Tonemapping, slide 97 e note](https://www.glowybits.com/talks/real-time_samurai_cinema/real-time_samurai_cinema.pdf), SIGGRAPH 2021.
- [4] [Cloud Lighting Model, slide 87–89](https://advances.realtimerendering.com/s2017/Nubis%20-%20Authoring%20Realtime%20Volumetric%20Cloudscapes%20with%20the%20Decima%20Engine%20-%20Final%20.pdf), SIGGRAPH 2017.
