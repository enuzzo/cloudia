# Pioggia: supporto alpha R8, parità visiva ma adozione respinta

17 ottobre 2026, ciclo 51. **Prodotto v61 invariato; goal attivo.** La candidata esterna `experiment-v61-support-alpha-r8-r1` conserva il fotogramma di riferimento, ma fallisce il criterio FPS prefissato. [Archivio](measurements/rain-support-r8-trial-2026-10-17/README.md) e [integrità](RAIN-SUPPORT-R8-VERIFICATION-2026-10-17.json).

## Modifica qualificata

Il worker copia in un buffer indipendente l'alpha già completata del detail RGBA 128³. Solo il ramo piovoso usa questa nuova texture R8 per il broad support; RGB, coordinate, sampler del detail, Repeat/Linear, inset, clamp, LOD0 e predicati sullo zero restano quelli canonici. Nessun nuovo campo o bake, soglia, passo, rumore o ricalcolo della densità. Il default dry e il wet senza nuovo flag restituiscono il WGSL originale; l'inversione della sola derivazione riproduce il file canonico. Non è il macro R8 o la narrow mask già presenti.

Costo aggiunto nominale: **2.097.152 byte CPU e altrettanti GPU persistenti**, un buffer trasferito e un binding wet. Il detail RGBA resta necessario. Upload/residenza GPU e traffico fisico non sono misurati; una risorsa più piccola non garantisce un accesso meno costoso.

Base canonica 141 file, manifest `2577f187…`. Candidata R2 143 file, manifest `428da0e9…`, nove delta: quattro runtime e cinque file di test. **Typecheck, 580 test su 54 file e build APP PASS.** La prima suite R1 ha 579 PASS / 1 FAIL: un secondo test del worker elencava ancora cinque buffer. R2 corregge soltanto quel test, richiedendo il sesto buffer, alpha11 esatta e non-aliasing; progresso/errori conservati. Freeze, test fallito e raw originali restano archiviati. Nessun runtime cambiato dopo R1. Hero non ricompilata dopo il successivo FAIL di adozione.

## GPU e immagine

Prima dell'app è stata eseguita una sola pagina WebGPU isolata: due volumi sintetici **128³**, rampa a 8 bit e supporto binario, sampler Repeat/Linear, stessa espressione di clamp/inset/LOD. **7.833 punti per caso**, con coordinate float32 e output completi salvati: zero differenze di parola float32, zero divergenze del predicato zero, tutti finiti, sia risultati positivi sia nulli. Readback e coda drenati; dispositivo distrutto prima di caricare Cloudia. Review indipendente conferma hash e aritmetica.

È una prova sui punti dichiarati: il foro del campo binario non è coperto esplicitamente e il minimo positivo binario campionato è 0,5. Gli ULP di coordinate sono realmente distinti, ma non dimostrano equivalenza universale o code filtrate arbitrariamente piccole. Nessun punto aggiunto dopo i dati.

Seguono nuovi export nativi A/B: seed74, pioggia Float32 0,8 assestata, camera mondiale identica, sim60/forcing0/precipitazione0/flow60, pausa, main/full flow/full ablation, **256³/128³/384, output e interno 2474×1844**. B dichiara il percorso R8 128³ effettivo, 2 MiB e fallback nullo. Il PNG completo è identico: **3.258.221 byte, SHA256 `6ea5e9a22052c40ebdbd223594a1a9ec2761e321410e6a009086ea8ca5972fd1`**. A riusa un bitmap precedente soltanto dopo il nuovo export e il rehash; B ha DTO proprio e alias verificato. CRC/IEND e bitmap completi verificati indipendentemente.

Confronto ricorsivo di tutti i DTO: 16 differenze ammesse dal protocollo, cioè 14 identità/contatori/versione/weatherTime locali, il nuovo oggetto `supportSampling` qualificato integralmente e rain CPU F64 diverso ma stesso Float32 `0x3f4ccccd`. Nessun altro input fisico diverso. Questa parità riguarda un singolo stato fermo PNG, senza nuova prova HDR, animata o artistica.

## Confronto attivo completo

Un solo A1/B/A2, **90 secondi ciascuno più warmup2**, main/stages, qualità e camera come sopra, nube attiva, niente orbit/navAudit/frame cap/flash/dispersione. Il protocollo `ec9365c6…` precede GPU e benchmark. Avvii reali sim/forcing: A1 60,05/0,0659; B e A2 60/0, tutti entro lo stesso inviluppo100ms. I clock non sono replay per frame.

| Finestra | Intervalli / durata | Invii/s | Con completamento finale | p95 / p99 / massimo |
| --- | --- | ---: | ---: | --- |
| A1 v61 | 1306 / 90,0214 s | 14,507662 | 14,461380/s | 83,4 / 84,0 / 84,4 ms |
| B R8 | 1364 / 90,0549 s | 15,146316 | 15,097982/s | 83,4 / 83,8 / 84,3 ms |
| A2 v61 | 1469 / 90,0223 s | 16,318179 | 16,272969/s | 83,7 / 116,5 / 117,7 ms |

Il criterio prefissato richiede B almeno **+5% sopra il migliore A**, sia negli invii sia nel tasso con completamento, e p95/p99 non peggiori del peggiore A. B passa i percentili ma fallisce entrambi i throughput: soglie 17,134088 e 17,086618/s. B/A1 è +4,40219%, B/A2 −7,18133%; **A2/A1 varia +12,47973%**. Non è dimostrato un beneficio causale R8 né una regressione universale. I circa19,9 del ciclo50 sono continuità storica, non un confronto matched o una causa identificata della differenza attuale.

Tutti i prefissi sono completati: 1306/1364/1469 confermati, nessun invio misurato residuo; drain283,4/276,1/233,4ms. Timestamp completi render+compute: **1304/1306, 1361/1364, 1468/1469**. Mancanti conservati; tre pass unmatched A1 e tre B precedono i rispettivi ledger e restano esclusi, nessuno in A2. UID, mapping, somme dei pass e dati sparsi verificati indipendentemente. Invio, conferma, somme GPU e presentazione restano misure diverse; `presentedCanvasFps` è nullo.

Il primo controllo aritmetico A2 fallisce soltanto per un ULP nella durata: `sum()` Python3.14 produce90022,30000000002 mentre il `reduce` sequenziale JS produce90022,3. Il verificatore corretto usa le stesse addizioni sequenziali e coincide esattamente, senza tolleranza o soglia nuova. Vecchio programma, FAIL iniziale e receipt conservati; nessun nuovo benchmark. Il [cambiamento dell'algoritmo float di Python](https://docs.python.org/3.14/library/functions.html#sum) è documentato dalla fonte primaria; il caso effettivo è riprodotto sui dati salvati.

## Decisione e continuità

Root e reviewer indipendente: **FAIL_ADOPTION_GATE_NO_ADOPTION**. Nessun tuning, altra ripetizione, hero, worker o ampliamento meteo/anatomia della candidata dopo il FAIL. I 141 file prodotto sono esatti. Preview4196 ripristinata a Sole/nube matura animata, canvas2474×1844/CSS1237×922 e console vuota; solo server candidato53790/session80462 chiuso, exit0. Dipendenze Dropbox ignore1 prima/dopo, nessun install/lock edit, `node_modules 2/` e4201 preservati. Nessun push/deploy.

La [proposta strutturale per l'anatomia](measurements/rain-support-r8-trial-2026-10-17/review/anatomy-next-substantive-action.md) riguarda la generazione volumetrica precalcolata al posto delle torri complete con cap aggiunto. È ancora un progetto da specificare, con guide delle tre famiglie e filtro/supporto conservativo da definire; nessun modello eseguito o beneficio dimostrato. Mantiene un campo finale256³ reale, senza ingrandire un volume più piccolo, detail128³ e renderer attuale. Il prossimo lavoro deve arrivare a immagini fronte/lato72/73/74 alla camera A, dopo le correttezze necessarie, senza sostituire il risultato artistico con grandi witness.

Anatomia delle tre famiglie, vicino/luce/moto, pioggia/virga, fotorealismo del terreno, UI e60FPS a qualità piena restano nel goal. Geografia reale con abitati nello stesso materiale confermata; niente edifici3D/pass aggiunti per rappresentarli, nessuna promessa costo totale0.
