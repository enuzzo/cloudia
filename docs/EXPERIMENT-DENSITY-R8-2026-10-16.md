# Densità R8 separata: beneficio locale con la pioggia

16 ottobre 2026. **La variante v47 dimostra un vantaggio nella posa pioggia
provata, nessun vantaggio nel Sole ravvicinato.** La successiva selezione v48
usa R8 soltanto con la pioggia; qualifica browser circoscritta completata.
60 FPS, presentazione, continuità visiva in moto e gate artistici restano aperti.

L'estrazione copia `R[i] = RGBA[4*i]` in un buffer indipendente da 256³.
Il worker lo trasferisce insieme ai volumi originali. Il solo lookup della
densità deformata usa R8; luce, coordinate, sampler lineare/clamp, LOD0,
materiale, macro 256³, dettaglio 128³ e 384 passi nominali restano invariati.
Payload aggiuntivo: **16 MiB CPU e 16 MiB nominali GPU**. Questi numeri non
misurano la memoria fisica del driver. I vecchi payload usano lo shader originale,
con percorso e motivo espliciti nei report.

## Parità finita e trasferimento

Audit raw WebGPU Apple metal-3: **77.629 query, zero differenze di bit f32**,
non finiti, errori di echo o discrepanze dei contatori atomici. Include 53.041
query sul volume originale seed72 e tre fixture con canali luce diversi,
zeri, uno, rampe e checker, con UV f32 dentro/fuori dominio e ai bordi.
Le quattro letture grezze sono state esportate e ricalcolate indipendentemente.
Nessuna tolleranza allargata. È una prova finita dello stesso sampler,
non una garanzia universale o una prova del binding Three.

V47 passa 229 test/34 file, typecheck e build app→hero. I test includono un
trasferimento structuredClone reale con distacco dei buffer, dati immutati,
packet legacy/invalidi, seed swap, diagnosi e cleanup. Le versioni default degli
shader dry/rain conservano i due SHA v46; la variante R8 cambia solo il lookup
della densità. Questi sono esiti del candidato v47, distinti dalle prove v48.

## Confronti nativi main A/B/A

Controlli: build v46 di `6a7df91`; candidata: v47 congelata. Un solo renderer,
CSS 1280×720/DPR2 e output/interno **2560×1440**, Massima/384, flusso pieno,
seed72, t60 in pausa, forcing e tempo precipitazione0. Cielo assestato, stessa
camera e target per ogni sequenza. Nessun altro replay, bake, test, build o
audit GPU orchestrato durante le finestre di misura; hardware non isolato.

| Stato | A1 v46 | B v47 | A2 v46 | B contro il migliore | Deriva controlli |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sole, avvicinamento100%, pitch0 | 23,0524 | 22,8065 | 23,0191 | −1,07% | −0,14% |
| Pioggia, avvicinamento0, pitch−.92 | 12,7447 | 13,6659 | 12,8183 | **+6,61%** | +0,58% |

Sono invii/s, non presentazioni del compositore. Tutti i prefissi finali sono
completati; tutti i report dichiarano il percorso R8 effettivo in B, stabile
all'inizio/fine, senza fallback. I tre JPEG CSS di ciascuna sequenza sono
byte-identici e le console warning/error sono vuote. Nessun confronto numerico
fra questi valori assoluti e le sessioni precedenti è un guadagno causale.

Nel Sole, p95 degli intervalli A1/B/A2: 50,5/50,2/50,1 ms; p99
50,9/50,9/50,9 ms. Nella pioggia: p95 83,6/83,4/84,4 ms; p99
84,2/84,1/266,7 ms; massimi 100,1/100/333,3 ms. Gli outlier del controllo
finale restano nei dati. Chiusure dei prefissi: Sole 170/173,4/174,4 ms;
Pioggia 307,2/294/316,1 ms. Le somme dei pass non vengono invertite in FPS.

Il verificatore ha respinto i primi B/A2 ravvicinati perché la transizione
atmosferica non era completa all'avvio del report. Sono conservati come
preliminari esclusi; le due prove sono state ripetute dopo l'assestamento.
I risultati in tabella superano il controllo stretto delle impostazioni.

Il guadagno pioggia supera entrambi i controlli e la loro deriva in questa
sequenza. Il risultato Sole non giustifica la nuova lettura nelle scene
asciutte. Per questo v48 conserva il percorso R8 della pioggia e seleziona
lo shader originale quando asciutto. Worker, transizioni e moto della versione
finale sono verificati nel perimetro seguente; nessuna accettazione artistica anticipata.

## Versione finale v48: percorsi e coda

**230 test/34 file**, typecheck e build app→hero passati. Solo engine e test
lifecycle cambiano rispetto a v47. Il template dry ha SHA v46 `d38fe391…`;
il template rain R8 v47/v48 è identico, SHA `a1899047…`. Sono hash del codice
FunctionNode CPU, non del binario compilato dal driver. La selezione non
aggiunge lavoro texture al percorso asciutto; la risorsa R8 è conservata.
Il report distingue byte nominali da upload/residenza effettivi non misurati.

| Verifica v48, sempre 2560×1440 e qualità piena | Invii/s | Prefisso finale | Chiusura |
| --- | ---: | --- | ---: |
| Worker, pioggia statica, 30 s | 12,8542 | completato | 314,6 ms |
| Main, pioggia in moto, 90 s | 13,3560 | completato | 261,8 ms |
| Main, asciutto dopo pioggia, 30 s | 54,6965 | completato | 74,1 ms |

Queste tre righe qualificano percorsi diversi; il confronto causale del
beneficio rimane quello A/B/A v47 sopra. Nel worker è effettivamente usata la
texture R8. Nel ritorno al Sole, narrow e densità tornano dry/originale,
mentre il payload R8 rimane disponibile: nessun fallback per dato mancante.
Report stabili all'inizio/fine, qualità completa, prefissi senza draw
non confermati, timestamp senza slot duplicati/ambigui e console vuote.

La prova in moto dura 90.072,2 ms, 1.203 intervalli, mediana 67,5 ms,
p95 83,6 ms, p99 84,3 ms, massimo 233,4 ms; tutti gli intervalli superano
33,34 ms. Tempo nube 60,65→122,10 s; forcing 1,00→93,09 s e precipitazione
0,92→93,01 s. Il clock simulato conserva il comportamento preesistente,
distinto dal tempo reale. Le immagini prima/dopo mostrano evoluzione del
campo, ma non certificano continuità temporale o qualità fotografica.

[Verifica v48 ripetibile sui report](measurements/density-r8-2026-10-16/v48-browser/verification.json).
La preview finale ordinaria è Sole animato su 4188, senza query diagnostiche,
output nativo; nessun push, merge o deploy.

**Valutazione visiva: gate fotografico ancora FAIL/aperto.** La nube congesta
rimane morbida e con teste a cavolfiore ripetute; terreno e virga richiedono
ancora lavoro. Questo ciclo migliora il costo di una lettura e ne verifica
la parità finita; non costituisce una nuova accettazione di anatomia o luce.

[Prove e sorgenti congelati](measurements/density-r8-2026-10-16/),
[verifica ravvicinata](measurements/density-r8-2026-10-16/measurements/near/verification.json),
[verifica pioggia](measurements/density-r8-2026-10-16/measurements/rain/verification.json).
