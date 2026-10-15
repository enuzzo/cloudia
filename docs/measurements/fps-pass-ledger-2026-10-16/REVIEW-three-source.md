# Revisione indipendente delle metriche GPU · ciclo 10

Solo codice locale Three 0.186.0 e report esistente. Nessun browser, dispositivo
GPU, bake, build o benchmark; nessuna modifica al prodotto o a node_modules.

**Conclusione:** nel percorso ordinario ispezionato non emerge un doppio conteggio
JavaScript della stessa coppia di query, né un unico intervallo cumulativo dei
frame. La metrica 20,8 ms è la media di 436 somme selezionate dal pool, non il tempo
medio dei 5395 invii. Il codice e il report attuali non identificano la causa
hardware di quel valore e non autorizzano a dividerlo per due. Possibili valori
riciclati sono riconoscibili nel codice, ma non dimostrati da questo report.

## Evidenza della misura

Fonte: [ordinary-sun-motion-90s.json](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/fps-sun-motion-2026-10-16/ordinary-sun-motion-90s.json).
Main WebGPU, Apple/metal-3, 2560×1440 pieno, 256³/128³/384, cielo sereno, pioggia 0,
moto attivo; renderer v40. Non è la misura della candidata pioggia ciclo9.

| Campo | Valore | Lettura corretta |
|---|---:|---|
| Invii misurati / durata rAF |5.395 / 90.005,9 ms|59,940515 invii/s; non presentazione.|
| Prefisso finale |5.395 / 5.395 confermati|Nessun invio misurato resta non confermato alla chiusura.|
| Drain finale / latenze periodiche |4,4 ms / 9,1–15,4 ms|Compatibili con completamento tempestivo dei prefissi osservati, senza prova di accumulo crescente.|
| Cadenza con conferma finale |59,932325/s|Include l'intervallo locale fino alla consegna del prefisso finale; non isola un frame.|
| Somma timestamp render |436 campioni; media 20,800465 ms|Somme di intervalli per pass, selezionate per frame Three.|

Le fence brevi e il drain finale non sostengono il backlog crescente come
spiegazione di questa specifica prova. Non dimostrano presentazione o latenza
input→display. `maxUnconfirmedMeasuredFrames=61` comprende il periodo fra notifiche
al JS, circa un secondo: non significa 61 immagini fisicamente in coda GPU.

## Tracciamento concreto nel codice

1. [GPUSceneEngine.ts:404](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/GPUSceneEngine.ts:404)
   invia compute e un QuadMesh. Il percorso output predefinito crea un pass nube
   e un pass di conversione colore: [Renderer.js:1905](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/common/Renderer.js:1905)
   termina il primo PRIMA di `_renderOutput`; quest'ultimo richiama `_renderScene`
   senza un'altra conversione. Sono due lavori distinti, non un timer esterno che
   contiene anche il timer interno. Il loro peso relativo non è nel report.
2. [Backend.js:475](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/common/Backend.js:475)
   costruisce UID `r:<frameCalls>:<contextId>:f<info.frame>`; compute usa `c:`.
   frameCalls avanza per chiamata. Il frame deriva dal rAF interno di
   [Animation.js:81](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/common/Animation.js:81),
   non dall'ID di submission Cloudia. Non va assunto un rapporto 1:1 senza verificarlo.
3. [WebGPUTimestampQueryPool.js:67](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js:67)
   alloca due indici distinti per UID (`index+=2`). Il backend assegna quegli indici
   ai timestamp inizio/fine del pass, non a inizio/fine dell'intero frame.
4. [Pool:148](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js:148)
   fotografa la Map degli offset e il numero di query, azzera l'allocatore, poi
   sottomette resolve e copia. L'intervallo di indici `[0,queryCount)` contiene più
   frame, ma non diventa una durata cumulativa. La copia precede i successivi
   riusi degli indici nella stessa coda; pendingResolve serializza il readback.
5. [Pool:207](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js:207)
   calcola `Number(end−start)/1e6` per ciascun UID e conserva tutte le durate in
   `timestamps`. Somma per suffisso `:f<ID>` e restituisce soltanto l'ultimo frame
   incontrato nel batch. La sottrazione avviene in BigInt prima della conversione:
   non c'è perdita delle basse cifre di grandi timestamp assoluti in Number.
6. [Backend.js:623](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/common/Backend.js:623)
   copia lo scalar in `info[type].timestamp`. Cloudia lo registra dopo il resolve,
   al massimo una richiesta ogni 200 ms e senza un'altra richiesta applicativa
   pendente. Non lo registra ad ogni rAF e non somma render+compute.

## Duplicazione, riciclo e limiti dimostrabili

- **Stessa coppia sommata due volte:** non avviene nel normale epoch del pool.
  Gli offset crescono di due; il ciclo itera una Map. Un UID ripetuto sostituisce
  il suo offset e può perdere la vecchia coppia, non aggiungerla due volte.
- **Range cumulativi:** la risoluzione legge un batch di query, ma la formula
  usa ogni singola coppia e lo scalar sceglie un solo gruppo frame. Non c'è
  `ultimoEnd−primoStart` né una somma di tutti i frame del batch.
- **Riciclo possibile:** pool vuoto/disabilitato/disposto, buffer non disponibile
  o errore possono restituire lastValue; una richiesta concorrente può condividere
  la Promise pendente. Info.reset non azzera timestamp. Il numero finito restituito
  non contiene un flag di freschezza; l'app può registrarlo senza riconoscere il
  fallback. Il report non ha UID, epoch o status per stabilire se sia successo.
- **Overflow:** a 2048 query il pool tenta un resolve e azzera comunque gli offset.
  Se un resolve era già pendente, le nuove query non ancora fotografate possono
  perdere l'associazione. Questo è un caso limite di perdita, non una prova di
  duplicazione; non è dimostrato nella misura a 90 s con resolve frequenti.
- **Più invii nello stesso frame Three:** il gruppo può includere più chiamate se
  condividono quel frame interno. Il report non permette di verificare il mapping.
- **Intervalli hardware sovrapposti o semantica del driver:** non sono decidibili
  dal codice JS letto. I timestamp assoluti vengono scartati dopo il readback;
  il report conserva solo somme. Non attribuisco la discrepanza a overlap o scala
  temporale senza dati grezzi o un profilo appropriato.

Il campionamento “ultimo frame del batch” è selettivo, non una media di tutti i
frame. Come semplice controesempio logico, 436 invii da 20,8005 ms e gli altri 4959 da
circa **16.3237**ms possono rientrare nella finestra locale fino alla conferma finale. Non è
una stima dei frame esclusi: dimostra che quei due aggregati, da soli, non provano
un errore o una duplicazione. Non si può convertire 20,8 ms in FPS né dividere per 2.

## Proposta concreta senza nuove query GPU

[three186TimestampBatch.ts](three186TimestampBatch.ts) è un adapter esterno legato
esplicitamente a `REVISION==='186'`; sostituisce la chiamata resolve esistente.
Non aggiunge query, buffer o readback e non cambia il materiale.

- Cattura offset, queryCount, pendingResolve, UID, frame list e lastValue prima e
  dopo il resolve; conserva il valore restituito, senza leggerlo dopo un'altra
  operazione da un generico campo info potenzialmente mutabile.
- Accetta un batch come **fresh** solo se gli UID risolti corrispondono allo
  snapshot richiesto, le coppie coprono gli indici senza duplicati, la frame list
  corrisponde e la somma dell'ultimo gruppo ricostruisce lo scalar restituito.
- Esporta tutti i pass validati e i gruppi Three, non solo l'ultimo. Gli stessi
  dati sono già disponibili nella Map del pool: nessuna query aggiuntiva serve
  per evitare il bias dell'ultimo frame. Le durate restano **passSumMs**.
- Distingue empty, cached/UID riusati, shared-pending, proprietà assenti, revisione
  diversa, pool sostituito, mismatch ed errore. observedAfter è diagnostico;
  solo passes/groups di un risultato fresh possono entrare negli aggregati.
  `status:error` richiede che il chiamante conservi la precedente politica errori.

Nessun appDraw viene dedotto dal frame Three. `requestAppDrawId` indica soltanto
l'invio che ha richiesto il resolve. Per un mapping futuro verificabile registrare,
per draw, ID app/prefisso e frame Three prima/dopo, più range frameCalls render e
compute. Associare un UID soltanto a un ledger univoco con stesso frame e numero
chiamata nel range; frame cambiato, zero o più match restano “non verificati”.
Per validare l'ipotesi dei due pass occorre esportare il conteggio effettivo; non
imporre passCount=2 come correzione. L'adapter non espone start/end assoluti, che
l'API corrente del pool ha già eliminato: non risolve da solo la semantica hardware.

[adapter-check-result.json](adapter-check-result.json): **8 controlli con pool
simulati passati**, usando il codice reale dell'adapter con i tipi rimossi dal
builtin Node. Verificano batch fresh, pari valore numerico con UID nuovi, empty,
lastValue, pending condiviso, campi assenti, revisione diversa, sostituzione pool,
copertura incompleta ed errore. Non è typecheck, integrazione Three o prova GPU.
Implementazione sperimentale da integrare e qualificare, non modifica già attiva.
È strumentazione diagnostica: copia Map e crea record CPU; l'assenza di nuove
query GPU non implica costo nullo. Confronti futuri devono usare lo stesso adapter
e riportarne la versione, separando la modalità timing off.
SHA adapter: `24f35dcdaeb1d0da6c57ceef55560f1140c9d151955f636fcf80cf7d7e4d7658`.

## Rapporto con l'audit già presente

[Il documento FPS esistente](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/FPS-METRICS-AUDIT-2026-10-16.md)
è esplicitamente storico ciclo8. Le sue frasi “stages non raccoglie questi dati”
e “fine misura non attende un fence finale” descrivono quel percorso precedente,
non il report corrente con QueuePrefixMeasurement.finish. Restano validi i limiti
su presentazione e somme dei pass. Qui non modifico il documento tracciato.

## Snapshot delle sorgenti lette

- `node_modules/three/src/renderers/webgpu/utils/WebGPUTimestampQueryPool.js`: `719c23dab1783a752b5c454f2564d39a28638e191aa4078cc82cfc1b968c0dfb`.
- `node_modules/three/src/renderers/common/Backend.js`: `9b3e452debbfc9a4675434da00178e09cdc1270f7e5d06f920e8be559f36e628`.
- `node_modules/three/src/renderers/webgpu/WebGPUBackend.js`: `fe2781e3c7c9e390b6c0121e1d4823d929a8a60e89aae618d49dad0abbc1574e`.
- `node_modules/three/src/renderers/common/Renderer.js`: `acf70db96a38c66cd113e20e2195a9c55ea7c51a5c8f114fea7f7a02e099cd6a`.
- `node_modules/three/src/renderers/common/Animation.js`: `36bd55bd835bc6eac718cfdb781972e14d428436c8c95aa0a43b35c991ffcd18`.
- `node_modules/three/src/renderers/common/Info.js`: `497b95aaa7077c97f43ec836d9cd9731f8a64b233fdf42f25883a2a94a312f27`.
- `src/cumulonimbus/GPUSceneEngine.ts`: `fadb049c86f08b4b32abda49f316d52a663df57f4817506640ae852a17a587a1`.
- `src/cumulonimbus/performance.ts`: `175e4be041d8bf2cf325e6ba4e09922b5a1be79c34d5bc4b4f704230ca01a7e8`.
- `src/cumulonimbus/queuePrefixMeasurement.ts`: `bf26e53d0a1aafd6e75bd20b4903d1a3633fd19937fdecf5d8fe3cd4b354324d`.
