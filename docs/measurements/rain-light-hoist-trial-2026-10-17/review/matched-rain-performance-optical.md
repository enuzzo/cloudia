# Rain light-hoist — verifica indipendente A1/B/A2 salvata

**Finestre valide; criterio di adozione FAIL. Nessuna adozione del light-hoist.** Solo lettura/hash e aritmetica sui JSON salvati: nessun modello, test, build, browser o GPU del reviewer.

| Finestra | Intervalli / durata ms | Invii/s | Invii/s comprensivi della conferma | p95 / p99 ms | Sim / forcing iniziali s |
|---|---:|---:|---:|---:|---:|
| A1-keyboard | 1794 / 90038.1 | 19.92489846 | 19.88496867 | 67.4 / 68.5 | 60 / 0 |
| B | 1792 / 90005.2 | 19.90996076 | 19.87313135 | 67 / 68.3 | 60.05 / .0666 |
| A2 | 1796 / 90039 | 19.94691189 | 19.91020453 | 67.3 / 68.4 | 60 / 0 |

**Gate congelato:** B doveva raggiungere almeno **20.944257488421687 invii/s** e **20.90571476082257/s** comprensivi della conferma, pari a 1.05×max(A1,A2). Entrambe le condizioni falliscono. p95≤67.40000000002328 e p99≤68.5 passano. B è −0.074970% rispetto ad A1 e −0.185247% rispetto ad A2 negli invii; −0.059529% e −0.186202% nei tassi comprensivi della conferma. A2/A1 varia +0.110482% negli invii. Non è dimostrato il beneficio pratico richiesto; queste piccole differenze non identificano una causa hardware/compilatore o una regressione universale.

Il protocollo pre-nativo preservato ha SHA `d0fd831ee874f580d1b0a73bb533db575f152d086b6b548bd18d485b7f31948a`; quello prima della prima performance ha SHA `e45a17b5b664b4d10a259d8f392ad7a5e3907b5dfbd10eeebc6eeab01fe7981a`. Il secondo aggiunge solo la procedura Enter-per-ripresa/click-Misura, lasciando invariati criteri e inviluppo. Riparazione successiva esplicita, preservata separatamente: SHA `71b900172c5c45d7e30d7929eb503f6c52c3f6afe23092374d917c8609bbf334`, Enter anche per Misura90. Il primo `performance-a1.json` resta **INVALID_FOR_MATCHED_START** (sim60.1344/forcing.1347); non entra in questo confronto. Il vecchio Rain90 da 19.8 è soltanto continuità storica.

**Contesto verificato:** seed74, stessa camera completa e camera finale, WebGPU/adapter/Three, main thread, ultra **256³/128³/384**, interno/output **2474×1844 screen**, flow/ablation full, timing stages, frame limiter/navAudit/orbit disattivati, moto attivo, speed1, vento .55, dispersione0, nessun lampo/skipped. Geografia/ottico/supporti, parametri del mezzo, sole e path densità R8 senza fallback sono uguali; path densità identico anche agli estremi di ogni finestra. Pioggia assestata, skyPending false, transizione1. Rain CPU A1/B=.7999999999999995, A2=.7999999999999323: tutti corrispondono allo stesso Float32 di .8, come ammesso prima dei dati. I tre avvii rispettano i 100 ms dichiarati. Le fasi finali sim sono 143.9196/144.5811/144.2073: non è una replay identica, coerentemente con il clock sim limitato per frame e forcing reale. Il JSON non costituisce telemetria continua di ogni controllo/visibilità; la procedura UI root resta parte del contesto operativo.

**Aritmetica e coda:** ricalcolati esattamente tutti gli intervalli/statistiche, percentili canonici `floor(n*p)`, FPS, sei riassunti scalari CPU/GPU e rispettivi alias. Intervalli finiti positivi; campioni scalari finiti non negativi. Tutte le fence sono completed (90/89/90 campioni); prefissi monotoni, latenza/drain coerenti e 1794/1792/1796 invii confermati senza residui. Ricalcolo dei tassi con solo clock locale esatto. Drain finale 181.5/170.3/162.9 ms; massimo di invii logicamente non ancora confermati 26/25/27, **non profondità fisica della coda**.

**Timestamp:** ricostruiti mapping UID/frame/call-range, somme dei pass, completeSamples e statistiche; nessun UID duplicato, conflitto, ledger invalido o batch stale. Copertura render e compute: **A1 1793/1794**, **B 1788/1792**, **A2 1791/1796**. Mancano rispettivamente gli intervalli 1794; 1789–1792; 1792–1796. B conserva inoltre sei pass non associati, appartenenti ai frame 5158/5159 precedenti al primo ledger5160: verificati ed esclusi, senza attribuirli ai frame misurati. Pass associati fuori finestra 120/123/117, esclusi. I campioni scalari GPU sparsi sono 382/382/385; non sostituiscono i campioni completi del ledger. Nessun riempimento dei dati mancanti o deduzione FPS dal reciproco delle somme dei pass.

**Limiti:** `presentedCanvasFps:null` in tutti i rapporti. Invio, conferma della coda e intervalli dei pass non misurano presentazione del compositore o throughput GPU isolato; overhead diagnostico non sottratto. La parità PNG precedente resta limitata a uno stato fermo e non viene estesa ai frame animati. Si applica lo stop del trial senza tuning/ripetizioni; il goal dei 60 FPS stabili resta aperto.

Pin dei rapporti verificati contro le ricevute `-validity`:

- A1-keyboard, 4617056 B: `2b66d7d8dadde802350458ee9dd033726a90fba72499a8ff180121cb2bc9ba6c`.
- B, 4543949 B: `78298ed496fa87db1d78d0cb9bc54f83bb56002d26cc394e15d1fb3cf211bd9d`.
- A2, 4540188 B: `460696ed57a7595280998833989a906968f27c34b26c8ecf5ea5e4de475aed5f`.
