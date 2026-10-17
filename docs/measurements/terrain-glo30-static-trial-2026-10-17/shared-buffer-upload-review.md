# TMA1: review mirata dell’upload condiviso

17 ottobre 2026. **Nessun bug concreto trovato nel percorso Three r186 esaminato per viste TypedArray distinte sullo stesso ArrayBuffer. La causa del FAIL resta aperta.** Solo lettura di sorgenti locali e JSON salvato; nessun test, modello, browser, GPU o modifica del candidato. Nessuna prova di correttezza effettiva del contenuto GPU viene sostituita con questa lettura.

## Evidenza effettiva

`browser/candidate-first-f32.json` (23587 B, SHA256 `d9795acbc454becdb823c8c087beacaa9540aa5fbe08342a1dcd5c0291506f48`) dichiara `FAIL_F32_DIFFERENCE`, `stable=true`, `cacheStateQualified=true`. Cached `04239524bbd9181fda93fc4a207ff450edd0a92cf6c470a09a0e6134ceb2caab`, fresh `d7dfd69b584300db49db81af4224caa0bf93952636628872cc43ea541eab6b8d`; entrambi 72.992.896 byte packed a2474×1844. Le due hash diverse provano soltanto che almeno un bit del target differisce: non identificano quantità, canali, localizzazione, magnitudine o causa. Il precedente tentativo rifiutato prima dell’assestamento non è questo FAIL qualificato. Nessun PNG del tentativo viene inferito da questi digest.

Il candidato crea quattro BufferAttribute distinti per positions/normals/surface/indices (`candidate-source/src/cumulonimbus/terrainMesh.ts:413–414`). Le due tabelle delle celle restano CPU: non sono vertex/index attribute né binding GPU. Quindi sei viste nello stesso backing buffer non significano sei upload o un unico GPUBuffer.

## Cosa fa effettivamente Three186

1. `BufferAttribute.js:71–90` conserva la TypedArray fornita e deriva count dalla sua lunghezza. `Attributes.js:71–107`, `DataMap.js:30–47` e `Backend.get()` indicizzano i dati per **oggetto attributo**. Non emerge una chiave basata su `array.buffer` che potrebbe confondere le viste del TMA1.
2. `WebGPUAttributeUtils.js:69–80,158–174` ottiene il buffer dall’attributo, alloca `array.byteLength` arrotondato a quattro e scrive `new array.constructor(mappedRange).set(array)`. `.set(array)` legge precisamente gli elementi della vista: l’offset CPU non va aggiunto di nuovo né scartato leggendo tutto il backing buffer. Ogni attributo ha un proprio GPUBuffer che parte da offset zero.
3. I rami di conversione INT8/16 e padding storage-vec3 (`82–155`) non si applicano ai normali BufferAttribute Float32x3, Float32x2 e Uint32 index. I loro stride12/8/4 byte sono già allineati. Il codice non riscrive i valori delle viste in questo percorso.
4. Anche `createShaderVertexBuffers()` raggruppa per attributo (`294–328`); `RenderObject.js:530–579` usa ID e Set di attributi. `_draw()` (`WebGPUBackend.js:2063–2087`) lega il GPUBuffer di ogni attributo, non il backing ArrayBuffer CPU condiviso. L’offset GPU zero è dunque atteso. Solo un attributo interleaved viene ricondotto al suo `attribute.data`, cosa che qui non avviene.
5. Gli update (`WebGPUAttributeUtils.js:185–268`) passano la TypedArray direttamente a `queue.writeBuffer`; non usano `array.buffer` omettendo il byteOffset. `Attributes.js:100–107` aggiorna soltanto per versione cresciuta o DynamicDrawUsage. Qui gli attributi sono statici: invalidare il target colore non richiede né provoca, da solo, un nuovo upload degli array.

**Non raccomando copie separate dei sei array come fix:** senza prova di errore in upload aggiungerebbero memoria e cambierebbero la diagnosi, senza correggere un difetto identificato. Il contratto di ownership resta indispensabile: un’altra parte dell’app potrebbe corrompere CPU data tramite alias, ma nessuna tale scrittura è stata trovata nel percorso esaminato. La validazione TMA1 e le hash del bundle riguardano i byte CPU, non costituiscono una lettura dei GPUBuffer realmente installati.

## Ipotesi e discriminatore minimo già previsto

Il forced fresh dell’audit chiama `terrain.invalidate()` (`GPUSceneEngine.ts:633`), che invalida **colore e shadow** (`terrainMesh.ts:436`), poi disegna entrambi. Nel JSON colore passa149→150 invii e shadow1→2. Il confronto non isola quindi un solo buffer, il sampling della shadow o un solo pass. Lo stato CPU stabile e le cache qualificate non sono una prova di identità dei bit della shadow map o dei receiver GPU. Non è dimostrato un errore di cache, driver, shader, derivative o upload.

La singola ulteriore invalidazione/read programmata dal root è un discriminatore utile senza alterare gli array:

- se il cached successivo è uguale al fresh precedente e il nuovo fresh coincide ancora, emerge un passaggio iniziale poi stabile; restano da individuare l’input non osservato o lo stato del primo contenuto, senza concludere automaticamente “stale cache”;
- se anche due fresh consecutivi con stato dichiarato identico differiscono, l’ipotesi di una sola vecchia entry riusata non basta. Il percorso comprende ancora il ridisegno shadow e colore, quindi non identifica quale dei due cambi né prova nondeterminismo generale;
- due hash uguali non misurano l’entità del primo FAIL, che deve restare conservato.

Nessun aumento di tolleranza o promozione suggerito. Una lettura più ampia degli array GPU o una prova con buffer separati sarebbe un esperimento distinto e non è stata eseguita qui.

## Provenienza della lettura locale

- `node_modules/three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js`: SHA256 `48e28e508ce6e881c2e8d41f215e8a3493f7b06479be965d72d3e53f0cbf643c`.
- `node_modules/three/src/renderers/common/Attributes.js`: SHA256 `82e7eb71dca1a723f522725a9a824da6eaa04b4f1a8e5a7d21ace7868a9a840d`.
- `node_modules/three/src/renderers/common/DataMap.js`: SHA256 `943c549f262d6f60ced6e9d5d3a1c614149166f934ed8e4f2aae3ef9be22d8de`.
- `node_modules/three/src/renderers/common/RenderObject.js`: SHA256 `fd39f216baf77dad588cbc57712a08bf047bd27475f448b47c157b50e43f0838`.
- `node_modules/three/src/renderers/webgpu/WebGPUBackend.js`: SHA256 `fe2781e3c7c9e390b6c0121e1d4823d929a8a60e89aae618d49dad0abbc1574e`.
- `node_modules/three/src/core/BufferAttribute.js`: SHA256 `d2ef1016597e2c03cb78003cb76243375f42540fba4af0b49d116671ccafc835`.

Review parallela indipendente del percorso attributi concorde: nessuna deduplicazione per ArrayBuffer o perdita di offset individuata. Questa nota riguarda il codice locale letto e il singolo report indicato, non la convalida di tutta Three o del terreno.
