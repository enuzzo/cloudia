# Review indipendente — attivazione locale del materiale v61

17 ottobre 2026. **PASS della review statica del solo delta finale; nessun blocker concreto rilevato.** È distinto dal PASS materiale limitato delle immagini e dalla richiesta di fotorealismo finale ancora aperta. Nessun test, build, modello, browser o GPU eseguito in questa review.

Ho confrontato `navigation-source` con `final-source` nei tre file modificati e i relativi manifest: entrambi elencano141 percorsi, senza aggiunte o rimozioni; differiscono soltanto `GPUSceneEngine.ts`, `lifecycle.test.ts` e `public/terrain-data-notice.txt`. I byte dei tre file, prima/dopo, corrispondono ai rispettivi hash dichiarati. Gli altri138 hash manifestati sono uguali: non è una nuova verifica completa di tutti gli asset. Shader materiale/wrapper, navigazione, geometria, ombre, dati ottici e dipendenze non ricevono un nuovo delta in questo passaggio.

## Default e percorso diagnostico

A `GPUSceneEngine.ts:221`, `terrainOpticalEnabled=!(profiling && optical==='0')` rende il materiale ottico predefinito sia fuori profiling sia nel profiling senza esclusione esplicita. La sola combinazione `profile=1&optical=0` seleziona il materiale canonico precedente; `optical=0` senza `profile=1` non lo disattiva. Il flag è readonly dell’owner: nessuna transizione a metà frame o selezione shader per-frame.

Il ramo di inizializzazione già qualificato resta quello di `GPUSceneEngine.ts:274–278`: carica e autentica l’asset, lo dispone se l’owner è stato distrutto/perso, poi procede con volume e terreno. Il default non introduce una modalità silenziosa di fallback su errore: l’asset ottico diventa una dipendenza richiesta dell’avvio ordinario. Il test d’errore esplicito resta presente; non considero misurati tempi di avvio o residenza driver.

La scelta false continua a entrare in entrambe le factory con false (`GPUSceneEngine.ts:336–346`), non carica texture ottica e mantiene due sole dipendenze cover nel cache key. La scelta true richiede la texture e la aggiunge alle dipendenze della cache. `releaseGPU` continua a disporre e azzerare l’owner ottico (`:983`). Non vedo nel delta un nuovo binding rimasto nel percorso di esclusione, né una diversa ownership dei dati.

Versione `observatory-v61-observed-terrain-material` e variante `observed-premult-valid-land-v1` sono aggiornate coerentemente sia nella cattura sia nel contesto benchmark; l’esclusione conserva l’etichetta `canonical-v60`. Le versioni non costituiscono da sole prova di identità del compilato o del frame: la nuova autentica nativa del default è separata e resta al root.

## Test e avviso dati

La fixture ottica predefinita ora restituisce una piccola texture reale con dispose, permettendo agli owner ordinari dei test di seguire il nuovo avvio. La prova di esclusione usa esplicitamente `profile=1&optical=0` e richiede sia assenza del caricamento sia due sole dipendenze cache (`lifecycle.test.ts:886–889`). Le prove esistenti su fallimento di autenticazione, abort con risoluzione tardiva e riuso/dispose dell’asset restano presenti. Questa lettura non sostituisce l’esecuzione della suite riferita dal root.

L’avviso pubblico elimina correttamente il qualificatore “isolated trial” dalla distribuzione del derivato RGBA16F. Restano espliciti media di area valid-aware, RGB premoltiplicato, fallback acqua/unknown, uso delle overview e assenza di recupero di albedo/BRDF. “Canonical material” nel paragrafo precedente indica il materiale autoriale di riferimento mantenuto nel fallback; non lo interpreto come dichiarazione che il default v61 utilizzi soltanto costanti. Nessuna nuova garanzia scientifica o artistica è introdotta dal delta.

**Conclusione operativa:** nessuna correzione richiesta prima dell’autentica finale del default prevista dal root. Questo PASS riguarda attivazione sicura e recuperabilità diagnostica; non amplia la qualifica delle immagini, non dichiara60 FPS e non risolve i limiti residui di forme, canopia e segni sui rilievi.

## Provenienza letta

| File | SHA256 |
|---|---|
| `candidate-navigation-manifest-r4.json` | `56d95db4283ce22c1ec9d805e6692eb05cf8cf9aefeb474b7f20552434b77519` |
| `final-manifest.json` | `2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73` |
| `final-source/src/cumulonimbus/GPUSceneEngine.ts` | `268867e25190ea2352d96f7ad259e5fef3631cd294df23857c8b588ca33a888f` |
| `final-source/src/cumulonimbus/lifecycle.test.ts` | `bac913938a1581690a85b06ce7f0d537869a7c43fc0f47a4674181000aaa6410` |
| `final-source/public/terrain-data-notice.txt` | `5286e3ff34eabc0e357b451de619dc402ec70847269ead0485b9907005e29bc2` |
