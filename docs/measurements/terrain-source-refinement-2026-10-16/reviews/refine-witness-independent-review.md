# Review indipendente del protocollo OFF/ON — ciclo 28

Nessun blocker statico concreto rilevato per il confronto numerico dichiarato. Nessun Bun, mesh/query, test, build, raggio, GPU o browser eseguito da questa review. La nota viene salvata dopo la notifica del root che OFF e ON sono già terminati: non è un'approvazione pre-run retrodatata. La lettura statica era iniziata prima di quella notifica; i risultati non sono usati per cambiare i gate.

## Identità letta

| File | SHA-256 |
|---|---|
| `refine-witness/PROTOCOL.json` | `5ec63f8ec7e3c35bd44a438071b6b53bc554171a21f39a3f1a16901d0c3fde96` |
| `refine-witness/REVIEW-FREEZE.json` | `98e132c98884553cc413f13d66612aefd80cac1d9878b08cdf45114ca1f57cd5` |
| `refine-witness/witness.ts` | `0ae4817067a2a6e73ab56afc8d26bda41313f9bf595b718e74025e3a28e7e930` |
| `refine-witness/run.py` | `e53ff990ec65f89f029e941dad54ccd5dad6ca3290ea1c2dcb07180c7b8920a1` |

`refine-decision-protocol.json` SHA `a032e13f73ace31a0c44e940a36ad1a87652d566c845388d8ed7515c033c3ceb`. Candidate manifest126 SHA `83469d62c552db7bad9cbc175bf549f7b7c0bd8c0b113c137e484e1b4f315e00`; storico e stream OFF sono pin distinti. La copia di REVIEW-FREEZE in PRE-RUN-FREEZE con stato ROOT_APPROVED_UNEXECUTED appartiene al root e non è una mia esecuzione.

## Gate valutati

- **OFF significativo:** costruisce una sola volta il modulo candidato con refinement assente. Richiede i cinque buffer storici, statistiche e sampler count, aggregate/ring/top8 e digest dell'intero stream degli stessi 591361 nodi esattamente uguali allo storico. Non si limita a confrontare un commento o pochi punti. Il raw OFF nuovo è una riproduzione autenticata dal digest storico, non un vecchio array recuperato.
- **ON condizionato all'OFF:** sia wrapper sia child controllano il terminale OFF; il wrapper richiede anche selectionFitGatePASS. Risultato e stream OFF vengono letti per hash/byte prima e dopo ON. L'ON usa direttamente l'errore OFF alla posizione row-major corrispondente della stessa griglia e scrive un proprio stream completo. Non vedo disaccoppiamento degli indici o ricerca adattiva dei punti.
- **Fit e peggioramenti separati:** RMS globale/land e land ring2/3/4 devono scendere strettamente; il massimo assoluto globale ammette soltanto +0,001m rispetto al precedente. Risorse sono un gate indipendente. Tutti i gruppi rimangono nell'output; improved/worsened/equal, sign flip e attraversamenti stretti di5m sono definiti esplicitamente senza epsilon. Uguale errore assoluto può avere segno opposto ed è registrato anche dai sign flip.
- **Identità ON corretta:** original positions/surface prefix devono restare esatti; non vengono promesse normali/indici o faceIndex originari invariati. Le range di lookup per cella sono contigue, finite e bounded, con hole vuoti e copertura di tutti gli indici. Questo controllo contabile non dimostra manifoldness, assenza di crack, orientamento o assenza di sovrapposizioni geometriche: i limiti sono dichiarati.
- **Consumo e risorse:** directory per modo esclusiva; preflight e failure consumano il tentativo. Un solo child, hard CPU20s, wall40s e gate terminale CPU combinata/RSS somma dei picchi. Freeze,126 sorgenti e dipendenze vengono controllati prima e dopo. Nessun retry automatico, ricostruzione vecchio modulo o bake nube.

## Limiti che il PASS non deve oltrepassare

La soglia5m è di selezione e non diventa un massimo finale. Selezione e assessment condividono i nodi: è fit, non holdout o bound continuo. Il gate può consentire regressioni su singoli nodi, sulla maschera mare e nei ring0/1; deve mostrarle anche se supera il PASS aggregato. “Strettamente minore” non impone un guadagno minimo materiale: i numeri e la futura immagine restano necessari per valutarne l'utilità, senza ritoccare ora le soglie.

L'OFF storico protegge il confronto del modulo candidato; l'ON non qualifica da solo l'intera pipeline renderer. Il conteggio lookup non prova la correttezza geometricamente continua del lookup; i cap di byte non includono tutti i temporanei/Map, coperti invece dal gate RSS separato. Ring4 è campionato solo entro±48km. La maschera coast resta una categoria materiale.

Il wrapper ricontrolla stato/hashes, conteggi e gate; alcune statistiche paired sono prodotte dal child nello stesso loop. La verifica indipendente degli stream salvati può controllarne conteggi e somme senza ripetere mesh o query, ed è il prossimo passo autorizzato dal root. Non trasforma comunque il fit in prova di fotografia, causa delle ombre, correttezza GPU o FPS.
