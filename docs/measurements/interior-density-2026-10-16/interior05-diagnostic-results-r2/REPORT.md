# Interior05 — confronto13 raggi, trial non adottato

Unico run seriale A poiB completato; entrambi exit0 terminali osservati da Popen. Nessun retry o terzo bake. Fonte: snapshot122 A/e826… e B/07d8…, qualità256³/128³; camera74near60 identica, t60 e flowfull. Sole/Tramonto condividono questi percorsi di densità, quindi non occorre duplicare il run per il sole basso.

| UV | Δfronte m | Δτ1 m | Δmedia opacità m |
|---|---:|---:|---:|
| 0.05,0.05 | 15.000 | 27.822 | 60.661 |
| 0.5,0.05 | 81.000 | 127.415 | 153.620 |
| 0.95,0.05 | 36.000 | 36.890 | 37.373 |
| 0.05,0.5 | 28.000 | 11.707 | 13.041 |
| 0.5,0.5 | 38.000 | 69.790 | 63.303 |
| 0.95,0.5 | 11.000 | 21.366 | 18.860 |
| 0.05,0.95 | 46.000 | 34.757 | 37.116 |
| 0.5,0.95 | 31.000 | 52.385 | 48.637 |
| 0.95,0.95 | 19.000 | 20.397 | 27.638 |
| 0.35,0.5 | 15.000 | 19.754 | 19.128 |
| 0.65,0.5 | 132.000 | 107.053 | 123.964 |
| 0.5,0.35 | 407.000 | 142.063 | 273.289 |
| 0.5,0.65 | 21.000 | 35.081 | 32.498 |

Δ=B−A: positivo significa più lontano dalla stessa camera. Il fronte è un evento campionato in un intervallo1m, non una superficie esatta. Tredici raggi hanno tutti primo materiale eτ1 in entrambe le varianti; nessun raggio interamente svuotato. Massimi assoluti: fronte407m,τ1 142,063m,media273,289m, tutti UV[.5,.35]. Questi punti non rappresentano l’intera immagine.

Al centro: fronte A1760.500m/B1798.500m;τ1 A1889.228m/B1959.018m;media A1877.721m/B1941.024m. La densità alla nuovaτ1 è simile (0.663891→0.666126), in posizioni diverse. Densità media pesata0,588468→0,517864. Footprint alla media:1,913785×1,076504km→1,978303×1,112796km. Non è una misura di contrasto fotografico.

Il centro.5m conferma Δfronte38m eΔτ1≈69,7895m: errore1m/.5m suτ1<0,000353m e sulla media<0,012365m. Allo zoom UI60 il primo materiale è fisicamente a1,55–2,51km, perciò il termine micro entro300m è correttamente implementato ma inattivo nei tratti occupati. Non trasferire la diagnosi di footprint105m del vecchio seed72near100 a questa posa.

Terreno: i13 tratti A/B restano almeno1987,745m sopra il bound globale della mesh. Nessuna occlusione possibile nel segmento analizzato secondo il certificato conservativo; non è una lettura depthGPU. Validazione offline senza nuovo modello:84 checkpoint/672cornerR8, interpolazione e84 densità liquide riprodotte entro1e−12;σ e somma pesi d’opacità coerenti.

## Esecuzione e limiti

| Variante | CPU terminale getrusage | Wall | PiccoRSS upper bound | Exit |
|---|---:|---:|---:|---:|
| A | 23.959765s | 23.672939s | 999849984B | 0 |
| B | 23.995223s | 23.702669s | 1001537536B | 0 |

Entrambi rispettano2GiB/180CPU/240wall. RLIMIT_CPU è stato impostato nel figlio prima di exec; getrusage terminale dà le durate canoniche. Il monitorRSS libproc sul solo PID figlio,heartbeat15s e Popen.poll/wait sono registrati nei log. **Erratum strumento:** ri_user/system del libproc su questo Mac sono tickMach, con timebase125/3. Il wrapper congelato li etichetta impropriamente secondi dividendo solo per1e9: i campioni vanno moltiplicati offline per41,6667. Non usare quel controllo CPU campionato come prova del limite; il kernel e getrusage sono indipendenti e corretti. Nessun log/freeze è riscritto, nessun run ripetuto.

R1 è conservato come preparazione NON ESEGUITA: Solar trovò il mancato halo engine[1.3,0,.65] prima di qualsiasi bake. Solo R2, con entrambi i box corretti e revisione finale approvata, è stata eseguita. I dati mostrano arretramento significativo e spostamento della zona otticamente dominante; non dimostrano rilievo utile. Il giudizio root sulle quattro still app è non convincente e la variante rimane NON ADOTTATA. Nessun nuovo tuning autorizzato.

Riepilogo compatto riusabile: `../numeric-summary.json`. Originali A/B/log/comparison immutati; correzione metadati separata in `LIBPROC-TIMEBASE-ERRATUM.json`.
