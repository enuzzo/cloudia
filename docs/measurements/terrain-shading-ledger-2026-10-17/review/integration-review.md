# Shader ledger — review statica dell’integrazione congelata

17 ottobre 2026. **PASS statico, nessun blocker residuo identificato nei file finali letti.** Freeze 144 file `run/SOURCE-FREEZE.json`, SHA256 `f9c855d5ca1c52d710521b28b05c29be1c00a101d10cea2dab3b445f805bcd1a`. I sei file elencati sotto corrispondono agli hash del freeze. Nessun test, compilazione, modello, browser o GPU eseguito in questa review; il test mirato precedente del solo helper è una qualifica distinta.

## Sorgente diagnostica e identità ordinaria

`GPUSceneEngine.ts:337–357` conserva la costruzione ordinary con `terrainOpticalSurfaceWGSL` e wrapper ottico correnti. Le tre factory diagnostiche sono lazy e attive soltanto con profile/terrainAudit/shadingAudit espliciti. Usano lo stesso wrapper e gli stessi binding applicati; la libreria cambia esclusivamente il return finale tramite il helper congelato. `TerrainMesh` clona tre materiali e assegna nuovi fragmentNode: non muta il fragmentNode/versione del materiale ordinario. Il costruttore ordinario e il metodo render risultano testualmente invariati rispetto al prodotto v61 letto.

Macro-normal è `normal=normalize(macroNormal)` del materiale corrente, alimentata dalla normale mesh interpolata in spazio mondo; non è normale di faccia né gradiente DEM indipendente. Final-normal è `n` dopo il roughness esistente. Factors restituisce diffuse, proxy skylight e solarVisibility clamp. I vettori sono firmati e non codificati come colori 0…1. Le etichette storiche dei 12 marker non costituiscono classificazione dei materiali.

Il percorso Three186 `NodeMaterial.js:525–596` applica il max(0) soltanto al ramo built-in privo di fragmentNode; il ramo usato qui passa il fragmentNode a setupOutput. Con fog/premultipliedAlpha false (`setupOutput:1190–1207`), nessuna clamp a zero è aggiunta lì. Il target custom lavora senza tone mapping e nello spazio di lavoro (`Renderer.js:2663–2677`). Questo sostiene la lettura raw dei valori negativi, senza sostituire la prova GPU effettiva.

Ogni variante diagnostica può avere DCE, shader e pipeline diversi da ordinary. La sola conservazione della sorgente/identità oggetto non dimostra identità del compilato né causalità visiva. L’autentica del full target/PNG ordinario contro v61 prima del probe resta un gate del protocollo esterno; cached=fresh da solo non è un confronto con il riferimento canonico.

## Scissor, copie e ripristino

Il contratto r186 è rispettato: `Renderer.js:1768–1792` legge la rect da renderTarget.scissor (pixelRatio1) ma abilita lo scissor tramite il flag globale canvasTarget._scissorTest. Il probe imposta **entrambi**, con coordinate top-origin già usate per i readback; `WebGPUBackend.updateScissor:1673–1678` passa x/y senza ribaltamento a setScissorRect. Il bbox nativo fisso copre 1.049.267 pixel, con cap 1.100.000; sono tre draw diagnostiche scissor, non 12 draw per punto. Ogni clear è intenzionalmente completo prima del draw.

`TerrainMesh.ts:589–634`: dopo ciascun draw vengono invocate 12 copie 1×1; tutte 36 sono accodate prima del primo await. `Renderer.readRenderTargetPixelsAsync:3225–3227` delega subito al backend; `WebGPUTextureUtils.copyTextureToBuffer:803–860` esegue il submit prima di mapAsync. Le copie precedono quindi i clear dei modi successivi. Il materiale ordinario è rimesso e l’intero target ordinario viene ridisegnato prima dell’attesa; target/MRT/clear/depth/autoClear/scissor locale e globale sono ripristinati nei finally, anche se un passo fallisce.

Tutte le copie effettivamente accodate e il drain owner sono attesi con allSettled; i cloni vengono disposti solo dopo il termine di tali promesse. Un errore di enqueue parziale, lettura, ripristino o drain viene conservato e impedisce COMPLETE. La sentinella RGBA[-8192,-8192,-8192,1], shape esatta, finitezza e alpha>0 impediscono un PASS da buffer clear/miss. Il limite noto di Three186 resta esplicito: mapAsync rejection può bypassare il destroy del suo staging buffer interno; il probe non promette di correggere quell’implementazione.

## Owner e qualifica dei record

L’Engine riserva terrainAuditPromise prima del microtask. La frame loop si ferma prima di avanzare uniformi durante busy; export/benchmark sono esclusi. Il cleanup attende la promessa prima di disporre terreno/renderer/device. Dopo ogni attesa esterna i guard destroy/loss/release/generation scartano lavoro stale, senza pubblicare nuovi read/report. Il target/installazione e il materiale ordinario sono verificati anche dal probe.

I due rilievi iniziali sono chiusi nei byte congelati:

- `GPUSceneEngine.ts:702–710` lega ogni row/id/pixel al witness ordinario e richiede che tutti 36 bit alpha coincidano con il rispettivo alpha fresh. Normalnorm entro 1e−4 e fattori finiti in [0,1] sono ulteriori guard, non una ricostruzione indipendente della luce.
- `:1033` azzera terrainLedgerShades dopo il drain, rilasciando la closure che tratteneva i binding cover/ottici anche dopo Texture.dispose.

ShadingQualified richiede COMPLETE, stateRestored/inputsStable, i gate dei record e uguaglianza fullRGBA/fullalpha dopo il redraw ordinario. Quattro hash delle array CPU installate identificano la geometria prima del probe; non dimostrano da soli il contenuto del buffer GPU. I test aggiunti, letti ma non eseguiti qui, coprono copie/drain/restore parziali, stato modificato, sentinelle/miss, owner distrutto/generazione cambiata e rifiuto di una qualifica dichiarata erroneamente dal mock.

**Limite conclusivo:** questi dati consentono una diagnosi locale su 12 receiver qualificati; non individuano automaticamente una causa globale delle scaglie, una normale GPU ordinary identica in ogni istruzione, un vincitore shadow o un miglioramento fotografico/FPS. Nessuna modifica visiva è adottata da questa review.

## Byte finali letti

| File in ledger-source/src/cumulonimbus | Byte | SHA256 |
|---|---:|---|
| `GPUSceneEngine.ts` | 90565 | `b8ee292262da2e3e6bbfecccd9f92ebf1bc882bb60562f83cce63de94a4b5f80` |
| `terrainMesh.ts` | 54085 | `763fa49c5f9ae7196c5eb16d188c38b6de74f430d1388a8e286d7219624e987a` |
| `terrainShadingLedger.ts` | 2496 | `9f2715908df14940032fbc4ace19c2b7f3430105e6e405f6303647801db6fb9b` |
| `terrainShadingLedger.test.ts` | 3910 | `549a94aaa4ce948124475acf9160ff49fbf0f831824f4751579c2628ae5c5948` |
| `terrainShadingProbe.test.ts` | 12615 | `d67b412760ce6c0dc2b68d329684feee4a61acf1c5f995ef891c860d8faa266f` |
| `lifecycle.test.ts` | 90306 | `b589e201c44c2b15b20782cb726ff2c9b68786c59b96fe10c14f7e7d5ec87a05` |
