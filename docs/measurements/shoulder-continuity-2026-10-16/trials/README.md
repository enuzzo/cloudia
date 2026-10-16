# Trial anatomia — archivio compatto delle alternative non adottate

Questo pacchetto conserva evidenze e provenienza, senza sorgenti completi, dist, hero-dist, dipendenze, volumi o fotografie. Le foto sono curate separatamente dal root. La qualifica numerica e l’esecuzione delle build non equivalgono a un giudizio visivo positivo o a un vantaggio FPS.

| Gruppo | Cosa conserva | Stato e limite |
|---|---|---|
| `r3` | Tutte le 23 evidenze del manifest, più il manifest originale: protocollo, source 119 hash, patch, controlli/build/test, CPU approach e wrapper | R3 ritirata dopo il corpo617 gonfio e la regressione near. Il risultato CPU approach salvato contiene 18 pose, ma la supervisione è **WRAPPERFAIL**: `ps` negato e `childExitCode:null`. Nessun PASS del comando viene ricostruito. Il seed hardcoded di qa-approach è 1571198069, non 617. |
| `r4` | Tutte le 28 evidenze più manifest: source 122 hash/freeze, riferimenti prefix, patch, test completi 348/44, scanner 1024, mutazione e log | Qualifica del contratto PASS: 323 inward identici R3, 18 outward identici A, 683 altre famiglie identiche A. **Non adottata**: il lift del corpo mantiene rischi di gonfiore/near. Nessuna foto R3 viene presentata come render R4. |
| `r5-r1` | Tutti i 23 payload del manifest più manifest: source 119 hash, full-axis recenter, 9 nominali, 31 test, typecheck/app/hero e log | Alternativa non adottata/superata da R2. Il corpo resta A, ma il recenter completo può essere enorme anche con piccola protrusione inward. |
| `r5-r2` | Tutti i 31 payload del manifest più manifest e verifica derivata: source 119 hash, sola componente inward, 7 nominali più 926, 31 test, typecheck/app/hero e log | **Trial non adottato al freeze di questo pacchetto**. Rimuove `-inner*projection` solo se positiva, corpo sempre A e offset perpendicolare preservato. Nessun nuovo scanner 1024 o bake256/128 fu eseguito da questo autore. Non rappresenta l’eventuale successiva integrazione ufficiale da 122 file di Anatomy. |
| `morphology617-r1` | Tutti i 15 payload più manifest terminale | **FAIL della nostra guardia RSS 1 GiB**, non requisito del prodotto: A terminato/reaped senza JSON finale, B non avviato, nessun restart. |
| `morphology617-r2` | Tutti i 37 payload originali, 350200 byte, più manifest e verifica derivata | Due processi sequenziali A/B a256/128 con guardia 2 GiB, entrambi exit0/reaped. Massa +3,1961%, centroidi/profili/connectivity e boundary audit conservati. Il quasi invariato 99,9976% nella componente maggiore non prova un miglioramento. Sei facce e secondi strati R zero non provano assenza universale di clipping. R3 resta ritirata per qualità visiva. |

`copy-record.json` associa ciascun file conservato al percorso esterno originale, SHA-256 e dimensione originali, percorso nel pacchetto, compressione, SHA e dimensione memorizzati. JSON/log/patch/CSV da almeno 8192 byte sono compressi con gzip livello 9 e **mtime 0**. La decompressione ripristina esattamente i byte originali; non sono stati riformattati JSON o patch. Il manifest originale di ogni trial resta intatto e può contenere riferimenti a snapshot/build intenzionalmente esclusi.

Il verifier originale R4 è stato eseguito soltanto come verifica offline dei file già congelati: risultato PASS, stdout/stderr/controllo sono nei tre file `r4-offline-verifier.*`. Non è stata lanciata alcuna esecuzione nuova di modello, prefix, scanner, test, build, browser o GPU durante questa curation.

Per verificare il pacchetto senza dipendenze e senza le directory esterne:

```sh
python3 verify_curated.py /percorso/curated-trials
```

L’opzione `--compare-external` aggiunge il confronto byte per byte con gli originali nei percorsi del copy record, se ancora disponibili. Il controllo base verifica hash/dimensioni di tutto il nuovo manifest, decompressione e SHA originali, completezza dei payload dei sei manifest originali e stati salvati essenziali. Non importa né esegue alcuno script di generazione. `offline-verification.json` registra l’esecuzione del verifier copiato in `/tmp`, con confronto esterno attivo.

I JSON CPU sono dati registrati, non un replay indipendente dei volumi: gli array originali non sono inclusi. Conteggi, uguaglianze dei layout e verifiche aritmetiche si applicano alle rappresentazioni e ai runtime dichiarati. Nessun risultato qui prova rendering mobile/worker/motion, qualità fotografica generale, presentazione a 60 FPS o raggiungimento dell’obiettivo finale.
