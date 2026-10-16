# S2 2021 — protocollo unico prima del run

Solo archivio esterno: nessuna modifica prodotto, quota, backend, dipendenza, GPU
o build. Si produce una riflettanza di riferimento utilizzabile, non albedo fisica
né una promozione artistica. Nessuno sweep o ritocco successivo delle soglie.

## Sorgente e download

Riutilizzare piano e metadati congelati nel ciclo 20: quattro Range overview 4,
24 blocchi, esattamente 71.091.595 byte. Limite 80.000.000 byte e 90 s totali,
30 s per richiesta, nessun retry automatico. Ogni risposta deve essere 206,
If-Match inviato, ETag/Content-Range/lunghezza esatti. Conservare tutti i Range
originali e SHA256/header; ETag multipart non è SHA dell'intero oggetto.
Scrittura a chunk da 1 MiB, nessun caricamento dell'intero Range o mosaico in RAM.
Una failure conserva il parziale e interrompe il processo, senza rerun automatico.

## Decoder e geometria

TIFF uint16 little-endian, quattro campioni interleaved per pixel, DEFLATE e
Predictor 2. Ricostruire somme orizzontali per canale modulo 65536, azzerando la
dipendenza all'inizio di ogni riga. Ordine verificato: B04 rosso, B03 verde, B02 blu,
B08 NIR. Scala 0,0001, offset 0; non riapplicare offset di altri prodotti L2A.

Overview4: ciascuna tessera 1° ha 3000² pixel, PixelIsArea. Il mosaico di indici
globale ha lon 9–11 / lat 43–45; j=(lon−9)*3000, i=(45−lat)*3000. Si decodifica un
blocco 1024²×4 uint16 per volta (8 MiB), senza allocare il mosaico intero.

Target 2048² celle, 62,5 m, bordi world ±64 km; righe Z Sud→Nord, colonne X Est→Ovest.
Stessa equirettangolare del DEM: lat=44+z/111.1950802335,
lon=10−x/(111.1950802335*cos44°). Entrambi gli assi cambiano verso rispetto al raster.
Overlap rettangolari esatti nel piano locale in float64; non area geodetica o
superficie del versante. Ogni pixel sorgente interseca al massimo 2 celle per asse.

## Validità e output

Pixel ammesso se **tutti e quattro i DN sono fra 1 e 10000 inclusi**. Questo gate
conservativo elimina anche pixel fisicamente molto scuri se una banda vale 0:
registrare separatamente all-zero, qualsiasi-zero e oltre 10000, senza correggerli.
Non viene presentato come maschera di nuvole. I campioni invalidi contribuiscono
alla copertura geometrica totale ma non alla somma RGB o all'area valida.

Per ogni cella: somma RGB*area su pixel validi, divisa per area valida. Se questa
è 0, RGB 0 e validità 0 separata. Output `rgb-linear.f32`: Float32LE, 2048²×3 RGB
interleaved,50.331.648 byte. Output `valid-area.f32`: Float32LE, 2048² frazioni
di area valida,16.777.216 byte. Raw più gzip mtime0, compressione streaming.
Schema e proiezione dichiarati nel risultato. Budget di picco RSS 384 MiB.

## Prove congelate

Prima del dato: decoder Predictor 2 contro encoder e decoder scalari originali,
overflow uint16/reset riga; overlap esaustivo su 16 celle / 63 pixel con assi inversi,
RGB distinti, all-zero, singolo canale 0 e NIR>10000. Intero e partizionato devono
coincidere con errore<1e−12. Copertura geometrica reale 1±1e−9; RGB Float32 errore
assoluto≤2^-24 rispetto al mean float64; nessun NaN/Inf o valore negativo.

Cinque witness reali: i quattro parent WorldCover già congelati delle classi
10/40/50/60, con child RGB(2*x+1,2*z+1); quinto=primo massimo row-major di v*(1−v),
per verificare validità parziale se esiste. Se non esiste, dichiararlo senza cambiare
selezione. Oracle distinto in coordinate pixel native, record di tutti i DN/pesi;
errore di somme pesate e mean<2e−10. Stesso decoder DEFLATE, non finto secondo stack.

## Statistiche cromatiche e diagnostiche, senza correzioni del campo

Campionamento palette prefissato: lattice target x,z=2 mod 4 (passo 250 m), massimo
262.144 candidati. Classi 10/20/30/60 dal WCV1 congelato, parent=floor(target/2).
Maschere: validità≥0,99; classe≥0,95; somma NoData/crop/built/acqua≤0,01.
Luminanza proxy Y=0,2126R+0,7152G+0,0722B nel range [0,02;0,60]. Escludere dai soli
campioni palette il flag grigio-brillante minRGB≥0,25 e maxRGB−minRGB≤0,12.
È un'euristica cloud/neve, non un classificatore o dato SCL. Tutto il campo RGB
resta conservato senza queste esclusioni. Fornire conteggi di ogni esclusione.

Cromia robusta=mediana per componente di RGB/Y, poi normalizzata a Y1; anche
RGB/Y percentili 10/90 e mediane RGB e Y separate. Sotto 256 campioni segnare LOW_N,
senza inventare fallback o cambiare maschere. Classe 10 include oliveti/piantagioni;
la classe 125 m può contaminare il footprint RGB 37 m, caveat sempre esplicito.

Seam: differenze RGB dei campioni adiacenti alle linee x0/lon10 e z0/lat44,
solo validità≥0,99; confronto diagnostico con 14 linee vicine entro 8 celle.
Statistiche mediana/p95/max; non chiamare differenze di terreno adiacente una prova
causale di errore radiometrico. Non livellare colori fra tessere.

Figura: **un solo gain globale 3**, clipping 0..1 e OETF sRGB standard a tratti,
esplicitamente visualizzazione e non codifica del dato lineare. Evidenziare NoData
e riportare clipping; non ritoccare lo stretch se il risultato è debole. La figura
deve conservare anche le aree costruite/coltivate osservate, senza fingere wilderness.
Nessun claim albedo, rimozione fisica delle ombre, GPU, FPS o obiettivo risolto.
