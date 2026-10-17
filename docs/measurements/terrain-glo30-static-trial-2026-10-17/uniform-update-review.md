# Three186 — aggiornamento uniform nei multipass

17 ottobre 2026. **Nessun meccanismo concreto di latch FRAME trovato per Sun/solar/ambient nel percorso letto.** La lettura non spiega il FAIL cached/fresh e non esclude un altro problema di binding, stato GPU o cache. Nessun test, modello, browser, GPU, patch o modifica del prodotto.

## Ordine applicativo osservato

In `difference-source/src/cumulonimbus/GPUSceneEngine.ts` il frame chiama `advanceAtmosphere` prima di `renderTerrain` e del quad (`457`, `512–513`). `advanceAtmosphere` applica direzione e componenti colore correnti con interpolazione e `.copy(...).lerp(...)` (`726–733`). La chiave terrain legge solar/ambient correnti e direzione sole, prima di decidere il riuso; un hit non disegna il terreno, ma il successivo miss/forced redraw torna al normale percorso Three. Durante l’audit l’ordinary rAF ritorna subito se busy (`447`). Non emerge un `.copy/.lerp` successivo al commit della chiave ma precedente alla submission dello stesso disegno.

## Frequenza e contenuto delle uniform

- Sun, solarColor e ambientColor sono normali `uniform(new Vector3(...))`; nei tre moduli Engine/terrainMesh/TerrainShadow non compaiono `setGroup`, `frameGroup`, `renderGroup` o callback `onFrameUpdate` su questi input. `UniformNode.js:55` assegna per default **objectGroup**, che `UniformGroupNode.js` definisce non shared e con updateType OBJECT. Condividere un UniformNode fra terreno e quad condivide il valore JS, non equivale a dichiarare un frameGroup.
- `NodeManager.updateGroup` (`114–141`) ritorna immediatamente true per OBJECT, senza usare il latch di frame/render. I latch di `NodeFrame` si applicano ai callback node configurati FRAME/RENDER; non impediscono, da soli, il normale packing degli input UniformNode.
- Il terreno usa un `fragmentNode`: `NodeMaterialObserver.containsNode` (`325–340`) lo riconosce e `needsRefresh` (`932–935`) richiede FULL. `Renderer._renderObjectDirect` (`3869–3880`) effettua quindi update dei node e dei binding prima del draw, anche per una mesh geometrica statica. Non dipende dall’aver cambiato l’identità del Vector3.
- `NodeUniform.value` legge `node.value` tramite getter; `Vector3NodeUniform.getValue()` legge quel valore corrente. `UniformsGroup.updateVector3` (`352–375`) confronta **x/y/z singolarmente** col proprio cache di numeri e scrive i componenti nel buffer Float32. Una mutazione in-place `.copy/.lerp` è rilevabile; non viene confrontato soltanto l’oggetto.
- `Bindings._update` (`369–407`) chiama updateGroup, poi `binding.update()`, poi `backend.updateBinding()` se i numeri cambiano. `WebGPUBindingUtils.updateBinding` (`193–248`) chiama `queue.writeBuffer` prima del draw successivo. Non c’è in questo tratto un await che sposti intenzionalmente l’upload al frame dopo.

I gruppi uniform vengono costruiti dal WGSLNodeBuilder per lo stato del builder; `NodeBuilderState.createBindings` clona quelli non shared. Questa lettura non fornisce però gli ID/buffer actual della pipeline eseguita: non uso la distinzione teorica per certificare il contenuto GPU.

## Multipass e salto della cache

`Renderer._renderScene` incrementa `info.calls` e assegna quel numero al `nodeFrame.renderId` (`1741–1745`) per ogni render call; lo ripristina all’uscita. Quindi anche un eventuale gruppo RENDER avrebbe una nuova occasione di update fra shadow, terreno e quad; FRAME sarebbe una scelta esplicita diversa. Al termine `finishRender` del backend invia il command encoder (`WebGPUBackend.js:1565`), prima che l’app prosegua col quad. Nel percorso sincrono locale non emerge un pass che legge volontariamente i nuovi valori JS soltanto dopo il proprio submit. Questo descrive l’ordine CPU/queue, non GPU completion o presentazione.

Un hit terreno conserva legittimamente i vecchi UBO di quel materiale senza usarli per un nuovo draw. Se i valori CPU della chiave cambiano, occorre un miss; nel miss FULL i componenti vengono confrontati/impacchettati. Se invece i double CPU restano uguali, la loro conversione Float32 è deterministica. Differenze di precisione JS/GPU non dimostrano da sole una transizione persa.

## Conclusione operativa e limiti

Non suggerisco `needsUpdate`, `frameGroup` manuali o un secondo upload preventivo senza evidenza: cambierebbero la struttura del problema. La riproduzione R2 già prevista con diff RGBA e digest shadow è il discriminatore successivo. Alpha diversa renderebbe insufficiente una spiegazione limitata ai soli colori solar/ambient; shadow diversa o identica distingue due attachment ma non identifica automaticamente la sorgente o il binding responsabile. Non è stata avviata alcuna ulteriore acquisizione.

Questa è una review statica di pochi percorsi locali r186. Non legge UBO actual, shader compilato o receiver/caster; non prova che ogni dipendenza della chiave app sia esaustiva, né che il backend/driver esegua bit-identicamente il draw. Il FAIL originario resta intatto e senza causa attribuita.

## Hash dei file mirati letti

- `node_modules/three/src/nodes/core/UniformNode.js`: `76cd5f198a7392d89a39fa15adaa02e38ba334eaa1a59c7259dcd3fe45820034`.
- `node_modules/three/src/nodes/core/UniformGroupNode.js`: `9cba945ced07fb3b4360b8d9430afbababb473c953f8163589599527bdb983e6`.
- `node_modules/three/src/nodes/core/NodeFrame.js`: `4048e1d55a262f3dd97370cb14b517fbc6f3d7c4bbc0d3c76f0626fea928452a`.
- `node_modules/three/src/renderers/common/nodes/NodeManager.js`: `8ec9afe44c4b8a3e56a1122c0c1bd5d2a5de2ac887dc397a535127a7dbce8076`.
- `node_modules/three/src/renderers/common/nodes/NodeUniform.js`: `584e991648e3348e91c95f311ba6559c3e960765bbb12ea6c47c53a5b0c8a36d`.
- `node_modules/three/src/renderers/common/UniformsGroup.js`: `2c9287d8e35bf35aa43b3c1d7cc20e79dbce32a77210ed03b9eb01b88c578b86`.
- `node_modules/three/src/renderers/common/Bindings.js`: `13d5a3bcf5e488e503384bf63d5bf6319cbfafa185361d7114876ca3d75afca2`.
- `node_modules/three/src/materials/nodes/manager/NodeMaterialObserver.js`: `6bd51dade335422ffcabf6a6b3f595f0f9a5375b4ac9da20ba814755d08376c1`.
- `node_modules/three/src/renderers/webgpu/utils/WebGPUBindingUtils.js`: `cd387f0ab208760d72fb27bd33cfc6edfb2ea1217f4166b679842670dc81cb8f`.
