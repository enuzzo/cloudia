# Review v45 — narrow cloud limitata alla pioggia

16 ottobre 2026. Sola lettura dei quattro sorgenti attuali e delle prove locali.
Nessun nuovo test, benchmark, bake o accesso GPU; nessuna modifica prodotto.
**Nessun difetto concreto bloccante rilevato.** Le copie `v45-source/` coincidono
con i file letti. Questa review riguarda v45, non promuove il renderer.

Il gate è `if(hasRain)`, con `hasRain = weather.z>.001 && bounds non degeneri`.
Indice e `textureLoad` R8 sono dentro il ramo: non c’è un `select` che valuti
sempre il load. In asciutto `narrowSupport=1` conserva il percorso cloud.
`textureDimensions` rimane fuori dal ramo, senza caricare texel. Il gate è
uniforme fra i frammenti; non dipende dall’etichetta Sole/Pioggia dell’interfaccia.
Con pioggia attiva vale per l’intero percorso cloud, anche fuori `rainRegion`:
è la variante hasRain richiesta, non un nuovo ritaglio dei segmenti.

Il punto certificato resta `local=reference-flowValue.rgb`, prima del fine warp;
la medesima coord alimenta narrow e macro. Il builder legge ogni rawR>0, ignora
GBA e conserva il padding r2 verificato a256/128, con guard1m. Un load zero prova
soltanto raw/densità zero nel punto. Broad alpha, flow, ice, t/ds/jitter, pioggia,
macro gate .002, microerosione, ghiaccio, alba e sorgente restano invariati.
Probe3 usa flow zero; probe4 usa fine=.6: entrambi mantengono il warp entro il
massimo coperto. Clamp float prima del cast e min(dims−1) coprono anche coord=1
ed esterno finito. La prova non si estende automaticamente ad altre risoluzioni.

Dimensioni non qualificate o payload macro malformati producono una R8 tutta255;
assenza del campo legacy produce in engine1³[255]. Nessun falso vuoto deriva da
questi fallback. Il worker trasferisce i tre buffer originali e la nuova R8 una
volta ciascuno. L’RGBA scratch non è trasferita né persistente. Upload RedFormat,
UnsignedByteType, Nearest e noMip sono coerenti con textureLoad. `configureIntegrator`
passa il relativo TextureNode; installVolume dispone oldNarrow dopo lo swap.
Packet mai installati passano da disposeCloudTextures; releaseGPU dispone soltanto
la narrow installata ed è idempotente. I rami destroy-before-install, drain
interrotto e drain rifiutato non mostrano nuovi percorsi di doppia dispose.

Le prove disponibili sostengono la sicurezza locale, con limiti precisi:

- `product-builder-verification.json`: builder prodotto byte-identico alla R8
  congelata ad38c2… da macro esistente,2.097.152byte; nessun nuovo volume.
- `gpu-audit/result.json`:62.544 query finite (49.344 reali +13.200 sparse),13.668
  narrow-zero, nessun macro positivo escluso, nessun nonfinito. È il certificato
  point/warp originario pin v44, identico nelle espressioni locali di v45;
  non esercita il nuovo ifhasRain, il flow compute o la pipeline Three completa.
- `browser-image-parity.json`: JPEG CSS A/B identiche nello stato statico rain
  t60 v44; non native framebuffer, moto, tutti i seed o nuova pipeline v45.
- Test mirati precedenti:12builder/worker e19lifecycle, con typecheck corretto.
  I mock lifecycle verificano binding/lista transfer/dispose, non detach nativo
  né esecuzione shaderGPU. Nessuna nuova verifica eseguita da questa review.

Le coppie preliminari v44 hanno camera, output2560×1440 e t60/pausa uguali:
pioggia13,9992→15,5151 invii/s (+10,829%); Sole near23,1395→20,4760 (−11,511%).
Sono **invii**, non presentazione. Il tab terreno30 bloccato/stato dispositivo
non controllato resta un confondente dichiarato. Questi numeri motivano v45 ma
non ne misurano il risultato; non dimostrano una causa GPU specifica.

🌟 Il rischio concreto ancora aperto è prestazionale: in Sole restano binding,
risorsa/layout shader e una diramazione uniforme, anche senza lookup nel percorso
sorgente. Il compilatore può produrre costi diversi; **v45 non garantisce per
analisi il recupero dell’11,51%**. Servono compilazione/app v45 e una coppia
pioggia + una Sole near a stato identico, con contesto dispositivo dichiarato.
Conservare distinta la provenienza: `product-provenance.json` e le misure sopra
sono v44; gli hash v45 seguenti identificano solo il codice di questa review.

| Sorgente v45 | SHA256 |
|---|---|
|narrowCloud.ts|`6b3ebc7e3299d1ae995405e75ad04f90190789605136200d72d0cd4ea51e9759`|
|cloudShader.ts|`781c2783d00430c65219733bd95a7ef25774dd058ed9418ea7c7d3f1f31a3186`|
|GPUSceneEngine.ts|`3eba1a81a1330ccf814514819635c079dbcdeb830b555edb9cee0f797cf695f1`|
|volume.worker.ts|`19ce4dae52d881d453953b70bac07bf56cd1d9cc99cfa68237ecf58767069bb7`|
