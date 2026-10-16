# Cloudia v54 — copertura reale del suolo

16 ottobre 2026. Prodotto locale `5d98655`. Goal attivo. Continuazione della richiesta di terreno e montagne credibili, dopo i rilievi [Copernicus v53](TERRAIN-MEASURED-2026-10-16.md).

## Cambiamento

Preferenza successiva del proprietario: a costo FPS equivalente mantenere la geografia reale, comprese le aree abitate. Queste sono pesi di materiale nella stessa mesh e nelle stesse due mappe; nessun edificio3D o pass aggiuntivo. Non è una nuova misura A/B delle palette. La preferenza aggiorna il precedente vincolo documentale di paesaggio senza elementi urbani.

Il DSM risolve la forma dei rilievi, ma non distingue boschi, coltivi e città. Il terreno usa ora **ESA WorldCover 2021 v200**, nella stessa proiezione e nello stesso dominio del DEM. La classificazione nativa a10m viene aggregata in 1024² celle da125m attraverso overlap rettangolari: ogni cella conserva dodici frazioni distinte, inclusi NoData, coltivi e costruito. Non si interpolano gli ID numerici delle classi.

WCV1: 32 byte di header, poi dodici frazioni uint8 per cella, somma255. **12.582.944 byte**, SHA256 `e7fa38f2b0a8c3c469737410dc8d265e680071226e663b3cb12b23930ebda5fc`. MinX/minZ sono bordi delle celle, diversamente dai nodi inclusivi del DEM. X cresce verso Ovest, Z verso Nord. Il materiale usa il dato puro entro ±48km e lo raccorda separabilmente alla distribuzione autoriale fra48 e64km.

Otto gruppi di materiale: sconosciuto, alberi, vegetazione bassa, coltivi, costruito, nudo/rado, neve, acqua. Arbusti/erba/umido/muschi confluiscono nella vegetazione bassa; mangrovie negli alberi. Le dodici classi originali rimangono nell'asset. Le palette diffuse e la micrograna sono autoriali: **non sono albedo ottica misurata**. La classe alberi include oliveti e piantagioni; nudo/rado può essere roccia, sabbia, suolo o cave. Acque interne influenzano il materiale senza spianare o modificare il DEM.

La prima prova campionava ai vertici: la mesh arriva a passi di256–512m in lontananza e poteva dilatare o perdere piccole aree classificate. **R1 è ritirata.** La versione r2 usa due texture RGBA8 normalizzate, filtrate per ogni fragment del terreno, con mip per la distanza. La somma degli otto pesi viene normalizzata dopo il filtro, poi raccordata al materiale esterno. Non dipende più dal passo dei vertici per collocare i materiali. Restano l'approssimazione del filtro mip, la quantizzazione e la risoluzione sorgente a125m; non si dichiara conservazione areale esatta dell'immagine renderizzata.

## Costi e integrità

Due texture core RGBA8: **8.388.608 byte base +2.796.200 byte mip =11.184.808 byte GPU nominali**, undici livelli. Restano8.388.608 byte di array CPU base; l'owner non trattiene il raster sorgente a dodici canali. Questi valori non misurano residenza o picco del driver. Il campionamento aggiunge due letture filtrate per fragment visibile del terreno, senza nuovi pass di rendering. Mesh, ombre, quote, camera e shader della nube sono gli stessi di v53; nessun nuovo campione di quota CPU per frame. Nube256³, dettaglio128³,384 passi nominali e output pieno conservati.

Caricamento DEM/cover con annullamento condiviso; errore esplicito se la copertura manca o non coincide con il dominio del terreno. Le due texture sono rilasciate una sola volta. Main e worker usano lo stesso codice e asset.

## Dati e verifiche

Il run esterno ha letto15 HTTP Range, **9.114.088 byte**, della tessera N42E009. L'ETag multipart non viene presentato come SHA dell'oggetto intero: sono conservati i SHA dei singoli intervalli. Elaborati300 blocchi in streaming,265.284.056 pixel sorgente inclusi i bordi parziali. Un run8,83s, picco251,30MiB. Le aree sono nel piano equirettangolare locale, non geodetiche né superfici inclinate dei versanti.

Tutte le1.048.576 celle sommano255. Un oracle distinto controlla16 celle sintetiche/63pixel; cinque celle reali miste sono ricostruite da1.436 pixel sorgente, errore massimo delle frazioni9,60e−13 prima della quantizzazione. Errore massimo di quantizzazione0,0030631, inferiore a1/255. Non è una misura dell'accuratezza della classificazione ESA. I2.134,043km² di NoData quantizzato ricadono interamente sul mare secondo la coast DEM ai centri delle celle; zero NoData sulla terra DEM. NoData resta distinto dall'acqua.

**341/341 test,43 file, typecheck e build app→hero PASS.** I test coprono asset/header/somme/orientamento e cinque witness, raggruppamento di tutte le classi, formato/filtro/mip delle texture, rilascio idempotente, errore e teardown durante il caricamento.

Browser r2: main Sole, Tramonto e Pioggia a2474×1844 nativi, stessa camera/tempo60s in pausa; worker Sole e controlli a pari canvas, nessun warning/errore console osservato. Preview principale su localhost:4196, stesso dist r2, Sole nativo e animazione ripresa. Le catture sono JPEG della superficie CSS, **non framebuffer nativi**. Si leggono abitati costieri e mosaico di coltivi/prati prima assenti nel materiale uniforme. Le forme misurate del terreno v53 sono conservate. **Fotorealismo complessivo ancora aperto**: grana, specie/struttura della vegetazione, materiali e dettaglio distante restano semplificati; ombre e rilievo hanno i limiti già documentati. Nessun PASS artistico globale dedotto da test, dati satellitari o contatori.

Misure main r2: Sole58,9319583invii/s (1768intervalli/30.000,7ms), Pioggia17,1989681invii/s (516intervalli/30.001,8ms). Entrambi i prefissi coda sono completati. Mediana/p95: Sole16,7/18,4ms, Pioggia50,7/67,2ms. Copertura timestamp completa/mancante: Sole1758/10, Pioggia511/5. Nessun campione mancante viene inventato.

Le misure finali e il controllo worker sono registrati nel pacchetto delle evidenze e nel [piano FPS](FPS-OBJECTIVE-2026-10-16.md). La cadenza misura invii rAF con prefisso coda completato, non la presentazione del compositore; non si attribuiscono miglioramenti percentuali da singole misure di versioni differenti. **60FPS sostenuti restano aperti.**

## Provenienza e continuità

[Accesso ESA WorldCover](https://esa-worldcover.org/en/data-access), [citazione DOI](https://doi.org/10.5281/zenodo.7254221), CC BY4.0. Credito e modifiche in `public/worldcover-data-notice.txt` e nella pagina combinata `terrain-data-notice.txt`, accessibile da Atmosfera. Nessun codice esterno copiato.

Evidenze curate e verificatore: `docs/measurements/terrain-cover-2026-10-16/`. Archivio completo dei Range e del preprocess: `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle20/worldcover/`,44 payload/25.986.734 byte, manifest SHA `81a918da49e0a68d1884641708431dac1a60755b2bdbfe81a96a6857cf483e54`. Snapshot r2:119 file sorgenti,30 file di build; manifest conservati. Pacchetto curato: 45 payload, 2479910 byte; manifest SHA `4a1196c020403933c05c636a1f5d79ea71b1f938e0e8371ddd0fc9db8d118ca6`; verificatore offline PASS anche su tutti i sorgenti e sulla build. Nessuna installazione o modifica dei lockfile; `node_modules 2/` preservato.

Alla chiusura del checkpoint v54 erano stati studiati soltanto metadata e Range plan dei compositi Sentinel-2, senza pixel decodificati. La continuazione [v55](TERRAIN-COLOUR-2026-10-16.md) esegue ora il ritaglio2048² e adotta una guida cromatica delle sole costanti, conservandone luminanza autoriale e variazione di tinta. L'immagine contiene illuminazione e possibili artefatti: non è albedo indipendente dal sole e non viene incollata nel materiale con le sue ombre. Lo studio iniziale resta conservato nella sottocartella `next/`.

Restano esterni il candidato congiunto corpo/spalla della nube r2 e il certificato esplorativo CPU per intervalli vuoti C0/R0. Nessuna loro promozione, GPU o vantaggio FPS derivati dalle prove CPU. Goal originario e obiettivo FPS attivi. Nessun push o deploy.
