# PNG nativo v57 — checklist minima della qualifica browser

Review di sola lettura del protocollo corrente `observatory-v57-native-frame-export`; nessun test, browser, GPU o ricerca extra eseguiti qui. Helper24PASS e regressioni lifecycle sono prove separate, non sostituiscono il round-trip reale.

**Precedente R1:** encoder1280×720,806.716B dichiarati; testo CUA troncato a200.011caratteri con `[Truncated]`, byte ricostruiti149.990 e SHA diverso. Esito corretto `REJECTED_TRUNCATED_TEXT_NO_PNG_SAVED` (`browser-r1/transport-limit.json`). Quella prova conserva solo metadati, non una PNG nativa recuperata.

## 1. Recupero verificato prima di salvare una PNG

1. Acquisire dal pulsante visibile in `profile=1`; attendere stato `ready`. Leggere il **value** della textarea visibile `frame-export-json`, conservando captureId/requestId,infoPNG e `textExport`. Una foto è il DTO del draw, non il report benchmark o lo stato corrente della UI.
2. Leggere una parte per volta dal value visibile `frame-export-png`, registrare indice/range del controllo `frame-export-part`, usare soltanto i pulsanti visibili precedente/successiva. Nessun engine/global/storage privato, fetch del BlobURL o DOM nascosto. Le parti intermedie devono avere65.536caratteri, l’ultima il residuo; indici/range contigui senza duplicati o omissioni, next disabilitato all’ultima. Eventuali troncamenti del tool sono FAIL del trasporto, mai dati da completare a intuito.
3. Concatenare le parti **senza separatori**, poi decodificare il dataURL completo. Il prefisso `data:image/png;base64,` è solo all’inizio: la sua lunghezza22 sposta i quartetti base64, quindi **non decodificare ogni parte isolatamente**. Verificare `parts=ceil(totalCharacters/65536)`, lunghezza concatenata=totalCharacters=`22+4*ceil(byteLength/3)`. Rileggere il JSON alla fine: captureId/requestId/SHA invariati, nessuna nuova cattura mescolata.
4. Prima del salvataggio finale confrontare byteLength e SHA256 dei byte decodificati con infoPNG; controllare MIME, firma/IHDR, dimensioni e decodifica completa mediante un lettorePNG indipendente. Qualunque mismatch ⇒ niente PNG finale; conservare soltanto errore/metadati diagnostici. Il downloader UI è un percorso esplicito distinto, non prova che il pager sia completo.

Fonti: `CumulonimbusApp.ts:85–101,107–138`, `sceneMarkup.ts:61–71`. Il pager è una capability visibile, non un aggiramento del limite CUA precedente.

## 2. Tre artefatti minimi

| Acquisizione | Vincolo necessario |
|---|---|
| Main,posa1 | Bitmap **2474×1844** realmente esportato, output=internal=canvas=IHDR; qualitàultra,nominalSteps384,macro256³/detail128³. «Nativo» descrive il bitmap, non implica qualitànominale128 né dimensioniCSS. |
| Worker,stessa posa1 | `executionThread='worker'`, stesso seed/camera post-clamp/appliedsimtime/meteo/luci/qualità/output della main, dopo atmosfera stabile. Acquisizione dall’OffscreenCanvas del worker; stesso recupero completo e controllo digest. Non imporre SHA o UUID identici fra owner diversi: verificare le due immagini e le differenze pertinenti, non i timestamp o UUID locali. |
| Main,posa2 | Variare intenzionalmente la camera; nuovo captureId/draw serial locale, DTO camera diverso e SHA diverso. **Aprire entrambe le PNG** e confermare che cambi davvero la scena: hash diversi da soli non dimostrano una posa corretta. Dimensioni e qualità restano2474×1844/full. |

Per ogni coppia `.png`+`.json` conservare captureId,source/distmanifest,thread,IHDR/digest verificati, tutti i campi applicati e console. Controllare nominalSteps/stepSize contro la qualità scelta anche se canvas/internal hanno la stessa dimensione. Tenere distinti simulationTime,forcingTime,precipitationUniformTime,flowUniformTime e flowFieldTime: frozen-flow può conservare un tempo diverso, non va riscritto per far coincidere i report. Cielo stable/skyPendingfalse e assenzaflash per la coppia deterministica. Fonte DTO/draw: `GPUSceneEngine.ts:491–504,553–592`.

## 3. Cleanup, scope e verdetto

- **Clear reale:** dopo ready deve svuotare JSON e partePNG, nascondere dati/link e azzerare il pager. Durante acquisizione/conversione deve invalidare la pubblicazione tardiva e mantenere capture/benchmark disabilitati fino al terminale/ack UI; poi entrambi tornano utilizzabili. Nessuna riapparizione del risultato cancellato. Il caso asincrono è già coperto da regressioni, ma non presentarlo come visto nel browser se non osservato.
- **Modalità ordinaria/preview:** senza profile, controlliPNG/pager assenti; normale scena/render e navigazione utilizzabili. Preview separata raggiungibile senza errori e con versione/distribuzione identificata. Verificare console main+worker intorno alle catture: nessun errore nuovo WebGPU,device loss,encoding o serializzazione; avvisi preesistenti vanno attribuiti senza chiamarli FAIL dell’export.
- **Accettazione separata:** il PASS trasporto richiede tutti i byte e i controlli sopra; il PASS acquisizione richiede immagini native aperte, non vuote/vecchie e coerenti coi DTO/pose. PNG lossless del canvas escludeUI/CSS/HDR/compositore. Non prova fotoPASS della nube/pioggia, parità bitexact col witnessFloat32 o pixel fisici del monitor. Nessuna promozione artistica finché la PNG non è stata effettivamente vista; nessun PASS globale anche dopo una singola vista.
- **Nessun FPS da questo giro:** readback/encoding/hash/base64/pager non sono una misura prestazionale. Benchmark deve restare escluso durante capture e conversione; servono finestre distinte per FPS, senza attribuire performance a una cattura riuscita.
