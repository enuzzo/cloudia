# Cloudia — GLO30 e mesh statica: trial respinto

17 ottobre 2026. **La maggiore risoluzione dei dati migliora la fedeltà numerica alla fonte, ma non supera il gate fotografico.** Il prodotto resta v60; nessuna mesh GLO30 o nuovo caricatore è adottato. Nella candidata emerge inoltre una prima differenza fra target riusato e ridisegnato: viene conservata e indagata separatamente, senza trasformare la successiva lettura stabile in un PASS retroattivo.

## Dati reali e confronto controllato

Quattro originali Copernicus GLO30 Public della [release AWS COG2021](https://registry.opendata.aws/copernicus-dem/) coprono il dominio: 113.273.641 byte scaricati, SHA256 conservati, nessun fallback a GLO90. Sono DSM, quindi includono superfici di vegetazione e manufatti; non sono terreno nudo o una misura di precisione verticale30m. Il [readme del dataset](https://copernicus-dem-30m.s3.amazonaws.com/readme.html) documenta le righe/colonne condivise rimosse dai COG. Il mosaico usa i centri PixelIsPoint senza offset artificiale di mezzo pixel.

Ricampionamento bilineare a62,5m, 2049² nodi su±64km, origine44N/10E, X Ovest/Z Nord, EGM2008, altimetria1×. Core±48km e raccordo esterno invariati. CDM1 16.793.636B, SHA `79f84ba70848724549f65c4d4f6758041f10068dc9885156894c36e7bc2c4cd1`; Hmax2152,625m, quantizzazione≤.0625m, seam nei controlli≤.000272m. Preprocess unico:11,670453CPU/11,637260wall,920.977.408B picco RSS; budget180CPU/240wall/2GiB rispettato. Non è un benchmark del renderer.

Il nuovo campo costa cambierebbe855 classificazioni sui nodi coincidenti. Il builder usa invece **coast direttamente dal vecchio sampler125m** a ogni vertice/probe; non usa né EDT nuovo né la variante legacy ricampionata/requantizzata. La nuova triangolazione può comunque cambiare l'interpolazione raster di coast. I due CDM1 derivati e il confronto del campo sono conservati separatamente.

## Un solo preflight della mesh

Stessa base256celle/9livelli/32m, normali geometriche, una sola passata red/green su scarti>5m ai nodi della nuova fonte. Limiti offline prefissati:2,4Mprobe,1Mvertici,2Mtriangoli,64MiB geometrici; nessun troncamento o rilassamento. Nel browser il precedente cap600k non viene alzato: la mesh viene costruita fuori runtime e caricata come risorsa statica.

Prima della candidata viene costruito e autenticato il riferimento v60 contro i quattro digest storici di posizioni/normali/surface/indici. Il run completo, compresi controlli e salvataggio: **4,672694CPU /4,298412wall /1.061.519.360B picco RSS**, gate20CPU/40wall/2GiB PASS. La costruzione candidata nel processo dura2,352317s. Nessuna ricostruzione successiva della candidata.

| Misura | v60 | Candidata |
|---|---:|---:|
|Vertici|591.788|619.667|
|Triangoli|1.182.550|1.238.308|
|Payload geometrico|33.127.816B|34.689.040B|
|Lookup CPU|2.949.120B|2.949.120B|
|RMS sui punti terrestri di controllo|14,636787m|13,102917m|
|Massimo scarto assoluto campionato|116,149681m|117,501491m|

Il controllo usa147.456 punti prefissati fuori dai nodi del raster62,5m:384², coordinate `−48+(4i+.5)*.0625km`, i0…383, ordine Z poiX. Il riferimento Float64 è bilineare sul mosaico GLO30 nativo, prima di maschera/quantizzazione; il witness confronta quote non negative sullo stesso insieme83.424 punti con coast canonica>0. RMS−10,4796%, appena oltre il gate prefissato−10%;53.078 migliorano,29.806 peggiorano,540 uguali. L'estremo peggiora1,3518m. Sono misure di conservazione della fonte, senza ground truth indipendente né garanzia di errore massimo.

Il raster62,5m da solo ha RMS3,482476m sugli stessi punti: una parte consistente del dettaglio si perde nella triangolazione. Non si deduce da questo che basti aumentare i dati o i triangoli senza una rappresentazione e un costo verificati.

## Bundle e integrazione esterna

TMA1 contiene sei array originali e statistiche, senza quantizzazione geometrica: posizioni,normali,surface,indici,cellFirstIndex,cellTriangleCount. **37.639.536B**, SHA `59fc118c9676fffd2b96ac1d52ed04cc5fe4a34bf06e1e1c3069562b3690a831`; roundtrip esatto dei sei digest e delle statistiche. Encode/decode/controllo usa gli array già costruiti, senza nuovo modello. Gzip lossless17.127.542B; trasferimento non confrontabile ai4,2MB del vecchio solo DEM e da considerare prima di un eventuale uso futuro.

Decoder con limiti di layout/dimensioni/statistiche/indici/lookup, loader a stream limitato, SHA prima del decode e AbortSignal; errore esplicito senza builder/fallback. Le viste condividono il buffer con contratto di proprietà esclusiva. Engine inoltra i dati alle BufferAttribute e al lookup, conserva la cachev60 e non ricostruisce il modello per nuovo owner. Shader,nube,qualità,cover,materiale e shadow invariati. Licenza30m e notice modificato conservano i crediti90m/WorldCover.

118 test mirati e518 completi in50file, typecheck e APP→hero PASS. Il primo run mirato aveva114PASS/4FAIL: aspettativa del vecchio IDfonte e tre successivi controlli RAF; corretta l'aspettativa ID/metadati, il run completo passa. Log e sourceR0 preservati; non sono quattro bug runtime dichiarati né un PASS iniziale riscritto. Gli11 test sintetici del codec e2 di integrazione verificano anche buffer/offset, malformed input, cancellazione e uso diretto dei dati. Le review statiche non hanno eseguito modello o GPU.

## Browser e decisione visiva

Prima della candidata, un owner v60 fresco recupera il targetFloat32 intero `e4435ce3…` e il PNG `90641c32…`. Stesso seed74, camera world fissa, Sole assestato, t60 in pausa/forcing0, niente orbita/lampi, flusso completo, nativo2474×1844,256³/128³/384.

Nella candidata il primo click audit, troppo presto, è rifiutato dalla guardia sul cielo. Il primo audit effettivo riporta **FAIL_F32_DIFFERENCE**: cached `04239524…`, fresh `d7dfd69b…`, stable e cacheStateQualified veri. Una sola seconda invalidazione ripete cached=fresh `d7dfd69b…`. Il primo FAIL resta: i due hash da soli non ne identificano pixel, entità o causa. La review del backend Three186 non trova dedupe del backing ArrayBuffer o un errore di byteOffset: nessuna copia degli array viene proposta come fix senza prova.

Il PNG è acquisito **dopo** il fresh stabile:2474×1844,2.977.207B,SHA `90c8db0b4d7b9b3d4d31f80cf770007138359ede99fd3d1ce23b93ddac678e65`, tutte61parti trasferite/verificate. Non esiste un PNG del cached042; questa immagine non localizza quella differenza. Root e review indipendente hanno visto l'intero PNG e i quattro ritagli1:1, stessi box della diagnosi albedo. Alcune pieghe più articolate, ma restano versanti levigati/campiture uniformi; numerosi piccoli trattini/frammenti scuri nel ritaglio primario e chiazza persistente nel secondo. **FAIL fotografico; nessuna attribuzione dei segni alle ombre senza query.**

Stop a worker,pioggia,Tramonto,moto eFPS della candidata. Il solo successivo lavoro GPU è una riproduzione diagnostica distinta della differenza cache, con conteggio dei byte/pixel e digest della shadow prima/dopo. Non è un'altra variante di quote o materiale.

## Riproduzione diagnostica distinta dello scarto cache

R2 riproduce **esattamente** la coppia iniziale042/d7, con input stabili e cache qualificata. Mantiene geometria e WGSL del candidato; aggiunge soltanto il confronto CPU dei due packed già letti e due letture del target shadow R32F esistente. Nessun nuovo target, soglia di tolleranza o modifica del materiale. Un solo owner/audit di riproduzione; nessun altro modello.

- Su4.562.056pixel: **21 parole diverse in7pixel, tutte RGB**; zero parole alpha diverse sull'intero target. Rettangolo raw x284,y897,larghezza2,altezza5. Massimo delta assoluto finito0,005331589374691248 nel verde; nessun NaN/Inf o cambio di zero con segno. Tutti21RGB fresh sono inferiori.
- Shadow R32F2048²,16.777.216B per lettura: cachedSHA `efedb5fbf752b8c0149234759a4fe233db6b4db30bf6934b054ba4e8e3dfae0a`, freshSHA `9eab703e2aa50491e4b05042d2d5bcde17294c27a02e6319c4bee2f6a12af0ee`.
- Zero alpha differenti significa distanza/miss invariati in questa vista; non identità geometrica globale. Il cambio della mappa colore shadow non identifica da solo una causa unica del delta RGB: nessuna lettura della depth o degli UBO effettivi, nessuna prova di errore driver o di solo arrotondamento.
- Le review mirate di Three186 non trovano né dedupe errata degli ArrayBuffer né un latch FRAME di Sun/solar/ambient. Sono controlli dei sorgenti CPU, non dei binding letti dalla GPU; nessuna patch preventiva adottata.

Il gate bit-identico resta **FAIL** anche se i pixel sono pochi. Il conteggio non viene estrapolato a tutte le scene, a un impatto visivo globale o agli FPS. La review indipendente ricostruisce conteggi/bits/bbox dai sette record salvati e conferma la riproduzione, senza nuova GPU.

R2:128test mirati e528completi in51file PASS. Primo build fallisce soltanto sul tipo generico del mock `stats`; dichiarazione resa callable, nessuna modifica runtime. Log/source prima della correzione preservati. Typecheck e APP→hero finali PASS; non ripetuti i test già passati per una modifica di solo tipo. I tre nuovi casi lifecycle verificano2/4read secondo flag, report/export e teardown con R32 pendente. Il report diagnostico usa un nome dedicato anche per gli errori e App gestisce entrambi i tipi audit.

L'audit conserva temporaneamente due packedRGBA,72.992.896B ciascuno, e legge due R32F16MiB in sequenza; staging/GC/residency e picco non misurati. Solo statistiche, digest e al massimo24esempi pixel vengono emessi, non i grandi buffer. Le letture esplicite non sono misure prestazionali.

## Stato del prodotto e continuità

Workspace esterno `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle35`. R1 candidato135sorgenti; R2 diagnostico137. I129 sorgenti canonici restano byte-identici al manifest v60 `a4e38cfc…`; nessuna adozione del codec, degli helper diagnostici o degli asset GLO30. Il pacchetto dati completo esterno conserva36payload/163.950.505B e i quattro originali, manifestSHA `627dedcb589137853333ad10e7c5fa7897e6db0a27d9e6dba6f2f30e92760e81`; archivio Git curato con gli input usati, overlay e alias compressi, senza ripetere i TIFF pubblici.

Preview4196 ripristinata su v60ordinary,Sole/nube matura animata,2474×1844,14sinistra/3giù; console osservate vuote. QA53779/53780 chiusi intenzionalmente exit0. Dipendenze ignorateGit/nontracciate con attributoDropbox1 verificato prima/dopo; nessuna installazione o lock edit. `node_modules 2/` e servizio4201 estranei intatti; nessun push/deploy.

Il prossimo candidato materiale va preparato sul v60 canonico, con geometria invariata: variazione ottica coerente con i dati reali già acquisiti, distinguendo composito satellitare da albedo fisica e luce incorporata. La proposta è separata dalla sua implementazione/adozione. GLO30 e costruzione statica rimangono disponibili per un futuro raffinamento meglio controllato; questa singola passata non basta. Terreno,anatomia/vicino,pioggia/virga,UI e60FPS restano aperti, goal attivo.

Archivio [terrain-glo30-static-trial](measurements/terrain-glo30-static-trial-2026-10-17/manifest.json): **125 payload /31150167 byte**, manifestSHA256 `cb21cc139da9bf7bbf8d74ccb86bc5678ab87653656f045fcc10cd720a0729c1`. La [proposta ottica](measurements/terrain-glo30-static-trial-2026-10-17/next-optical-material-candidate.md) usa RGB+validità già disponibili, non NIR persistito: RGBA16F2048²,44,74MB con mip e1lookup nel raster; costo in navigazione da misurare, nessuna stimaFPS o adozione.
