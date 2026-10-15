# Rain upper bound · proposta esterna ciclo 9

**PROPOSTA NON APPLICATA.** Base esplicita `a1efb8e489d31c417ebb2dd6b06cbc2e8dfaca1c`.
Nessuna build, bake, prova GPU o benchmark eseguiti da questo pacchetto.
La qualifica del sampler GPU è affidata al root con un audit separato.

## Modifica proposta

- `precipitationMaxBaseReference(map,size=64):number|null` legge i byte RG8 già esistenti. Per ogni texel con R>0 prende il massimo G nell'halo Chebyshev1, ritagliato ai bordi. Ritorna `maxG/255*3−.5`, oppure null per R interamente zero. Nessuna allocazione o nuova texture nel helper.
- `installVolume` aggiorna `maxBaseRef` insieme alla rainMap ad ogni sostituzione del volume, anche nel caso vuoto (`−.5`; hasRain è già false). Main e worker usano lo stesso GPUSceneEngine; non cambia il payload del volume.
- Una sola volta per raggio: `rainCeiling=.72+(maxBaseRef−.72)/growth.x+.3+guard`. Il blocco ottico pioggia diventa `if(rainRegion && rp.y<=rainCeiling)`; `rp=position−drift`.
- Il sampler continua ad essere lineare, senza mipmap, dati lineari; ClampToEdgeWrapping, già default Three, viene dichiarato esplicitamente su S/T.
- Il renderer esterno è etichettato `observatory-v42-rain-upper-bound-external`; metadati aggiunti: `precipitationMaxBaseReferenceKm` e `precipitationUpperGuardKm`.

Il box pioggia mantiene il tetto **2.8km**. Union box, rainNear/rainFar/rainRegion,
`t`, `ds`, jitter, integrazione co-locata, passi massimi6m, densità e luce nube restano
invariati. Lo skip riguarda solo il calcolo della pioggia dove l'attacco verticale
è nullo. Nessuna risorsa GPU o cache temporale aggiunta; un solo scalar uniform.

## Prova e contratto numerico

R e G filtrano separatamente. Se R filtrato è positivo, almeno un contributor R
è positivo; ogni altro contributor G della stessa impronta bilineare dista al
massimo un indice, anche in diagonale. L'halo include quindi il suo G. Il massimo
viene letto **dai byte effettivi**, senza usare momenti di base non quantizzati.
La quota finale `.72+(3*g−.5−.72)/growth.x` è monotona per growth.x>0.
Guess, shear e vento scelgono il final UV ma non invalidano questo limite globale.

Il margine concordato è `guard=3/255+2**−15` km = **11.795223460477941m**:
un codice G UNORM8 di possibile overshoot del filtro, più circa30.5mm per ALU,
conversione double→f32, divisione e ordine delle operazioni. La componente filtro
copre il caso height<=1 attuale (growth.x>=1). A uguaglianza si esegue il blocco.

**Contratto da qualificare su GPU:** filtro con overshoot G non maggiore di un
codice UNORM8 e R esattamente zero se tutti i contributor R sono zero; coordinate,
UNORM8 lineare senza mipmap, clamp addressing e growth.x>=1. Non presentiamo la
precisione di textureSampleLevel come ULP universale garantito dalla specifica.
Il filtro matematico convesso non richiede un codice aggiuntivo; il budget è una
tolleranza esplicita da verificare con il sampler reale. Non è un permesso di
omettere texel o alterare materia.

## Controlli disponibili

`node repro.mjs` eseguito con Node26.11.0: **9 gruppi superati**, senza dipendenze.
Carica il helper candidato reale, rimuovendo soltanto i tipi con il builtin Node
stripTypeScriptTypes (API sperimentale, warning emesso). Non importa il prodotto.

- R/G indipendenti, sentinel R0/G255 accanto a R1/G0, diagonali, quattro bordi,
  sentinel distante escluso, decode dei byte, mappe vuote e caso base minima.
- 9600 campioni positivi in tre modelli bilineari CPU; 345600 verifiche di attacco
  nullo oltre il limite. Nessun modello CPU qualifica il filtro GPU.
- 1024 casi avversari: G con un codice intero di overshoot e divisione perturbata
  di tre ULP f32 verso l'alto; margine residuo minimo circa29.8mm.
- Sei raggi sintetici attraversano il limite, una nube sottile e i bordi rainRegion;
  includono passi inspection sotto6m, assenza R e weather zero. Trace f32 t/ds,
  campioni della nube sottile e media integrati sono identici. Si usa il vero helper
  CPU integrateMediaSegment; il campo analitico non è il volume generato corrente.
- La reversibilità testuale delle sole quattro modifiche shader verifica che tutte
  le altre espressioni dei raggi, dei campioni e della nube siano byte-identiche.

`after/src/cumulonimbus/precipitationUpper.test.ts` propone **7 test Vitest unitari**
con il vero helper e un campionatore bilineare indipendente. Non eseguiti qui e non
applicati. La patch dei test è separata dalla patch dei tre file di produzione.

## Artefatti e riproduzione

- `rain-upper-bound.patch`: modifica solo precipitation.ts, cloudShader.ts, GPUSceneEngine.ts.
- `before/`: copie byte-verificate contro la base; `after/`: candidate. `reference/src/cumulonimbus/medium.ts` è solo input di test.
- `precipitationUpper.test.patch`: aggiunta opzionale del test proposto.
- `manifest.json`: SHA delle copie, patch, generator e repro; `repro-result.json`: risultati e fixture RG8 esplicite.
- `prepare.py --project /percorso/Cloudia` rigenera le copie dalla base esplicita e rifiuta sorgenti correnti differenti. Non scrive nel progetto. Poi eseguire `node repro.mjs`.

Nessuna rainMap reale residente è stata estratta qui e nessun volume è stato
ricostruito. Risparmio di lookup, beneficio FPS, equivalenza delle immagini e
qualifica numerica sul dispositivo restano da misurare. Le letture logiche evitate
sui raggi sintetici non costituiscono una previsione del guadagno GPU.
