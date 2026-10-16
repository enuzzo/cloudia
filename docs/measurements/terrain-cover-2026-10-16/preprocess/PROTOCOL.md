# Protocollo congelato prima del run — WorldCover WCV1

**Un solo preprocess autorizzato, solo esterno al prodotto.** Nessuna installazione,
GPU, altezza modificata, cache cloud o sweep. Il successivo impiego nel renderer
richiederà una qualifica distinta. Non si convertono coltivi o costruito in foresta.

## Sorgente e budget

ESA WorldCover 2021 v200, tessera N42E009, EPSG:4326, classi native 36000².
Si riusano metadati e prefisso 64 KiB già letti e verificati nel ciclo 19; SHA nel freeze.
Il TIFF è PixelIsArea, 8 bit, DEFLATE/Predictor 1, blocchi 1024². La regione copre
il quadrato world ±64 km, senza un buffer del raster intero da 1,296 GB.

Scaricare solo i 15 Range contigui raggruppati degli offset osservati: 9.114.088 byte
totali, 300 blocchi sorgente. Ogni risposta deve essere 206, lunghezza e Content-Range
esatti sull'oggetto 72.420.601 byte, ETag uguale a quello congelato e If-Match inviato.
ETag multipart non è un SHA dell'intero oggetto; si registrano i SHA dei singoli Range.
Timeout totale 60 s, 15 s per richiesta; nessun retry automatico. Conservare i Range
originali e tutti gli header. Qualunque deriva sorgente blocca il run.

## Geometria e classi

Proiezione equirettangolare locale già concordata per il DEM:

```text
lat = 44 + z / 111.1950802335
lon = 10 − x / (111.1950802335 × cos(44°))
```

X aumenta verso Ovest, Z verso Nord. La sorgente ha colonne verso Est e righe
verso Sud: entrambi gli assi cambiano verso. PixelIsArea significa che il tiepoint
lon 9 / lat 45 è l'angolo esterno del primo pixel, non il suo centro. Ogni pixel nativo
è un rettangolo; ogni cella target 125 m riceve esattamente il prodotto degli overlap
dei due intervalli, in aritmetica float64. È area nel piano locale, non area geodetica
o superficie inclinata del versante.

Conservare 12 classi nell'ordine `[0,10,20,30,40,50,60,70,80,90,95,100]`:
NoData separato, alberi, arbusti, erba, coltivi, costruito, nudo/rado, neve/ghiaccio,
acqua permanente, umido erbaceo, mangrovie, muschi/licheni. Un codice imprevisto
è un errore, non viene rimappato a una classe nota. Il codice 10 può includere oliveti
e piantagioni; il codice 60 non distingue roccia da sabbia, suolo o cave.

Accumulo per blocchi in un istogramma float64 delle celle target. Ogni pixel nativo
copre meno di una cella target per asse: al massimo quattro contributi non nulli.
Non si interpolano numericamente gli ID. Budget di picco esplicito 256 MiB;
istogramma target 96 MiB, un blocco sorgente 1 MiB, temporanei locali limitati.

## Asset e quantizzazione

Header WCV1 di 32 byte: magic ASCII4, side 1024 u32LE@4, spacingKm 0.125 f64LE@8,
minX −64 f64LE@16, minZ −64 f64LE@24; poi 12 u8 interleaved per cella, row-major
Z Sud→Nord / X Est→Ovest. MinX/minZ sono bordi delle celle; centro=`min+(i+.5)*spacing`.
Questa convenzione è distinta dai 1025 nodi CDM1. Dimensione esatta 12.582.944 byte.

La somma geometrica deve essere 1±1e−9 prima di quantizzare. Si normalizza solo il
residuo di chiusura float64. Largest remainder: floor(f*255), poi distribuire i codici
mancanti ai resti maggiori; i pareggi seguono l'ordine dei canali. Somma finale 255
per ogni cella; nessuna classe assente può essere creata; errore per canale ≤1/255.
Raw più gzip livello 9 con mtime 0; preservare SHA di entrambi.

## Prove predefinite e diagnosi

1. Prima dei dati reali, oracle esaustivo originale su 16 celle target, 63 pixel
   sorgente e tutte 12 classi, con bordi frazionari e assi invertiti. Confrontare
   elaborazione intera e a blocchi; errore massimo<1e−12. Provare NoData one-hot,
   frazioni 1/2 e 1/3 e pareggi della quantizzazione.
2. Sui dati reali: classi ammesse, finitezza, non negatività, chiusura, somma 255,
   bounds degli overlap e quantizzazione; aree per classe prima/dopo; picco memoria.
3. Cinque witness reali, lista fissata `[10,40,50,60,80]`: per ogni classe scegliere
   il primo massimo row-major di f*(1−f), così si controllano celle miste.
   Oracle scalare distinto calcola tutti gli overlap dei pixel sorgente della cella
   direttamente in coordinate pixel native. Archiviare i singoli pixel con codice/peso,
   coordinate, 12 frazioni e 12 byte. Stesso decoder DEFLATE congelato, non fingere
   un secondo stack GeoTIFF indipendente. Errore frazioni<2e−10.
4. Tavola scientifica: distribuzione delle 12 classi e frazioni separate, crop/built
   leggibili; nessun uso di materiale/rendering per mascherare classi indesiderate.

Ogni failure si conserva e interrompe il percorso; nessuna modifica di soglie per
far passare la prova. La rappresentazione misura copertura di **classi**, non densità
fisica della canopia. Nessun vantaggio FPS, memoria GPU o fotorealismo dedotto.
