# A isolata — review statica indipendente

**PASS statico limitato, nessun blocker concreto.** Review del solo freeze `aaaa73e95401f4225c75581f3b01b832e05f758dbcce73c9373e4c228b778ed8`, prima dell’esecuzione root. Nessun modello, test, build o GPU eseguito dal reviewer.

- Verificati tramite sola I/O tutti i **25/25 pin** (dimensione e SHA256); `expectedCases` coincide integralmente con i quattro casi batch originali salvati, nell’ordine **72, 73, 74, 913**. Al controllo finale del reviewer `run/` non esisteva.
- `witness.ts` esegue un solo caso canonico 64³ per processo, con detail 64³ e bake originali. Richiede uguaglianza esatta di layout hash, macro RGBA, detail RGBA, sunset, intero observer, checks e pass rispetto al caso batch corrispondente. Nessun predicato o dato geometrico modificato; i tempi non partecipano alla parità.
- `run.py` avvia i quattro processi **sequenzialmente**, raccoglie CPU/RSS con `wait4` del PID effettivo e ferma la sequenza al primo errore. RSS terminale massimo **402653184 B per PID**; somma CPU dei child **≤20 s** e wall del launcher **≤40 s**. Il dato RSS non è il massimo cumulativo di `RUSAGE_CHILDREN`.
- Verificata la correzione wall prima del run: conteggio dall’ingresso in `main`, verifica pin e budget prima di ogni child, campione finale dopo l’ultima verifica e controllo finale dei limiti 20/40. Come dichiarato in `ISOLATION-REVISION.md`, il campione finale precede la serializzazione delle ricevute.
- Freeze e fonti vengono ricontrollati; output esclusivo, nessuna installazione, GC esplicito, aumento dei limiti o retry automatico. Il lancio della candidata B resta vietato finché questa qualificazione A non restituisce PASS.

Il batch originale rimane **FAIL di risorse**, pur avendo completato i quattro casi con predicati funzionali PASS: RSS 404570112 B contro 402653184 B. L’eventuale nuovo PASS qualificherà soltanto la precondizione A isolata entro i limiti dichiarati; non dimostra qualità anatomica/renderizzata della candidata, correttezza a 256³, FPS o accettazione visiva. L’observer misura frontiere del canale macro R, senza dettaglio/flow o immagine GPU.

Pin dei file riletti: witness `cd09232356cdb9ae36af20863670f23a1aedd53888ab8ef9fc9fecf12a16e004`; launcher `bdf0f6db8c0f4a26878e2ce85c459df019aa6d119e78db36f2ee96c3c6d25379`; revisione `36d3ae61a8ce666d8887fffb0e11a549d42f19999f74367e4e53b099f10b5d9b`.

## Addendum successivo — sola verifica delle ricevute root

Dopo l’unica esecuzione root, riletti esclusivamente i file salvati: `execution.json` SHA `45b82fbe220de905ff44df41e93898a277148b3c862a8acab2f8207367321d88` e `result.json` SHA `0728632283fcb9b7e67c11c783a826a8fb0a071f805afb245a0fc9ee686d69af`. Entrambi dichiarano **PASS_A_ISOLATED_PRECONDITION_ONLY**; quattro child exit 0, SHA delle ricevute e casi aggregati coerenti. Tutti i campi di parità sopra elencati coincidono esattamente con ciascun caso batch originale. CPU sommata 3.935015 s, wall 3.2442169579444453 s, massimo RSS per PID 379322368 B < 402653184 B. Freeze e 25 pin ancora esatti. Ricevuta `candidateGenerations: 0`, `noGPU: true`; nessuna esecuzione del reviewer. È qualificata la sola precondizione A, con i limiti già indicati.
