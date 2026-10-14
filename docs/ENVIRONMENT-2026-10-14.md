# Cloudia v21 — pioggia, avvicinamento e terra lontana

Richiesta del 14 ottobre 2026: proseguire il lavoro sul cielo asincrono,
vedere precipitazioni credibili sotto la nube, avvicinarsi al bordo mantenendo
la qualità massima, chiudere i pannelli dall'esterno/Esc e introdurre un suolo
lontano negli scenari Sole/Tramonto. Nessun deploy o merge su main.

## Comportamento implementato

| Intervento | Comportamento | Limite dichiarato |
| --- | --- | --- |
| Pioggia | Mappa RG64² ricavata dalle colonne di densità e dalla quota della base; cortine e filamenti volumetrici mossi da gravità apparente e vento, estinzione condivisa con la nube | Mezzo artistico pioggia/virga, non simulazione delle singole gocce; deformazione della sorgente approssimata |
| Avvicinamento | Dolly logaritmico reale con rotella, +/−, pulsanti e cursore; Panorama/Home torna alla vista intera | Margine obiettivo di circa3m rispetto a una soglia di densità stimata, non superficie fisica esatta; touch tramite pulsanti/cursore, niente pinch a due dita |
| Qualità vicina | 256³ macro/128³ dettaglio conservati; passi occupati più fini vicino alla camera, fino a1,5m nominali, e ulteriore erosione locale | Non equivale a una griglia macro con risoluzione metrica; luce precalcolata e materiale restano approssimazioni |
| Qualità normale | Massima e risoluzione nativa del display; nessuna riduzione automatica; modalità inferiori solo con profile=1 | Display Retina e grandi viewport possono costare molti più frame rispetto alle prove FullHD |
| Terra lontana | Sfera terrestre di raggio6371km, datum nube4km sopra il mare, suolo/acqua/fiume procedurali, foschia dipendente dalla distanza e luce condivisa | Geografia immaginaria; rilievo suggerito dall'ombreggiatura, nessuna geometria montuosa o DEM, nessuna ombra della nube proiettata a terra |
| Pannelli | Click esterno/pointerdown e Esc globale chiudono Nube e correnti, Atmosfera, Qualità, Mani; click interni preservati, Esc restituisce il focus al titolo | Nessun focus trap: sono pannelli di controllo, non dialoghi modali |
| Cielo | Calcolo fisico LUT in worker dedicato dopo l'avvio; riuso delle combinazioni già visitate; ultima richiesta prevalente e transizione dalla luce corrente | Il primo avvio è ancora sincrono; conversione half-float/upload restano sul thread di rendering; nessuna misura quantitativa del guadagno di latenza |

Il terreno è attivo inizialmente ma visibile soprattutto con Sole/Tramonto.
Nube e correnti → Paesaggio → Solo cielo lo disattiva. La pioggia si regola
anche separatamente dal preset. Pausa ferma l'evoluzione e la caduta; il cambio
cielo continua a sfumare. Avvicinarsi a una nube significa entrare in una zona
sempre più nebbiosa: lo zoom non promette una parete solida nitida a3m.

## Architettura e costo

SkyCache conserva al massimo le10 combinazioni dei5 scenari e2 lati:2,5MiB
per i Float32 della LUT128²RGBA, oltre ai piccoli metadati e all'overhead del
worker. Non duplica texture GPU per ciascun preset. Errori e teardown rifiutano
le richieste pendenti; un errore del worker consente un tentativo successivo.
Il modulo puro skyModel evita che il worker importi il proprio costruttore.

La sorgente pioggia aggiunge8KiB di texture RG8 e altrettanti di backing CPU,
oltre a piccoli temporanei durante il calcolo. Il ray march copre il tratto
fino a4km sotto il datum e costa più del precedente ellissoide.
L'avvicinamento conserva un riferimento ai dati volumetrici già utilizzati
dalle texture e sonda la frontiera circa ogni150ms; non ne crea una copia.
Il numero massimo di iterazioni shader sale a8192 per consentire passi fini:
non vengono eseguite tutte se opacità o uscita dal volume terminano il raggio.

## Fonti e scelta visiva

La definizione WMO di [virga](https://cloudatlas.wmo.int/en/clouds-supplementary-features-virga.html)
e il [glossario NOAA](https://preview-forecast.weather.gov/glossary.php?word=VIRGA)
supportano la scelta di cortine che possono evaporare sotto la nube. Questi
riferimenti non certificano le velocità o l'esattezza del nostro modello.
Per lo sfondo la scelta è un paesaggio procedurale leggero con occlusione
sferica e prospettiva atmosferica: aggiunge scala senza rete, dati geografici
o texture fotografiche. La qualità fotografica resta un obiettivo aperto;
la prossima evoluzione utile è rilievo reale e ombra larga della nube al suolo.
Nessuna fotografia o implementazione esterna importata.

## Verifiche

104 test in23 file, TypeScript e build applicazione→hero superati. I7 nuovi
test coprono sorgente pioggia, frontiera camera, orizzonte/scala terrestre,
chiusura pannelli/focus e deduplicazione/errori/cleanup della cache del cielo.
La compilazione conserva l'avviso Vite sulla dimensione dei bundle.

Le verifiche nel browser interno e le misure finali sono registrate sotto.
Le immagini con suffisso first/refined sono tentativi intermedi, non la build
finale. Screenshot e JSON non provano presentazione compositor o60fps video.

### Prima misura e intervento conseguente

FullHD/384, main, pioggia80%, nube matura animata, camera frontale,90s:
50,486fps rAF,377 intervalli>33,34ms, massimo100,4ms, GPU media33,942ms.
Report completo: images/environment-2026-10-14/main-rain-before-empty-column-guard-90s.json.
La misura ha motivato un controllo esatto column.r>0 prima delle due letture
di rumore della pioggia: nessun calcolo di filamenti nelle colonne senza acqua,
nessuna modifica ai passi, alla densità o alla risoluzione. Le prove successive
non sono un A/B alternato e non isolano causalmente il guadagno.

### Build qualificata e misure finali

Implementazione: `2b880b9`. Browser interno Chromium155/Apple Metal-3,
output e buffer interno1920×1080,384 passi nominali, full/no ablation.

| Prova | Durata | fps rAF | p95 intervallo | Intervalli>33,34ms | Massimo | GPU rendering medio |
| --- | --- | --- | --- | --- | --- | --- |
| Main, pioggia80%, animata, panorama | 90.01s | 59.874 | 17.50ms | 3 | 134.30ms | 22.245ms |
| Main, Sole, animata, avvicinamento100% | 30.02s | 47.237 | 33.40ms | 160 | 34.40ms | 40.452ms |
| Worker, Sole, panorama, nube ferma | 30.00s | 59.998 | 17.60ms | 0 | 17.80ms | 13.905ms |

La seconda prova pioggia conserva la qualità e mostra un risultato migliore
della prima, ma tempi di simulazione e carico esterno non sono identici:
non attribuire l'intera differenza al solo controllo delle colonne vuote.
La misura vicina conferma un costo significativo. I timestamp GPU e gli
intervalli rAF sono osservazioni differenti e non necessariamente accoppiate;
non interpretare59,9rAF/s come59,9 immagini realmente presentate al secondo.
Non è stato misurato il guadagno di latenza del primo cambio cielo.

### Verifica visiva e interazione

- Desktop1280×720: Sole, Tramonto, pioggia animata, Panorama, zoom50% e100%.
  Terreno visibile con orizzonte/foschia; nessun rettangolo evidente nella
  cortina. Dettaglio vicino ancora morbido; nessuna accettazione fotografica.
- Mobile390×844: scena e nuovi pulsanti leggibili; pannello scorrevole,
  document.scrollWidth=clientWidth=390. Verifica responsive nel browser,
  non telefono fisico o gesture touch reali.
- Click dentro il pannello preserva lo stato; click sul pulsante esterno
  Avvicinati/Panorama chiude il pannello e applica l'azione. Esc sul cursore
  chiude Nube e correnti; Esc chiude anche Mani.
- Nel layout stretto il pannello Atmosfera copre fisicamente i preset meteo:
  quei preset non sono una zona esterna cliccabile finché coperti. Panorama
  resta fuori e chiude correttamente; Esc è disponibile.
- Nessun errore console/GPU osservato nelle verifiche main/worker.
- Immagini first/refined e sun/sunset-final risalgono alle iterazioni prima
  del controllo delle colonne vuote; quel controllo cambia solo lavoro
  nullo nella pioggia. rain-final e zoom/mobile sono della build2b880b9.

### Recupero Git locale

Un git add era fermo in access() su una directory oggetti Dropbox dataless.
Interrotto solo il processo avviato per questo checkpoint. La directory c2
e altre142 directory dataless sono preservate integralmente, senza rimozione,
in .git/cloudia-preserved-c2-20261014 e
.git/cloudia-preserved-object-dirs-20261014. Refetch del remoto autorizzato;
920 oggetti raggiungibili verificati, zero mancanti prima del commit.
Nessuna modifica alla storia pubblicata. I backup interni restano locali.

Worker verificato anche con cambi rapidi Tramonto→Pioggia→Sole, zoom24%,
ritorno Panorama e disattivazione del paesaggio: ultima scena Sole visibile,
suolo assente in Solo cielo, nessun errore console osservato. Ultimo confronto
worker-sun-final/worker-sky-only-final usa la build2b880b9.

Preview finale: modalità normale main, Sole animato, Panorama, nessun pannello
aperto. Solo Massima e Schermo nativo presenti nei selettori; override di
viewport rimosso. Browser1280×720, buffer1280×720, nessun errore console.


## Correzione successiva — solo natura

Richiesta esplicita del proprietario: foreste, montagne e mare, niente urbano.
La linea del fiume è stata eliminata perché sembrava una strada. Anche la
variazione cromatica tipo campi è sostituita da bosco continuo e roccia sui
rilievi. Costa irregolare, acqua bassa più chiara e mare profondo più blu.

Questo aggiornamento supera il precedente limite «nessun rilievo geometrico»:
il punto d'intersezione viene ora raffinato contro un campo di altezza
procedurale con sei iterazioni limitate. Il terreno può quindi spostare il
punto visibile rispetto alla sfera marina, ma il metodo è approssimato e
attenua il rilievo fra90 e180km. Non è una garanzia di intersezione esatta
per ogni raggio radente, né geografia reale o ombreggiatura del terreno completa.
Il bosco è una tessitura di copertura vista dall'alto, non singoli alberi 3D.
Nessuna strada, costruzione o città è presente nel generatore.

Verifica: browser interno tramite cua_repl/Playwright perché il Browser plugin
non è disponibile. Flusso: preview→Sole/Tramonto→costa naturale senza linee
stradali, anche in viewport mobile. Screenshot conservati in
images/wilderness-2026-10-14. Build e104test superati; nessuna dipendenza nuova.

Controlli finali: desktop1280×720 con Sole e Tramonto, mobile390×844
con Sole; nessun overflow orizzontale, overlay o errore console osservato.
Il formato stretto mostra soprattutto mare per la maggiore distanza della
camera: il bosco resta visibile nel margine inferiore/sinistro.
Main FullHD/384, Sole, nube ferma,30s:59,996fps rAF, zero intervalli
oltre33,34ms, massimo17,8ms; GPU media15,063ms. Report:
images/wilderness-2026-10-14/main-sun-30s.json. Non è una nuova prova
animata, worker o su dispositivo fisico; quei risultati precedenti non
certificano il costo di questo terreno.
