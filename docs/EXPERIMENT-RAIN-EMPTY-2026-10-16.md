# Nube certificata vuota nella pioggia — candidata ritirata

16 ottobre 2026. Ottavo ciclo, successivo al checkpoint `792e764` e all'archivio
`8757b97`. Il goal è di nuovo verificato **active**; gli FPS sono un obiettivo
aggiuntivo, mantenendo tutti i gate visivi e la qualità piena.

## Ipotesi e verifica di correttezza

La candidata memorizzava, per il solo raggio/frame corrente, un intervallo di
nube certificata vuota dopo un lookup fresco della maschera conservativa.
Durante quel tratto evitava riferimento e maschera della nube, continuando
ogni passo originale della pioggia e ogni campione di nube occupata.
`sampleStep`, ingresso/jitter, clipping, sorgente e integrazione restavano uguali.

La review indipendente conferma un margine continuo, valido anche per i6m
della pioggia non allineati ai passi ordinari. La versione effettivamente
misurata aggiunge il gate `reference.y + growth.x*H + .001 < iceRange.x`,
con `H=max(0,emptyStep-stepSize)`, per conservare il limite del Jacobiano anche
nel dominio pioggia oltre il box nube. Il timer si rinnova soltanto da un
lookup fresco zero, si usa solo in `rainRegion` e con confronto stretto `t<until`.

Quattro test CPU della candidata sono passati e archiviati, insieme a un
modello esterno con10 casi e2 controlli negativi. Coprono spostamento continuo,
formazione, endpoint e nube sottile analitica con sequenza/integrale invariati.
Non eseguono WGSL e non sono una nuova validazione di un CloudVolume generato.
I test sperimentali sono stati rimossi dal prodotto insieme alla candidata.

## Risultato nel browser

Main WebGPU, seme72,60s in pausa, forcing0, vento0,55, assetto pioggia80%,
camera identica yaw0/pitch−0,92 e target fissato, CSS1280×720/DPR2,
output e interno2560×1440, Massima384, macro256³/dettaglio128³.

| Misura30s | Controllo v40 | Candidata con gate |
| --- | ---: | ---: |
| Invii misurati/s | 11,38035 | 10,37051 |
| Media somma pass GPU campionati | 171,44449ms | 188,60069ms |

La candidata dà−8,87% nella cadenza e+10,01% nel tempo GPU riportato.
**Nessun vantaggio dimostrato: ritirata.** La singola coppia non isola
temperatura, carico di sistema o un nesso causale generale. Inoltre la pioggia
del controllo conservava un piccolo residuo di transizione:0,799959889 contro
circa0,8, differenza0,00004011. Le altre52 impostazioni confrontate coincidono.
Il precedente `rain-control-30s.json` usa camera e output diversi ed è solo
un riferimento, escluso da questa coppia.

Le due immagini1280×720, acquisite dopo la chiusura del pannello, sono
byte-identiche: SHA256 `c73b336f2ef9d2e2a1810f0cb5cf8cbba246a832e66bae531fc9f23e15021972`;
anche il confronto RGB dell'intero frame dà zero differenze. Questo qualifica
la still fornita, non ogni posa, famiglia, moto, worker o immagine GPU nativa.
Restano comuni rilievi morbidi, sottobase abbastanza uniforme e cortina di
pioggia poco articolata. Non è accettazione fotografica.

La pressione sui registri e il controllo divergente sono spiegazioni possibili
del mancato guadagno, documentate nelle fonti Apple conservate nella nota.
Non abbiamo registri/spill o contatori SIMD: non sono cause dimostrate qui.

## Ripristino e archivio

`cloudShader.ts` è ripristinato byte per byte alla baseline v40/materiale v34,
SHA256 `d80225521258edb4beed2e713afe3c6b97fad5eca79d7dcdc657f9f47c1deddd`.
La ricostruzione di controllo ha riprodotto il precedente hash del bundle main.
La modifica successiva alle misure FPS non altera shader, texture o passi.

[Archivio con manifesto](measurements/rain-empty-certificate-2026-10-16/archive-manifest.json):
sorgenti base/candidati, patch iniziale e con gate, proof, test, report,
immagini, review e ripristino. `*.guarded` identifica la versione misurata;
la patch esterna iniziale precede il gate. I percorsi assoluti interni sono storici.

La prossima ipotesi documentata è un limite conservativo dell'altezza di
emissione pioggia, derivato dai byte RG8 e dall'halo dei texel positivi. Può
evitare lavoro sicuramente nullo conservando i passi, ma richiede ancora
qualificazione f32 e misura del beneficio. Non è implementata. Non ripetere
come nuove le due esclusioni già ritirate, per box o intervallo vuoto.
