# Candidata esterna v58: cache shadowmap

**37/37 test TerrainShadow PASS, typecheck PASS.** Nessuna suite completa, build, GPU o browser; nessuna modifica al prodotto o al witness. Root resta l'unico writer/adottante del prodotto.

Sorgenti in `../cache-source`, copiati dai124 file congelati `../source` e verificati contro il manifest originale prima delle modifiche. Dipendenze riusate tramite symlink, non copiate/installate: node_modules repository ignorato/non tracciato e attributo File Provider1 verificato prima/dopo. Lockfile invariato.

`PROTOCOL.json`, `source-manifest.json` e `candidate.patch` sono stati salvati e comunicati prima dei test; tutti124 hash sono rimasti identici dopo i test. `baseline-source-manifest.json` conserva il manifest della fonte. `VALIDATION.json` riporta risultati e hash dei quattro file cambiati.

La modifica è confinata a:

- TerrainShadow: cache esatta dopo validazione frame, snapshot Sole/bounds/renderer/reverse-depth/target+attachment/version/epoch; clear della key prima di ogni miss, commit post draw e ripristino soltanto se input/epoch restano validi. Listener dispose e invalidate esplicito, cleanup terminale.
- Engine: versione `observatory-v58-terrain-shadow-cache`, stats `terrainRaster` nei metadata PNG e `terrainRasterEnd` nel report benchmark.
- Test: regressioni mirate cache e sola aspettativa versione lifecycle aggiornata. Lifecycle non eseguito in questa qualifica circoscritta.

I due blocchi WGSL caster/visibility sono byte-identici alla fonte, con hash nel protocollo. Nessuna geometria, materiale, coefficiente, proiezione o bias cambiato. Il pass colore resta vivo. La cache conserva anche le scaglie/limitazioni visive esistenti.

Contatori `terrainRaster.shadow.cache`: requests=chiamate render con input frame validi, submissions=tentativi CPU di renderer.render (anche se lanciano), hits=ritorni senza clear/draw, epoch=invalidazioni esplicite/eventi, valid=entry installata. Sono cumulativi dell'owner, non completamenti GPU, intervalli misurati o presentazione.

I test verificano cold/hit e stato renderer, input mutabili e invalidi, Sole/bounds/renderer/reverse, resize-and-back e versioni/dispose, nuove identità attachment e listener vecchi, primo bind che incrementa versioni, B fallito dopo clear seguito da A, clear/ripristino che lanciano, invalidate durante draw/ripristino, bounds/dimensioni cambiati durante draw e cleanup dispose. Sono mock di controllo risorse, non una prova della codifica GPU.

Contratto: casters statici e target esclusivo. Una scrittura esterna sul target o reset backend dello stesso owner richiede invalidate esplicito; mutazioni caster richiedono anche bounds world aggiornati. Il tracking di un nuovo attachment protegge la validità della cache; non promette il rebinding automatico di ogni nodo materiale TSL che conservava un riferimento precedente. L'app attuale non sostituisce quegli attachment. Il lifecycle corrente distrugge Shadow prima del renderer su perdita device.

Comandi eseguiti da `../cache-source`:

```sh
node node_modules/vitest/vitest.mjs run src/cumulonimbus/TerrainShadow.test.ts --reporter=verbose --reporter=json --outputFile=../cache-evidence/test-results.json
node node_modules/typescript/bin/tsc --noEmit
```

Log: `targeted-tests.log`, `test-results.json`, `typecheck.log` (vuoto, exit0). Prima del run una chiamata di orchestrazione aveva un errore sintattico JavaScript e non ha avviato comandi; il run autorizzato dei test e il typecheck sono poi terminati al primo tentativo, senza modifiche delle fonti congelate.

Qualifica runtime ancora a Root: PNG native controllo/cold/hit con input identici, Sole che cambia e si assesta, camera e colore live, owner worker separato. Nessuno speedup o60FPS dichiarato; eventuale A/B/A deve misurare cadenza/prefissi reali, senza sommare come costi esclusivi gli intervalli GPU già noti come non additivi.
