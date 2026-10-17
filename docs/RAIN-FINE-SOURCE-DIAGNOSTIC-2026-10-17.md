# Diagnosi della sorgente di pioggia fine

17 ottobre2026, ciclo46. **Diagnosi CPU completata; dati insufficienti per giustificare un nuovo trialGPU o modificare il prodotto. Goal attivo, v61 invariato.**

L'attuale emissione RG64² deriva dalla densità macro prima del dettaglio. Una sola generazione effettiva canonica64³, seed74 e dettaglio64³, confronta quel riferimento con lo stesso riduttore alimentato dalFloat32 fine già calcolato per la luce. Non è un renderer a qualità ridotta: il prodotto rimane256³/128³/384 e output pieno. Non simula gocce né certifica la coerenza in moto.

Il gancio è dopo la sovrascrittura fine e prima dei cinque bake ottici originali, che proseguono fino alreturn conoccupancy. Derivazione testuale del reducer con unico accessor; inversi esatti verificati da root e review indipendente. Prima del fine, il reducer derivato suR8/255 deve riprodurre tutti8192byte dell'originale: PASS. La fasciaY≤2.5km haice0 verificato, quindi Float32 già in unità confrontabili senza nuova scala. I due array prestati hannoSHA integrali invariati prima/dopo. Nessun importcircolare, nuova dipendenza o buffervolumetrico aggiunto.

Freeze prima del modello: `1d0747559cbb95b4b91cd076bc345a32e47279e21f4d49f4df8ba296705d0b9c`,19payload. Esecuzione unica con Bun esistente hashato: exit0,0.586s wallchild,0.622s CPUchild,130.449.408B peakRSS terminale. Limiti20sCPU/40swall/384MiB; RSS è un gate a posteriori, non un limite live. Nessun retry. Tutti i cinque eventi originali di luce osservati e volume finale completo.

| Misura postfiltro | Risultato64/64 |
|---|---:|
|SommaR macro → fine|133660 →123177 (−7.843%)|
|Texel positivi macro → fine|953 →927|
|Nuovi texel positivi|0|
|TexelR cambiati / totali|816 /4096|
|CorrelazioneR|0.997486|
|TV spaziale su distribuzioni normalizzate|0.036242|
|Quota base sui positivi condivisi, mediana /p95delta|+23.53 /+70.59m|

**Root e review indipendente: nessuna riorganizzazione convincente da portare ora al nativo.** Non è una scala uniforme esatta: i rapporti sono variabili. Prevale però l'attenuazione della stessa impronta continua; nessunR aumenta e i26texel persi hanno solo codici1–2 (29codici totali). Il bordoZ massimo si ritira di un texel109.375m e il centroide si sposta circa7.75m. Non deduco una migliore pioggia artistica dal solo calo di intensità.

I cambiamenti di quotaG sono reali, ma il passoY della prova è132.8125m e non qualificano256. I grandi deltaG nel solohalo dell'unione non dimostrano da soli un artefatto visibile: alcuni non hanno emissione fine vicina. I pannelliPPM hanno range0–255 comune; PNG identico e ingrandimento nearest4x sono visualizzazioni dei dati, non immagini native del cielo, senza stretch o normalizzazione dei campi.

Nessuna modifica di soglie/gain, integrazione prodotto, nuova generazione256, altro seed oGPU. Non è un FAIL del renderer canonico né un PASS finale della pioggia. Nessun benchmark: i60FPS restano aperti e la vecchia pioggia pesante circa19invii/s non è stata rimisurata. Una pioggia meno opaca potrebbe anche prolungare il cammino di integrazione; nessun guadagno prestazionale attribuito.

La prossima prova riguarda il terreno:32m contro31.25m allineato al dato125m, stessi sampler/sfera/refinement e limiti, fit eholdout distinti sulle stesse coordinate fisiche, prima di qualsiasiGPU. L'allineamento è un'ipotesi algebrica, non un beneficio dimostrato. La nota distingue i vecchi risultatiGLO30, altra fonte e rappresentazione. Nessuna nuova mesh ancora prodotta da questa diagnosi.

Preview4196 restaordinaryv61Sole/nube matura animata ripristinata nel ciclo45, output2474×1844 e console osservata[]. Nessun codice prodotto o lockfile cambiato, nessuna installazione, nessuna nuova cartella rigenerabile inDropbox; node_modules2 e4201 preservati. Geografia reale comprese le aree abitate nello stesso materiale, nessun edificio3D o pass aggiunto per le città. Anatomia delle tre famiglie, vicino, pioggia/virga/terreno/UI e60FPS conservano i gate aperti. Nessun push/deploy.

[Archivio](measurements/rain-fine-source-diagnostic-2026-10-17/README.md):38payload/553327B, manifestSHA256 `1406aa9384ebeee21b94608041db6d2439d3a1bb6dd083593cc179c0deceeab6`. [Verifica integrità](RAIN-FINE-SOURCE-VERIFICATION-2026-10-17.json). Nessuna ripetizione del modello.
