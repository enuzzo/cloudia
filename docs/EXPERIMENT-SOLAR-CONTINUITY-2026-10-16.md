# Continuità del cambio luce — 16 ottobre 2026

Il comando **Luce** cambiava subito il canale delle ombre, mentre il cielo veniva calcolato in modo asincrono. Alla risposta, la direzione solare saltava al nuovo lato prima che iniziasse la dissolvenza del cielo. Il replay dei metodi effettivi di `59bb8d3` misura un salto di **83,85° di giorno e 144,33° al tramonto**, con blend del cielo ancora zero. Questo difetto del comando è distinto dalla qualità della luce quando si entra nella nube.

La correzione parte dalla luce visualizzata quando arriva una risposta valida: direzione, peso sinistra/destra delle ombre, peso giorno/tramonto, colori e cielo condividono la transizione esistente di **2,4 secondi**. Un nuovo comando può interromperla; le risposte obsolete restano escluse. Azimut ed elevazione vengono interpolati separatamente, così un cambio lato al tramonto mantiene il sole basso. Reset e riferimento diagnostico seguono lo stesso percorso. L'installazione iniziale adotta direttamente il proprio stato finale.

Restano **256³ macro, 128³ dettaglio, 384 passi nominali e output pieno**. Il percorso R8 della pioggia e le sue condizioni di attivazione restano quelli di v48.

| Verifica | Evidenza e limite |
|---|---|
| Replay prima/dopo | Salto del peso ombre al comando: **1 → 0**. Salto della direzione alla risposta e durante un'inversione: **83,85°/144,33° → 0°**. Stato sintetico e metodi effettivi; nessun pixel GPU. |
| Test mirati finali | **17/17 PASS**, revisione 2: richieste pendenti, inversioni, errori, risposte obsolete, scenari interrotti; reset raggiunge sunset-left, riferimento raggiunge storm/day-left. Il lampo si spegne subito senza scatti del cielo o dei colori. I due tipi di host esercitano il controller condiviso, senza un vero worker grafico. |
| Suite completa precedente | **247 test / 35 file PASS** sul congelamento `frozen-solar`, volume originale. Include la prima versione del test solare; la successiva revisione aggiunge asserzioni e corregge il fixture, verificata separatamente con i 17 test finali. La validazione finale d'integrazione resta da aggiornare nel checkpoint. |
| Browser main | Osservati estremi sinistra/destra e immagini dopo il comando, giorno e tramonto; confronto al 20% con mira fissa. Rendering configurato **2560×1440, 384 passi**. Sono fotografie sparse della UI, non una registrazione dell'intera transizione. |
| Browser worker reale | Sequenza tramonto sinistra/comando/destra. Il [riscontro DOM e canvas](measurements/solar-continuity-2026-10-16/browser/solar-worker-proof.json) mostra **Worker WebGPU**, output/interno **2560×1440**, macro/dettaglio **256³/128³**, seed 72, t60 in pausa, vento 55%, flusso completo e console vuota. |

Le immagini conservate sono **JPEG CSS 1280×720**, ottenute mentre il canvas rendeva a risoluzione piena. Non sono PNG nativi, video continuo, prova di trasporto fisico esatto o misurazione FPS. Il valore rAF mostrato dalla UI non dimostra 60 FPS stabili; quel gate resta aperto e qui non è stata eseguita una nuova misura prestazionale.

**Qualità ravvicinata ancora aperta:** la [vista frontale al 100%](measurements/solar-continuity-2026-10-16/browser/solar-day-left-near.jpg) resta quasi uniformemente bianca anche nella posa esterna qualificata su CPU: `surface=1.4795113574194039`, cioè 100 m oltre la stima radiale ordinaria per la mira documentata. Il campionamento CPU trova origine a densità zero e prima materia circa 103 m avanti; è una verifica di pochi raggi e della densità, non della radiance GPU. Il [rapporto di classificazione](measurements/solar-continuity-2026-10-16/browser/near-classification-report.md) ne delimita il campo. Questa immagine impedisce di dichiarare risolto il gate ravvicinato.

La fusione delle profondità ottiche precalcolate è un'approssimazione dei lati e delle altezze solari estremi. La correzione assicura continuità dei valori del controller; restano da verificare continuità visiva temporale, inversioni rapide nel browser, qualità durante il moto naturale e l'intero obiettivo artistico.

L'[archivio curato](measurements/solar-continuity-2026-10-16/manifest.json) conserva snapshot prima/dopo dei soli sorgenti pertinenti, test finale, patch gzip lossless, replay, risultati e fotografie, senza cache volumetriche o build. Il manifest conserva anche SHA e dimensione del patch originale decompresso. I runner adattati usano le dipendenze locali del progetto e scrivono un rapporto soltanto se si indica una destinazione:

```sh
node docs/measurements/solar-continuity-2026-10-16/replay-before.mjs /tmp/cloudia-solar-before.json
node docs/measurements/solar-continuity-2026-10-16/replay-after.mjs /tmp/cloudia-solar-after.json
```

Entrambi sono stati rieseguiti: hash dei metodi e risultati coincidono con i rapporti originali. Replay e QA browser riguardano il candidato prima dell'etichetta definitiva, engine SHA `49174226267924eafe5f02a3b641884360e9dd49dc29da836008b83bc1b215f8`, basato su `59bb8d3` e con anatomia originale. Etichetta v49, decisione sull'anatomia e validazione definitiva verranno collegate dal checkpoint d'integrazione.

## Integrazione finale v49

La versione `observatory-v49-quality-checkpoint` conserva la geometria di
`59bb8d3`; nessuno dei tre candidati anatomici è promosso. **247 test/35 file,
typecheck e build app→hero passati** sullo stesso congelamento finale, con le
asserzioni solari della revisione 2. La sola differenza del runtime rispetto
alle precedenti immagini solari è l’etichetta nei report; i tre metodi di
transizione sono stati confrontati byte per byte.

[Verifica della build](measurements/solar-continuity-2026-10-16/integration/verification.json):
97 sorgenti/file confrontati con il checkout, 57 corrispondenze nei sourcemap,
24 asset registrati, zero discrepanze. I log originali sono conservati gzip
lossless. Lo [smoke browser finale](measurements/solar-continuity-2026-10-16/integration/final-browser-proof.json)
conferma output/interno2560×1440,384 passi, t60 e console vuota dopo il cambio
al lato destro al tramonto. Anche questa è una verifica circoscritta, senza
nuova misura FPS né prova video continua. Anteprima ordinaria animata su4193.
