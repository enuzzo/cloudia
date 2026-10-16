# Gate UI — revisione indipendente, ciclo 11

16 ottobre 2026. **Nessun edit prodotto, browser, test, build o generazione.**
Revisione del contratto `docs/UI-DESIGN-2026-10-14.md`, fase 4 dell'handoff,
`scene.css`, `sceneMarkup.ts`, `panels.ts` e test esistenti letti, non eseguiti.
Il contratto comprende esplicitamente **Mani · in arrivo**: resta valido.

## Esito circoscritto

**Non emerge dal codice un nuovo difetto dei target da 44 px nelle tre viewport.
Non è un PASS del gate renderizzato.** Esiste un percorso concreto di possibile
perdita del focus dopo chiusura esterna, distinto dal clic canvas già corretto.
È il solo candidato a correzione proposto; richiede una riproduzione browser.

Prova visiva letta:
[v46 ordinaria](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/narrow-cloud-2026-10-16/v46-ordinary-preview.jpg).
Il file è 1280×720: mostra marchio/sottotitolo leggibili, Mani, dock unico e
controlli di distanza, senza collisioni evidenti a pannelli chiusi. Non contiene
focus visibile, pannelli aperti o una transizione. Non dimostra 1672×941,
390×844 o 1280×432, né touch, Esc o reduced motion.

## Rischio concreto da riprodurre: chiusura sul vuoto del dock

In [panels.ts:18](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/panels.ts:18)
il `pointerdown` esterno chiude il pannello in capture con `restoreFocus=false`.
Il dock intercetta il puntatore (`pointer-events:auto`,
[scene.css:34](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/scene.css:34)),
ma padding e divisori non sono focalizzabili. Il canvas è un'altra superficie:
il suo nuovo `focus({preventScroll:true})` non riceve quel gesto.

Percorso, preferibilmente 1280×432: aprire Regola → Nube, focalizzare Vento,
poi cliccare il divisore fra Pausa e Sole o il padding libero del dock.
Il pannello si chiude nascondendo il controllo focalizzato; il codice non
assegna un nuovo focus. Verificare `document.activeElement` e la successiva
interazione da tastiera. L'eventuale ritorno a BODY va registrato nel browser,
non dedotto come risultato già osservato in questa revisione.

🌟 Se riprodotto, correggere solo la chiusura esterna: prima di chiudere,
ricordare se il focus appartiene al pannello e in quel caso riportarlo al suo
summary con `preventScroll`, prevenendo il default del pointerdown solo in
quel ramo per evitare il successivo mousedown compatibile. Il normale focus
del pulsante cliccato e quello
esplicito del canvas devono poter prevalere durante il medesimo gesto.
Non spostare il focus quando era già altrove; non cambiare drag o layout.

Verifica mirata proposta: test DOM con input realmente focalizzato e
pointerdown su divisore/padding, asserendo focus fuori dal contenuto nascosto;
poi browser con Tab/Spazio dal nuovo focus. Ripetere il percorso canvas già
corretto e il clic su un pulsante meteo per escludere regressioni del destinatario
del focus. I test esistenti coprono canvas/Esc/close/tab, non il vuoto del dock.

## Contratto e limiti delle prove

| Area | Evidenza statica corrente | Limite |
| --- | --- | --- |
| Target | Pulsanti/summary min-height44; icone e zoom width44; select min-height44; range height44; link legacy min-height44 | Nessun bounding box o hit-test reale acquisito ora |
| 1672×941 | Panel432×640, top126/bottom175; dock con controlli min-height48 | Dimensioni dedotte dalle regole CSS, pannelli non mostrati nello screenshot |
| 390×844 | Panel366×632, top116/bottom96; dock laterali12, pulsanti meteo circa62,5×48 con safe-area zero | Calcolo CSS, non prova di scroll/occlusione o touch |
| 1280×432 | Panel320×266, top76/bottom90; corpo scorrevole; zoom spostato a sinistra del pannello | Occorre verificare selettori nativi, focus e scorrimento reali |
| Focus e tastiera | Outline dedicati; tab roving, frecce/Home/End; tab attivato prende focus; range con for/id univoci | Non riaprire come nuovi bug i problemi range/canvas già corretti |
| Esc e outside | Esc ripristina il summary e rispetta defaultPrevented/isComposing; peer esclusivi; listeners con AbortSignal | Resta il percorso sul vuoto del dock sopra descritto |
| Motion | Entrata220ms e disclosure180ms; reduce disattiva animation/transition, incluso ::details-content | Da vedere apertura/chiusura con e senza supporto CSS; non attestato da foto statica |

I documenti precedenti qualificano leggibilità e clic canvas in un perimetro
esplicito; non chiudono l'intera fase 4. La leggibilità del ciclo 10 usa anche
375×812 e1280×500, che non equivalgono alle due viewport richieste qui.
Nessun redesign, variazione tipografica o rimozione di funzioni è giustificato
da questa sola prova. La prossima azione utile è il singolo percorso di focus
sopra descritto, dopo la conclusione delle misure A/B/A.
