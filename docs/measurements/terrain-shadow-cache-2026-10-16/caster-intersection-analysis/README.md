# Minimo del caster e intersezione col texel — sei record offline

**Analisi congelata, nessuna modifica del prodotto o proposta di clipping GPU.** Un solo calcolo sui sei record di `../witness/result.json`, SHA `b826b473c460ac244e89158acadc9459c5b86800305e2403cf5944a3245ec70a`. Nessuna ricostruzione mesh, nuovo raggio, GPU, bias cap, selezione o caso aggiuntivo.

## Confronto richiesto

Si mantiene il caster vincente RAW al centro del texel, gli stessi qlookup, il confronto inclusivo qlookup>=stored, la fade esistente e il margine 1 m. Per ciascuno dei tre vertici già salvati si proiettano UV e q=dot(vertex−center,sun).

1. Baseline: minimo affine su tutto il quadrato del texel, già registrato nel witness, meno 1 m.
2. Bounds1: max(baseline, min(q dei tre vertici)−1 m). Limita l'estensione fuori dal triangolo usando il suo minimo globale.
3. Intersezione: Sutherland–Hodgman sui quattro piani del texel, interpolando linearmente UV e q a ogni taglio. Poiché q è affine, il minimo sul poligono convesso è il minimo sui suoi vertici, poi si sottrae 1 m.

“Esatto” indica il minimo della geometria affine salvata in aritmetica reale, valutato qui Float64 con controlli residui. Non significa rasterizzazione o f32 GPU esatti. Il baseline viene ricostruito anche dai quattro angoli del texel come controllo algebrico; nessuno di questi angoli è un nuovo witness selezionato.

| Record | Margine baseline | Margine bounds1 | Margine intersezione | Area coperta dal caster nel texel |
|---|---:|---:|---:|---:|
| L1 artefatto | −190,107 m | −210,111 m | −212,062 m | 61,97% |
| L1 controllo | +234,081 m | +38,723 m | −57,558 m | 22,12% |
| L2 artefatto | −46,844 m | −153,712 m | −162,181 m | 53,84% |
| L2 controllo | +19,816 m | −87,052 m | −95,521 m | 53,84% |
| L3 artefatto | −97,160 m | −97,160 m | −141,344 m | 17,42% |
| L3 controllo | +15,615 m | +15,615 m | −34,865 m | 49,82% |

Margine=qlookup−stored; negativo significa shadow. Tutti i sei record hanno un blocker geometrico nel witness precedente. Il baseline ne lascia tre lit; bounds1 ne lascia **due** lit (L1 e L3 controlli); l'intersezione li classifica tutti shadow. Gli artefatti restano shadow in tutti e tre i metodi.

**Il clamp al triangolo intero non basta.** L1 controllo ha un vertice basso fuori dal texel: il suo minimo globale continua a indebolire il bound. L3 controllo non cambia affatto con bounds1, mentre restringere il dominio al texel alza la soglia di 50,48 m. Qui il minimo sull'intersezione discrimina davvero il piano esteso dal dominio coperto della faccia.

## Perché non basta per un fix

Tutti e sei i lookup UV sono **fuori dal triangolo caster vincente**, benché il centro del texel sia al suo interno. La faccia vincente copre soltanto il 17–62% del texel. Un unico valore scalare assegnato a tutto il texel non contiene l'identità delle altre facce che ne coprono il resto. Il minimo ritagliato rimane una proprietà della porzione di **quella faccia**, non una garanzia della visibilità al lookup esterno ad essa.

I sei punti erano selezionati per artefatti e controlli di immagine; ora sappiamo che tutti sono geometricamente shadowed. Non ci sono in questa selezione punti fisicamente unoccluded per verificare eventuali false ombre introdotte. La buona classificazione 6/6 non stima il risultato dell'intero fotogramma, di altri soli o camere, e non è un PASS artistico.

`physicalReference` riporta q del blocker già salvato e gap verso receiver/lookup/stored. Questi q appartengono al raggio fisico del receiver originale, mentre caster e lookup possono seguire UV diversi: un gap positivo o negativo fra essi **non è un bound dell'errore fisico del texel**. Per esempio il blocker fisico di L2 artefatto è su una faccia diversa dal caster del texel.

Non viene proposta implementazione GPU: qui sono disponibili offline tutti i tre vertici del caster vincente. Il fragment corrente non riceve quel triangolo completo. Accesso ai vertici, attributi/buffer, copertura, clipping, registri e costo effettivo non sono qualificati; non si dichiarano gratuiti o adatti al budget FPS.

## Controlli e provenienza

Protocollo e script congelati prima del calcolo in `PRE-RUN-FREEZE.json`, SHA `c395915dd2515f75d6722d97cc1216b84eb5e680e1b705bd53b9a0c12f0fe212`. `analyse.py` SHA `2d69a155a22182449c89699cdb6a631bb15dd7f3c8093cf4469839370949356e`. Quattro half-plane con segni controllati, t=da/(da−db), q interpolata; rimozione soltanto di duplicati identici, senza epsilon di copertura. Anatomy ha eseguito una lettura statica indipendente, senza calcolo/rerun.

Controllati: poligono non vuoto, centro caster interno al triangolo, q interpolata coerente col piano, baseline ricostruito dagli angoli, ordine dei bound e monotonicità della visibilità. Tolleranza 1e−8 km soltanto per residui Float64; **nessuna tolleranza nel confronto di visibilità**. Tutti gli input congelati restano invariati dopo il run.

Unico processo: exit0, CPU 0,02747 s, wall 0,037127 s, picco RSS 20.267.008 byte. Hard CPU 1 s, wall 5 s e gate terminale RSS 2 GiB rispettati. Nessun failure harness, timeout o retry.

File: `result.json` contiene q dei vertici, poligoni/stadi clipping, tutti i bound, visibilità e gap; `run.json` conserva exit/budget; `PROTOCOL.json`, `analyse.py`, `run.py` e freeze permettono di riprodurre l'analisi senza importare mesh/Three o fare raycast. Non è stato eseguito alcun ulteriore modello dopo il risultato.
