# Artefatti sulle creste: ramo isolato, trial scartato

16 ottobre 2026. **Prodotto v57 invariato; goal attivo.**

Le PNG native mostrano piccole macchie scure geometriche sulle dorsali a
sinistra della nube, sia al Sole sia con pioggia. Sono distinte dalle vecchie
fasce argentate: costa e forme del terreno ora provengono dai dati reali,
ma versanti uniformi, profili angolosi e dettagli poco ricchi restano aperti.

## Discriminazione effettiva in app

Due snapshot esterni di124sorgenti, base `99fc989`, sono stati confrontati
con la PNG Sole nativa v57. Camera completa, seme74, t60 in pausa,
materiale, luce, meteo assestato, macro256³/dettaglio128³/384passi e
output/interno/canvas2474×1844 coincidono. Cambiano versione diagnostica
e soli contatori/clock locali non campionati dal materiale assestato.

Primo esperimento: soltanto il materiale del terreno riceve
`solarVisibility=1.0`. Il pass e le risorse shadow restano nel codice;
non è un'ablazione qualificata del costo, anche perché il compilatore può
eliminare espressioni inutilizzate. La PNG completa cambia1.778pixel su
4.562.056, tutti con variazioni RGB non negative. Nei tre rettangoli fissati
prima della prova spariscono cunei e tagli scuri. Root e lettura indipendente
attribuiscono queste tracce al fattore di visibilità dell'ombra. L'ablazione
toglie anche ombre proiettate valide: **non adottata**, non prova da sola che
ogni pixel scuro fosse fisicamente errato o che le ombre vere siano preservate.

## Trial del distacco dal piano locale

Il secondo esperimento conserva il confronto shadow e completa il vecchio
distacco radiale di mezzo texel lungo la normale geometrica della faccia.
Derivate calcolate prima del ramo UV, cross riscalato, normalizzazione protetta
e fallback radiale; stessa mappa, unico lookup, draw e byte persistenti invariati.
Aumentano operazioni aritmetiche e derivate per frammento: non è costo zero.
UV e quota solare provengono dallo stesso nuovo punto del lookup.

La proprietà locale è verificata: distacco dal piano31,25m e spostamento
totale massimo44,20m in aritmetica reale sul caso non degenere. L'oracolo CPU
standalone registra654assert/126casi,108controesempi del solo bias radiale;
errore massimo locale double6,70e−16km, surrogatef32≈0,315mm. Limiti espliciti:
un blocker separato200m resta in ombra, ma un contatto reale35m può sparire;
un texel con più facce può ancora produrre una falsa ombra. Il surrogate
semplifica il raggruppamento delle somme radiali e non certifica parità GPU.

Il launcherR1 è fallito prima dell'exec Bun nel setup dei limiti. Failure e
freeze conservati; R2 modifica solo il wrapper: CPU kernel5s e RSS terminale
verificata sotto2GiB, senza imporre un limite allo spazio virtuale del JIT.
Unico run numerico effettivo: exit0, CPU0,122854s, wall0,168507s,
RSS119.701.504B. Nessuna nuova suite Vitest del prodotto eseguita sui trial.

Typecheck e app→hero dei due snapshot PASS con exit0. Il nuovo WGSL è stato
compilato e ha prodotto la PNG nel browser, senza warn/error osservati.
La PNG normal-clearance cambia1.006pixel rispetto alla base e782 rispetto
al controllo senza ombra; alcune variazioni RGB sono negative fino−9,
perché il nuovo lookup cambia anche UV e quota, senza monotonia garantita.

**FAIL visivo condiviso, variante scartata.** Il grande cuneo L1 persiste,
L2 conserva residui e L3 mostra ancora il cuneo con un gradino scuro angoloso.
La proprietà del piano locale non risolve il campionamento della scena.
Stop alle ulteriori catture Pioggia/Tramonto su questo trial; nessun aumento
del margine, adozione, nuova misura FPS o qualifica worker dedotti dai PASS CPU.

## Stato riproducibile e seguito

Archivio curato:
[measurements/terrain-shadow-native-2026-10-16](measurements/terrain-shadow-native-2026-10-16),
77payload/6.002.388B, manifest SHA256
`820cce30ba33906249d0df8f31f6b584345e8baead496cc800ac6da4ee7e6272`.
Verificatore offline PASS: byte, decodifica integrale PNG, ledger delle parti,
metadati, differenze, risultati numerici salvati e124sorgenti base più
ricostruzione virtuale dei due candidati. Non riesegue il kernel CPU o GPU.
Le PNG base restano nel pacchetto v57, senza duplicarle in questo archivio.

Source/dist completi esterni in
`/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle25`.
Server dei due trial e QA53760 terminati; solo preview ordinaria4196
di proprietà di questo lavoro conservata, v57 Sole animata nativa e console
osservata senza warn/error. Nessun sorgente prodotto modificato dopo99fc989.

Il prossimo passo sulle scaglie deve discriminare un ricevitore reale e il
texel shadow che lo oscura, con le facce della mesh effettiva alla posa fissata,
prima di un altro bias o filtro. Un piccolo witness CPU di raggi selezionati
nelle ROI può distinguere auto-ombra e blocker vicino; non una nuova scansione
globale o un altro coefficiente. Normali/materiale troppo uniformi restano un
intervento separato; nessuna grana aggiunta per mascherare gli artefatti.
Anatomia, luce ravvicinata, pioggia/virga, moto, UI e60FPS restano nel goal.
