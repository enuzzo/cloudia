# Limite superiore della pioggia: qualificato e ritirato

16 ottobre 2026. Goal attivo; obiettivo FPS ancora aperto. Esperimento locale
basato sul commit `a1efb8e489d31c417ebb2dd6b06cbc2e8dfaca1c`.

## Decisione

**Non conservare la candidata nel prodotto.** Nella sequenza controllo,
candidata, controllo ripetuto non dimostra un vantaggio FPS. I tre screenshot
CSS dell'intero frame coincidono byte per byte; questo qualifica soltanto la
vista statica campionata, non tutta la pipeline o gli altri dispositivi.

| Prova, 30 s dopo 2 s di riscaldamento | Invii/s | p95 intervallo | Somma pass GPU media | Chiusura prefisso finale |
| --- | ---: | ---: | ---: | ---: |
| A, controllo v40 | 14,2088 | 83,4 ms | 137,380 ms | 274,8 ms |
| B, limite superiore v42 sperimentale | 13,0656 | 84,8 ms | 149,740 ms | 319,9 ms |
| A, controllo v40 ripristinato | 13,4664 | 99,9 ms | 144,341 ms | 243,2 ms |

La candidata è inferiore dell'8,05% al primo controllo e del 2,98% al secondo.
I controlli differiscono fra loro del 5,22%: non attribuire causalmente tutta
la differenza allo shader. La conclusione operativa è **nessun beneficio
dimostrato**, non una stima universale della regressione. Tutti i prefissi
finali sono completati e confermano il numero di intervalli misurati.

Configurazione verificata dai JSON: main thread, Apple `metal-3`, output e
interno 2560×1440, CSS 1280×720, DPR 2, Massima / 384 passi nominali,
macro 256³, dettaglio 128³, seed 72, tempo della nube 60 s in pausa,
forcing 0, pioggia, vento 0,55, dispersione 0, stesso target, camera e pitch
−0,92, diagnostica `stages`, nessuna ablation, nessun limite ai frame in volo.
La pioggia converge asintoticamente a 0,8: i residui dei tre report sono
inferiori a 10⁻⁸ e i valori originali restano archiviati. I clock di navigazione
e lo stato termico/sistemico non sono identici né controllati.

Le somme dei pass GPU sono campioni diagnostici, non latenze complete del
frame e non reciproci degli FPS. Gli invii e i completamenti della coda
restano distinti dalla presentazione: `presentedCanvasFps` è `null`.
Una prova separata con diagnostica disattivata dà 13,6174 invii/s: non è il
controllo della candidata con `stages` e non dimostra un vantaggio di quella
modifica. Questi 30 s non qualificano i 60 FPS sostenuti o il movimento.

## Ipotesi e conservazione della qualità

Il renderer continua i passi della pioggia anche sopra qualsiasi possibile
emissione. La candidata conserva box superiore 2,8 km, intervalli del raggio,
passi di 6 m, jitter, campioni e percorso della nube; modifica soltanto
l'ingresso nel blocco ottico della pioggia quando il contributo è nullo.
Non introduce una risoluzione adattiva o un nuovo materiale.

Il massimo delle quote G soltanto nei texel con R positivo è insufficiente:
R e G sono filtrati indipendentemente. Il helper legge invece il massimo G
nell'halo di un texel, comprese le diagonali, attorno a tutti i byte R positivi.
Il massimo viene aggiornato insieme alla mappa a ogni installazione del volume;
clamp e assenza di mipmap sono espliciti. Lo shader converte la quota attraverso
la crescita verticale e conserva un margine di 11,795223 m: un codice UNORM8
di G, cioè 3/255 km, più 2⁻¹⁵ km per l'aritmetica. Questa è un'ipotesi
conservativa dichiarata e campionata, non un limite universale garantito per
ogni implementazione di `textureSampleLevel`.

Una sola generazione CPU del volume reale ha prodotto la mappa 64×64 RG8 del
seed 72. Massimo G in tutto il padding: 255; solo sugli R positivi: 180;
nell'halo corretto: 196. Il bound decodificato è 1,805882353 km nel riferimento.
Alla posa t=60 s lascia circa 682,3 m della precedente fascia superiore in cui
il blocco ottico può essere omesso. Questa estensione non misura il lavoro
effettivamente risparmiato per frame.

## Prove e limiti

- **CPU:** 9 gruppi del repro esterno superati, inclusi canali indipendenti,
  padding, bordi, byte quantizzati e sei raggi sintetici. Sono prove del
  contratto e della sequenza f32 modellata, non raggi del volume reale.
- **GPU sampler:** 14 dataset, 39.614 UV f32, 16.520 letture con R positivo;
  nessuna violazione del bound, falso positivo sulle mappe vuote o errore
  non catturato. Attachment zero alla soglia e al primo f32 saltato, per tre
  valori della crescita. Report e integrità verificati da una review separata.
  È una prova finita su Apple `metal-3`, distinta dall'integrazione Three.js.
- **Browser completo:** la candidata compila e rende la scena, usa il massimo
  previsto e completa la misura. Console candidata e controlli senza warning
  o errori. JPEG CSS 1280×720 A/B/A identici, SHA256
  `c73b336f2ef9d2e2a1810f0cb5cf8cbba246a832e66bae531fc9f23e15021972`.
  Non è un confronto del framebuffer nativo né una qualifica delle altre pose.
- **Test e build:** 7 test mirati della candidata superati; build applicazione
  riuscita. Dopo il ritiro, ripristino byte per byte dei tre sorgenti, rimozione
  del solo test introdotto e già conservato nell'archivio, build app e hero
  riuscite. La suite completa 163/28 del checkpoint precedente non è stata
  ripetuta su sorgenti ripristinati identici.

Il primo tentativo del solo harness sampler non aveva completato. È conservato
come incompleto; non contribuisce al PASS. Il runner finale aggiunge testo di
fase, con WGSL invariato. Il completamento è arrivato dopo l'isolamento della
pagina dall'anteprima attiva; la causa dell'attesa iniziale non è identificata.
Il risultato finale dichiara la distruzione del device e delle risorse per mappa.

## Archivio e continuazione

L'[archivio delle prove](measurements/rain-upper-bound-2026-10-16/manifest.json)
contiene input RG8, script CPU e GPU, proposta congelata prima/dopo, patch,
review indipendenti, report grezzi, confronto dei parametri, immagini e hash dei
bundle della candidata e del ripristino. Gli stati delle proposte nei manifesti
originari descrivono il momento della preparazione; questo documento e
`comparison-decision.json` registrano la decisione finale.

Il prodotto resta `observatory-v40-terrain-camera-focus`, materiale v34, con
strumentazione coda schema 2. Restano aperti anatomia/cap delle tre famiglie,
luce ravvicinata in moto e controluce, pioggia/virga nel paesaggio, intersezioni
del terreno, UI e FPS sostenuti. Il solver terreno attuale può perdere montagne
anche su raggi senza hit della sfera del mare: la correzione deve preservare il
campo originale, certificare gli intervalli precedenti al primo hit e avere un
costo esplicito. Nessuna nuova geometria campionata viene promossa qui.
