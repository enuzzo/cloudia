# Prossimo candidato: GLO-30 a 62,5 m, con costruzione statica limitata

17 ottobre 2026. Studio di fattibilità; nessuna mesh, prova GPU o modifica al prodotto eseguita qui. Il controfattuale albedo di root rende ragionevole indagare anche il rilievo: non dimostra però che la fonte DEM sia la causa unica delle grandi campiture o dei versanti arrotondati.

**Propongo un solo candidato:** quote reali GLO-30 ricampionate a **62,5 m** sul medesimo quadrato di 128 km, stessa altimetria 1× e stessa proiezione. Conservare materiale, WorldCover, normali geometriche e algoritmo di raffinamento v59; preparare e validare la mesh **offline**, poi caricare i buffer statici nel browser. Nessun nuovo noise, erosione sintetica o passaggio per frame. Preparazione raster, mesh e integrazione sono autorizzate dal task generale e restano da implementare e qualificare; root ha scelto un preflight unico20sCPU/40swall/2GiB e i cap finali1M V/2M T/64MiB prima del bundle statico.

## Dati effettivamente disponibili

Il [catalogo AWS](https://registry.opendata.aws/copernicus-dem/) offre GLO-30 Public senza account, come COG della **release 2021**: non va chiamata la release più recente di CDSE. Ho verificato il 17 ottobre quattro HEAD HTTP200 e quattro Range HTTP206 `bytes=0-8191`, **32.768 B complessivi**: nessun blocco raster decodificato in questo studio. Tutte le tile necessarie sono pubblicamente raggiungibili.

Prefisso `https://copernicus-dem-30m.s3.amazonaws.com/`; ogni oggetto usa il nome sottostante sia come directory sia come basename `.tif`:

| Nome | Bytes intero oggetto da header | ETag osservato |
|---|---:|---|
| `Copernicus_DSM_COG_10_N43_00_E009_00_DEM` | 275.853 | `a4357a39508e267e708bb5f6aaab8af6` |
| `Copernicus_DSM_COG_10_N43_00_E010_00_DEM` | 31.619.637 | `dbe27f5719000b024c3a84a37954f29b` |
| `Copernicus_DSM_COG_10_N44_00_E009_00_DEM` | 35.799.772 | `a6697d98be1bbeb2363c41b6bc5fc845` |
| `Copernicus_DSM_COG_10_N44_00_E010_00_DEM` | 45.578.379 | `0cb06a9eeee0cc51b7cf1e8d2a2f3b61` |

Totale **113.273.641 B**, circa108 MiB. ETag è un identificatore HTTP, non lo SHA256 degli originali. Gli header TIFF letti confermano in tutti e quattro i casi **3600², Float32, PixelIsPoint, passo 1/3600°**, tiepoint a `(E009/E010,N44/N45)` al centro del pixel(0,0). A44°N un secondo d'arco corrisponde nella nostra proiezione a circa30,888 m Nord–Sud e22,219 m Est–Ovest. La [documentazione del bucket](https://copernicus-dem-30m.s3.amazonaws.com/readme.html) spiega la rimozione della riga Sud/colonna Est condivise: niente offset artificiale di mezzo pixel, niente clamp separato ai seam. Il token `10` distingue GLO-30 dal `30` dei file GLO-90, non è un passo di10m.

La [licenza ufficiale GLO-30-F](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf), artt.3–6, permette riproduzione, distribuzione e modifica, con credito per il dato modificato, disclaimer e obblighi verso i destinatari. Va aggiunta al pacchetto/notice senza rimuovere GLO-90 e WorldCover. Il [cambio CDSE del28 luglio2026](https://dataspace.copernicus.eu/news/2026-7-17-copernicus-dem-30m-view-service-license-acceptance) riguarda l'accesso al suo **View Service**: non invalida i quattro accessi S3 osservati. Usare questi oggetti espliciti, evitando API che sostituiscano silenziosamente tile30 mancanti con90.

È ancora un **DSM**: vegetazione, edifici e modifiche del prodotto possono restare nelle quote. Non diventa DTM, bosco tridimensionale, roccia erosa o rilievo a precisione verticale30m. La descrizione [Copernicus](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) distingue superficie, risoluzione, datum e accuratezza.

## Perché62,5m e perché non basta cambiare il file

Origine44N/10E; X Ovest, Z Nord; nodi estremi±64km. Core misurato±48km, transizione48–64 invariata. Intervallo geografico attuale: lat43,4244349672–44,5755650328; lon9,1998704472–10,8001295528. Quote ortometriche EGM2008, mare sferico e quantizzazione0,125m invariati. **125m è il passo di ricampionamento attuale di GLO-90**, non la risoluzione nativa della fonte.

| Reticolo sullo stesso dominio | Nodi asset | CDM1 raw, header32+4N² | Nodi nel core±48 |
|---|---:|---:|---:|
|125m attuale|1025²|4.202.532 B|591.361|
|**62,5m proposto**|2049²|**16.793.636 B**|**2.362.369**|
|31,25m rinviato|4097²|67.141.668 B|9.443.329|

62,5m mantiene dettaglio proveniente dalla fonte30m con un aumento4× dei nodi;31,25m costerebbe16× rispetto al125m e non elimina il limite della triangolazione. Nessuna interpolazione di GLO-90 può sostituire la nuova fonte.

`terrainDem.ts:11–23` accetta già fino a4097², ma durante il decode convivono raw e nuovi array: circa32MiB nominali per il62,5m contro128MiB per31,25m, esclusi altri oggetti/temporanei. `GPUSceneEngine.ts:258–262` limita invece i probe a600.000: **un semplice swap del DEM62,5m fallisce**. Non alzare quel limite nel percorso normale del browser né abbassare qualità per farlo passare.

## Costruzione proposta e limiti

Preparare una volta, fuori Dropbox/runtime, con il builder attuale: griglia base256celle/9livelli/passo32m, normali geometriche; selezione errori>5m sui2.362.369 nodi del nuovo core, una sola passata red/green con midpoint condivisi. Conservare il cap finale **1M vertici /2M triangoli /64MiB**; overflow deve fermare il candidato, mai troncare selezione, ridurre il dominio o passare a GLO-90. La soglia5m è un criterio ingegneristico già esistente, non un certificato di errore finale.

Base senza refinement:465.409V/929.792T. Bound combinatorio di una passata: T≤**3.719.168**; bound grezzo V≤**3.254.785**. Il cap applicativo è più stretto e non sappiamo ancora se il nuovo dato vi rientra. Con i cap V/T il payload geometrico `32V+12T` è al massimo**56.000.000B**; lookup CPU per celle2.949.120B. Sono payload, non picco RSS o memoria del driver. Mesh attuale:591.788V/1.182.550T/33.127.816B. Una griglia uniforme62,5m su tutto il core richiederebbe già oltre4,7M triangoli: non è questa proposta.

Salvare posizioni/normali/surface/indici + cellFirstIndex/cellTriangleCount e metadata/hash. Caricarli con cap e AbortSignal tramite un ingresso `TerrainMeshData` prevalidato: oggi `terrainMesh.ts:408` chiama sempre il builder. `terrainSample` è usato dall'Engine solo per costruzione; camera/collisione leggono poi `surfaceY` dalla mesh. È quindi fattibile evitare la ricostruzione costosa per nuovo owner/worker. Asset assente/corrotto: errore esplicito, **nessun rebuild denso di emergenza**. Sorgenti e programma offline conservati per rigenerare il bundle.

La mesh non diventa uniformemente62,5m: una sola divisione porta facce512m a256m, e le celle base32m non coincidono con31,25m. Questo limita il guadagno possibile sui crinali lontani. Se il cap fallisce o la mesh continua a perdere il dettaglio, serve una decisione separata sulla rappresentazione; non si deduce che GLO-30 sia inutile.

La costa attuale è una distanza derivata da H<0,5m connesso al bordo, non una costa certificata. Il solo asset CDM1 nuovo può ricalcolarla a62,5m per conservare il metodo originario, ma va confrontata alla vecchia maschera. Per un futuro A/B **solo geometria**, comporre le nuove quote con il vecchio campo coast125m, anziché attribuire al rilievo anche cambi della spiaggia/acqua. Non nascondere questo confondente quantizzando una maschera diversa e chiamandola identica.

## Gate prima dell'eventuale adozione

1. **Asset:** originali interi+SHA256, header/datum/NoData, mosaico unico senza mezzi pixel; estremi/seam/corner/origine; quantizzazione≤0,0625m senza saturazioni. Vecchio e nuovo raster confrontati sugli stessi1025² nodi, separando terra/mare della vecchia maschera. Delta tra DSM non è errore contro terreno vero.
2. **Mesh offline:** conteggi, cap, indici/celle contigui, winding, edge condivisi, normali finite/unitarie, bounds e lookup; tutti i nodi fit più un holdout prefissato di147.456 centri di celle62,5m (una ogni4 per asse nel core), non scelti dopo aver visto il risultato. Confronto contro il GLO-30 nativo bilineare: misura perdita rispetto alla fonte, non accuratezza geografica indipendente. Budget CPU/wall/RSS del run da congelare prima; nessun tentativo automatico con cap rilassati.
3. **Nativo:** stessa camera world, sole/pioggia/tramonto, t60 fermo, output e qualità256³/128³/384 invariati; baseline ordinary autenticata prima. PASS richiede crinali/impluvi più credibili senza nuove ondulazioni, spike, reticolo, costa o shadow regression. Il dettaglio di vegetazione/edifici nel DSM non va celebrato come roccia. Un numero RMS o un crop favorevole non costituiscono PASS artistico.
4. **Costo:** cachev60 può riusare un raster stazionario; navigazione, cambio sole e invalidazioni devono ridisegnare terreno/ombre più grandi. Misurare separatamente fermo e movimento con A/B/A; qui nessuna previsione di FPS o promessa60.

Riferimenti locali riletti: `terrainDem.ts:11–79`, `terrainMesh.ts:92–108,207–295,408,484`, `GPUSceneEngine.ts:257–262,337–339`; `docs/TERRAIN-MEASURED-2026-10-16.md`, `docs/TERRAIN-SOURCE-REFINEMENT-2026-10-16.md`; `cycle19/dem-feasibility/{PREPROCESS-PROTOCOL.md,preprocess-dem.py,preprocess-result.json}`. Riferimenti relativi al checkout/snapshot, nessun file prodotto modificato.
