# FPS: invii e completamento del lavoro GPU

16 ottobre 2026. Implementata la prima strumentazione dell'
[obiettivo FPS](FPS-OBJECTIVE-2026-10-16.md), dopo l'
[audit della semantica](FPS-METRICS-AUDIT-2026-10-16.md).

Il benchmark mantiene i campi storici e aggiunge schema2, versione
`submission-queue-prefix-v1`, alias `submissionFps`, `submissionPacing` e
`gpuRenderPassSumMs`, e `presentedCanvasFps:null`. Quest'ultimo resta esplicitamente
non misurato. Non cambia il renderer v40 o la qualità dell'immagine.

## Che cosa è verificato

Solo durante la finestra di misura si osservano prefissi immutabili della
coda: iniziale dopo il warmup, periodici ogni almeno1s con richieste pendenti
accorpate, e finale obbligatorio. Il primo draw è l'anchor degli intervalli;
il conteggio misurato coincide con `stats.frames`. I timestamp di completamento
usano un unico clock locale e conservano separatamente il timestamp rAF.

Il JSON aspetta il completamento finale, con limite5s e stati espliciti per
timeout, errore o annullamento. Un timeout non inventa una frequenza completata.
Resize, cambio scena, scheda nascosta, perdita del device o teardown annullano
anche una misura che ha già finito gli intervalli ma attende il fence finale.
Controlli di identità/generazione impediscono report tardivi di una vecchia misura.

`completionBoundedSubmissionFps` divide gli intervalli misurati per il tempo
locale dall'anchor alla notifica del prefisso finale: include eventuale lavoro
ereditato e consegna JS. È distinto da throughput GPU isolato e presentazione.
`maxUnconfirmedMeasuredFrames` include anche il tempo fra le osservazioni:
è un limite superiore ai draw non confermati al JS, **non la profondità fisica
della coda**. Le nuove richieste possono influire sulla misura; la versione è
esplicita e un confronto rigoroso deve usare lo stesso schema.

## Prova browser iniziale

Pioggia, seme72,60s in pausa, forcing0, camera yaw0/pitch−0,92, main,
CSS1280×720/DPR2, output interno2560×1440, Massima384 e volumi256³/128³:

- 354 intervalli in30,0026s:11,799invii/s; mediana83,30ms, p95100ms.
- Prefisso finale354 confermato; completamento finale342,20ms.
- Frequenza con completamento finale11,667/s; nessun draw misurato non
  confermato alla chiusura. Le osservazioni periodiche completate restano
  nell'ordine di319–346ms, senza crescita evidente durante questa prova30s.
- Il massimo16 draw non confermati non significa16 frame fisicamente in coda.

Questa prova qualifica il percorso delle nuove misure nel browser e mostra
chiaramente che la pioggia è lontana dal target. Non è una prova90s né misura
delle presentazioni. Il tempo GPU aggregato non viene diviso automaticamente
per due o trasformato in FPS.

Sole alla stessa posa e risoluzione, sempre30s:1800 intervalli,
59,994invii/s; mediana16,70ms, p9518,30ms, p9918,60ms, massimo18,80ms,
131 intervalli oltre18ms e nessuno oltre33,34ms. Prefisso1800 confermato,
completamento finale46,20ms, frequenza con chiusura59,877/s. Le notifiche
campionate vanno da18 a57,30ms. Il contatore è vicino a60, ma questi30s statici
non chiudono il target sostenuto/in moto o la regolarità della presentazione.

Anche il percorso worker è stato eseguito nella stessa posa/output:1692
intervalli in30,0019s,56,396invii/s; p9533,20ms, p9933,50ms, massimo50,50ms.
Prefisso1692 confermato, chiusura68ms, frequenza con chiusura56,285/s.
Questo verifica il protocollo anche nel worker con clock locale separato.
Non è una dimostrazione causale della differenza fra thread e non raggiunge60.
Le console main e worker non riportano warning/errori nelle acquisizioni.

## Verifiche del codice

Suite163 test/28 file superata, inclusi test con clock di diversa origine,
prefissi catturati prima di altri draw, timeout, rigetto sincrono/asincrono,
annullamento e callback tardivi. Due test di lifecycle attraversano i controlli
reali dell'app: confronto del conteggio, unico fence finale e report pubblicato
solo dopo completamento; resize e nuova misura non ricevono dati della vecchia.
Review indipendente senza difetti bloccanti individuati. Build app riuscita;
build hero e snapshot finale sono registrati nel manifesto di verifica.

Le evidenze di runtime e gli hash sono nel
[manifesto](measurements/fps-queue-2026-10-16/verification.json).
Restano tutti i gate visivi e i60fps nativi sostenuti dell'obiettivo completo.
