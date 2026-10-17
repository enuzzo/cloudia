# Cloudia — raccordo dell'outflow alla torre alimentante

17 ottobre 2026, ciclo43. **La variante è stata implementata e respinta al confronto nativo. Prodotto v61 invariato, goal attivo.** Spostare l'intera espansione superiore verso la torre non elimina il cappello piatto né la grande cavità laterale a U.

## Cambiamento e verifiche

Una sola modifica strutturale esterna, sulla famiglia sheared: dalla linea foundation→summit maturo si ricava la posizione alla quota del primo core dell'incudine. La differenza X/Z trasla solidalmente entrambi i core e i48 streak; collar e spalla usano il parent maturo esplicito. Nessun lift, raggio, rumore o primitiva aggiunta. Non è un modello fisico di vento/CFD. Shader, paesaggio, materiale ottico e qualità restano quelli di v61.

Il preflight indipendente esegue una sola volta le ricette minuscole74/72/73, senza allocazioni dense, raster o GPU: seed74 conserva1918 primitive e ordine/consumo RNG;98 primitive dell'outflow si spostano. Le ricette72/73 sono esattamente identiche in Float64/RNG. I vecchi contratti dei raccordi passano.

**Correzione esplicita rispetto alla prima descrizione:** la contrazione globale X passa da `.761178793094101` a `.8691662334874339`; il corpo lungo X risulta quindi relativamente più largo del14,1869%. Dire che cambia soltanto la sommità sarebbe scorretto. Nessuna nuova primitiva non significa volume o costo invariato. Il delta grezzo è `[-.6676362513060935,-.1280009178265471]`, prima di trasformazioni/contrazione.

**569 test in54 file, typecheck e APP build PASS**:561 test prodotto più8 significativi del helper. Nessuna aspettativa prodotto indebolita. Review statica indipendente senza blocker. Freeze143 sorgenti R1 SHA256 `e809c77ed113331d54003d5d730a964c15b87589b794d634fe1d4e4286e08792`;6 percorsi differenti rispetto ai141 canonici. Hero non ricompilata, candidata non adottata.

## Confronto nativo davanti e di lato

Un solo tab/GPU owner attivo alla volta, A4196 e B53786. Seed74, Sole assestato, t60 in pausa, vento55%, dispersione/pioggia0, fullflow,256³/128³/384 e2474×1844. Camera mondiale congelata da A e identica in B: nessun ricentraggio sui nuovi bounds. Lato ottenuto dal fronte con16 frecce destra, circa90,71°, non24. Prima di B sono salvati il protocollo e l'addendum sul clock weatherTime: qui non pilota il rendering senza temporali/flash; gli altri clock coincidono.

| Posa | A v61 SHA256 PNG | B R1 SHA256 PNG |
| --- | --- | --- |
| Fronte | `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9` | `a5618ec2982212f7587d7930a5f42b271d86cab19288ae9094d502f2901934aa` |
| Lato | `c9c4681b03b9c4771c7be62974712b12b516e8b8717c22dc0907f18318aa2749` | `64a047ec9d21590c6e7bdfead6a9e7b10b05210c5685c54e99ae978731d63a2a` |

A fronte: DTO nuovo e alias verificato del bitmap già conservato, nessun trasferimento duplicato. A lato1.359.259B/28 parti; B fronte3.607.225B/74 parti; B lato1.467.060B/30 parti, tutti interi con lunghezza/SHA/IHDR e parti verificati. Console[] nei due owner. Sono catture native, distinte dagli screenshot CSS dell'interfaccia.

**Il validatore numerico congelato conserva un FAIL formale:** `FAIL_NATIVE_METADATA_CONTROLS`, perché l'allowlist ometteva `terrainRaster.shadow.cache.hits/requests`. Sono gli unici mismatch nelle due pose; il DTO li definisce contatori CPU locali all'owner. Submission1/epoch0/valid e tutti gli input fisici camera/luce/meteo/materiale, salvo bounds anatomici dichiarati, coincidono. La spiegazione del difetto del validatore non sostituisce il risultato con un PASS. Nessun retry, modifica tardiva dei criteri o inferenza artistica dai numeri.

## Esito e continuità

**Root e revisore indipendente: FAIL visivo.** Davanti resta un cappello orizzontale sopra un collo scuro poco articolato; di lato persiste la grande forcella a U, visivamente più aperta. Non compare un ponte massiccio nuovo, ma manca il beneficio positivo richiesto in entrambe le pose. Quattro full native ispezionati da entrambi; il revisore aggiunge quattro crop matched1:1 con coordinate esplicite. Non è un semplice problema di posizione della sommità.

Stop del trial rispettato: nessun tuning, altra posa vicina, altro seed GPU, worker/meteo/moto o benchmark FPS dopo il FAIL. Identità72/73 qui significa soltanto ricetta, non volume GPU. Nessuna conclusione nuova sui60FPS; la pioggia pesante precedente rimane intorno a19 invii/s e non è stata rimisurata. I successi Sun precedenti prossimi a60 sono limitati alle pose/finestre documentate.

Preview ordinaria [4196](http://127.0.0.1:4196/?seed=74) ripristinata su v61: Sole, nube matura animata,14 sinistra/3 giù, canvas2474×1844 su viewport1237×922, console[]. Owner48736 confermato vivo; QA53786/session97027 chiuso intenzionalmente con exit0. Tutti141 sorgenti prodotto rihashati invariati. Dipendenze Gitignorate/non tracciate e Dropboxignore1, nessun install o modifica lock; `node_modules 2/` e4201 estranei preservati. Nessun push/deploy.

Il [goal completo e i suoi gate](measurements/terrain-face-direct-trial-2026-10-17/review/full-goal-gates.md) restano validi: anatomia delle3famiglie, luce da vicino/in moto, pioggia/virga, terreno finale, UI e60FPS. La geografia reale scelta dall'utente comprende le aree abitate nella stessa texture, senza edifici3D o pass aggiuntivi per rappresentarle; non è una promessa di costo misurato zero. La [prossima proposta strutturale](measurements/cloud-outflow-anchor-trial-2026-10-17/review/next-structural-action.md) riguarda la costruzione del raccordo, distinta dallo spostamento R1 respinto; è soltanto una proposta, senza altra esecuzione in questo ciclo.

[Archivio riproducibile](measurements/cloud-outflow-anchor-trial-2026-10-17/README.md):61 payload/8.051.138B, manifest `5851bb577f69240aee1ec03697ddd1ffef24b4495c27e96fb46717a406a1feb1`. La [verifica di conservazione](CLOUD-OUTFLOW-ANCHOR-VERIFICATION-2026-10-17.json) passa in0,107s leggendo70,9MB: byte/PNG/parti/alias/overlay e141 correnti esatti, nessun replay modello/GPU/FPS o nuova accettazione artistica. Conserva entrambi i FAIL. Lo stato del goal resta attivo, senza richiesta di nuova autorizzazione.

Contesto meteorologico primario: l'[incus WMO](https://cloudatlas.wmo.int/en/clouds-supplementary-features-incus.html) e le [note sul cumulonembo](https://cloudatlas.wmo.int/en/explanatory-remarks-and-special-clouds-cumulonimbus.html) descrivono l'espansione superiore e il ruolo del vento in quota. Motivano il rapporto torre/incudine, ma non convalidano la nostra estrapolazione lineare o il suo risultato visivo.
