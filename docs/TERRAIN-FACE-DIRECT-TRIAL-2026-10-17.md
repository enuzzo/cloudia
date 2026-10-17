# Cloudia — trial del diretto da normale di faccia

17 ottobre2026, ciclo42. **FAIL visivo, candidata non adottata. Prodotto v61 invariato e goal attivo.** La prova verifica il passo scelto dal ledger precedente: cambiare soltanto la luce diretta, senza altra regolazione di creste, palette o bias. Il risultato peggiora la credibilità del paesaggio.

## Un solo cambiamento, fuori dal prodotto

Base141sorgenti v61, manifest `2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73`, implementation8a9535f/documentationHEADebcca43. Owner esterno `experiment-v61-face-direct-r1`, opzione immutabile solo `profile=1&faceDirect=1`. Flag spento restituisce esattamente la libreria ottica originale. In modalità B sostituisce soltanto D=max(dot(n,Sun),0) con quello di una normale geometrica del fragment da cross(dpdy(point),dpdx(point)), orientataY+. La normalizzazione è protetta da1e−20 e usa la macro normale come fallback per cross finito nullo/tiny. Non è una garanzia universale per derivate arbitrarie NaN/overflow.

Derivate fuori da branch, prima dei select. Macro e rough usate dagli altri termini, albedo ottico, WorldCover, S, visibilità solare, acqua, blend costa, trasporto atmosferico, geometria e asset rimangono invariati. Nessuna primitiva/texture/pass/target nuovo. Il compilato può cambiare DCE/algebra: non perfetta identità delle operazioni o prova fisica. Questo è distinto dal crease45° respinto, che modificava gruppi di normali e duplicava vertici.

Protocollo prima del freeze143sorgenti **`b3f253843ed7d57c8d45d37dce65775e0e1fe1f8f4a3b2400f380aaee9336a65`**. Review statica indipendente PASS senza blocker per la posa prevista. **575test/54file, typecheck e APPbuild PASS**:561della base prodotto+14del helper. Ripartito dalla base141, non dal ledger144 del ciclo41: non sono stati rimossi test prodotto. Hero non ricompilata, nessuna adozione da qualificare.

## A/B/A nativo qualificato

Un solo renderer/tab attivo in sequenza. Stessa camera mondiale fissa del ledger, seed74/t60paused, Sole assestato, vento55%, dispersione/pioggia0, fullflow,256³/128³/384, output=interno=canvas2474×1844. Browser plugin assente; CUA Playwright sul tab IAB esistente. Flusso: nuovo owner A→audit+PNG→B→audit+PNG completo→ritorno A→audit+PNG.

| Owner | Whole RGBA32F cached=fresh | PNG nativo |
| --- | --- | --- |
| A ordinario | `07fa43ec5de6d77b9bdf83d5a78e73cb607ae573d875ce382b3c28f909fb2fb9` | `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9` |
| B faceDirect | `efcfeab71e90f5c6a22b30f1473e75c414e661493c5aa70a5d8ff52419767a4d` | `66aa0e659a0975b55960c151caa75eeb1063ae868636256fe44f735d40909d67` |
| Ritorno A | identico ad A | identico ad A |

I sei digest alpha interi su4.562.056pixel sono **`29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c`**; dodici parole distanza selezionate identiche fra tutti gli owner. Controlli e statistiche geometriche canonici corrispondono; TerrainMesh/builder e dati sono byte-originali. Non sono stati rihashati i quattro array CPU in questo ciclo né letti i vertex buffer GPU: la parità alpha qualifica le distanze/receiver di questa vista, non una prova globale della geometria o del depth grezzo.

B: **2474×1844,3.804.264B,78parti complete**, lunghezza/SHA/IHDR e ledger delle parti verificati. A/ritorno: metadata freschi,3.599.836B e digest del bitmap v61 già conservato; bitmap rihashato e alias espliciti, nessun trasferimento duplicato inventato. Console[] nei tre owner.

L'analisi indipendente saved-only supera101gate. Cambiano6dei12pixel/18paroleRGB. L1 eL3 restano bit-esatti; il contrasto Y Michelson L2 passa da+.175190855 a−.185354446: ordine invertito, magnitudine non ridotta. **Non sono stati letti D o la normale da derivate di B.** Il delta RGB e il codice delimitano il controfattuale, non misurano quei fattori né dimostrano miglioramento artistico.

## Gate visivo: FAIL

Root e review indipendente hanno visto full nativi e ritagli1:1: B accentua alcuni rilievi ma rende leggibili triangoli, piani e diagonali sui versanti vicini; nella catena lontana emergono facce/piramidi. La tessitura satellitare resta sopra una mesh più visibile, senza diventare roccia credibile. Le fasce non risultano risolte. Maggiore nettezza non equivale a fotografia.

Crop storici espliciti in coordinate PIL L/T/R/B: primaria[0,560,1000,1000],1000×440; secondaria[700,540,1030,780],330×240. **Ho inizialmente esportato la secondaria come una ROI ampliata1030×780:** conservata come supplementare, non spacciata per il riferimento. Aggiunti i due tagli storici esatti, A identico al vecchio PNG/crop, verificati entrambi dal revisore con addendum; FAIL confermato. Sei crop lossless/unresampled e convenzioni nel crop-ledger. Originali full conservati o alias esatto: nessuna informazione persa.

Stop rispettato dopo FAIL: nessun blend, forza, angolo, bias, altro trial, benchmarkFPS o estensione a worker/meteo/moto. La variante non è una nuova base. Nessuna nuova conclusione60FPS; pioggia pesante resta il collo di bottiglia precedente~19invii/s non rimisurato.

## Prossima tranche del goal completo

[Audit requisiti e gate aperti](measurements/terrain-face-direct-trial-2026-10-17/review/full-goal-gates.md): anatomia delle3famiglie, vicino e luce in moto, pioggia/virga, terreno,60FPS e UI rimangono aperti. La roadmap non aggiunge nuove condizioni di completamento. La preferenza utente per geografia reale è preservata; aree abitate sono materiale nella texture, senza edifici3D.

**Prossimo intervento selezionato, ancora proposta:** [ancorare l'intero outflow sheared alla sorgente matura](measurements/terrain-face-direct-trial-2026-10-17/review/anatomy-next-action.md). Nel sorgente corrente cap sheared assoluti e streaks indipendenti possono conservare la mensola separata dal percorso alimentante. Una singola traslazioneXZ dalla prosecuzione foundation→summit alla quota del primo cap, applicata solidalmente a entrambi i core/streaks e parent esplicito; nessun lift, aumento raggi o nuovo rumore. Diversa dalla rotazione prossimale già fallita. La contrazione globale assi può spostare indirettamente altre coordinate: registrarla, senza promettere identità delle torri. Prima un solo A/B nativo fronte/lato74 a camera mondiale congelata, FAIL/stop se mensola solo traslata, nuova parete/cuscino o nessun beneficio. Vicino/altre famiglie e FPS soltanto dopo beneficio visivo. Nessun codice, modello o rendering eseguito per questa proposta.

## Continuità

Preview ordinaria **4196/v61** ripristinata: Sole/nube matura animata,14sinistra/3giù, canvas2474×1844,viewport1237×922,console[] e screenshot salvati; owner48736 confermato vivo. QA53785/session54482 chiuso intenzionalmente exit0. Source/dist completi esterni `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle38/face-source`. Nessun install/lock edit; dipendenze Gitignorate/non tracciate e Dropboxignore1 prima/dopo; node_modules2/ e4201 estranei preservati. Tutti141sorgenti prodotto immutati. Nessun push/deploy.

[Archivio](measurements/terrain-face-direct-trial-2026-10-17/README.md): **45payload/6.436.251B**, manifest **`caebb0e3f67238b1c94f88067da17022b7229417be8df197bb3f012cb0f600b3`**. Overlay4file/base141/esperimento143, protocollo, fullB/6crop/78partledger, metadata/alias, source/native review+addendum e analisi101gate. Savedverifier controlla byte/contratti, PNG/crop e141correnti, senza replay modello/GPU/FPS o nuova accettazione artistica. Il ciclo è progresso perché chiude il confronto causale scelto e respinge una modifica peggiorativa; non completa il goal.

Fonti primarie: [WGSL derivative functions](https://www.w3.org/TR/WGSL/#derivative-builtin-functions), [Three r186 normalFlat](https://github.com/mrdoob/three.js/blob/r186/src/nodes/accessors/Normal.js). La review richiama Disney2019 come contesto, non come diagnosi shadow-terminator dei nostri pixel.
