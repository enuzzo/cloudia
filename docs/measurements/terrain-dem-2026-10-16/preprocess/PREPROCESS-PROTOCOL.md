# CDM1 preprocess autorizzato — contratto prima dell'esecuzione

Una sola asset esterna, nessuna normalizzazione verticale, erosione o rumore.
Input:quattro TIFF già congelati in tiles-manifest.json. Nessun nuovo tile.

- N1025, nodi estremiX/Z−64,+64 km, spacing0,125 km; origine44N10E.
- Proiezione imposta dal root:equirettangolare locale, non geodesica esatta:
  lat=44+z/111.1950802335;
  lon=10−x/(111.1950802335*cos44°). X Ovest, Z Nord; righe Z crescenti.
- Bilineare sul mosaico globale PixelIsPoint. Tiepoint=center(0,0), nessun+.5.
  Nessuna bilineare clampata separatamente per tile.
- Quote in metri EGM2008, senza aggiunta del geoide o esagerazione. Valori
  negativi clampati0. Oceano=H<0,5 m connesso al bordo con4-vicini, poi H_oceano0.
  Sono esclusi dall'oceano i bassi interni non connessi; approssimazione dichiarata.
- Costa:trasformata euclidea separabile esatta verso il centro campione opposto,
  meno mezzo passo62,5 m, positiva a terra/negativa nell'oceano. È una distanza
  alla costa raster approssimata, non alla costa vettoriale reale. Quantizzazione8m.
- Huint16=roundEven(H_m/.125); H_km=code*.000125. Coastint16=roundEven(d_m/8).
  Eventuale saturazione, NaN/NoData o H>3310m deve fallire, non essere nascosta.
- CDM1:magicASCII4B; sideu32LE@4; spacingKmf64LE@8; minXf64LE@16;minZf64LE@24;
  poi Huint16LE row-major, poi coastint16LE. Rawatteso4.202.532 byte.
- Conservare raw+gzipmtime0, input/output/scriptSHA, licenzaGLO90 pp18–20 separata,
  credito/disclaimer esatti, audit seam/centri/corner/minmax/mask/quantizzazione,
  immagine scientifica DEM/costa e profili. Nessun cambiamento nei128km del DEM
  oltre queste trasformazioni; blend48–64 riguarda il parser del renderer, non
  l'asset. Nessun trial GPU o accettazione fotografica/FPS da questo preprocess.

Il metodo EDT usa l'inviluppo inferiore di parabole1D per colonne e righe,
derivato dal problema min_q(f(q)+(p−q)²). Implementazione originale, nessun codice
copiato; riferimento primario Felzenszwalb/Huttenlocher2012:
https://cs.brown.edu/people/pfelzens/papers/dt-final.pdf . Un test indipendente
brute-force su piccole maschere precede l'EDT1025²; non è uno sweep del DEM.
