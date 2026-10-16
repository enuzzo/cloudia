# Proposta focus esterno — non applicata e non eseguita

Versione 2. Patch: `focus-dismissal-proposal.patch`. Copie esatte prima/dopo in
`proposal/{before,after}/src/cumulonimbus/`; SHA nel manifesto adiacente.
I due sorgenti del prodotto erano invariati dopo la scrittura delle copie.

## Decisione sincrona

Prima di chiudere il pannello, cercare sul target o sui suoi antenati un
controllo nativo presente nella UI o un elemento con tabindex, anche negativo.
`closest` include SVG/path dentro un bottone. Canvas ha tabindex0 e resta
affidato al controller esistente. Escludere `:disabled` (compreso fieldset
disabilitato), input hidden e antenati inert.

Soltanto se non esiste tale destinatario e il focus appartiene al pannello
da chiudere, `close(panel,true)` restituisce focus al summary con preventScroll.
Solo nel medesimo ramo si chiama `pointerdown.preventDefault()`: impedisce che
il successivo mousedown compatibile annulli il focus appena ripristinato.
Negli altri casi resta la chiusura attuale senza chiamate focus aggiuntive e
senza preventDefault. La versione 1 senza questa protezione è conservata in
`proposal-v1-capture-only/`, superata e non proposta per l'applicazione.
Nessun microtask, RAF, timer, listener successivo o cambiamento del drag.
La condizione di chiusura esterna rimane quella esistente, anche per il tipo
di puntatore: questa proposta modifica il focus e previene il default soltanto
nel ramo di ripristino.

La funzione è limitata ai controlli della UI corrente; non è una libreria
generale per determinare la focalizzabilità di DOM arbitrario. Etichette che
delegano focus e widget contenteditable non sono presenti come superfici
esterne pertinenti e non motivano qui una nuova astrazione.

## Test preparati, da eseguire soltanto dopo coordinamento

- Focus reale nell'input → divisore o padding non focalizzabile → pannello
  chiuso, summary focalizzato, pointerdown cancelable prevenuto.
- Stesso percorso su bottone disabled e bottone in fieldset disabled.
- Bottone, SVG dentro bottone, link, input/select, summary, canvas e tabindex−1:
  nessuna chiamata focus al summary e default non prevenuto durante pointerdown.
  Il test distingue
  questa fase dalla successiva azione nativa: dispatchEvent non la simula.
- Focus già fuori dal pannello: preservato quando il pannello si chiude,
  default non prevenuto.
- Dopo abort: nessuna chiusura né spostamento del focus.

Prima dell'eventuale applicazione, root riproduce il difetto in IAB. Dopo:
test inspector mirati e regressione pointer già esistente; nel browser
verificare il destinatario effettivo sia dopo pointerdown sia dopo il gesto
completo pointerdown→mousedown→pointerup→mouseup→click, Tab/Spazio per
riaprire Regola, clic sul meteo e sul canvas, comprese frecce sulla scena.
Controllare anche il target SVG di Pausa/zoom, che deve mantenere il suo
normale comportamento. Nessuna dichiarazione di esito anticipata.

## Rischi e perimetro

La correzione non deve trasformare un pannello non modale in focus trap né
spostare il focus da un'altra zona. Il test sui target interattivi evita il
salto transitorio al vecchio summary. La verifica reale resta necessaria per
focalizzazione nativa, disabled, cancellazione del mousedown compatibile e
chiusura animata. Il caso right-click conserva
il criterio di dismiss già esistente; nessun nuovo comportamento di camera è
introdotto. Mani, dimensioni e transizioni non cambiano.
