# Rami gerarchici R1 — review nativa indipendente seed74

**Verdetto: FAIL del gate iniziale fronte+lato.** Giudizio formulato dopo l’ispezione dei quattro PNG completi, prima di ricevere un verdetto visivo root. Nessun crop, browser, GPU, modello o test aggiunto.

Il protocollo richiede un beneficio complessivo percepibile nelle due pose: radice obliqua leggibile, maggiore unità delle cellule e conservazione delle teste, senza nuovo cuscino/ponte massiccio o testa inghiottita. Non ho imposto la soluzione completa di cap, vicino, pioggia o tutti i difetti precedenti.

- **Fronte:** B raccoglie un poco la massa inferiore del ramo anteriore, ma nella lettura complessiva restano due montanti e una sella scura. Testa giovane, parete matura e grande cappello superiore mantengono quasi la stessa relazione visiva. Non leggo una nuova alimentazione obliqua abbastanza chiara da rendere l’insieme più credibile.
- **Lato:** il rientro della radice giovane è visibile; la parte bassa è meno sporgente e il ramo risulta più obliquo. È il beneficio locale reale. Il grande vuoto a forcella resta però dominante e il tratto sotto la testa giovane appare più assottigliato/rientrante: sul bordo destro la testa e il rigonfiamento superiore sporgono sopra il corpo con un piccolo risalto pendente. La ricomposizione complessiva non supera chiaramente A e questa articolazione risulta meno continua alla mia lettura.
- **Regressioni escluse solo visivamente in queste pose:** non vedo un nuovo ponte orizzontale massiccio, un nuovo cuscino liscio dominante, una parete tagliata contro il texture box o la testa giovane inghiottita. Queste assenze non trasformano il beneficio locale in PASS. Il motivo del FAIL è il vantaggio globale insufficiente nelle due pose, con una nuova lettura di sbalzo sul giovane di lato.

I quattro IHDR sono2474×1844. Il confronto salvato `run/BRANCH-NATIVE-INPUT-COMPARISON.json` riporta MATCH_FROZEN_RENDER_INPUTS, due pose e zero differenze inattese; le eccezioni owner-local, comprese submissions, sono già dichiarate nel protocollo preB. È una corrispondenza degli input con le variazioni anatomiche previste, non uguaglianza dei campi luce/densità né prova artistica o FPS. Protocollo:256³/128³/384, t60 paused, Sun, wind.55, disp0, camera world congelata per ciascuna posa.

Questo giudizio riguarda soltanto seed74 nelle due pose. Secondo il gate prefissato, un chiaro FAIL74 basta a fermare l’unità iniziale e non giustifica B72/B73, ulteriori pose o tuning. Non deduco un giudizio sulle famiglie non renderizzate.

## Input autenticati

- A fronte: `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/terrain-optical-material-2026-10-17/browser/candidate-b-native.png`
  - SHA256 `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9`; 3599836 B.
- B fronte: `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle41/browser/branch-74-front.png`
  - SHA256 `eb0b90f945a993afa1faaf2e1cce41a81c62b11428a95dc12f023e6c22bc2f34`; 3598957 B.
- A lato: `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/cloud-outflow-anchor-trial-2026-10-17/browser/baseline-74-side.png`
  - SHA256 `c9c4681b03b9c4771c7be62974712b12b516e8b8717c22dc0907f18318aa2749`; 1359259 B.
- B lato: `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle41/browser/branch-74-side.png`
  - SHA256 `8101ebe6a852d551b9a518a1626bf58763eecfe20685e30240cd58e76c282f66`; 1339890 B.

Protocollo SHA256 `c33cb39828ec8f7ae8ee214bd51fab583a9a21608652dd6168c98301d5816265`. Confronto input SHA256 `87f2eb77e7e843358f627b463dc91f9db7639b9bc4d2c7f2b423146e90f42a5d`. Originali PNG/JSON e sorgenti lasciati invariati.
