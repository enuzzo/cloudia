# R5 R2 — sola componente inward, candidata esterna non adottata

Questa variante usa i 119 file v55/R3 congelati e conserva integralmente la R1 full-axis separata. Cambiano soltanto il blocco joint di `volume.ts` e l’etichetta diagnostica `observatory-v56-inward-shoulder-trial`.

Il corpo comune e i suoi 91 elementi conservano ogni valore di A. Se la spalla matura punta verso l’altra cella (`projection > 0`), la sola traslazione X/Z `-inner * projection` rimuove quella componente; lo scostamento perpendicolare, Y, raggi, blend e gli scostamenti relativi dei figli restano invariati. Nessuna nuova primitiva, estrazione RNG, frequenza o coefficiente.

Gli 8 prefix nominali effettivi (74/77/80/617/323/917/2 più 926 aggiunto su richiesta) verificano identità esatta A fuori dal gruppo selezionato, corpo91 sempre A, RNG/assenza alias e invarianti geometriche senza riscrivere la formula della candidata come oracle. Sono PASS. Il caso917 passa da941.805m della ricentratura completa a6.699794m, conservando la componente perpendicolare; il caso926 richiede807.388322m inward. Il caso617 resta tutto A. La tolleranza delle sole identità geometriche derivate è1e-12km; le tuple non modificate usano deep equality esatta inclusi segno di zero e lunghezze.

31 test focalizzati, typecheck, una build app e una hero separata sono PASS. Il suffisso di rasterizzazione e le dipendenze light/sun/motion/inclinedShoulder restano identici; CSS compilato identico. `source-freeze.json`, `checks.json`, manifest source/dist, patch e verifier conservano la provenienza.

Questi controlli non sono un render né una qualifica della forma. La traslazione può ancora peggiorare il raccordo o far avvicinare lobi al dominio dopo il precedente contenimento orizzontale: nessuna prova universale di assenza clipping viene dedotta. I casi nominali non sostituiscono lo scanner indipendente, la bake256/128 o il giudizio browser. Il conteggio323inward/18outward/683altre famiglie deriva dal precedente scanner e non è stato rieseguito qui. Nessun vantaggio FPS o adozione dichiarati.

Servire `dist/` per il trial app; `hero-dist/` è indipendente. Nessun server avviato. Nessun file del repository prodotto modificato.
