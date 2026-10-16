# Maschera dopo il flow: candidata locale v46

16 ottobre 2026. Goal attivo, target di 60 FPS e gate visivi aperti. La candidata è
implementata sul branch locale; non è una release e il beneficio prestazionale
rimane preliminare. Nessun push, merge o deploy. Il controllo su 4177 conserva
il build del commit 0d0ab21; la candidata è servita separatamente su 4184.

## Cambiamento e qualità conservata

La maschera originale che decide attraversamento e passo rimane identica.
Una nuova R8 da128³ controlla il solo punto **dopo** lo spostamento flow e prima
della lettura fine/macro. Quando il punto è certificato vuoto, salta soltanto
quelle letture e il materiale nullo. Non modifica t, ds, jitter, clipping,
integrazione cloud/rain, ghiaccio, pioggia o luce. Macro 256³, dettaglio 128³,
384 passi nominali e output nativo configurato sono preservati.

Il builder considera tutti i byte macro R>0, anche 1/255, dilatati per coprire
interpolazione, warp e guard di 1 m. Nel rapporto 256/128 il raggio è 2 celle; la prova
geometrica mantiene almeno 14,7 m di margine dopo il guard. È un certificato del
punto, non una distanza che autorizza passi più lunghi. Dimensioni/payload non
qualificati rimangono tutti occupati; payload legacy senza maschera usano 1³[255].

Il costo persistente aggiunge 2 MiB CPU e una texture nominale 2 MiB quando caricata
sulla GPU. Il builder usa inoltre scratch temporanei: non dichiarare 2 MiB come
picco totale. I quattro buffer vengono trasferiti una volta; installazione,
annullamento, sostituzione e rilascio gestiscono la risorsa aggiuntiva.

## Perché tre revisioni

V44 applicava il controllo in ogni scenario: la pioggia migliorava, ma il Sole
ravvicinato perdeva l'11,51%. V45 racchiudeva indice/load in `if(hasRain)`;
recuperava parte della perdita, lasciando un −3,72% rispetto al controllo ripetuto.
La sola diramazione uniforme non dimostrava quindi costo nullo in asciutto.

V46 genera due shader. L'asciutto ha **WGSL byte-identico alla baseline e nessun
binding narrow**. Il bagnato conserva esattamente il WGSL v45. La selezione usa
`targetRain>.001 || actualRain>.001`, si aggiorna solo al cambio di stato e torna
asciutta al termine del residuo. Non ricompila a ogni frame. Installazione del
volume e cambio diagnostica ricostruiscono esplicitamente il relativo shader.
Il report registra specializzazione iniziale/finale per rendere visibile una
misura eventualmente attraversata da una transizione.

Hash WGSL effettivi mode0: dry `d38fe3918e5cf95e2f13a1f6ca9a111a20045b2497600b89118cb7a8200bcb8c`;
rain `6d30dc1d1ab7bc99513c451f4fcbdee81c402fe90220d565bb3a6df52c5cb655`.
Il confronto indipendente del template dry prima dell'interpolazione conserva
12170 byte e SHA `9f295d675d7f8be3a30988f95879e93edd79d9b5d83fad83ddee10234599b443`.

## Misure reali, con confondente dichiarato

Tutte main, seed 72, t = 60 in pausa, forcing/precipitazione 0, camera e target uguali
entro ciascuna coppia, output/interno 2560×1440, Massima / 384, volumi 256³/128³.
Le transizioni meteo sono assestate; residui rain confrontati entro 1e−6.

| Posa | Controllo | V44 | V45 | V46 |
| --- | ---: | ---: | ---: | ---: |
| Pioggia | 13,99916 | 15,51513 | 15,37248 | **15,47236** |
| Sole ravvicinato | 23,13952 iniziale /23,21894 ripetuto | 20,47597 | 22,35415 | **23,27277** |

Valori in **invii/s**, non frame presentati. V46 è +10,52% rain rispetto al
controllo e +0,23% near rispetto al controllo ripetuto: il secondo è compatibile
con la variabilità della prova, non un guadagno rivendicato. La regressione
near delle due revisioni precedenti non ricompare in questa misura.

V46 near: 699 intervalli / 30.035,1 ms, p95 50,9 ms, p99 51,8 ms, massimo 52 ms;
prefisso completo, chiusura 165,7 ms. V46 rain: 465 / 30.053,6 ms, p95 83,4 ms,
p99 84,6 ms, massimo 85,2 ms; prefisso completo, chiusura 243 ms. Specializzazioni
rispettivamente dry/dry e rain/rain all'inizio/fine. Nessuna presentazione
misurata; somme timestamp dei pass non invertite in FPS.

**Queste misure restano preliminari:** la scheda «Cloudia · audit terreno GPU
esterno» è bloccata e non risponde nemmeno alla chiusura automatica. Un processo
renderer era al 100% CPU senza attribuzione provata alla scheda. Stato del device
non controllato; nessuna causa compiler/Metal accertata. Le prove v44/v45/v46
nello stesso contesto non sostituiscono un A/B/A pulito dopo la chiusura.
Il precedente Sole ordinario 90 s vicino a 60 appartiene alla baseline, non viene
ridenominato come misura v46. Il target di 60 FPS globale è ancora **FAIL/aperto**.

## Correttezza, browser e limiti

- Builder prodotto byte-identico alla R8 congelata dalla macro reale esistente;
  nessun nuovo volume per quella verifica. Macro originale non modificata.
- Audit raw GPU Apple metal-3: 62.544 punti, di cui 13.668 narrow-zero; nessun
  positivo macro escluso, indice/load errato o non finito. Comprende 49.344 probe
  del volume reale e 13.200 della fixture sparsa. È una qualifica finita del
  point guard v44/warp, non flow, materiale completo o selezione pipeline v46.
- Prima fixture sparsa respinta perché senza punti vuoti; originali conservati.
  Aggiunte 6.288 query senza cambiare runner, shader o criterio anti-PASS-vuoto.
- Suite completa **198 test/32 file**, typecheck e build app/hero superati.
  Test per contributor positivi, bordi, warp/ice, controesempio raggio1,
  trasferimenti/dispose, fallback, WGSL e transizione interrotta/residua.
- Browser main compila e misura entrambi gli shader; Sole → Pioggia funziona,
  console warning/error 0. La transizione inversa è esercitata separatamente.
  Prova worker reale, altri seed, tutte le pose/moto e altri device restano aperti.
- Il fermo immagine CSS non è framebuffer nativo, parità in moto o accettazione
  artistica. Nei confronti v45/v46 la scena è confrontata anche come raster
  decodificato; eventuali differenze hover sono circoscritte nel report immagini.

**PASS circoscritto:** implementazione/test, certificato numerico finito e
ripristino della baseline dry nella prova main dichiarata. **Non chiusi:**
adozione prestazionale senza confondente,60 FPS sostenuti, qualifica visiva completa
di anatomia/luce/virga/paesaggio e giudizio del proprietario.

[Archivio, sorgenti e riproduzione](measurements/narrow-cloud-2026-10-16/ARCHIVE-README.md),
[provenienza v46](measurements/narrow-cloud-2026-10-16/v46-provenance.json),
[verifica dei nove report](measurements/narrow-cloud-2026-10-16/variant-verification.json).
La cache macro 64 MiB, i build e le mappe restano esterni. Il
[successivo certificato continuo](RAIN-EMPTY-RESEARCH-2026-10-16.md) è soltanto
ricerca: l'errore del filtro flow non è qualificato. Non usare i suoi conteggi
condizionali come FPS o come margine numerico già disponibile.
