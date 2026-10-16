# Narrow-cloud: revisione indipendente della prova

2026-10-16. Solo lettura del prodotto. Nessun bake, GPU/browser o nuova misura.
Revisore cloud_anatomy; implementazione esterna posseduta da rain_landscape.

Esito: nessun blocco concreto rilevato nella geometria 256/128 o nel guard WGSL
esterno letto. È una review CPU/sorgente, non un PASS del renderer GPU. La patch
non contiene ancora l’integrazione engine/worker e non viene promossa qui.

## Contratto necessario

Una seconda mask 128³ R8, costruita dal macroR 256³ **nonzero**, viene letta sul
`local=reference-flowValue.rgb` dopo lo stesso flow baseline. Un suo zero può
saltare soltanto il corpo fine/warp/macro/material/light. Il calcolo ice rimane
prima del guard, come nella patch effettiva. Broad alpha mask,
cloudReference, flow, passo, t, jitter, rainRegion e pioggia restano originali.
Non è un nuovo certificato continuo e non autorizza emptyStep più lunghi.

La revisione preferisce `textureLoad` non filtrata, con index:

```
floor(coord * vec3f(textureDimensions(narrow)))
clamp(index, 0, dims-1)
```

Non `round`, non `coord*(dims-1)`, non una textureSampleLevel trilineare. La
lettura discreta elimina una nuova premessa sulla precisione dello zero filtrato.
Lo zero di un filtro GPU 3D universale non viene assunto né provato qui.

## Prova geometrica del punto, con i dati 256/128 attuali

Per asse, h è il texel mask e f=h/2 il voxel macro. Un corner macro positivo
ha centro distante al massimo h/4 dal centro della cella mask alla quale è
assegnato con floor(indexMacro/2). Una lookup macro trilineare positiva richiede
un corner positivo entro f per asse. Il fine warp sposta al massimo W per asse.
Quindi la distanza del local dal centro mask assegnato è al massimo:

```
Dlocal <= W + f + h/4 = W + .75h
```

Se il builder marca tutte le celle di indice k−r..k+r, la loro unione geometrica
arriva a (r+.5)h dal centro. Con r=ceil((W+f+additional)/h)=2 e additional=.001km,
il floor al punto local ricade in una cella marcata. Gli endpoint che danno un
peso macro zero sono inclusi nel bound, rendendolo conservativo.

|Asse|h mask|W massimo|r|Margine (r−.25)h−W|
|---|---:|---:|---:|---:|
|X|78,125m|80m|2|56,71875m|
|Y|66,40625m|60m|2|56,2109375m|
|Z|54,6875m|80m|2|15,703125m|

Il metro additional non cambia i raggi interi in questo caso. I margini
sopra derivano dalla geometria e non equivalgono a una qualifica numerica GPU.
Vanno confrontati con errori effettivi di coord/index/warp. Una tolleranza di un
codice UNORM8 sul fine, per esempio, aumenta il warp massimo di meno di 0,63 m,
ancora molto sotto il margine minimo; non dichiariamo quella tolleranza universale.

Il clamp deve essere esplicito anche per local fuori dominio. La macro baseline
usa clamp-edge: texel R positivi sul bordo devono marcare anche la cella mask di
bordo, così fuori dominio entrambe le lookup mantengono il medesimo bordo.
Non bisogna assumere i bordi sempre vuoti per una particolare famiglia o seed.

Il flow non richiede un ulteriore halo in questa mask: si certifica proprio il
local già spostato. Crescita/shear/vento hanno già prodotto reference; né il loro
Jacobiano né un bound dinamico in X sono richiesti per questo solo punto.
Questo ragionamento non si trasferisce a un intervallo successivo del raggio.

## Controlli di integrazione da leggere nella candidata

- Costruzione derivata dai byte macroR, ignorando GBA; nessuna soglia.002 o densità
  erosa che possa eliminare un contributor interpolato positivo.
- Broad detail alpha non sovrascritta dal bake della mask stretta; RGB detail,
  volume e cache luce invariati; stesso clamp/index nei bordi sintetici.
- Il guard comprende solo il corpo materiale dopo flow, senza modificare le
  variabili usate nel passo/pioggia. Nessun valore source/density non inizializzato.
- Assenza mask o fixture legacy deve scegliere il percorso originale, non vuoto.
- Upload R8 coerente con dimensione, mip0, un solo canale, array trasferito una
  volta; lifecycle/dispose/worker da verificare senza attribuirli alla prova CPU.
- 2 MiB è il costo persistente R8 CPU/GPU. Un builder che usa scratch RGBA8 e la
  difference array 3D di bakeOccupancy ha un picco temporaneo maggiore da esplicitare.

Il caso più importante di test è macroR=1/255 isolato, off-grid e sul bordo,
con coordinate su entrambi i lati dei confini delle celle e warp firmato estremo.
Includere la transizione ice e i modi diagnostici fine/flow disabilitati, che
possono cambiare il warp ma devono restare entro il medesimo massimo. Una prova
CPU finita non certifica la pipeline GPU; prima di promozione servono campioni
GPU avversari macro-positivo/narrow-zero, confronto immagini e misure abbinate.


## Pacchetto effettivamente letto

Tutti i file sono nella cartella di questa review. Non ho rilanciato builder o
contatore; ho letto sorgenti/report e verificato gli SHA dei file.

|File|SHA256|
|---|---|
|cloudShader.before.ts|d80225521258edb4beed2e713afe3c6b97fad5eca79d7dcdc657f9f47c1deddd|
|cloudShader.after.ts|b1dde880c8cc572dfebcf30825035c8c028925e75da52be05a64f214bbafbe93|
|cloudShader.patch|ae15a33194ba119ab45ca906f6e12f5c4b0df13f623284d37a5a6f69ee1d9599|
|build-narrow.ts|3dc9914bd2f7031dab320e44ea21f15de31b65512917d394c7a7876fd5c5c496|
|build-result.json|6d54e5bd02b4819e90077b135f98ccc3a3e038f8c409089ccf1b8ffff0ec4037|
|count-narrow.ts|2b4b5b833115ba307b73f7c00fbcf50c6aeb940751d85c4f8f1f3a38f564c67d|
|work-16x9.json|f06e71d5994286d0a04378bc04b9f7129e12c58770d95bc991717cac10797373|
|work-32x18.json|c4027b75c7ba9a2568cf2b1099ddd4c769ef1e69c452fa5f0caa404952246d47|

`cloudShader.after.ts:140–149`: broad/flow/local/coord/ice restano fuori dal nuovo
guard. Dimensioni hoist fuori loop; coord viene clampata prima della conversione
u32 e l’indice è limitato a dims−1. Il caso coord=1 carica quindi l’ultimo texel,
non un out-of-bounds. La parentesi a riga 200 racchiude tutto il corpo materiale;
`density=0` e `source=.65` sono già inizializzati. RainRegion e sampleStep sono
calcolati prima; t avanza negli stessi due punti del loop, senza nuovi continue.

Il builder usa uno scratch separato e non modifica macroR o il detail broad.
I raggi calcolati sono proprio 2/2/2. La verifica prefix dei cubi marcati è una
prova discreta utile: 861.511 corner macro positivi si comprimono in 114.575 seed,
tutti con il cubo r2 interamente marcato. Gli ulteriori 6.144 casi estremi 1D
coprono indici macro, segni supporto/warp e bordi, con f32 sull’indice. La prova
cartesiana separabile spiega perché non occorre enumerare tutte le loro triple.
Resta la premessa del footprint/range del macro sampler esistente, non nuovo.

Il contatore valuta comunque il raw/density baseline nei punti narrow-zero e
confronta candidata e baseline: non si limita ad assumere che siano vuoti.
Sul 32×18 trova 88.956 zero su 115.627 nuove letture; nessun raw positivo o rho
positivo rimosso, nessuna differenza T o hash della sequenza CPU. Il saldo è
177.912 letture fine/macro evitate meno 115.627 aggiunte = 62.285 chiamate,
4,919% del totale baseline. Il 16×9 dà 4,826%. La classificazione conserva le
limitazioni del port CPU originario e non equivale a risparmio GPU o FPS.

## Osservazioni materiali e limiti ancora aperti

1. La patch shader è coerente, ma engine binding, texture format/upload, transfer,
   legacy fixture/fallback e dispose non sono inclusi. Non sono stati verificati
   da questa review; sono gate prima di eseguire la candidata nel renderer.
2. Il margine h/4 e i raggi verificati valgono per macro256/mask128. Non estendere
   automaticamente la stessa prova a rapporti non interi o size diagnostici diversi:
   floor(indexMacro*coarse/fine) può avere uno scarto di centro maggiore.
3. Il primo controesempio r1 era vicino a un endpoint e poteva restare sotto
   il gate shader .002. Il proprietario lo ha rafforzato prima del congelamento:
   endpoint−.0017, raw=.4352, local=macroPoint+W e warpZ=−.08 coerente con
   fine.r=0/fine.b=1, erosione=.38 e rho=.0890323>gate. Ho riletto il nuovo
   builder/report con gli SHA sopra. L’indice resta 66, fuori r1 ma dentro r2;
   quindi ora mostra anche un possibile contributo materiale perso da r1.
4. Il builder diagnostico alloca scratch RGBA8, mask, difference/prefix e seed:
   circa 20 MiB di array temporanei distinti oltre agli array già caricati, con
   possibili picchi GC superiori. Il prodotto non deve attribuire tutto il picco
   CPU a soli 2 MiB; la risorsa R8 persistente è invece esattamente 2.097.152 byte.
5. La candidata conserva il campionamento e dovrebbe essere valutata con confronto
   GPU avversario macro-positivo/narrow-zero, immagini e benchmark abbinati.
   Nessuna promessa di guadagno o accettazione visiva deriva da questa review.


Conclusione operativa: la candidata merita una guardia GPU controllata se scelta
dal root, con integrazione e lifecycle ancora da verificare. Il certificato è
locale e non richiede ricostruire il flow o alterare la sequenza dei passi. Il
vantaggio CPU semantico è più sostanziale del raster rain non convesso, ma il
costo GPU della nuova lettura e della divergenza resta interamente da misurare.
