# Sommità giovani collegate al corpo — 17 ottobre 2026

**Esito: candidata non qualificata per memoria del verificatore, prodotto v61 invariato. Goal attivo.** [Fonti, patch e raw](measurements/cloud-head-attachment-trial-2026-10-17/README.md). Non è un giudizio visivo della nuova forma: non è stata renderizzata.

La nuova regola porta ogni sommità giovane sul bordo del corpo maturo alla quota propria, mediante l'intersezione analitica degli ellissoidi effettivi lungo il raggio collegato all'asse principale. Basi ferme, gruppi di figli traslati rigidamente con peso crescente lungo l'altezza; cap e collar giovani seguono la sommità. Nessuna massa o rumore aggiunto; Y, raggi, blend, RNG, ordine e numero delle primitive restano protetti. Il metadato `updraftAnatomy` fotografa i riferimenti finali reali. Non è CFD né prova di contatto del campo eroso.

Fonti meteorologiche primarie e limiti dell'inferenza sono in [RESEARCH](measurements/cloud-head-attachment-trial-2026-10-17/run/RESEARCH.md). Non assumiamo che l'incudine debba essere sempre frastagliata: fasi liquide e ghiacciate possono avere contrasti differenti. La formula di attachment è una nostra scelta procedurale, non una formula tratta dalle fonti.

La copia esterna ha143 file, manifest `ae6369636efc203ced8d0ad4afed74d95b805e77abff5619ca46cc59b2295ecb`; sette delta conservati in `source-overlay`. Base canonica141 `2577f187…`, commit sorgenti prodotto `8a9535f9cb849292f5dd868020ef7f514567109a`. I sorgenti prodotto non sono stati sostituiti. Review statica indipendente del metodo: PASS limitato.

| Verifica effettiva | Risultato e limite |
|---|---|
| Typecheck candidato | PASS, exit0; durata totale non misurata |
| A64 canonico72/73/74/913, stesso observer delle frontiere | Tutti i predicati necessari PASS; il batch complessivo FAIL RSS404.570.112 B oltre402.653.184 B |
| Unica revisione esplicita A in4 processi separati | PASS; layout/macroRGBA/detailRGBA/sunset/observer/checks identici al batch originale; CPU3,935015 s, wall3,244217 s, massimo perPID379.322.368 B, stesso limite384MiB |
| Witness candidato,305 seed fissati | FAIL RSS al seed37 dopo37 casi completi0–36; osservato402.735.104 B, terminale403.062.784 B oltre402.653.184 B di409.600 B |
| Densità B, suite completa, APP/hero, camera audit, PNG B, FPS B | Non eseguiti dopo lo stop |

I37 casi completi verificano parità legacy Float64, ID/RNG/alias, fondazioni e maturo fermi, Y/raggi/blend invariati, gruppi rigidi, cap/collar coerenti e margini non peggiorati oltre il bound prefissato. Il seed37 si ferma immediatamente dopo `traceLegacy`, prima delle asserzioni di parità e prima di `tracePost`: non è un38° caso valido. Il limite è del programma di verifica, non una misura della RAM del renderer. Nessun aumento del cap, fallback, riduzione dei casi o ulteriore retry.

Le due vecchie guardie che imponevano finestre X e una sella profonda sono state sostituite prima di qualsiasi B con un osservatore comune A/B sulle teste effettive; documentazione e revisioni sono conservate. Le guardie bulk/fill/bordi/famiglia rimangono. A passa il requisito minimo di frontiera, ma questo non certifica silhouette, campo fine, luce, moto o qualità artistica. Gli8 nuovi test sintetici sono preparati e compilati, **non eseguiti**.

Nuovi export A74 front/side riproducono esattamente i digest PNG già archiviati: front `6d7a8c83…`, side `c9c4681b…`. Alias e nuove DTO sono conservati; nessuna duplicazione del bitmap e nessun PNG B. La preview4196 è stata riportata al Sole, nube matura animata, pannello chiuso, output2474×1844 su viewport1237×922. Screenshot finale CSS e console vuota: prova di ripristino, non prova FPS o novità visiva.

L'unità artistica rimane tre famiglie fronte/lato, poi vicino/moto/luci e pioggia; il goal completo comprende terreno, virga, UI e60FPS a qualità piena. La scelta reale con aree abitate resta nello stesso materiale, senza edifici3D o pass aggiunti per le città; costo assoluto nullo non dimostrato.

Una misura canonica Pioggia90s è una tranche indipendente del goal FPS, con protocollo congelato prima dell'avvio; non esegue né qualifica la candidata. [Risultati e limiti](CANONICAL-RAIN-PERFORMANCE-2026-10-17.md):19,80253invii/s su90,039s; coda completata, target60 non raggiunto.
