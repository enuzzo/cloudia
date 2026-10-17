# Una prova materiale: tessitura ottica S2 osservata sul v60 canonico

17 ottobre2026. Proposta e ricognizione limitata dei dati già acquisiti; nessun
download raster, preprocess, mesh, test, GPU o modifica prodotto. Geometria
GLO90/refinement v59 e cache v60 canonici: il candidato GLO30 respinto non entra.

**Propongo una sola variante:** usare l'RGB lineare osservato come colore diffuso
spaziale delle classi terrestri note, con validità premoltiplicata prima del
filtraggio. Nessun gain, nuova palette, normalizzazione per classe, high-pass o
coefficiente da scegliere dopo l'immagine. Normali, rough, luce diretta/ambiente,
cast shadow, acqua, coast e nube restano quelli canonici. La sostituzione prova
se manca soprattutto la struttura geografica del colore; non aggiunge volume
ai boschi né dettaglio geometrico ai crinali.

## Dati disponibili, distinti dalle immagini di anteprima

Directory esistente: `Cloudia-QA-2026-10-16-cycle21/sentinel2-reference-r2/`.

| Campo persistito | Bytes | SHA256 già congelato |
|---|---:|---|
|`rgb-linear.f32`|50331648|`44205c43c1f243766716060b16e7f74948fba3a9366b6f38473d045c066a074e`|
|`valid-area.f32`|16777216|`e89361dccb2b50a515f08ee7fee8500bdd3a535bdce4f5ea6159a736120f12c7`|

Float32LE,2048² **celle**62,5m, bordi±64km, origine44N10E, X Ovest/Z Nord;
prima riga Sud/prima colonna Est. UV=(worldXZ+64)/128, flipY=false; centri
−64+(i+0,5)*0,0625km. Non applicare il gain3 o la OETF della figura di riferimento.

La fonte è RGBNIR annual median L2A2021, quattro COG/24blocchi overview4 già
scaricati. Il livello originale non viene ricaricato. L'output persistito è
**RGB+validità, non RGBNIR**: NIR è stato usato nel gate DN1..10000 ma non è
conservato come reticolo. Nessun NDVI può essere dato per disponibile qui.
RGB è media condizionale dell'area valida; non è già RGB×validità. Validità0
produce RGB0. È un reticolo62,5m derivato dagli overview acquisiti, non dettaglio
ottico originale10m. Restano ignote alcune proprietà radiometriche del resampling
degli overview: non convertirle in una pretesa di albedo fisicamente calibrata.

Ho controllato dimensioni e letto soltanto i cinque witness già fissati
(15Float32RGB+5validità,80B): coincidono con le medie salvate entro il rounding
Float32, massimo4,77e−9 RGB/5,19e−9 validità. Nessun nuovo punto scelto o scansione
del campo. La figura salvata mostra struttura di boschi, campi, cave/costruito,
ma anche contrasto dei versanti e zone non valide: è indizio di informazione
spaziale disponibile, non un giudizio sul risultato del renderer.

Il cross-tab esistente attribuisce soltanto0,1030km² invalidi alle classi diverse
da acqua/NoData contro5428,4935km² ad acqua/NoData. Il66,8665% valido non significa
33% di terra mancante. È una stima pesata con frazioni WorldCover, senza maschera
SCL ufficiale delle nuvole o intersezione con costa vera. I2333 pixel sospetti
grigio-brillanti della diagnostica sono un'euristica, non una maschera da inserire
in questa variante.

## Un solo trasferimento deterministico

Preparare offline, a strisce, una **RGBA16F2048²** NoColorSpace:
`Q=(RGB*valid,valid)`. Nessuna conversione sRGB, gain o clipping artistico.
Filtri LinearMipmapLinear/Linear, ClampToEdge, flipY=false; mip lineari creati
una volta. Il premultipliedAlpha upload resta false: il prodotto è già nei dati
e l'alpha rappresenta copertura valida, non opacità della montagna.

Usare le frazioni WorldCover esistenti, già raccordate48–64km. Nel materiale:

```text
U = authored * coverA.x
P = forest*coverA.y + grass*coverA.z + crops*coverA.w
    + built*coverB.x + rock*coverB.y + snow*coverB.z
K = coverA.y+coverA.z+coverA.w+coverB.x+coverB.y+coverB.z
Qf = textureSample(opticalRGBA16F, existingWorldUV)
albedoTrial = U + (1-Qf.a)*P + K*Qf.rgb
```

Q premoltiplicata permette il fallback nelle aree invalide e mip sui bordi senza
dividere per alpha, epsilon o bordi neri. Validità1 sostituisce il contributo
palette delle classi note con il colore osservato; validità0 riproduce la
palette. Unknown mantiene U; acqua coverB.w e mare conservano il ramo attuale.
Le frazioni note contengono già il blend misurato, quindi non moltiplicare K
ancora per lo stesso peso48–64. La prima prova mantiene anche campi/costruito
realmente presenti, senza riclassificarli in bosco. Annual composite e classi
non sono perfettamente coevi/coincidenti: i pixel misti restano un limite.

La formula ground e i suoi coefficienti restano byte invariati:
`albedo*(solar*.90*diffuse*visibility + ambient*1.12*skyVisibility) + water`.
Usare factory compile-time con default canonico esatto, owner separati A/B e
metadata immutabili della variante; nessun toggle uniform che riapra il problema
di parità dell'albedo R0. Questo è un uso sperimentale della riflettanza osservata
come colore diffuso, non una sua identificazione con albedo BRDF indipendente
dalla luce.

## Illuminazione incorporata: rischio da misurare, non da cancellare a intuito

Le [fonti ESA WorldCover](https://esa-worldcover.org/en/data-access) descrivono
compositi annuali dall'archivio L2A e scala RGBNIR0,0001/offset0; il
[registro AWS del produttore](https://registry.opendata.aws/esa-worldcover-vito-composites/)
conferma mediane annuali e licenza CC BY4.0. Le tre bande visibili sono trattate
come RGB lineare nel renderer, senza una calibrazione colorimetrica spettrale.

[Copernicus L2A](https://sentiwiki.copernicus.eu/web/s2-products) distingue
riflettanza corretta atmosfericamente e artefatti residui, compresa
sovracorrezione topografica in zone ombreggiate. Mediane di date/angoli/bande
diversi non forniscono un'unica direzione solare da invertire. Con i dati qui
conservati non esiste de-lighting perfetto: rilievo, ombre residue e BRDF possono
essere moltiplicati dall'illuminazione del renderer. Non ricavare un sole medio
dal DEM né dividere per il diffuse del sole corrente.

La scelta diretta senza gain rende il test leggibile e falsificabile. Il lato
opposto del Sole serve a cercare contraddizioni visibili fra ombre incorporate
e nuova luce, ma ogni macchia scura persistente può anche essere colore reale:
non è automaticamente prova di doppio shading. La variante va scartata se
produce versanti anneriti/incisi, fotografia appiccicata o falsa profondità.
Il vecchio R1 cromia unica per classe e R2 sole sei costanti non sono questo
modello: qui cambia la distribuzione spaziale osservata, con luminanza inclusa.

## Payload e lavoro aggiuntivo, senza previsione FPS

| Risorsa/lavoro | Aggiunta prevista |
|---|---:|
|RGBA16F base2048²|33554432B|
|11livelli mip extra|11184808B|
|Totale nominale12livelli GPU|**44739240B**|
|CPU persistente minimo per texel base|33554432B|
|Texture/sample nel frammento terreno|**+1 / da2 a3 textureSample**|
|Nuovi target o pass per frame|0|
|V/T/qualità nube/risoluzione|invariati|

I due Float32 sorgenti restano offline; non caricarli nel browser insieme alla
texture preparata. Input67,11MB e output33,55MB possono essere trattati a
strisce senza un duplicato dell'intero campo. Preparazione/validazione SHA e
mip iniziali non sono costo nullo: escluderli onestamente dalle finestre steady,
ma misurare startup/risorse separatamente. I44,74MB sono payload nominali,
non RSS, residency o overhead del driver.

Il +1 è un'istruzione di campionamento; filtraggio/mip possono richiedere più
accessi fisici, quindi non è un fetch GPU garantito. Cache hit v60 riusa il
raster senza quel draw; movimento, sole o resize invalidano e ne pagano il
costo. Aggiungere la texture al descriptor della cache e al disposal, mantenendo
chiavi di versione/sampler e invalidazione esplicita. Nessun upload per frame.
Anche da fermo la memoria maggiore può incidere: non prevedo FPS o gratuità.

## Gate congelati per l'unica prova successiva

1. **Prima dell'immagine:** autentica RGB/validità con gli SHA, layout/centri e
   cinque witness esistenti; pack half finito, QRGB=0 dove valid=0, errore di
   quantizzazione registrato. Fixture piccola con pixel invalidi/validi/misti
   e mip verifica algebra senza bordi scuri. Non riapplicare gamma o maschera
   clouds euristica. Geometria canonica: quattro buffer hash invariati; nessun
   GLO30, cambio normali, luce o shader nube.
2. **Integrazione:** default A deve riprodurre il v60 ordinario, inclusi PNG e
   fullF32 autenticati nella posa esatta. B conserva depth/alpha e camera;
   cached/fresh coerenti prima del giudizio. SHA/asset assente o mismatch:
   errore esplicito del candidato, senza fallback nascosto che falsi l'A/B.
   Typecheck, test di pack/ownership/cache e build APP→hero prima della GPU.
3. **Primo nativo Sole:** stessa camera costiera già fissata, t60 in pausa,
   full256³/128³/384/output nativo. Immagine intera e ROI terreno fissate prima.
   PASS richiede struttura di bosco/campi/affioramenti credibile e riduzione
   delle campiture uniformi, senza griglia62,5/125m, seam, acqua contaminata,
   scaglie o semplice scurimento/saturazione. FAIL→stop prima worker/meteo/FPS;
   nessuna seconda forza di blend, gamma o coefficiente da tentare qui.
4. **Solo se passa:** Sole opposto e Tramonto per rischio di doppia illuminazione,
   Pioggia per leggibilità/materiale, main/worker coerenti e console. I difetti
   geometrici e ombre già aperti restano separati; texture bella non li chiude.
   Poi A/B/A fermo e navigazione prefissata con stessa qualità e cache stats;
   misurare costo, senza inferire60FPS da payload o cache hit.

Crediti CC BY4.0 e trasformazioni da aggiungere al notice pubblico per questa
nuova texture distribuita: l'attuale testo dichiara esplicitamente che nessuna
texture ottica è distribuita e andrà aggiornato. Sorgenti e licenza originali
sono già nell'archivio; nessun nuovo download necessario.

Riferimenti locali: `terrainSurface.ts:160–203`, `GPUSceneEngine.createTerrain`,
`docs/TERRAIN-COLOUR-2026-10-16.md`; cycle21 `sentinel2-reference-r2/`:
`{README.md,preprocess-result.json,preprocess-sentinel2.py,source-witnesses.json,
palette-and-diagnostics.json,validity-by-worldcover.json,SOURCE-LINKS.md}`.
Questa nota propone il trial; non implementa, non modifica gli archivi e non
attribuisce accettazione artistica a un composito o ai suoi quantili.
