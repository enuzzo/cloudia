# Guardie famiglie/teste — fissate prima di B

Solo lettura/proposta, poi implementazione test autorizzata; nessun prefix, modello, test o GPU eseguito dall'agente. Base canonica141 v61, non il trial delle radici respinto.

Il test `volume.test.ts:243–252` usa tre finestreX assolute e impone picchi/sella>1,3 nel volume40³. Può quindi richiedere proprio la valle/U che il goal chiede di ridurre, e ignora il percorsoZ. Il test254–263 attribuisce l'età aX<−.75/X>.75: uno spostamento legittimo della testa può farlo fallire senza perdere età o struttura. Il fill237–242 e la connettività bulk232–235 non usano questi quadranti: restano invariati.

## Osservatore comune A/B, senza duplicare la modifica geometrica

`createLayoutPrefix(source,stage='legacy')` conserva il taglio originario PRE attachment per tutte le vecchie guardie del joint. Uno stage esplicito post-attachment usa un marker distinto prima del raster reale. Restituisce snapshot delle actual summit/foundation tuple; non si rinomina un trace PRE come se fosse POST. L'osservatore puro della densità vive nello stesso helper test-only e viene riusato dal rootA e dai testB, senza nuovo scanner/runner.

Per ciascuna actual testa, usa centro/raggi post-layout e aggiunge solo mezzo voxel per asse al dominio ellissoidale. Considera la metà superiore (`Y >= centreY−halfVoxelY`). Ciascun centro di voxel appartiene alla testa ammissibile con minima distanza ellissoidale normalizzata; i pareggi seguono l'ordine semantico del trace. Nessun segnoX o quadrante del mondo.

Una frontiera della testa richiede R>=.4 (soglia già esistente) e vicino immediato sopra con R<.4; il vicino deve esistere nel volume, quindi il bordo texture non crea una frontiera artificiale. Una testa completamente sepolta senza frontiera nella propria regione non passa. Si conservano conteggi e quota massima di frontiera per testa. La partizione impedisce che lo stesso voxel qualifichi due teste.

Nuove guardie effettive a64³ per72/73/74 e il precedente913: ogni testa reale deve avere almeno una frontiera finita nella propria regione; conteggio semantico delle teste conservato (tre congestus, due multicell/sheared). Per multicell l'ordine older/young viene dalle quote actual dei summit, non dallaX; rimane il divario di quota della densità .25km già richiesto, senza imporre una sella o due colonne separate. Y/raggi/RNG/numero primitive/radici restano anche contratti di ricetta indipendenti, non dedotti dal campoR.

## Stop e limiti

Root esegue prima A canonico64 sui soli72/73/74 usando gli actual tuple legacy e questo stesso osservatore. Se A non soddisfa il predicato, si registra FAIL e **non si esegue B né si rifittano soglie/regioni dopo averlo visto**. La proposta è una guardia necessaria per teste non cancellate e con età distinguibile, non prova automatica di due silhouette, visibilità da ogni camera o qualità artistica. R64 è il canale macro post-carving quantizzato: non certifica fine erosion, flow, rendering256³/128³, vicino o moto. Le prove native front/side/near sulle tre famiglie restano indispensabili.
