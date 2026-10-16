# Foschia comune fra nube, pioggia e paesaggio — 16 ottobre 2026

**Promossa la coerenza del coefficiente nel modello omogeneo**, dopo il confronto browser circoscritto. Il beneficio artistico generale rimane non dimostrato; le misure conservano un possibile piccolo costo e non mostrano uno speedup.

Il territorio usava `exp(-(.006+.004*haze)*d)`, mentre nube e precipitazione usavano `exp(-.0035*haze*d)`. La helper CPU/WGSL condivisa conserva il coefficiente artistico del territorio e lo applica nei due punti preesistenti del materiale volumetrico. Resta una sola definizione WGSL, inclusa dal modulo paesaggio completo. I test recuperano gli SHA dry/rain qualificati annullando soltanto queste due sostituzioni: i restanti template, l'API a tre argomenti e il percorso R8 sono preservati. Nessuna variazione a emissione, evaporazione, streak, clipping o campioni; qualità **256³ macro, 128³ dettaglio, 384 passi nominali e output pieno** conservata.

A 16 km, con haze 2,6, il fattore di contrasto della precipitazione passa da **0,8645034354** a **0,7692032809**, uguale a quello del territorio. Sono coefficienti Float64 del riferimento, non pixel finali. La densità atmosferica reale varia con la quota: il raccordo omogeneo resta un'approssimazione, come chiarisce [NVIDIA GPU Gems 2, capitolo 16](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering). Non è una nuova integrazione fisica dell'atmosfera.

Le **tre coppie JPEG** mostrano terreno e cortina nella stessa posa; il taglio della cima della nube è intenzionale. Le immagini sono CSS **1280×720**, mentre il rendering è configurato a **2560×1440**. Non sono PNG nativi o registrazioni temporali.

| Coppia osservata | Giudizio limitato alle immagini |
|---|---|
| Pioggia 80% | Immagini quasi equivalenti; candidata appena più tenue, cortina ancora leggibile. Nessuna nuova discontinuità evidente fra costa, foresta e mare. Il profilo molto regolare della cortina è già presente nel controllo. |
| Virga, target UI 20% | Quasi invisibile in entrambe. Nessuna perdita nuova evidente attribuibile alla candidata; intensità effettiva non esportata, assestamento di circa 30 s riferito dalla sequenza UI. |
| Sole | Nessun dilavamento globale evidente nella coppia. Non costituisce accettazione fotografica del materiale o dell'anatomia. |

Le [metadata delle sei immagini](measurements/aerial-consistency-2026-10-16/browser/metadata.json) distinguono target UI e quantità misurate. Console candidata vuota nel riscontro conservato. Il verdetto resta **assenza di regressione evidente in questa posa**, senza estenderlo ad altre famiglie, viste ravvicinate o movimento.

Il confronto A/B/A usa **main WebGPU**, seed 72, t60 in pausa, vento 55%, dispersione e lampi zero, forzante e tempo precipitazione zero, flusso completo, cielo assestato e intensità effettiva entro 1e−6 da 0,8. Camera identica: target `[0,0,0]`, yaw 0, pitch 0,36, avvicinamento 0%, distanza attuale **16 km**, terreno attivo. Il parametro diagnostico `surface=1` descrive l'estremo vicino e non la distanza di questa posa. Ogni misura comprende 2 s di riscaldamento e circa 30 s misurati, con output e interno **2560×1440**.

| Sequenza | Invii/s | Intervalli | p95 rAF | Intervalli >33,34 ms | Drain finale |
|---|---:|---:|---:|---:|---:|
| A1, coefficiente precedente | 20,320802 | 610 | 66,6 ms | 560 | 181,1 ms |
| B, coefficiente comune | 19,732149 | 592 | 66,7 ms | 571 | 211,6 ms |
| A2, coefficiente precedente | 19,899337 | 597 | 66,6 ms | 573 | 197,8 ms |

I controlli variano del **−2,07%**; B è **−2,90% rispetto ad A1** e **−0,84% rispetto ad A2**. Un piccolo costo rimane possibile, senza una separazione causale pulita dalla deriva dei controlli. Questi sono invii confermati nel prefisso finale, **non frame presentati dal compositore**: non qualificano 60 FPS stabili.

Tutti i prefissi terminano completi, con zero invii misurati non confermati. I ledger timestamp sono chiusi ma hanno 3/3/4 draw mancanti e 6/6/12 righe `no-ledger-range`; nessuna riga invalida, ambigua o duplicata rilevata. I dettagli rimangono nei raw, senza trasformare la copertura parziale dei timestamp in una prova GPU completa.

**Provenienza:** le tre misure riguardano `08c33cb` più il solo trial aerial, congelato in `rain-landscape/frozen-trial`, con anatomia originale e label del renderer v49. Il checkpoint finale **v50** comprende anche la nuova spalla anatomica: volume ed engine hanno SHA differenti. Questi risultati non sono una misura del v50 combinato. La [provenienza selezionata](measurements/aerial-consistency-2026-10-16/build-provenance.json) conserva entrambe le identità; la validazione finale del checkpoint resta separata.

L'[archivio](measurements/aerial-consistency-2026-10-16/manifest.json) conserva sei JPEG, tre report raw gzip lossless, statistiche compatte, sorgenti pertinenti e prove CPU. Anche i due snapshot dello shader sono gzip lossless: il manifest conserva SHA e dimensioni dei byte originali. I **27 test mirati su 4 file** usano witness fissi, proprietà bounded/semigroup e contratti effettivi dei nodi WGSL. L'ipotesi iniziale sulla scala della pioggia è registrata come **falsificata e ritirata**: `growth` contiene reciproci e le trasformazioni esistenti sono coerenti. Il rapporto in `source-evidence/` è lo snapshot della fase CPU precedente all'A/B; lo stato finale di questo esperimento è quello descritto qui.

Verifica ripetibile dei byte archiviati, dei raw e delle invarianti della misura:

```sh
python3 docs/measurements/aerial-consistency-2026-10-16/verify.py
```

Restano aperti qualità fotografica generale, continuità temporale, luce ravvicinata, integrazione artistica della virga e prestazioni sostenute. La promozione di questa coerenza del modello non chiude quei gate.
