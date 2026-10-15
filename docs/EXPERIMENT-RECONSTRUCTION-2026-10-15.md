# Condensazione dopo interpolazione: quinto ciclo

15 ottobre 2026. **La precisione della ricostruzione non equivale alla qualità
ravvicinata.** Questo ciclo prova il cambio d'ordine già definito nelle
[opzioni di ricostruzione](RECONSTRUCTION-OPTIONS-2026-10-15.md), poi due
interazioni circoscritte: larghezza della transizione e estinzione. Le immagini
v35/v36/v38/v39 restano troppo morbide. **Tutte le varianti sono ritirate e
conservate come esperimenti; il materiale operativo torna a b2613c2.** Il goal
rimane attivo.

## Modello e costi del candidato

La texture aggiuntiva RG16F conserva due quantità prima del clamp:

```
U0 = (rawField + carving - (.025 - .017*iceVoxel)) * (10 + 4*iceVoxel)
M  = (.65 + .35*n2) * (1 - iceVoxel*(1-fibers)*.5) * baseFade
rhoMacro = clamp(interp(U), 0, 1) * interp(M)
```

U è una coordinata di condensazione adimensionale, non una distanza. v35 usa
U=U0, conservando profilo e modulazione originali; cambia l'ordine rispetto a
`interp(clamp(U0)*M)`. Il comportamento del ghiaccio può quindi cambiare per
l'interpolazione anche quando i suoi valori nodali restano gli stessi.
Il campo dopo carving non offre una garanzia di gradiente unitario.

M è generata anche nei vertici di condensazione nulla necessari al filtro:
si usa lo stencil dei 26 vicini di ogni vertice rawField positivo. Carving non
positivo e offset positivo rendono questo stencil conservativo senza assumere
una SDF. U=-32 finita e M=0 altrove; M=0 sui sei bordi conserva il vecchio bordo
vuoto. CPU e GPU decodificano gli stessi half quantizzati e usano centro texel,
interpolazione trilineare e clamp ai bordi.

La maschera e i bounds dipendono dai vertici U>0, anche se M o il proxy R8 sono
zero. È necessario: con nodi `(U,M)=(-1,1)` e `(2,0)`, le densità nodali sono
entrambe zero ma il prodotto dei campi interpolati a metà vale .25. I test
includono interfacce oblique, fasi miste, half subnormali, warp e margini termici.
Il vecchio R8 rimane il proxy nodale per precipitazione, prima dell'erosione fine;
non viene usato per saltare la nuova densità. Le cinque cache ottiche vengono
ribattute dalla medesima funzione CPU di densità usata dal renderer.

Una RG16F 256³ aggiunge **64 MiB GPU e 64 MiB di backing CPU**: payload finali
104→168 MiB per copia, escludendo driver, staging, vecchio/nuovo durante swap
e picco RAM non misurato. Sostituisce una lettura R8 con una RG16F; il numero
di letture di densità resta uguale. Non è una prova di costo invariato. Worker,
trasferimento, installazione, rigenerazione e teardown gestiscono la quarta
texture insieme alle precedenti. Nessun TAA o taglio di 256³/128³/384/output.

## Varianti e guardia visiva

| Variante | Differenza dal controllo precedente | Verifica prima della preview |
| --- | --- | --- |
| v35 | U0/M dopo interpolazione, estinzione18/6,5 | 158 test / 28 file e app build |
| v36 | U=.5+(U0-.5)*(1+2.2*(1-iceVoxel)), estinzione18/6,5 | 161 test / 28 file e app build |
| v37 | v36 con estinzione liquida60 | App build; 160 pass e 1 fail, non caricata |
| v38 | v36 con estinzione liquida50 | 161 test / 28 file e app build |
| v39 | v38 con dettaglio su U dopo interpolazione, prima del clamp | 166 test / 28 file, typecheck e app build |

v36 ha gain liquido32 e ghiaccio14; la fase mista usa
`(10+4I)*(1+2.2*(1-I))`, non l'interpolazione lineare 32→14. Conserva il punto
medio U0=.5; il ramo ghiaccio completo restituisce U0 esattamente, prima di
quantizzazione. La rampa liquida ideale completa è31,25m solo per un campo
con gradiente unitario. Non è una misura dello spessore 3D o della nitidezza.

v37 fallisce il controllo originale di continuità dell'estinzione in
`volume.test.ts`: differenza .0107 fra fase .5±.0001 contro limite .01. Il test
non è stato allentato. v38 usa50 e differenza .0087; non dimostra che il valore
sia calibrato da una misura di contenuto d'acqua.

Guardia comune: seme1571198069, t60 in pausa, vento55%, dispersione/pioggia/lampi0,
Sole sinistro alto, cielo pronto e transizione1. Camera fissata dalla baseline:
mira `[.4296875,2.9365234375,0]`, raggio vicino `.6045067691053366` km;
all'80% origine `[.4296875,2.9365234375,1.1639784268955404]`. Main, flusso completo,
256³/128³, Massima384 e output/interno1672×941. L'output Finestra usa1pixel per
CSS pixel e non certifica prestazioni native al DPR della preview ordinaria.

| Stato | Immagine80% | rAF/s, 30s | GPU media / p95, ms |
| --- | --- | ---: | ---: |
| Baseline v34 | [JPEG](measurements/reconstruction-2026-10-15/baseline-v34-front80.jpg) | 59,7234 | 17,8244 / 23,9862 |
| v35 | [JPEG](measurements/reconstruction-2026-10-15/reconstruction-v35-front80.jpg) | 59,9982 | 21,9824 / 26,6732 |
| v36 | [JPEG](measurements/reconstruction-2026-10-15/reconstruction-v36-front80.jpg) | 59,8631 | 19,6173 / 24,3794 |
| v38 | [JPEG](measurements/reconstruction-2026-10-15/reconstruction-v38-front80.jpg) | 59,9966 | 18,4662 / 24,5105 |
| v39 | [JPEG](measurements/reconstruction-2026-10-15/reconstruction-v39-front80.jpg) | 59,9964 | 19,5683 / 24,9692 |

I [cinque report grezzi e il riepilogo](measurements/reconstruction-2026-10-15/front80-comparison-summary.json)
confermano identici camera, stato e qualità. Una misura per variante, in ordine,
non sostiene un confronto causale delle prestazioni; nella baseline c'è anche
attività di piccoli test. rAF, timestamp GPU e presentazione del compositore
restano distinti. Un primo tentativo v38 era annullato con messaggio
«Avvicinamento modificato» e report vuoto: la causa del cambio UI non è stata
stabilita. La misura tabulata è il successivo tentativo valido, conservato.

v35 conserva il corpo sfocato. v36 e v38 rendono alcuni bordi più netti; v38
aumenta anche il contrasto, ma non recupera rilievi sufficienti nel corpo.
Le immagini95/100 di v35/v36/v38 restano nell'archivio; al95–100%
torna una distribuzione quasi uniforme. Le console acquisite sono vuote.
Non sono qualificati altri semi/famiglie, lati/controluce, moto, worker,
dispositivi fisici o una nuova prestazione nativa sostenuta per queste varianti.
v39 si ferma al guard80%; le immagini95/100 riguardano v35/v36/v38.

## Sampler GPU e controllo planare

L'audit esplicito crea una texture temporanea RG16Float dallo stesso payload:
512 coordinate f32, 64 centri,64 frazioni,64 clamp esterni,128 punti nel volume,
192 campioni di48 coppie a U misto. Il riferimento CPU decodifica gli stessi
half e interpola in float64. È un test del sampler caricato separatamente,
non della binding Three nel draw né della qualità dell'immagine. Il rendering
reale IAB verifica separatamente che il candidato compili e mostri la scena.

| Audit | Massimo errore assoluto rho | RMS rho | Esito |
| --- | ---: | ---: | --- |
| [v35](measurements/reconstruction-2026-10-15/reconstruction-v35-gpu-sampler.json) | .0004463792 | .0000776707 | 512 finiti; tolleranza consultiva rispettata |
| [v36](measurements/reconstruction-2026-10-15/reconstruction-v36-gpu-sampler.json) | .0016713919 | .0001342778 | 512 finiti; tolleranza consultiva rispettata |

La tolleranza `abs≤.002+.002*abs(CPU)` è un ausilio d'ispezione, non una garanzia
universale WebGPU o accettazione automatica. Le coppie cercate cambiano con U:
gli errori fra versioni non sono un confronto sulla stessa selezione spaziale.
Il pulsante è solo in profiling, blocca rigenerazione e misure durante l'audit,
invalida il vecchio report e attende il proprio cleanup prima di distruggere
il device. Il report non viene usato come misura della scena.

Il [kernel planare ripetibile](measurements/reconstruction-2026-10-15/cloudia-visible-kernel.ts)
usa M=.8, F affine con gradiente1 e integra esattamente il profilo di visibilità,
con verifica numerica a passi .25/.5m fino a T<1e−6. Con gain32, la deviazione
standard della profondità del contributo scende da70,002m a26,391m passando da
estinzione18 a50. Con gain10 ed estinzione18 vale74,431m: restringere da sola la
rampa cambia poco quella dispersione. Errori massimi numerici di media/std e
profondità tau1 inferiori a .0005m nel modello. Il [JSON](measurements/reconstruction-2026-10-15/cloudia-visible-kernel.json)
non prevede le sorgenti eterogenee3D né la nitidezza dei pixel.

## Dettaglio prima del clamp: v39

L'ultimo guard conserva v38 e applica:

```
U' = interp(U) - .5 * (1 - detailR(local*1.2)) * (1-iceLocal)
rhoMacro = clamp(U',0,1) * interp(M)
```

PackedRG invariato; CPU e shader campionano il dettaglio alle coordinate local,
senza un secondo warp. Resta l'erosione ordinaria successiva. Il lookup extra
si evita con U≤0, U≥1+.5*(1-ice) o ghiaccio completo. La diagnostica no-detail
lo omette intenzionalmente, perciò non è un confronto di qualità equivalente.
I nuovi test verificano monotonia, ampiezza zero, ghiaccio completo, sampler
pair e coordinate del dettaglio. L'audit GPU del sampler puro non verifica
questa nuova composizione con il rumore e non viene presentato come tale.

È diversa dalla [meso post-clamp già respinta](EXPERIMENT-MESO-2026-10-15.md):
U=1,25,M=.8 con sottrazione massima.5 passa da rho.8 a.6. Il precedente remap
post-clamp con erosione.12 dava circa.7727 considerando quel solo termine.
Non tutti i nuclei saturi erano immuni al vecchio remap: era immune rho=1,
mentre condensazione1 con M<1 veniva erosa debolmente.

Il canale R combina65% Worley32 e35% noise8: a local*1.2 le scale sono26,04m
e104,17m, texel6,51m e ripetizione833,3m. Non è solo dettaglio26m; include
contrazione media e una componente larga. La sottrazione massima corrisponde
a15,625m solo sotto gain32 e gradiente unitario. Poiché U'≤U, la maschera
precedente rimane conservativa. Le cache luminose sono ribattute, ma i loro
27–39m non risolvono automaticamente il nuovo dettaglio.

La [guardia80%](measurements/reconstruction-2026-10-15/reconstruction-v39-front80.jpg)
modifica il margine senza rendere sufficientemente leggibile il corpo. Nessuna
promozione; nessuna matrice estesa successiva al guard insufficiente. Il costo
del lookup e il rischio di ombre sottocampionate non sono giustificati dal
risultato osservato. Nessuna nuova texture oltre alla RG16F delle altre varianti.

## Conservazione e verifica finale

Le cinque patch `docs/experiments/reconstruction-v35.patch`, `v36`,
`v37-ext60`, `v38` e `v39` sono **alternative indipendenti contro b2613c2**,
non incrementi da applicare in sequenza. Tutte passano `git apply --check`
su copie temporanee dei file parent; nessuna applicazione al checkout operativo.
I manifesti build registrano sorgenti e asset effettivamente generati per ogni
variante. I sorgenti privati completi e gli originali delle misure restano
preservati. Le patch mantengono esattamente whitespace e terminatori originali;
escluderle dal controllo whitespace della prosa evita di alterarne gli hash.

L'[archivio](measurements/reconstruction-2026-10-15/archive-manifest.json) contiene
37 evidenze e5 patch, con43 file verificati in
[SHA256SUMS](measurements/reconstruction-2026-10-15/SHA256SUMS), manifesto incluso.
Un [manifesto finale separato](measurements/reconstruction-2026-10-15/final-cycle5-build.json)
registra che tutti i72 file tracciati di `src` sono identici a b2613c2 e conserva
gli hash di app e hero. Le quattro evidenze finali hanno
[checksum separati](measurements/reconstruction-2026-10-15/FINAL-SHA256SUMS).

Dopo il ritiro: **147 test / 26 file, app build e hero build superati**.
Il renderer resta v34, estinzione18/6,5, senza RG16F, nuova UI di audit o erosione
pre-clamp. Non serve promuovere test e memoria di un modello scartato. Non sono
state installate dipendenze; esclusione Dropbox locale di node_modules riletta1,
nessun lockfile modificato, `node_modules 2/` preesistente intatta.

La [preview finale ordinaria](measurements/reconstruction-2026-10-15/final-cycle5-native-sun.jpg)
è main, seme72, Sole,60,6s in pausa, Panorama, pannelli chiusi e audio spento.
Override viewport rimosso: CSS1672×941 e canvas/output/interno3344×1882,
Massima384; [stato DOM](measurements/reconstruction-2026-10-15/final-cycle5-preview-state.json)
e [console vuota](measurements/reconstruction-2026-10-15/final-cycle5-console.json)
acquisiti. È la dimensione ordinaria osservata in questo momento, diversa dalla
precedente preview1280×720. La cadenza istantanea non certifica60fps nativi
sostenuti né presentazione del compositore. Nessun push, merge o deploy.

L'[ipotesi powder](POWDER-OPTIONS-2026-10-15.md) rimane non implementata e
condizionata al segnale di densità e al controllo di oscuramento uniforme.
Non trasforma questo ciclo in un'accettazione di anatomia, luce, pioggia,
paesaggio, moto o UI; quei gate rimangono espliciti nell'handoff.

## Riferimenti e limiti

- [GPU Gems39, §39.2/39.4.3](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques): ricostruzione scalare e funzione di trasferimento. U, formato, profili e test qui sono scelte nostre.
- [Nubis2017, fonte Guerrilla](https://www.guerrilla-games.com/read/nubis-authoring-real-time-volumetric-cloudscapes-with-the-decima-engine): generazione Perlin–Worley e modellazione delle nubi. Non documenta già la formula pre-clamp sperimentale di questo progetto.

L'ordine di ricostruzione recupera informazione persa dal clamp nodale, ma non
ricrea geometria o informazione luminosa assente. Le cache GBA restano su27–39m;
l'accuratezza half e il kernel planare non chiudono questa limitazione.
