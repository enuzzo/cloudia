# Audit raw WebGPU narrow-cloud — pronto, non eseguito

La GPU si attiva soltanto con **Esegui audit**. Il risultato compare in
`#audit-json` (data-testid `narrow-audit-json`) e si può scaricare con il pulsante.
Serve localhost, ad esempio il server4183 gestito dal root, con questa cartella
come radice o il suo percorso sotto cycle10. Nessun server/browser viene avviato
preparando questi file. Non eseguire insieme ad altri benchmark renderer/GPU.

Risorse: una texture macro256³ RGBA8 da64MiB e una narrow128³ R8 da2MiB, mip0;
un solo device. Dopo il dataset reale, la fixture riusa le stesse due texture e
gli stessi array CPU. I buffer query/output/readback aggiungono circa6MiB al
picco nominale e vengono distrutti; questa pagina non è una misura di memoria.
Le risorse vengono distrutte anche su errore/pagehide; fasi e timeout30s rendono
esplicito un await bloccato. Nessuna attesa popErrorScope precede il primo submit.

I due `.bin` macro/mask sono link simbolici ai dati esterni già presenti, non
copie della cache né nuove cotture. Il server deve seguirli: se uno restituisce
404 o i suoi SHA differiscono, l'audit fallisce prima della GPU. Non rigenerare.
`inputs.json` registra hash e parametri; `prepared-files.json` registra tutti i
file preparati. La pagina verifica i SHA hardcoded dei sorgenti e dei dati,
lo shader e le query prima di richiedere il device.

Il kernel contiene le espressioni esatte del guard frozen e delle due righe
fine-warp/macro della baseline. Il file completo originale e quello candidato
sono conservati e hard-pinned. Il calcolo parte da `coord` f32 **già dopo flow**:
non esegue cloudReference o flow. Ogni query passa ice e fineRGB dinamici da
storage; warp e textureSampleLevel linear/clamp/mip0 vengono valutati sulla GPU.
La macro viene campionata anche quando il guard sarebbe zero per controllare il
controfattuale; ciò non riproduce il ramo/pipeline Three.js completo.

- Dati reali:49.344 query.512 corner macroR positivi distribuiti e256 boundary
  candidati selezionati deterministicamente fra861.511 corner positivi. Centri,
  supporti prossimi agli endpoint,8 segni del warp, ice0/.5/1, un ULP su entrambi
  i lati dei confini narrow, facce/clamp esterno e punti Halton del volume.
- Fixture sparsa:6.912 query,12 texel macro isolati con R=1/255 o1 su vertici,
  spigoli, facce e interno. Il resto è zero; mask r2 costruita esplicitamente e
  hash confrontati. Non è una seconda nube o un bake anatomico.

Ogni dataset confronta l'indice/load R8 GPU con l'indice CPU e registra:
`narrowZeroMacroPositive`, `narrowZeroMacroAboveGate`, input/output SHA, gruppi,
valori non finiti e primi witness. Un PASS richiede entrambi zero, indici/valori
coerenti e centri positivi sopra il gate originale .002: una macro che restituisce
sempre zero non può passare. Errori di compilazione, validazione, perdita device
o timeout producono FAIL. Il JSON include adapter, fasi, scope e cleanup.

Non sono punti reali estratti dai passi visitati del contatore: sono corner e
probe di volume basati sugli stessi array reali. Non si dichiara equivalenza di
renderer, binding Three.js, flow compute, radiance/materiale, immagini, lifecycle
app o FPS. Un PASS è una qualifica finita delle espressioni e delle texture su
questo backend. La successiva candidata app richiede i propri controlli.

`prepare-audit.py` conserva la generazione CPU delle query e la provenienza,
con percorsi espliciti di questa sessione. Non chiama generateVolume né API GPU.
Preparazione eseguita in meno di1s; controllo sintassi JS con `node --check`.
Nessuna esecuzione GPU è stata fatta dall'agente che ha preparato il pacchetto.
