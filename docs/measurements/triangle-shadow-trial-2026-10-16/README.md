# Trial ombre per triangolo: respinto

Checkpoint del 16 ottobre 2026, base prodotto v58 `9080780`. Il prodotto resta
invariato; i sorgenti trial/diagnostici qui conservati sono evidenze esterne,
non moduli importati dall'app. Il goal resta attivo.

Il trial supera 440 test in 47 file e build APP→hero, ma il PNG nativo mostra
nuovi puntini/tratteggi sulle pianure e non corregge le larghe scaglie a sinistra.
La review root e quella indipendente concordano su FAIL. La stop rule ha escluso
ulteriori Rain/worker/FPS e qualificazione lifecycle dopo il FAIL.

## Contenuti e relazioni

- `positive-witness`: 12 pixel prefissati / 36 raggi della mesh Float32; sei
  schermati e sei non schermati fisicamente, senza selezione successiva.
- `caster-proposal`, `clipping-validation`: originali R1/R2, codice e log dei
  controlli mirati. I manifest annidati conservano le rispettive selezioni.
- `qualification`: snapshot trial 128 file, 440/440 test, build e manifest dist.
- `browser`: unico PNG nativo trasferito per intero, metadati e ledger delle
  61 parti, confronto RGB, otto crop derivati e ripristino della preview.
- `gpu-readback`: sonda intenzionale profile-only dei 12 record / 11 texel R32F,
  confronto con q CPU, review, sorgenti/dist qualificati. Il secondo hash PNG
  è calcolato dall'owner; non è un secondo trasferimento di PNG.
- `intrinsic-counterexample`: unico caso affine prefissato che dimostra il
  falso shadow di almeno 5,75 m anche su un piano complanare; separato dal
  problema concreto osservato nel PNG GPU.
- `source-before`: cinque file originali modificati dal trial. `source-trial`:
  nove override, di cui quattro nuovi. `source-diagnostic`: due override della
  sola UI/readback rispetto al trial. I manifest completi ricostruiscono
  virtualmente base124 → trial128 → diagnostica128 senza copiare dipendenze.
- Le review alla radice distinguono prova fisica, CPU, R32F e percezione; lo
  studio del raffinamento è fattibilità, non una nuova mesh né un fix adottato.

Il PNG baseline comune è già nel pacchetto fratello
`../terrain-shadow-cache-2026-10-16/browser/v58-main-sun-terrain-native-settled.png`,
SHA256 `af8877ac93db6fcd50ab3ceece43ac1a40fc7d21c41151afb3a9620ca7586be5`.
I crop L1/L2/L3/coast hanno ROI rispettive [40,820,140,910],
[390,810,520,890], [860,620,970,715], [1700,850,2150,1200]. Sono immagini
derivate, non acquisizioni native indipendenti.

## Verifica senza replay

`verify_archive.py` verifica soltanto file, hash, risultati e confronti salvati.
Non esegue Bun, test, build, campionamento DEM, raggi o GPU. Richiede Python e
Pillow già presenti. Il manifest radice contiene tutti i payload e i manifest
annidati, escludendo soltanto sé stesso. Esempio dalla radice del repository:

```sh
python3 docs/measurements/triangle-shadow-trial-2026-10-16/verify_archive.py \
  --runtime-source . \
  --trial-dist /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle27/candidate-source/dist \
  --diagnostic-dist /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle27/diagnostic-source/dist
```

Le dipendenze stanno nella `node_modules` del repository, ignorata Git e
verificata localmente con `com.apple.fileprovider.ignore#P=1` prima dei run.
Nessuna installazione, modifica del lockfile o operazione su `node_modules 2/`.
Sorgenti completi/dist esterni sono in `Cloudia-QA-2026-10-16-cycle27`.

L'archivio non dimostra FPS, presentazione del compositore, assenza globale di
false ombre, causa dei puntini GPU o accettazione fotografica. La sonda non legge
q del ricevitore GPU, ID del triangolo, corner o motivo del fallback. Numeri
simili alla baseline non identificano il ramo che ha scritto il texel.

Le due patch raw e i due log targeted originali mantengono la spaziatura esatta
coperta dagli hash. `.gitattributes` limita l'eccezione whitespace a quei quattro
file; il primo controllo cached ha segnalato le righe vuote finali dei due log,
che sono state conservate senza riscrivere le evidenze.
