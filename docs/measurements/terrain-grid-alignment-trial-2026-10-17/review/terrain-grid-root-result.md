# Root result: frozen numeric gate FAIL

17 ottobre2026, ciclo47. Due generazioni effettive sequenziali completeentro budget, A32m eB31.25m. A riproduce6hashgeometria e4730888Bfitstorico esatti; frozen19input invariati prima/dopo i child. Nessunbuilder ripetuto. Il runner non cambia sorgenti, soltanto spacinginput.

Analisi root dei due streamF64completi salvati su591361fit+589824holdout. Script e criterio erano congelati prima delle mesh (ANALYSIS-FREEZE-BEFORE-MESH). Punti/ordine/reference sferica identici, costa>=0 come maschera delmateriale, non validazione geografica indipendente. p99 è sortedabs[floor(.99*(n−1))].

FAIL sostanziale: RMSlandfit11.64136→9.95650m, maRMSlandholdout7.38676→8.15934m. Il massimoassolutofit96.06550→125.75545m e p99globaleholdout25.00928→25.69031m. Quindi falliscono tre condizioni primaB: fitmaxnonmaggiore, holdoutRMSlandinferiore, holdoutp99nonmaggiore. Holdoutmaxmigliora87.02977→75.31293m, senza compensaregli altri criteri. B ha meno geometria (568304vertici/1135582tri/31.813MB contro591788/1182550/33.128MB), entrocap, ma questo nonpromuove un rilievo geometricamentepeggiore nei punti fuori selezione.

Regressioni locali conservate: fit407601migliorano/183705peggiorano/55uguali, regressioneassolutamassima101.09762m; holdout244539migliorano/345283peggiorano/2uguali, massima62.72059m. Sulholdout aumentano da84063a116541i punti globali oltre5m. Non è unguadagnogenerale di rappresentazione mascherato da ungate troppo rigido. È una differenza tra adattamento ai nodi e superficie intermedia. Non deduco automaticamente unacausa unica né un artefatto nativo.

A wall2.41568s/CPU2.75435s/peak888.816MB; B2.26724s/CPU2.63219s/peak852.836MB. RSSDarwinwait4perPID, childseparati, nonlimiteallocazione; launcherCPU.17015s/wall4.85864s. Nessun guadagnoGPU/FPS da questinumeri.

Stop definitivo diquestospacing: nessun'altrolarghezza, tuning, build, candidatoeditato, GPU, meteo/worker/moto oFPS. La copia141 `candidate-source` era preparata esatta v61 prima dellemesh e resta noneditata/nonbuildata; non è un prodotto nuovo. Canonico141 v61 invariato, preview4196ordinaria restaquella ripristinata nelciclo45.

Prossima azione: valutare la fattibilità di una patch nel core misurato che triangoli direttamente il reticoloDEM125m, alposto degli anelli che sottocampionano lafonte e di una selezione sui soli nodi. Prima conteggi/cap, raccordo conforme al dominioesterno e lookupcamera, senza assumere accuratezza continua o fisicadellaroccia sotto125m. Non un'altra larghezza o modifica dellalucedopo questoFAIL. Nessun modello/prodotto diquesta proposta eseguito qui.
