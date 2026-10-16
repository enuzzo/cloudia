# Sentinel-2 annuale 2021 — fattibilità per la palette del terreno

**Accesso e costo verificati; utilità cromatica non ancora verificata.** Solo HEAD e
quattro prefissi TIFF da 48 KiB: **196.608 byte Range totali**, sotto 256 KiB.
Le due liste S3 per latitudine sono altri 11.625 byte XML; la prima lista esplorativa
è circa 2 KiB. Nessun blocco immagine richiesto appositamente o decodificato, nessun
preprocess, installazione, backend, modifica prodotto o GPU. I prefissi possono
contenere byte compressi iniziali non usati dal lettore di metadati.

## Dato effettivo e ritaglio

La [pagina ESA](https://esa-worldcover.org/en/data-access) e il
[registro dei compositi](https://registry.opendata.aws/esa-worldcover-vito-composites/)
confermano mediane annuali L2A, bucket pubblico `esa-worldcover-s2`, CC BY 4.0.
Servono quattro COG: N43/N44 × E009/E010, non la singola tessera 3° del landcover.
URL osservati, HEAD, ETag, Content-Range, SHA dei prefissi e tutti gli offset sono in
[metadata-probe.json](metadata-probe.json). I quattro oggetti interi sommano **1.495.656.797 byte**.

Il TIFF reale specifica 12000², EPSG:4326, PixelIsArea, passo esatto 1/12000°,
uint16, DEFLATE/Predictor 2, interleave per pixel. **Ordine effettivo: B04 rosso,
B03 verde, B02 blu, B08 infrarosso**, confermato nei metadati: non invertire rosso/blu
seguendo l'elenco generico delle bande. Scala 0,0001 e offset 0 sono già del composito:
non aggiungere nuovamente offset radiometrici dei prodotti L2A originali. NoData 0.

| Livello sorgente | Passo N/S × E/O a 44° | Blocchi / Range ROI | Byte compressi ROI |
| --- | --- | ---: | ---: |
| Nativo 12000² | 9,27 × 6,67 m | 300 / 30 | 531.206.069 |
| Overview 4, 3000² | 37,07 × 26,66 m | 24 / 4 | **71.091.595** |
| Overview 8, 1500² | 74,13 × 53,32 m | 12 / 4 | 28.332.389 |

Stime dai byte-offset reali, non download eseguiti. Il NIR è interleaved e non può
essere evitato leggendo solo RGB. Per 2048² sul dominio ±64 km, cioè 62,5 m/cella,
**overview 4** è il taglio concreto: evita di ingrandire pixel N/S più larghi dell'output.
Metodo di generazione overview/validità ai bordi ancora da qualificare. Medesima
proiezione equirettangolare del DEM, X Ovest/Z Nord; campionare attraversando i
quattro confini, senza clamp indipendente delle tessere.

RGB8 contiene **12.582.912 byte (12 MiB)**; una rappresentazione GPU comune RGBA8
con validità richiede 16 MiB, esclusi eventuali mip. Compressione di trasporto non
misurata. I 24 blocchi contengono circa 192 MiB decompressi complessivi, elaborabili
in streaming con un blocco 8 MiB: non occorre il mosaico nativo intero in RAM.
Queste sono dimensioni, non una misura di costo GPU o FPS.

## Ottica, gamma e proposta circoscritta

È riflettanza di superficie corretta per l'atmosfera, **non albedo/BRDF indipendente
dalla vista e dal sole**. Sen2Cor può correggere effetti topografici, ma la fonte
ufficiale descrive anche sovracorrezioni blu nelle zone in ombra e discontinuità:
non è garantito uno “shading rimosso”. [Copernicus: prodotti L2A](https://sentiwiki.copernicus.eu/web/s2-products).
La mediana annuale non rappresenta una sola data o illuminazione; non consente
una rimozione fisica univoca delle ombre. Il
[produttore VITO](https://remotesensing.vito.be/news/simplify-your-processing-worldcover-annual-composites)
segnala possibili residui di nuvole/neve e dati corrotti. Senza pixel decodificati
non conosciamo la copertura valida nella regione; NoData S2 non è il NoData WorldCover.
Acqua, riflessi e ombre profonde non devono calibrare il colore del suolo.

DN×0,0001 è un valore lineare di riflettanza spettrale: non applicare sRGB-decode
come a una fotografia già codificata. Le bande RGB non sono automaticamente una
calibrazione colorimetrica sRGB. RGB8 lineare introduce errore di arrotondamento
≤0,001961 per canale: può essere rilevante nei verdi scuri. Qualunque codifica
sRGB per il trasporto richiederebbe una sola conversione dichiarata e il relativo
decode; non un gamma 2,2 arbitrario o stretch diversi per tessera.

**Un solo prossimo esperimento consigliato:** usare il ritaglio come riferimento
per una palette naturale per classe, non trasferire subito la luminanza fotografica
sul materiale. Da pixel validi delle classi 10/20/30/60 isolate dal landcover conservato,
calcolare una cromaticità mediana robusta `c=normalizeY(median(RGB/Y))`, con maschere
fissate prima del run, poi `paletteNuova[k]=Y(paletteAttuale[k])*c[k]`.
Si preservano la luminanza della palette e tutta l'illuminazione della mesh, senza
incollare ombre, strade o campi nella texture. È una scelta autoriale guidata dal dato,
non recupero fisico di albedo. Coltivi/costruito restano esclusi dalla palette naturale;
classe 10 continua a includere oliveti/piantagioni, non certifica foresta naturale.

Qualifica minima prima del trial: validità/NoData, seam e colori delle quattro tessere,
statistiche per classe, esclusione acqua/nuvole/ombre estreme, errore RGB8 e nessuno
stretch locale. Poi un confronto congelato Sole/Tramonto, mantenendo geometria,
luminanza e luce identiche: decidere se la cromia aiuta davvero. Nessuna previsione
positiva sulla qualità è dedotta dai metadati. Credito ESA WorldCover 2021 e modifiche,
CC BY 4.0 e citazione DOI restano necessari, come già archiviati per WorldCover.
