# Cache A/s: formati GPU e costo reale del percorso — 2026-10-16

**RG16F campionabile è core; RG16F scritto come storage non lo è.** La stima
8/64MiB descrive una sola texture128³/256³ senza mipmap. Non comprende staging,
pubblicazione doppia, copie, rebuild, risorse renderer o memoria del driver.
Questa verifica è solo sorgenti/spec: nessuna GPU/browser, build, run o modifica
prodotto. Non promuove la cache, che conserva il FAIL del contratto CPU iniziale.

## Capacità WebGPU da verificare sul device realmente usato

- La scrittura `texture_storage_3d<rg16float,write>` richiede la feature device
  `texture-formats-tier1`; Tier1 ammette write-only/read-only per RG16F, non
  read-write. Texture binding lineare RG16F non richiede questa feature.
  [WebGPU: Tier1 e tabella formati](https://www.w3.org/TR/webgpu/#texture-formats-tier1).
- Distinguere adapter.features e device.features: il supporto dell'adapter non
  abilita una feature nel device già creato. Dopo l'init va controllato il device
  effettivo del renderer. La dichiarazione WGSL richiede anche l'estensione
  linguistica `texture_formats_tier1`, verificabile con wgslLanguageFeatures.
- **Non usare `enable texture_formats_tier1;`.** È una language extension,
  disponibile automaticamente quando implementata; `requires texture_formats_tier1;`
  può rendere esplicito il requisito. [WGSL: language extensions](https://www.w3.org/TR/WGSL/#language-extensions).
  Il normale Storage3DTexture RGBA16F write-only è invece un percorso core.

I report GPU precedenti letti riportano Apple/metal-3, ma non l'elenco delle
feature API/linguaggio. **Non attestano Tier1 su quel browser/device.** La
capacità Metal sottostante non sostituisce l'esposizione WebGPU. Questi controlli
restano un prerequisito di un eventuale esperimento successivo.

## Three locale:0.186.0, capacità e confini

Percorsi sotto `node_modules/three/`, letti senza importare/eseguire il renderer:

|Sorgente e righe|Riscontro concreto|
|---|---|
|package.json:3|Versione0.186.0|
|src/renderers/webgpu/WebGPUBackend.js:235–265|Il percorso device automatico richiede le feature conosciute supportate dall'adapter; con device esterno usa quello ricevuto|
|src/renderers/webgpu/utils/WebGPUConstants.js:347|Enum TextureFormatsTier1 presente|
|src/renderers/common/Storage3DTexture.js:22|Risorsa3D dimensions-only, senza typed array CPU; flag storage|
|src/renderers/webgpu/utils/WebGPUTextureUtils.js:350–400,1723–1754|RGFormat+HalfFloatType→rg16float; flag storage aggiunge STORAGE_BINDING. Nessun fallback automatico RG16F→RGBA16F|
|src/renderers/webgpu/nodes/WGSLNodeBuilder.js:2195|Dichiara texture_storage_3d con formato/accesso del nodo|
|src/nodes/accessors/StorageTextureNode.js:82|Default write-only; specificarlo esplicitamente è opportuno, evitando read-write|
|src/renderers/webgpu/utils/WebGPUBindingUtils.js:470–500|Binding storage formato reale e view3D|
|src/renderers/common/Renderer.js:3033,3083|hasFeature dopo init e initTexture sono disponibili|

Per il diretto Tier1, il disegno minimo è Storage3DTexture con RGFormat,
HalfFloatType, NoColorSpace, clampXYZ, filtri lineari e **generateMipmaps=false**;
compute write-only, poi normale texture3D campionata in un pass successivo.
La mappatura del formato Three non prova la validità dello storage sul device.
La build WGSL deve essere controllata, senza assumere direttive Tier1 automatiche.

Il precedente flow dell'app usa già Storage3DTexture RGBA16F e textureStore
write-only, ma soltanto16³: prova il percorso esistente, non costo/capienza del256³.

## Tre percorsi implementabili

**A. RG16F storage diretto, se qualificato Tier1.** La stessa texture può avere
STORAGE_BINDING e TEXTURE_BINDING, usate in pass diversi. Nessuna copia API tra
compute e render e nessun array CPU della cache. In-place è valido con ordine
compute→render sulla stessa coda; non leggere/campionare la risorsa mentre viene
scritta nello stesso usage scope. Due texture servono se si vuole mantenere
visibile la cache precedente durante un rebuild distribuito/incompleto.

**B. Fallback core compatto: buffer u32→RG16F campionata.** Compute scrive
`pack2x16float(vec2<f32>(A,s))` in array<u32>, indice x+N*(y+N*z).
Buffer STORAGE|COPY_SRC, texture3D RG16F COPY_DST|TEXTURE_BINDING; terminare il
compute pass, poi copyBufferToTexture, poi render. A va nei16bit bassi e s nei
16alti; il layout little-endian combacia con RG. Non usa tipi f16 né shader-f16.
Le conversioni possono arrotondare/flushare subnormali: niente identità con il
convertitore CPU RTE. [WGSL: packing](https://www.w3.org/TR/WGSL/#pack2x16float-builtin).
Verificare finitezza e range binary16 dei nodi prima di considerare valido il pack.

|N|bytesPerRow|rowsPerImage|Buffer completo|Copie complete per rebuild|
|---:|---:|---:|---:|---:|
|128|512|128|8MiB|1×8MiB|
|256|1024|256|64MiB|1×64MiB|

Stride già multipli256, offset0 allineato4byte, rowsPerImage=N per profondità>1.
Le texel-copy garantiscono il valore dei finiti non subnormali; possono cambiare
±0 e flushare subnormali. Non sono una promessa di bytes identici.
[WebGPU: layout/copie, sorgente normativa](https://raw.githubusercontent.com/gpuweb/gpuweb/main/spec/sections/copies.bs).

**Limite Three concreto:** Renderer non espone una copia pubblica GPUBuffer→Texture.
`WebGPUTextureUtils._copyBufferToTexture` a1084 usa queue.writeTexture da dati CPU,
non GPUCommandEncoder.copyBufferToTexture. Il fallback richiede un piccolo confine
raw WebGPU sullo **stesso device**: recupero controllato di texture/buffer backend,
encoder, ordine delle submit e cleanup. Backend.get(texture).texture esiste, ma
è dettaglio interno r186, non un contratto pubblico stabile. La destinazione deve
essere inizializzata senza ricaricare per errore dati CPU: Data3DTexture(null)
con needsUpdate e dataReady predefinito non è automaticamente un upload valido;
Textures.js:354 permette di sopprimere l'upload con source.dataReady=false.
Questo percorso d'integrazione va qualificato, non dichiarato pronto.

Se si usa StorageBufferAttribute di Three, il costruttore alloca anche una
Uint32Array CPU da8/64MiB e l'inizializzazione copia in un buffer mapped; un
GPUBuffer raw evita quella shadow CPU. Non usare Uint16Array aspettandosi il
packing: AttributeUtils converte tipi integer piccoli in Uint32Array. Dopo la
copia il render campiona la vera RG16F lineare, non il buffer packed.

**C. Fallback più semplice: RGBA16F storage diretto.** Memorizzare A,s nei primi
due canali e campionare .rg. Core e vicino al flow già esistente, senza buffer
o copia API, ma payload e store raddoppiati. Non si può fare una copyTextureToTexture
RGBA16F→RG16F per scartare due canali: non è una conversione tra formati.
R32uint packed campionato richiederebbe interpolazione manuale8load/unpack e non
conserva l'obiettivo di una sola lookup lineare. RG32float richiede poi qualificare
la filtrabilità f32; RGBA16F è il fallback diretto più lineare da valutare.

## Memoria e traffico da mettere nel preventivo

MiB binari, mip0, input detail/rain condivisi col renderer; sono payload logici,
non misure della memoria fisica/tiling del driver. Doppio=una cache vecchia e una
nuova contemporanee; nessuna nuova allocazione per frame nel percorso stabile.
Le colonne rappresentano risorse vive al rebuild: distruggere il buffer in pausa
abbassa la memoria residua, ma il successivo aggiornamento lo richiede di nuovo.

|Percorso|GPU singola128/256|GPU con due texture128/256|Traffico output nominale per rebuild128/256|
|---|---:|---:|---:|
|RG16F diretto Tier1|8/64MiB|16/128MiB|Store8/64MiB|
|Buffer completo+RG16F|16/128MiB|24/192MiB|Store buffer+lettura copia+scrittura texture:24/192MiB|
|Buffer slab8+RG16F|8.5/66MiB|16.5/130MiB|Stessi24/192MiB,16/32dispatch+copy|
|RGBA16F diretto core|16/128MiB|32/256MiB|Store16/128MiB|

Lo slab8 richiede un buffer4*N*N*8, cioè.5/2MiB, riusato dopo ciascuna copia
con origin.z appropriato. Riduce il picco, non le letture del campo né i byte
totali copiati. Aggiunge pass/command encoding/barriere: nessun vantaggio misurato.
Per una transizione128→256 che trattiene la vecchia cache, i picchi corrispondenti
sono72MiB direttoRG,136MiB buffer completo,74MiB slab8,144MiB RGBA16F.
La shadow CPU Three del buffer, se scelta, è aggiuntiva ai valori della tabella.
Allocazioni iniziali, zero-initialization e copie interne del driver sono escluse.

Il rebuild deve valutare2.097.152/16.777.216nodi; fino a3lookup input ciascuno:
circa6,29/50,33milioni di chiamate semantiche, prima del render. Non derivarne ms.
Alcuni A0 evitano sheets, ma devono comunque produrre s corretto. Tutti i percorsi
devono misurare compute+eventuale copy+render, inclusa la coda completata; il
solo render può migliorare mentre il frame completo peggiora.

Non usare mipmap implicite: una catena3D completa aggiunge circa14,29% di payload
e lavoro di generazione. Cache statica in pausa e rebuild durante animazione
sono casi distinti: growth/wind/timeRain/amount/driftY e nuova mappa invalidano
A/s. Aggiornamenti diradati richiedono un ulteriore contratto d'errore temporale.

## Dispatch, pubblicazione e prova minima successiva

Controllare device.limits reali, maxTextureDimension3D>=N e buffer binding≥4N³.
Il64MiB packed rientra nei default core128MiB/storage binding e256MiB/buffer;
non è una prova di budget disponibile. Raw dispatch piatto a256³ supera65535
gruppi perfino con256thread. Un workgroup4³ con dispatch32³/64³ è valido rispetto
ai normali limiti core. **Three r186 divide già il count piatto oltre il limite
X su Y** (Backend.js:1948–1968): non attribuirgli il bug del raw dispatch ingenuo.

La prova minima futura deve registrare feature/limiti/format/usage/mipCount e
WGSL effettivi sul device condiviso, verificare nodi e filtro su A/s reali,
code subnormali e s non zero con A0, poi guard native ottiche. Timer separati per
rebuild/copy/render e report totale con prefisso completato; nessun readback nel
percorso normale. Sostituzione seed/resize, build annullata, device loss e destroy
devono liberare buffer/texture e impedire pubblicazioni stale. Tutti i nodi devono
essere scritti e cache+metadata dello stesso stato pubblicati insieme; un volume
aggiornato a metà non soddisfa il contratto CPU.

Sceglierei prima **direttoRG se Tier1 realmente presente**, altrimenti **RGBA16F
diretto per un guard isolato**, dichiarando16/128MiB. Il packed/slab è la strada
per ridurre la texture campionata senza Tier1, ma comporta più integrazione e va
valutato includendo le copie. Questa è una proposta di implementazione fattibile,
non una qualifica eseguita né una promessa FPS.

## Provenienza locale

SHA256 delle principali sorgenti lette, tutte sotto node_modules/three:

```
package.json ab4ff6950aab522dfe6980f19914a5eb2cadb689a36c6c44f4d3869c5e46dc89
src/renderers/webgpu/WebGPUBackend.js fe2781e3c7c9e390b6c0121e1d4823d929a8a60e89aae618d49dad0abbc1574e
src/renderers/webgpu/utils/WebGPUTextureUtils.js e690a6d73435a3067be86532a1a403ebfcae08175644420179dfcf318a52158d
src/renderers/webgpu/nodes/WGSLNodeBuilder.js f742b3fe5d2a9396c0aadff8c9ba0489a2ce8dc833b199abc95a4b683dd74ed3
src/renderers/common/Storage3DTexture.js 69b157355b259ded8cab13dee70db13a966f4fc562b2a6d335d97c0f3d152b45
src/renderers/common/StorageBufferAttribute.js e7bd357166d3d64f410f6a59a0a17d5c037928074e93e64f396ba690bf26214e
src/renderers/common/Textures.js 1e52e94146cc3f4e50517664b4adaad473cb6601978288ae8ef9246d0ea4683b
```

Ricerca primaria consultata il2026-10-16; review indipendente delle regole
WebGPU/WGSL da gpu_format_review, anch'essa senza esecuzioni GPU o file prodotto.
