# Review statica ROOT-RUNNER — ciclo45

Scope: sola lettura del runner e dei riferimenti immediati. Nessun prefix, test, modello, typecheck, build o browser eseguito da questo agente.

Runner SHA256 `77af4ffa60283f636c49971affe09526c30412d6103365af6a2523234d63ebe2`. Freeze dichiarato `ae6369636efc203ced8d0ad4afed74d95b805e77abff5619ca46cc59b2295ecb`, 143 percorsi; coincide con l’anchor `EXPECTED` letto nel runner.

**Esito: nessun blocker individuato per test/build; prerequisite mancante per lo step prefix al momento della lettura.** La riga17 punta a `review/attachment-prefix-witness.ts`, che non era presente. Non eseguire quello step prima che il file sia completato e congelato; il sorgente esterno del witness non è incluso nei143 hash del freeze della candidata. Nessuna modifica al runner proposta da questa review.

Le protezioni effettive sono coerenti con il mandato: `verify()` controlla freeze e hash dei percorsi e richiede xattr1 prima e dopo il processo (righe8–11,20,36); il receipt già presente vieta un secondo lancio e il log aperto `xb` blocca anche il riuso dopo un’interruzione priva di receipt (21–27); wall30s per prefix/180s per gli altri, kernel CPU20s solo per prefix, SIGKILL del process group e wait4 terminale al timeout (24–37). I cache path Bun/XDG sono esterni a Dropbox. APP e hero includono entrambi `tsc` secondo package.json.

Limiti espliciti: il tetto RSS384MiB è un gate terminale per il processo lanciato, non una limitazione live né un picco aggregato dei figli; il receipt lo dichiara. Test/build hanno il wall timeout, non il medesimo budget CPU/RSS del prefix. La review non certifica esiti dei processi ancora da eseguire, idoneità artistica o costi GPU.
