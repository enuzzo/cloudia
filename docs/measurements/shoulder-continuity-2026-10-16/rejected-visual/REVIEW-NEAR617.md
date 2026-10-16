# Seed617 vicino — FAIL dell'adozione R3

**Decisione Root: R3 non adottata. La review indipendente conferma il bilancio negativo del percorso vicino617, senza cancellare i miglioramenti locali lontani77/80.** Otto JPEG locali sono stati visti, più i record UI e i due rapporti camera originali; nessun nuovo browser/GPU o modifica prodotto.

## Risultato visivo

- **Approach80, Sole:** A è insufficiente nel dettaglio, ma conserva un ampio margine scuro della nube e una porzione leggibile di cielo/orizzonte. B occupa quasi tutto il quadro con materia chiara e perde il contesto esterno già a questa posizione.
- **Approach95/100, Sole:** A mantiene ancora un bordo e un'apertura verso il cielo; B è quasi completamente uniforme bianco/grigio. Non è soltanto lo stesso difetto vicino già presente con identica gravità.
- **Approach100, Tramonto:** A conserva la separazione fra margine scuro e cielo caldo; B diventa una superficie rosata quasi uniforme. La luce bassa non recupera la leggibilità del volume.

Entrambi falliscono la resa fine vicina, ma R3 peggiora la leggibilità del percorso osservato. Il precedente costo a cuscino del corpo617 e la minore emergenza relativa del giovane acquistano peso: il piccolo guadagno di raccordo sui casi77/80 non giustifica questa regressione d'uso. La grande U resta un problema preesistente aperto, non la ragione unica del rigetto.

Le etichette80/95/100 descrivono le posizioni di avvicinamento riferite da Root, **non distanze in metri**. Il raw100 conferma `approach=1`.

## Camera: mira uguale, origine diversa

| Dato raw100 | A v55 | B R3 |
| --- | --- | --- |
| Target | `[0.52734375, 3.052734375, 0.02734375]` | `[0.52734375, 3.052734375, 0.02734375]` |
| Origine | `[0.52734375, 3.052734375, 0.25908496633069245]` | `[0.52734375, 3.052734375, 0.7225613088278932]` |
| surfaceEstimateKm / probe.distance | `0.23174121633069247` | `0.6952175588278932` |
| probe.found / yaw / pitch | `True / 0 / 0` | `True / 0 / 0` |

La stima della superficie aumenta di **463.476342 m** e la camera finale arretra della stessa quantità lungoZ; X/Y e target restano uguali. Quindi il differente risultato **non deriva da una mira spostata**, ma le due immagini non sono neppure un confronto a origine mondiale identica. Sono la risposta del normale percorso di avvicinamento alla geometria/campo cambiati. Non si dimostra da questi record un bug del probe, una camera interna, la correttezza fisica della frontiera o un contributo radiometrico isolato del solo lift. Non serve conoscere tale causa fine per constatare il FAIL dell'esperienza vicino R3.

I raw confermano seed617, t60 in pausa, vento55%, dispersione0, clear/full flow/full ablation,1920×1080 interno/output,256³/128³/384. `comparisonSurfaceKm` e `comparisonTargetKm` sono nulli: percorso ordinario senza override diagnostico di target/superficie. I JPEG restano CSS1237×922, non readback nativi. I due report30s sono letti qui per stato/camera, **non come confronto FPS causale**.

## R4: critica concettuale, nessuna implementazione qui

La restrizione proposta da Root è coerente con un fix circoscritto della **spalla inward**: eseguire insieme lift del corpo e rientro soltanto quando la proiezione selezionata è positiva. Ripristina integralmente A nei18 outward del prefisso congelato, mantiene R3 nei323 inward e A nei683 delle altre famiglie; nessun `if(seed)` o nuovo coefficiente. Non vedo una contraddizione concettuale: il tetto alzato viene mantenuto dove accompagna un attacco che rientra, invece di applicarlo anche ai layout outward che hanno prodotto il costo617.

Questo restringe l'obiettivo e non risolve il raccordo di ogni configurazione né la grande U. Il numero18 riguarda il range0..1023/runtime congelati, non tutto l'universo dei seed. Soprattutto **non qualifica il vicino dei323 inward**:74 e un caso77/80 con lift maggiore devono ancora dimostrare un percorso leggibile, senza la perdita di contesto vista qui. L'identità R4→A del617 evita questo cambiamento solo se verificata sul layout effettivo; non è da sola un PASS fotografico del vicino baseline.

R3 resta un trial ritirato per l'adozione; i PASS locali77/80 rimangono parziali e validi nel loro ambito lontano/Sole. Nessun runtime è stato modificato da questa review.

## Originali letti e SHA-256

| File | Byte | SHA-256 |
| --- | ---: | --- |
| `a617-near80-sun.css.jpg` | 32884 | `3b6cb7dde15e3277a22c3318c97ad7ed134c57bf6621fa9140f445c12e52c33c` |
| `b617-near80-sun.css.jpg` | 35127 | `06658655b632f873b7bb6b331c4ef2aa16b1e8429fb1667e6b6a5d70ce38574a` |
| `a617-near95-sun.css.jpg` | 33817 | `2d528294d40fd3ad845617ad53bb9582d1c6a2850b6506b434601e16c2c2cb48` |
| `b617-near95-sun.css.jpg` | 27993 | `764a6d26ebe290fb355b2c96288867e221d2105abc6687a54b79b9dddcba6207` |
| `a617-near100-sun.css.jpg` | 33598 | `369467b2dbdc6ef1721dc8987a792a9a79259af6f70bcd2e6d976ce042068809` |
| `b617-near100-sun.css.jpg` | 27170 | `d642f5addb8fc2085f52f21f477ebb890399f262b0b58754341905120993782f` |
| `a617-near100-sunset.css.jpg` | 30143 | `224708efa3a9da283595f228a4b79bc0f3468583006eab6276b9087ffb89a45e` |
| `b617-near100-sunset.css.jpg` | 28159 | `e915929565b5e8883d8b5c570abea119121f78baaefe21b8da5be2056c7fef0f` |
| `a617-near100-ui.json` | 483 | `b78511e3da83f38c4d329097b5d4f9c9638d0266dedd0f8d2284840ef29747b1` |
| `b617-near100-ui.json` | 483 | `c3c811e4a98e09f0bdc05308d7310864afd6ecf813e8a92b4f8dc91a12097ad2` |
| `a617-near100.raw.json` | 3412894 | `0d9323168426c3e76894788e45929975fd76c55f53793aec43814d0ac712ef26` |
| `b617-near100.raw.json` | 4378580 | `81614b2b7f39733694231d22ffaf29dd3997bc7570ff8d3d15fc866eb163cafa` |
