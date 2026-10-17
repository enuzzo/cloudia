# Review indipendente del runner sorgente pioggia

**PASS statico limitato — nessun blocker concreto rilevato. Non eseguito da questa review.** Il pacchetto è idoneo al singolo run diagnostico già autorizzato dal root; questo non costituisce esito numerico o adozione.

Ho letto runner, preparazione, derivati, launcher e protocollo; autenticati19 payload contro FREEZE SHA256 `1d0747559cbb95b4b91cd076bc345a32e47279e21f4d49f4df8ba296705d0b9c`. Verifica propria solo testuale/I/O: l’inverso della patch volume ricostruisce esattamente il canonico c349e8f7; l’inverso di firma/accessor/dimensione del reducer ricostruisce esattamente il corpo canonico. Nessun transpile, modello, test o runner eseguito.

- **Hook:** il callback è dopo la chiusura del loop che sovrascrive density con `sampleCloudDensity*materialExtinction/18`, immediatamente prima del primo bake ottico originale. Cattura quindi il vero F32 fine usato dalla luce, distinto dal macro carved/pre-prune del diagnostico precedente. Tutti i cinque bake e occupancy proseguono. Il volume non importa precipitation: nessun nuovo ciclo di dipendenze.
- **Stesso reducer:** il derivato cambia soltanto la dimensione in ingresso e un accessor scalare. Threshold.05, top2.5km, area filter, gain.85, Gaussian5×5, estrapolazione della base e quantizzazione RG8 restano nel medesimo corpo. Prima del confronto fine, il runner richiede canonico macro vs derivato macro identici in tutti8192 byte; questo gate è previsto nel codice, non ancora osservato in esecuzione.
- **Unità e indici:** scalar index resta `(z*volumeSize+y)*volumeSize+x`. L’accessor macro divide R8 per255; l’altro legge il F32 reale senza gain o rinormalizzazione. Il requisito `iceStart(74)>2.5` copre tutta la fascia del reducer; lì ice=0 e il rapporto fra estinzione liquida e18 è matematicamente1. Il buffer F32 mantiene comunque i suoi effettivi arrotondamenti. Non è un campo idrometeore e manca il flow runtime.
- **Ownership:** gli input sono letti in prestito nel callback sincrono. I reducer possiedono solo gli scratch/output piccoli; gli hash completi prima/dopo devono escludere mutazioni del F32 e RGBA. Gli output conservano mappe/statistiche/hash, nessuna reference ai buffer originali. Nessun nuovo lookup/pass/target GPU.
- **Budget:** il launcher usa un solo Popen, limite OS20CPU child, timeout40s con kill+wait e384MiB peakRSS child verificato al terminale. RSS non è un limite live; CPU/RSS wrapper non vengono aggiunti al budget del child e il protocollo non pretende il contrario. Directory run preesistente impedisce replay. Errori, timeout o gate fallito restano fallimenti terminali, senza retry.

Le due RG8 post filtro complete e i4096 texel prefissati permettono distinguere supporto, spostamento della base e semplice attenuazione. TV normalizzata/correlazione/rapporti sono statistiche diagnostiche; non modificano i byte né sostituiscono una differenza visiva convincente. Risoluzione64/64, seed74 soltanto: niente prova256/128, GPU, worker, meteorologia o FPS. Nessuna proposta di adozione da questa review.

## Digest dei file letti

- `runner.ts`: `c684d590f4e6e6e933e908520e7e978cfa895182ed0022adfb3574209401ccf3`
- `launch.py`: `5cfd90f5ebac6783ce078932543903e6570462cd0631b70de993a90ce6d33aab`
- `instrumented/volume.ts`: `6b7d23ceb3facbb8f9e0e6abc43aacd9940ba8afa4c349704cca059348aa8ac9`
- `instrumented/precipitation.ts`: `2ca1f7a666d9a680c407a0f4a1c7beeb0aa044a2c347d8320fa358920c681ed3`
