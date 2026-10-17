# Scalare DEM125m — verifica indipendente dei dati salvati

17 ottobre2026. **PASS_NECESSARY_HOLDOUT_ONLY.** Nessuna nuova valutazione sorgente, sfera, sampler, mesh, modello, test, build o GPU. Ricalcolo Python compatto soltanto dai due streamF64 salvati e dai codici coastDEM.

Autenticati result `e5fd704fed9e1c06a496083f824b5ae168b4ce2bc0f48aedb07604493c18e6b1`, rawAcompleto `ef4836da…2189d`, sua sliceholdout `220af9c8…f905`, rawB `81b2e470…8db35`, gzipB `241d51fc…4547b`, stessoDEM `92b28f01…071d`. I589.824 centri sono quelli già congelati; land334.018. A centrocellau=v=½, il segno del bilineare coast coincide con quello della somma dei quattro i16: maschera ricostruita SHA `c4f5ba0f9c978b444f036c94d08cce2d32f346c4048c7bd7b3a004abdd691b9e`, esatta al report.

| Gate congelato | Acanonico | Bscalare125m | Esito |
|---|---:|---:|---|
| RMSland(m) strettamente minore |7.386759891967312|4.27954255764613|PASS|
| p99assoluto globale(m), non maggiore |25.00927650918605|12.532219725643223|PASS|
| massimoassoluto globale(m), non maggiore |87.02977014615732|34.9382159043583|PASS|

P99ricalcolato all’indice583.924=floor(.99*(589824−1)); quadrati sommati con math.fsum, risultati coincidenti con quelli dichiarati. RMSglobale5.560346143708591→3.221229772686753m. Bsignedmin/max−29.6560186900221/+34.9382159043583m.

**Non tutte le celle migliorano:** land178.503migliori/**155.515peggiori**/0uguali; globale394.066/195.758/0. Conteggi verificati sul confronto assoluto punto per punto, conservati integralmente dagli stream. Non si eliminano regressioni locali dal verdetto.

Record root: unico child terminal0, CPU.46018s,wall.467673125s,RSSterminale268.255.232B; entro10CPU/20wall/384MiB. WrapperCPU.06873s separato. Questo conferma il gate operativo registrato, non misura il costo della futura mesh o degliFPS.

Il precedente source-review aveva verificato la derivazione: endpoint sferici canonici convertiti prima inFloat32 e media SW→NE, contro reference centrale bilineare+sferaF64. Il controllo odierno autentica e analizza l’output; non riesegue quella derivazione. La reference resta lo stesso GLO90 bilineare, non verità geografica indipendente. PASS giustifica implementare/qualificare la patch; non certifica fit, raccordo, lookupcamera, errore continuo, vicino, normali, ombre o fotografia.

Letto `patch-integration-outline-before-scalar.md`: routingcore/seam/outer, bordoCactualFloat32 con green conservati e ricomputo normali affrontano il requisito concreto della reviewstatica. Attesa review del sorgente congelato; nessuna implementazione da questa review.

Dettaglio compatto con tutti i digest e metriche: `dem-patch-scalar-independent-data.json`,2386B,SHA `f093d8755c8aad4ff0c3d85b49b5adc3429d87b88f7d62f03c6d2bf6b2b3b24f`.

## Addendum — cinque bande fisicheA già congelate
Ricalcolo soltanto savedF64+stessi coastDEM. Bande da POINTS, norma max(abs(x),abs(z)); ultima banda nominale fino65,536km, holdout effettivo fino47,9375km. P99=indice floor(.99*(n−1)) per ciascuna popolazione; nessuna riclassificazione secondo B e nessun nuovo gate.
| BandaL∞(km) | nland | RMSland A→B(m) | p99land A→B(m) | maxland A→B(m) | land migliori/peggiori/uguali |
|---|---:|---:|---:|---:|---:|
|0–4.096|56|0.019770→2.587367|0.056580→10.156806|0.117869→13.061848|0/56/0|
|4.096–8.192|3818|0.216481→2.525578|0.876078→9.843061|2.955731→20.313125|0/3818/0|
|8.192–16.384|23025|1.481096→4.797259|6.297555→16.530691|19.995934→34.938216|3024/20001/0|
|16.384–32.768|117277|2.565892→4.665600|8.801354→15.061932|29.395759→31.344646|39252/78025/0|
|32.768–65.536|189842|9.574390→3.981794|34.261739→13.312062|87.029770→29.656019|136227/53615/0|

P99/max **globali per banda**, A→B(m), distinti dai land sopra: 0: 0.003356→0.281799 / 0.117869→13.061848; 1: 0.564353→6.813155 / 2.955731→20.313125; 2: 4.471718→13.499385 / 19.995934→34.938216; 3: 7.591825→13.374609 / 29.395759→31.344646; 4: 30.110170→11.905984 / 87.029770→29.656019.

I conteggi land delle cinque bande sommano334.018 e preservano tutte155.515 regressioni. I dettagli all/land e conteggi globali sono in `dem-patch-scalar-fixed-bands.json`, SHA `e07ba28ee43ca75cf2563614687708254b19bced24788364e6987ec90eea471e`. Questa stratificazione dichiara il rischio near/far per la futura qualifica; non modifica il precedente PASS necessario globale.

**Limite sostanziale emerso:** RMSland, p99land e maxland peggiorano in tutte le prime quattro bande, mentre il miglioramento globale è sostenuto dalla banda32,768–48km effettivi. Nelle prime due bande peggiorano tutti i punti globali e tutti i punti land; la prima ha soltanto56punti land, quindi non generalizzarne il valore RMS a tutto il territorio vicino. Il coarsening near è una regressione campionata reale da dichiarare alla qualifica near/far, senza trasformarlo retroattivamente in un gate diverso o affermare un esito artistico.

**Decisione root dopo la stratificazione:** R1uniforme è superata prima di fixture/fullmesh/APP/GPU, non classificata come FAIL del gate scalare che aveva superato. Overlay143 e typecheckR1 restano conservati. La successiva R2 autorizzata mantiene tutta la geometria canonica interna fino all’actualFloat3232,768km e usa la fonte125m soltanto nell’annulus esterno; è un modello distinto da congelare e qualificare, non una reinterpretazione favorevole dei risultatiR1.
