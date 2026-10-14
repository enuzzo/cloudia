# Cloudia — piano di sviluppo dell'osservatorio

Autorizzato il 13 ottobre 2026: pubblicare i quattro checkpoint v18 e progettare
e avviare una continuazione autonoma. Baseline pubblicata: `85d6919` sul ramo
`codex/cumulonimbus-webgpu`. Nessun merge su main o deploy implicito.

## Direzione

Un piccolo strumento atmosferico che invita a osservare e giocare: il dettaglio
deve reggere lo sguardo, i controlli devono spiegarsi attraverso il risultato.
Non promettiamo una simulazione meteorologica né fotorealismo già raggiunto.
Manteniamo 256³/128³, 384 passi, output 100%; ogni costo nuovo va misurato.

## Coda ordinata per dipendenze e impatto

| Priorità | Intervento | Risultato verificabile | Stato |
| --- | --- | --- | --- |
| P0 | Sole basso condiviso fra cielo, scattering e ombre | Ombre laterali corrette nei due tramonti; giorno invariato; cambio scena/interruzione senza salti | Implementato v20; cache/worker LUT aggiunti in v21 |
| P0 | Confronti ripetibili | Stesso seme, tempo, camera e qualità; prove giorno/tramonto; conservare anche regressioni | 30s main giorno/tramonto +90s worker animato verificati; confronto alternato da fare |
| P0 | Latenza del cambio cielo | Cache delle LUT già visitate o calcolo asincrono; misurare anche il primo cambio scena e le interruzioni, non solo il regime stabile | Cache/worker implementati v21; misura quantitativa primo cambio ancora aperta |
| P1 | Profondità e scala | Prototipo reversibile con orizzonte atmosferico e nube lontana; confronto con foto e possibilità di mantenere il campione isolato | Terra procedurale reversibile v21; rilievi, ombra al suolo e nubi lontane ancora da fare |
| P1 | Incudine e glaciazione | Raccordo ampio, fibre distali non uniformi e silhouette plausibile da fronte/lato/retro in tutte le famiglie | Progettato |
| P1 | Illuminazione interna | Valutare scattering multiplo legato al colore solare, bordi scuri e luce trasmessa; evitare nubi di plastica e nero pieno | Ricerca |
| P1 | Pioggia/virga | Precipitazione che nasce dalla base, svanisce in aria se opportuno, segue vento e intensità senza un rettangolo visibile | Cortine dalla densità della base implementate v21; accettazione fotografica aperta |
| P1 | Cielo continuo | Elevazione solare e meteo graduabili; cache atmosferiche interpolabili, niente bake pesante a frequenza gestuale | Dipende da P0 |
| P1 | Mani: pipeline locale | Avvio esplicito, anteprima, stop che chiude le tracce; un frame in inferenza, worker separato, fallback manuale | Da implementare; nessuna attivazione automatica |
| P1 | Mani: grammatica giocabile | Aprire/raccogliere la nube, evocare pioggia, spostare il sole; soglie/isteresi, nessun evento su riacquisizione, feedback e annullamento | Proposta da provare |
| P2 | Controlli accessibili | Tastiera completa, stato annunciato, contrasto, touch, focus, riduzione movimento e guida breve contestuale | Click esterno/Esc globale e zoom tastiera aggiunti v21; audit completo aperto |
| P2 | Preset personali | Salvare seme/camera/meteo in un collegamento riproducibile; ripristino robusto dei valori | Progettato |
| P2 | Modalità contemplazione | Nascondere strumenti con ritorno evidente; pausa, audio e movimento rispettano la scelta dell'utente | Progettato |
| P2 | Paesaggio sonoro | Test d'ascolto per distanza, pioggia e tuoni; volume graduale, mute immediato, niente avvio sonoro inatteso | Richiede ascolto |
| P2 | Prestazioni GPU | Prove abbinate main/worker, costo letture texture, generazione/memoria, perdita device; ottimizzare solo con evidenza | Continuo |
| P2 | Embed reale | Montaggio/smontaggio ripetuto in contenitore 100%×60vh, resize, visibilità, più istanze e cleanup | Da verificare realmente |
| P3 | Dispositivi e compatibilità | Mac/Windows, GPU integrate, telefono fisico, messaggio chiaro senza WebGPU; budget dichiarati | Richiede dispositivi |
| P3 | Esportazione e condivisione | Fotogramma pulito con seme e crediti; eventuale clip solo dopo verifica dei costi e dei formati | Idea in coda |

## Metodo e criteri di uscita

Ogni tranche: una scelta motivata, implementazione circoscritta, test del rischio
reale, controllo visivo nel browser interno, misure a qualità invariata,
aggiornamento handoff e checkpoint sul ramo autorizzato. La roadmap è una coda,
non una promessa che tutte le voci siano già implementate. Nessuna automazione
o lavoro programmato viene creato implicitamente.

Per la prima tranche, aggiungere due cache ottiche RG8 alla stessa risoluzione
256³: +32 MiB di dati texture GPU e 32 MiB di payload CPU conservato, più due bake iniziali e relativi temporanei. Campionarle soltanto durante
tramonto/transizione. Integrare lungo l'asse dominante della luce evita la griglia
di raggi enorme del precedente algoritmo quando il sole è quasi orizzontale.
La transizione fra cache resta un'approssimazione; gli estremi sono calcolati
nelle direzioni effettive. La deformazione della nube continua ad approssimare
il trasporto delle ombre. Non introdurre ray marching solare annidato senza budget.

## Fonti e alternative

- [Guerrilla, Nubis³](https://www.guerrilla-games.com/read/nubis-cubed): riferimento
  di produzione per volumi, accessi alla memoria e accelerazione della luce;
  non dimostra gli stessi tempi sulla nostra GPU o nella nostra architettura.
- [Hillaire, atmosfera in tempo reale](https://doi.org/10.1111/cgf.14050): riferimento
  per atmosfera/LUT; l'implementazione Cloudia rimane un'approssimazione propria.
- [NASA S'COOL, cumulonembi](https://scool.larc.nasa.gov/GLOBE/cumulonimbus.html):
  scala, base, raccordo e incudine; fotografie consultate, non redistribuite.
- [MediaPipe Hand Landmarker Web](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js):
  pipeline futura già studiata nel documento OBSERVATORY; riverificare API prima
  dell'implementazione. Inferenza sincrona da isolare dal rendering.

Alternative al primo intervento: bake a ogni variazione (latenza e contesa),
campionamento solare per ogni passo (costo moltiplicato), atlante direzionale
denso (memoria). Due estremi aggiuntivi sono una prima soluzione limitata e
misurabile; non risolvono ancora un sole libero su tutto l'emisfero.

## Estensione richiesta il14 ottobre

Avvicinamento reale fino al bordo stimato, con più campioni locali e qualità
nativa massima implementato in v21. Le prove e i limiti sono in
[ENVIRONMENT-2026-10-14.md](../ENVIRONMENT-2026-10-14.md).
Priorità successiva proposta: rilievo del suolo e ombra proiettata, poi
raffinamento della frontiera vicina con riferimento fotografico.
