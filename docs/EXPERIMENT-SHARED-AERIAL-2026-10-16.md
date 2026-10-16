# Condivisione del fattore atmosferico — trial ritirato, 16 ottobre 2026

**Non promosso:** il vantaggio prestazionale iniziale non si riproduce nel secondo confronto A/B/A. Il prodotto conserva il checkpoint `10493af`; sorgenti e build del trial restano esterni. L'equivalenza osservata nei casi provati è documentata separatamente dal risultato FPS.

Il checkpoint applica già lo stesso modello atmosferico omogeneo a nube, pioggia e terreno. Questo esperimento tenta soltanto di riusare, nella specializzazione piovosa, il fattore diretto `aerialTransmittance(t,weather.x)` già calcolato per la nube. Conserva prima `rainLight`, attraversa lo stesso gate dei mezzi nulli e poi applica il mix alla precipitazione solo se `rainExtinction>0.0`. Due sostituzioni, selezionate esclusivamente dai flag esistenti `useNarrow || useDensityR8`; API a tre argomenti, template senza pioggia (DRY), fase, lookup, coefficienti, campioni e percorso R8 restano preservati. Nessuna ricorrenza o approssimazione aggiunta.

I **40 test mirati su 5 file**, typecheck e build app esterna passano. Il primo run aveva 38 PASS e un errore nel solo test che leggeva il file baseline attraverso un URL non `file:` in jsdom; corretto il percorso, è stato aggiunto anche il controllo diretto del DRY predefinito. Lo shader non è cambiato per questa correzione. Il [log gzip originale](measurements/shared-aerial-2026-10-16/source-changes/validation.json.gz) conserva entrambi i run. Il test qualificato è intenzionalmente esterno e dipende dal clone baseline: non è stato trasferito nel prodotto. La proposta successiva di test portabile non è stata eseguita né adottata.

I [24 witness dei template](measurements/shared-aerial-2026-10-16/gpu/candidate-template-witnesses.json) confrontano sei modi e quattro combinazioni dei flag. Tutti i sei DRY sono identici direttamente alla baseline; per le 18 varianti con almeno un flag attivo, l'inversione delle sole due sostituzioni restituisce l'intero codice originale. Anche i sei moduli inclusi sono identici. Sono i sorgenti effettivi dei nodi Three `wgslFn` catturati sulla CPU, non il codice macchina del driver. Lo SHA256 diretto del DRY predefinito rimane `59523937da9df384aa57345fb99c758cee70bc83c5ada8d3084038dfa416f546`.

Il confronto GPU separato, eseguito dal root su Apple/Metal 3, produce **216 tuple e 864 componenti RGBA f32 per variante identici per bit**. Differenze, valori non finiti, sentinelle residue ed errori di validazione: zero; console catturata vuota. Il [package GPU](measurements/shared-aerial-2026-10-16/gpu/README.md) conserva app riproducibile, input, due pipeline, raw e verificatore. Entrambi gli output di 3.456 byte hanno SHA256 `02fda484196d60c13cb86cdcebcd6574e356e28478f7a6f514c1c98038248987`.

Questa prova riguarda i segmenti finiti selezionati prima del film, con lookup e fattori di attachment/evaporazione forniti come input. Non percorre texture, interi raggi o ogni valore f32. La [specifica WGSL, §15.7.5](https://gpuweb.github.io/gpuweb/wgsl/) permette riassociazione e fusione delle operazioni secondo i limiti indicati: l'identità osservata su questo backend non è una garanzia universale. Non è stata misurata l'eliminazione di espressioni comuni da parte del compilatore; non viene attribuita al driver la causa dell'esito prestazionale.

Le cinque misure usano **main WebGPU, qualità ultra, 256³ macro + 128³ dettaglio, 384 passi nominali, output e interno nativi 2560×1440**, R8 stabile, flusso e lavoro interno completi. Seed 72, t60 in pausa, pioggia effettiva entro 1e−6 da 0,8, vento 55%, dispersione e lampi zero, cielo assestato; i clock di forzante e precipitazione sono zero. Camera identica: target `[0,0,0]`, yaw 0, pitch 0,36, avvicinamento 0%, distanza attuale **16 km**, terreno attivo. `surface=1` descrive l'estremo vicino della navigazione e non questa distanza. Ogni run comprende 2 s di riscaldamento e circa 30 s misurati.

| Sequenza | Invii/s | Intervalli | p95 rAF | Intervalli >33,34 ms | Drain finale |
|---|---:|---:|---:|---:|---:|
| A1, checkpoint | 17,745845 | 533 | 66,7 ms | 533 | 221,7 ms |
| B, trial | 20,642377 | 620 | 66,7 ms | 556 | 196,5 ms |
| A2, checkpoint | 19,621234 | 589 | 66,7 ms | 567 | 184,1 ms |
| B2, trial ripetuto | 19,265960 | 578 | 66,7 ms | 567 | 213,0 ms |
| A3, checkpoint | 19,144204 | 575 | 66,7 ms | 570 | 198,8 ms |

Nel primo blocco B supera A2 del **5,20%**, ma i controlli A1→A2 derivano del **10,57%**. La replica A2/B2/A3 mostra B2 **−1,81% rispetto ad A2** e **+0,64% rispetto ad A3**, all'interno dell'intervallo dei controlli, che variano del **−2,43%**. Il guadagno non è riprodotto. Questi confronti riguardano soltanto il ciclo15; non sono concatenati alle percentuali di altri esperimenti.

Tutti i prefissi finali sono completi, senza invii misurati non confermati. Il ledger timestamp è chiuso ma la copertura resta parziale: draw mancanti **4/2/2/3/2**, righe non associate **9/12/9/9/6**, nell'ordine della tabella; nessuna riga invalida, ambigua o duplicata rilevata. I raw mantengono l'intero ledger. Gli invii confermati non certificano la presentazione del compositore e non qualificano **60 FPS stabili**.

I [cinque JPEG e le metadata](measurements/shared-aerial-2026-10-16/browser/metadata.json) sono **1280×720 CSS**; la cima della nube è tagliata intenzionalmente per mostrare base, cortina e terreno. Il confronto PIL del root trova tutti i JPEG RGB decodificati identici, differenza massima e media zero; anche i byte JPEG coincidono. È una verifica circoscritta della posa conservata, senza PNG nativi, video, prova di continuità o accettazione artistica generale.

La [provenienza](measurements/shared-aerial-2026-10-16/source-changes/provenance.json) distingue il controllo `observatory-v50-quality-checkpoint`, servito dal `final-dist` del ciclo14 su 4196, dal candidato `observatory-v50-trial` su 4197. I 108 input baseline sono stati verificati contro `10493afa7f6d90389c39e17b2cad79397dfdac01`; i 109 input candidati aggiungono il test esterno. Le sole cinque differenze sono shader, due test, etichetta engine e relativa aspettativa lifecycle. Il bundle app candidato è `CumulonimbusApp-CmRmdfXx.js`, il render worker `render.worker-CBQVZObY.js`; i manifest distinguono i loro hash dagli asset del controllo. Le misure riportate sono main, non una qualificazione del worker.

L'[archivio curato](measurements/shared-aerial-2026-10-16/manifest.json) conserva cinque raw gzip lossless, JPEG e metadata originali, snapshot dei soli file cambiati, manifest e log, i 24 witness e il package GPU. L'app diagnostica originale, con i suoi 17 payload e manifest intatti, è conservata integralmente in `tar.gz` ed estraibile fuori dal repository; il verificatore ne legge direttamente i byte senza estrarla. Nessun clone completo o build dist è duplicato. Verifica CPU ripetibile, senza render o bake:

```sh
python3 docs/measurements/shared-aerial-2026-10-16/verify.py
```

Il trial è ritirato per assenza di beneficio prestazionale riprodotto. Restano aperti prestazioni sostenute a qualità piena, qualità fotografica generale, luce ravvicinata, continuità temporale e integrazione artistica della virga.
