# A1 Enter — review statica della sola procedura

**Nessun blocker statico** sulla riparazione esplicita `run/A1-START-REPAIR.json`, SHA `71b900172c5c45d7e30d7929eb503f6c52c3f6afe23092374d917c8609bbf334`. Nessuna esecuzione UI, modello, test, build o GPU del reviewer.

Il primo `performance-a1.json` è preservato con SHA verificato `16ecfab7f34750744b82b5b1f7e9b607f7a6300ce28b99fc5ad8c21586b77b3b`. Sim start **60.13440000000001** e forcing **0.1346999999999971** superano l’inviluppo preesistente di 100 ms: il rapporto completo resta una cadenza osservata (**19.52461233982155 invii/s**), **non A1 matched**. Non può partecipare al criterio A/B/A valido.

La [documentazione primaria Playwright](https://playwright.dev/docs/actionability) conferma che `click` verifica stabilità su due animation frame consecutivi, mentre `press` non esegue quei controlli. Sostituire il click del pulsante Misura90 con Enter è quindi una riparazione procedurale motivata. L’attribuzione del ritardo osservato a quell’attesa resta un’inferenza: la fonte non dimostra il tempo del bridge CUA. Due chiamate `press` nello stesso task CUA non garantiscono atomicità DOM o rispetto dei 100 ms. Visibilità e stato enabled dei due pulsanti devono risultare dallo stato UI osservato; non sono garantiti dal solo `press`.

Non vengono cambiati sorgente, parità nativa, qualità **256³/128³/384 e 2474×1844**, warmup 2 s, durata 90 s, inviluppo 100 ms, criterio +5% e percentili. La sequenza dichiarata è A1-keyboard/B/A2, con una sola riparazione esplicita. Il contesto effettivo del nuovo A1 determina la qualifica; se l’avvio è ancora fuori limite, si ferma prima di B senza ulteriore modifica della procedura, soglie più larghe o tuning dello shader.
