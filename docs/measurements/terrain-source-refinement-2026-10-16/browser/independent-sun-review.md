# Review visiva indipendente — Sole, candidato geometria

**Verdetto: PASS incrementale per questa posa.** Il guadagno sulle creste è visibile e moderato; non vedo un nuovo pattern regolare, speckle diffuso o una regressione riconoscibile della costa. **Nessun PASS artistico globale, sulle ombre o sulle prestazioni.**

Ho aperto entrambi i PNG nativi2474×1844 con `view_image`, poi sei crop abbinati senza resize, filtro, contrasto o differenza artificiale. Posa, luce e qualità full abbinate sono l'input dichiarato da root; questa review non ripete la verifica dei metadata né usa un modello. Originali preservati.

| Zona | Osservazione nel confronto |
|---|---|
| Crinali e versanti a sinistra, circa x0–1050/y580–1050 | Il candidato interrompe alcuni piani e tratti rettilinei più ampi della baseline; i piccoli crinali e gli impluvi hanno articolazioni più continue. Il volume si legge un po' meglio come rilievo ramificato. Beneficio locale reale, senza trasformazione radicale del paesaggio. |
| Superfici illuminate delle creste in primo/medio piano | Nel candidato la modulazione segue meglio la forma dei versanti. Restano forme lisce e materiale poco descrittivo della vegetazione; non le qualifico come fotorealismo compiuto. |
| Patch d'ombra sui monti | Le macchie scure nette restano, con alcuni contorni diversi insieme al rilievo. Non considero risolto il problema già aperto e dalla foto non attribuisco ogni contorno a geometria o shadow. Non vedo però il nuovo reticolo di puntini/trattini regolari che aveva bocciato il trial caster/clipping. |
| Costa nella parte bassa | Sagoma ed equilibrio mare/terra visivamente stabili nel crop abbinato; nessun nuovo foro, gradino macroscopico o linea regolare evidente. È un giudizio visivo, non un claim di identità pixel. |
| Pianura destra | La trama materiale e le grandi zone scure preesistenti restano riconoscibili. Non noto una nuova puntinatura o scacchiera associata al raffinamento. Il materiale continua ad avere un aspetto mosso/macchiato, già presente nella baseline. |
| Rilievi lontani | Foschia e contrasto basso limitano la lettura: qui non rivendico un beneficio convincente. |

## Input identificati

- Baseline: `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/terrain-shadow-cache-2026-10-16/browser/v58-main-sun-terrain-native-settled.png`, 2.817.764B, SHA256 `af8877ac93db6fcd50ab3ceece43ac1a40fc7d21c41151afb3a9620ca7586be5`.
- Candidato: `refine-main-sun-native.png`, 2.909.134B, SHA256 `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`.

Crop Pillow deterministici, coordinate native `[left,top,right,bottom)` identiche per A/B, soli pixel originali:

- `independent-{baseline,candidate}-ridges-crop.png`: `[0,580,1050,1050]`.
- `independent-{baseline,candidate}-coast-crop.png`: `[0,1280,920,1844]`.
- `independent-{baseline,candidate}-plain-crop.png`: `[1600,540,2474,880]`.

## Limiti del gate

Questo PASS permette di proseguire la qualifica separata del candidato; non equivale ad adozione. Una sola posa Sole, molte aree coperte dalla nube o dalla foschia, nessun movimento: non certifica altre camere, pioggia, continuità temporale, tutto il core o assenza di microdifetti. Le patch shadow note rimangono aperte. Nessun FPS misurato o inferito dal PNG/count della geometria. Nessun browser, GPU, modello, bake, test o modifica di sorgenti eseguito per questa review.
