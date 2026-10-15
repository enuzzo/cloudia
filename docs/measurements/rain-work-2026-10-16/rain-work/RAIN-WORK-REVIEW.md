# Lavoro eseguito nella posa pioggia A/B/A — riferimento CPU

2026-10-16. Un solo `generateVolume(256,72)` autorizzato; cache completa salvata
fuori Dropbox e riusata per tutti i conteggi. Nessun prodotto modificato,
nessuna GPU/browser avviata. Checkpoint dichiarato dal root: `ab2e122`.

## Conclusione operativa

Nella posa fissa misurata, la pioggia genera circa 52,37% delle chiamate texture
condizionali del loop, il mask cloud 19,46%, flow/fine/macro preliminari 27,40%.
Questa classificazione descrive le chiamate presenti nel sorgente; cache,
coalescing, ALU, divergenza e compilatore impediscono di convertirla in costo GPU.

Il vuoto comune laterale esiste anche **nei passi realmente visitati prima
dell'uscita per opacità**. La proposta prisma+certificato cloud copre circa 9,84%
dei campioni successivi e 6,54% delle chiamate texture nel modello. Il nuovo costo
slab/batch non è incluso, quindi non è un guadagno netto previsto.

La distinzione pratica è netta: fra i campioni pioggia con mask cloud zero,
55.598 hanno R=0, 14.984 evaporazione=0 e soltanto 24 attachment=0. Questo sostiene
una ricerca sul vuoto laterale/virga più del solo limite superiore verticale.
Il prisma economico copre solo parte di tale vuoto. Con un ipotetico certificato
R=0 gratuito e perfetto, eliminare tutti i 55.598 punti mask0/R0 rimuoverebbe al
massimo 13,17% delle chiamate del loop (tre per punto): è un tetto ottimistico,
non un algoritmo né un certificato continuo. Non suggerisco una nuova patch
sulla sola base di queste percentuali.

## Conteggi e stabilità spaziale

| Misura |16×9 pixel scelti|32×18 pixel scelti|
|---|---:|---:|
|Raggi|144|576|
|Iterazioni realmente attraversate dal port|62.210|246.399|
|Uscite per T<.006|29|126|
|Uscite far|115|450|
|Limite8192 / passo non positivo|0 /0|0 /0|
|Iterazioni nel rainRegion|83,70%|83,79%|
|Support mask zero|52,31%|53,07%|
|Entrambe le estinzioni zero|61,05%|61,07%|
|Column R=0, sul numero di column lookup|39,36%|39,41%|
|Mask0 e pioggia0, dentro rainRegion|33,95%|34,20%|
|Campioni successivi evitabili con prisma+cloud certificate|9,89%|9,84%|
|Chiamate texture potenzialmente evitate, costo nuovo escluso|6,56%|6,54%|

La griglia più fitta osserva 1.266.166 chiamate del loop:

|Gruppo semantico|Chiamate|Quota|
|---|---:|---:|
|Rain guessG + columnRG,2D|412.932|32,61%|
|Rain sheetsG + streakR,3D|250.208|19,76%|
|Cloud maskA,3D|246.399|19,46%|
|Cloud flow + fineRGB + macroR,3D|346.881|27,40%|
|Cloud macro-lightGBA|9.420|0,74%|
|Ice bend/detail|326|0,03%|

Support>0 si verifica 115.627 volte, ma solo 12.447 campioni superano il gate
macroR>=.002 e 9.420 producono densità cloud positiva. Il mask conservativo porta
quindi a 89,24% di gate macro falliti dopo flow/fine/macro. È un'altra categoria
di lavoro osservata; questi numeri non autorizzano a stringere il mask senza
la sua prova di supporto. Sheets e streaks vengono contati anche quando
attachment o evaporazione azzerano la pioggia, come nel codice originale.

## Fedeltà e limiti del port

Origine/target e parametri sono copiati dal vero controllo ciclo9; i pixel sono
centri di pixel interi sulla risoluzione 2560×1440. Basis dopo clamp, offset schermo,
jitter, campione a inizio segmento, rainNear/Far, emptyStep, clip, passo 6 m e
terminazione 8192/T<.006 seguono il loop baseline. Non si riusa il march midpoint
di `qa-visible-source.ts`. RainTime=0 è ricostruito dalla sequenza UI confermata
dal root (Fissa stato di confronto, Pioggia, 35 ArrowUp, nessuna Riprendi); manca
nel JSON originario e non viene confuso con simulationTime=60.

Il flow usa il helper CPU condiviso, quantizzato half 16³; il materiale usa
`sampleCloudDensity`, incluse le due soglie shader. MaskA è clamp con inset;
dettaglio RGB repeat; macro e flow clamp. Trasmissione usa entrambe le estinzioni.
RGB sorgente, aerial e film sono omessi perché non influenzano T; le loro lookup
condizionali vengono comunque contate. Tutti i raggi risultano sea miss e non
chiamano il solver terrain; non si è corretto il gate terreno della baseline.

Restano differenze concrete: filtri CPU ideali contro precisione GPU nativa;
flow CPU/half contro compute WGSL; reference e materiale con intermedi JS
binary64; f32 esplicito nei controlli ma nessuna emulazione di FMA, riassociazione
o tolleranze GPU di exp/pow. Possono cambiare soglie e punto di uscita. Non è una
prova di pixel parity o loop bit-identico sulla GPU. La stabilità delle due
griglie sostiene la classificazione generale, non l'esattezza di ogni contatore.

Per il prisma, i certificati sono selezionati senza sovrapposizione sul percorso
baseline: cloudH=emptyStep-stepSize, gate reference sotto iceStart e limite del
tratto pioggia vuoto. Nessuna densità positiva è osservata nei punti iniziali o
successivi selezionati, né R positivo fuori prisma. È un controllo sui campioni;
restano da qualificare continuità, padding/slab e replay f32 nella GPU. Il port
non applica né misura l'ottimizzazione. Tutte le partizioni/invarianti passano;
un eventuale passo<=0 renderebbe il risultato invalid anziché contarlo come
esecuzione completa. Nessun sorgente modello è cambiato durante bake/conteggi.

## Artefatti e riuso

- `prepare-data.ts`, `prepare-data.log`, `data/manifest.json`: generazione unica 27,21 s, cache e hash.
- `count-work.ts`: contatore senza chiamate generateVolume.
- `work-16x9.json` / `work-32x18.json`: risultati completi per raggio; log compatti affiancati.
- `input-control.json`: report originale completo, byte conservati.
- `source-snapshots/`: nove copie byte verificate del modello CPU/shader, con manifest. GPUSceneEngine è cambiato dopo i conteggi e non viene sostituito con una copia storica falsa; il suo hash al bake resta nei report.

Le 5 cache binarie occupano 109.092.864 byte (104,04 MiB), conservate fuori Dropbox.
Il preparatore rifiuta una nuova generazione se trova manifest o marker iniziale;
per rieseguire i conteggi basta il comando nel README. I tempi del contatore
sono solo accounting CPU, non confronto di throughput con il renderer.

- Contatore SHA256 `3f5d20d75db586b0d027cda1664bce9733ce5b735d1de8e06f5380bae1a0f810`
- Manifest cache SHA256 `dd4ecf24d7a5c17e8d8c9e9dda2b189658a33cdec34e1be8ac1bdbbf475604f8`
- Risultato16×9 SHA256 `24b2f7580f9a21d95f26867ffe6d67eba53ba10d27ca6a356c93666e29ed430c`
- Risultato32×18 SHA256 `2acd349b164d2d9b666d40245f0c696b449decaa92a2e01307b9d08c0bf9cc02`
