# Densità macro R8 separata — proposta non implementata

16 ottobre 2026. Revisione in sola lettura del codice corrente, renderer
`observatory-v46-compiled-rain-mask-trial`, Three locale **0.186.0**.
Nessun sorgente, build, test, GPU o installazione modificato/eseguito.
Il futuro controllo è **v46 congelata**, non v40; checkpoint base indicato
dal root `6a7df91`.

## Modifica minima e significato

🌟 Esperimento ragionevole: una copia contigua byte per byte `R[i]=RGBA[4*i]`,
256³, senza normalizzare, ricampionare, erodere o rifare il bake. Aggiungere
una texture `r8unorm`; mantenere RGBA8 intera per luce, CPU probe e pioggia.
Nel [lookup warped](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/cloudShader.ts:147)
cambierebbe solo la texture: stesse coordinate f32, warp, clamp, filtro e LOD0.
Il [lookup luce](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/cloudShader.ts:168)
resta RGBA; broad alpha nel detail e narrow mask restano distinti e invariati.

Nel modello ideale, `sum(wi*R8i/255) = sum(wi*RGBAi.r/255)` con gli stessi
otto pesi. È identità matematica del canale, **non promessa di bit identici
tra due sampler/formati GPU**. La precisione del filtraggio reale, il binding
Three e l'eventuale effetto dei residui sui gate devono essere verificati.

## Percorso concreto e precedenti

- Nuovo helper puro suggerito `src/cumulonimbus/densityR8.ts`: valida size e
  lunghezzaRGBA, restituisce `{size,data:Uint8Array}`. Una view/subarray del
  payload interleaved NON estrae R: serve una copia a stride4.
- [volume.worker.ts](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/volume.worker.ts:5):
  estrarre dopo generateVolume e trasferire il nuovo buffer insieme agli altri.
  Precedente locale: [narrowCloud.ts](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/narrowCloud.ts:20)
  estrae alpha in R8, ma rappresenta un certificato128³, non densità256³.
  Payload legacy/fixture senza R8: mantenere il template macro originale,
  senza copia o binding aggiuntivo. Una texture costante come fallback narrow
  sarebbe errata per la densità.
- [GPUSceneEngine.loadVolume](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/GPUSceneEngine.ts:339):
  Data3DTexture con RedFormat/UnsignedByteType/NoColorSpace, LinearFilter
  min+mag, clamp S/T/R, generateMipmaps=false, flipY=false, unpackAlignment1.
  **Non copiare NearestFilter dalla narrow.** Data3DTexture nasce nearest.
- Three: [mapping R8](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/webgpu/utils/WebGPUTextureUtils.js:1704),
  [1 byte/texel](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/webgpu/utils/WebGPUTextureUtils.js:1297),
  [sampler da stato texture](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/renderers/webgpu/utils/WebGPUTextureUtils.js:157),
  [default Data3DTexture](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/node_modules/three/src/textures/Data3DTexture.js:48).
  È un upload CPU ordinario, non una storage texture né una conversione GPU.
- API proposta: `createCloudIntegrator(mode=0,useNarrow=false,useDensityR8=false)`.
  Il default deve mantenere i due shader v46 dry/rain **byte/SHA identici**;
  applicare signature/lookup R8 solo alla copia del sorgente selezionato quando
  il terzo argomento è true. Engine associa true solo a un payload valido.
  Possibile riusare il `volumeSampler` già esistente nel WGSL, aggiungendo solo
  la texture; la narrow dimostra già un argomento texture senza sampler dedicato.
  Verificare reflection/layout effettivi: non presumere deduplica del sampler.
  Coprire dry/rain e tutte le ablation compilate; nessun branch runtime A/B.
- Estendere CloudTextures, installVolume, disposeCloudTextures e releaseGPU;
  stessa proprietà/cleanup nel main e render.worker, che usa lo stesso engine.
  I test lifecycle esistenti per macro+narrow offrono quattro casi pertinenti:
  sostituzione/destroy, iniziale stale, replacement stale durante drain,
  drain respinto. Aggiungere assert sulla nuova texture e relativo array.

## Costi e rischi

| Risorsa aggiuntiva a256³ | Payload nominale |
| --- | ---: |
| Texture GPU R8 persistente |16 MiB |
| ArrayCPU estratto, condiviso fra riferimenti JS |16 MiB |
| Due generazioni vive durante sostituzione |32 MiB GPU +32 MiB CPU |

RGBA64MiB rimane. Volumi GPU macro+sunset+detail+narrow passano nominalmente
da106 a122MiB, esclusi flow, sky, framebuffer e staging del driver. Questi
sono payload logici, non una misura della memoria residente su Apple unificata.
Una passata legge64MiB e scrive16MiB una volta per generazione; trasferire
il buffer evita un'ulteriore copia strutturata. Non stimare tempi senza misura.
Ridurre4→1 byte per texel nel singolo lookup non implica banda totale÷4 o
speedup: la cache luce RGBA resta, cambiano località, binding e pressione cache.

## Gate prima di qualunque promozione

1. Test piccolo di estrazione/stride con canaliGBA diversi e immutabilità
   dell'input; verifica integrale dei byteR sul volume congelato, senza nuovo bake.
   Worker test indipendente con packet piccolo e transfer reale/structuredClone:
   buffer R distinto, ricevuto integro, sorgente detached, altri canali preservati.
   Legacy→baseline e nuovo payload→R8 devono arrivare al binding giusto;
   verificare anche cancel/seed swap e i quattro cleanup, non solo proprietà del helper.
2. Nuovo audit rawGPU separato, derivato dal
   [runner narrow](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/narrow-cloud-2026-10-16/gpu-audit/audit.js:63):
   caricare la stessa macro congelata e la sua R8, un unico sampler linear/clamp,
   mip0, query f32 comuni. Centri, frazioni di cella, bordi/clamp esterni,
   codeR=1/255, zeri/positivi e warp esatto con ice0/.5/1; riusare input esistenti.
   Riportare max/RMS/ULP e primi witness di RGBA.r−R8.r, non finiti e differenze
   ai gate. Cercare parità esatta sul backend; nessuna tolleranza inventata per
   chiamare esatta una differenza. Readback, error scopes, timeout e finally cleanup.
3. Il precedente risultato rawGPU narrow PASS verifica textureLoad del
   certificato: **non** certifica questo filtro, né il draw Three completo.
   Dopo il raw audit: binding/pipeline reali, main/worker, rigenerazione e cleanup.
4. Immagini e A/B/A contro v46 a seme/clock/camera/meteo/output identici,
   dry e rain, vicino e panorama. Report esplicito format/resolution/bytes/SHA
   e sampler; misure FPS/GPU solo dopo parità e senza altri lavori concorrenti.
   Se la differenza prestazionale non è ripetibile o peggiora, ritirare la copia.

Nessun ostacolo concreto rilevato: pronto per editing esclusivo coordinato di
helper/worker, engine/shader e test pertinenti. Questa proposta non applica la
modifica e non riapre la ricerca.
