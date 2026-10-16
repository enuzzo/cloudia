# PNG native e metadati dello stesso draw

16 ottobre 2026. Renderer `observatory-v57-native-frame-export`.

Il profilo diagnostico ora acquisisce intenzionalmente il bitmap PNG del
canvas, con camera, qualità, materiali e clock copiati subito dopo lo stesso
draw nell'owner main o worker. Serve a valutare nube e paesaggio senza la
compressione JPEG delle schermate CSS. Non modifica densità, shader della
nube, terreno, illuminazione o qualità dell'output; non è un miglioramento
artistico o una misura di FPS.

## Comportamento e limiti

In `?profile=1`, Regola → Misure → «Acquisisci PNG del canvas» espone un link
di download manuale, metadati JSON e testo paginato del data URL. Ogni parte
contiene al massimo65.536 caratteri. **Concatenare tutte le parti prima di
decodificare base64**, quindi verificare lunghezza, SHA256 e dimensioni PNG.
Il prefisso data URL partecipa agli indici; le singole parti non sono immagini.
La vista ordinaria non contiene questi controlli.

Una sola acquisizione fisica può essere in corso per owner. Il limite è
8.388.608 pixel,32MiB PNG e20s dalla richiesta alla validazione. Il timeout
invalida il risultato ma non può interrompere l'encoder del browser: il lock
resta fino alla sua conclusione. Anche la conversione del Blob nella UI
mantiene il lock fino all'ACK finale. Clear invalida i risultati tardivi,
svuota testi e URL e non libera prematuramente lo slot. Benchmark e acquisizione
si escludono durante raccolta e chiusura. Nessun download automatico.

La PNG rappresenta il bitmap sRGB del canvas, senza UI, buffer lineari/HDR o
prova della presentazione del compositore. I valori uniform sono quelli CPU
inviati a Three; nessun readback della precisione float32 GPU. I clock di nube,
forzanti, precipitazione e flusso restano distinti: questa funzione li descrive,
senza cambiare l'ordine temporale esistente. Le identità locali delle texture
del cielo non sono hash dei loro contenuti.

## Verifiche concluse

124 sorgenti congelati, manifest SHA256
`8dce2ed7a5843104c3b606c4223435d69408d43739712b1f722c7a1fa8a348f2`,
confrontati esatti con il checkout. **378/378 test in45 file**, typecheck e
build app→hero PASS sequenzialmente con exit0. Inclusi24 test dell'helper e
quattro regressioni d'integrazione: ordine draw/cattura, snapshot immutabile,
clock/qualità effettivi, clear durante conversione e interblocco benchmark.
Le regressioni simulano il renderer; le immagini qui sotto provengono dal browser.

Tutte le acquisizioni finali usano seme74, t60 in pausa, vento55%, dispersione0%,
flusso completo, macro256³/dettaglio128³/384passi e output=interna=canvas.
La camera di confronto usa mira[.3515625,3.119140625,-.0546875] e superficie
stimata esterna .7227685139973958km; la probe è disabilitata. Non qualificano
automaticamente la massima vicinanza o la camera ordinaria.

| Acquisizione | Canvas | Byte PNG | Parti visibili |
| --- | --- | ---: | ---: |
| Main near60 Sole |1280×720|806.716|17|
| Main near60 Sole |2474×1844|3.434.897|70|
| Worker near60 Sole |2474×1844|3.434.897|70|
| Main near95 Sole |2474×1844|1.083.466|23|
| Main paesaggio Pioggia |2474×1844|2.508.514|52|
| Main paesaggio Sole |2474×1844|2.817.764|58|

Main e worker near60 producono byte identici, SHA256
`6251d0458628d4e01d560fda33d37630e9f08ecd5e61244698c607e92bc448dc`.
È parità di questa posa assestata, non di tutti gli stati o del moto.
720 e Schermo hanno aspect diversi: stesso centro/camera non significa stesso
campo orizzontale. Le viste paesaggio Sole/Pioggia condividono esattamente
camera e qualità; entrambi i cieli sono assestati, senza cache pendente.

Il trasferimento precedente R1 era troncato a200.011 caratteri: i149.990 byte
decodificati non corrispondevano allo SHA atteso e **nessuna PNG parziale è
stata salvata**. Il pager finale recupera la stessa PNG720 originale, SHA
`aee8f81aec6abd3800908b7829305b0d7a6fd8e809a00d6096519c2bd0bad747`.
Il primo errore di typecheck sul narrowing dell'unione è documentato e corretto
con guard esplicito dello stato ready; nessun cambiamento dell'helper per aggirarlo.

Clear verificato in main e worker: testi vuoti, href rimosso e acquisizione
nuovamente disponibile. Nessun warn/error osservato nei controlli finali;
vista ordinaria main animata a2474×1844 senza controlli PNG.
La preview ordinaria su `http://localhost:4196/?seed=74` ora serve il dist v57
congelato; la vista Sole animata, dimensioni e console sono verificate anche lì.

## Esito artistico e seguito

Root e lettura indipendente concordano: **vicino ancora insufficiente** nelle
PNG native, quindi la morbidezza non è attribuibile interamente al JPEG CSS.
La vista95 è quasi tutta chiara con grande ombra/cielo in alto e non recupera
il rilievo fine. Nessun nuovo coefficiente di densità è stato adottato.

Il paesaggio ha costa/catene specifiche e superfici opache più credibili delle
dune argentate iniziali; il confronto con quell'immagine è qualitativo tra
pose, versioni e luci diverse. Le creste in primo piano a sinistra conservano
facce uniformi e piccole macchie scure geometriche. La stessa posa al Sole le
rende una priorità concreta per distinguere forma, normali e ombre prima di
aggiungere grana o una nuova palette. La pioggia conserva una cortina troppo
uniforme. Nessun PASS fotografico complessivo né nuova qualifica60FPS.

Evidenze, protocolli, risultati e verificatore:
[measurements/native-frame-export-2026-10-16](measurements/native-frame-export-2026-10-16).
59payload/14.632.065byte, sei PNG integralmente decodificate con Pillow e
cinque contenuti unici. Manifest SHA256
`a369e0688a32947e1cf577e50a5627bb4d5778cb17fe8726a7bbd85733f495e6`.
Verificatore del pacchetto PASS, inclusi124sorgenti e30file dist congelati.
I testi grezzi delle parti non sono duplicati: la provenienza UI è registrata
dal collector e dai suoi ledger, non riprodotta da una verifica offline.
Source/dist congelati esterni:
`/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle24/native-export-source`.
Goal attivo; anatomia, moto, luce vicina, pioggia/virga, UI e FPS restano nel piano.
