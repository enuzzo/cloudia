# Review statica indipendente — audit luce emettitore

17 ottobre 2026. **PASS statico di ambito: nessun blocker concreto trovato nel helper congelato a quattro argomenti e nel hook diagnostico.** Non equivale a test eseguiti, parità GPU, misura dei buffer device o PASS artistico. Nessun modello/Bun/test/GPU/browser/bake eseguito; nessun file prodotto modificato. Questa nota è sola I/O e lettura sorgenti.

## Encoding e coordinate verificati

- `base-source/src/cumulonimbus/volume.ts:423–451`: macro RGBA8 con R densità, G/B τ giorno sinistra/destra, A τ zenit; sunset RG8 con i due endpoint bassi. Ogni τ è codificata `round(clamp(tau/16)*255)`: è profondità ottica adimensionale, non distanza né visibilità già esponenziata. La densità per il bake include erosione fine e rapporto di estinzione ghiaccio/liquido (`:428–438`).
- `precipitation.ts:65–114`: rainMap RG8, X contiguo, Z riga, R forza sorgente filtrata, G quota base codificata `(base+.5)/3`. Le celle R0 accanto a pioggia conservano quote estrapolate per il filtro. La fonte usa massa macro sotto 2.5 km e soglia interna già esistente; l'audit non la ricostruisce o modifica.
- `rainEmitterAudit.ts:41–51`: `(u,w,v)=((x+.5)/side,3*(G/255)/8.5,(z+.5)/side)` è coerente con bounds minY−.5/altezza8.5 e base già quantizzata. La Y non va scambiata con la Z. Indice `((z*N+y)*N+x)`; stride4 per macro e2 per sunset; sampler ideale trilineare `p=uvw*N−.5`, clamp di ogni indice, mip0. Nessun secondo flow, crescita, drift, shear o warp al punto materiale.
- `GPUSceneEngine.ts:300–302` del baseline espande supportBounds cloud di `[1.3,0,.65]` per traversal mondo: questo halo non sposta il punto emittente e non è supporto della mappa pioggia.

## Supporto: tre insiemi separati

Il helper `:29–40,59–62,174` separa R>0, R0 con vicino positivo Chebyshev1 (diagonali comprese) e R0 rimanenti. `support` è l'unione dei primi due. È un insieme discreto conservativo dei texel i cui BA possono entrare nello stesso footprint bilineare di una R positiva; non è una maschera continua di intensità né un AABB. Mantiene anche R=1, senza soglia nuova.

La differenza è necessaria: l'AABB ottenuto da `precipitationSourceBounds` include buchi vuoti e non deve diventare l'insieme statistico; i soli centri R>0 ometterebbero invece i vicini R0 che partecipano al filtro. Il helper non confonde queste nozioni. Non aggiunge un secondo blur alla rainMap già filtrata.

## Stato corrente e hook

`rainEmitterAudit.ts:25–26,118–150` valida lightSide/sunsetAmount/massFactor finiti in[0,1]. Gli endpoint sono memorizzati Float32; il preview corrente usa mix scalari CPU, poi Math.roundUNORM8 B/A, decodifica e risposta exp con massFactor corrente. Statistiche endpoint a massFactor1 e preview corrente sono distinti; è esplicito che la rainMap installata resta RG8 e BA è un packing **ipotetico**, non dato GPU misurato.

`audit-source/.../GPUSceneEngine.ts:207,602–621` limita il hook a profile1+emitterAudit1 nei metadata dell'export. Legge la rainMap installata senza rigenerarla e i buffer CPU del volume accettato; verifica identità degli oggetti array macro/sunset rispetto alle texture installate e passa i tre scalar uniform attualmente applicati. Il codice distingue identità CPU da readback/hash GPU; lunghezze e identità non sono spacciate per digest di contenuto. L'export esistente invoca questi metadata dopo il draw (`:513`); il helper è sincrono e non pubblica callback tardive né muta texture.

## Gate realmente utile e limiti da mantenere nel verdetto

1. Nessuna R positiva: STOP. BA corrente identica su supporto o risposta corrente costante: STOP_NO_SPATIAL_SIGNAL. L'audit può falsificare l'utilità informativa di questo proxy, senza nuovo bake.
2. Per interpretare VARIATION_ONLY_NOT_ART_PASS, leggere prima `current.regions.positive` e relativi pesi R, poi `haloZero` e supporto totale. Variazione soltanto nel bordo R0, pochi outlier o differenze di risposta minime non provano contrasto utile nelle colonne principali. Non introdurre soglie adattate al risultato per convertirlo in PASS.
3. I pesi R sono forza sorgente autoriale, non acqua fisica né peso dei contributi lungo il raggio. Quantili/minmax non descrivono la disposizione spaziale: anche una distribuzione ampia può produrre pannelli. I16witness sono prefissati per coordinate e possono mancare la pioggia; non sono scelti per dimostrare successo.
4. Packed255 include arrotondamenti al codice alto: da solo non certifica clipping originario esatto aτ16. Risposte exp e blend CPU Float64 non certificano filtro/ALU f32 GPU; non sostituiscono la lookup bilineare BA sul singolo raggio.
5. La visibilità alla base è un proxy per gocce discese/trasportate. Questo audit non prova ombre reali delle gocce, aperture o profondità. Un futuro trial resta FAIL se ottiene soltanto darkening o pannelli; nessun quantile non nullo è artPASS o FPSPASS.

Il lavoro è limitato a4096posizioni,8corner×5canali, tabella81.920B più region4.096B/order8.192B, istogrammi/Set bounded e JSON<128KiB validato prima del ritorno (`:181–192`). Nessuna copia/hash dei volumi. Il tempo locale helper e quello esterno del hook sono osservabili; non sono RSS, GPUtime o un benchmark. Non modificare il renderer a stato ordinario sulla base di questo solo PASS statico.

I cinque test scritti sono stati letti: polinomio affine indipendente per assi/stride, cornerR1+halo, CDF pesata, current packing/risposta, empty/limiti. **Non eseguiti da questa review.** Nessun fix richiesto.

## Input della review

I due file helper/test copiati in audit-source risultano byte-identici alla proposta. Volume/precipitation/cloudShader audit sono byte-identici alla base per semplice confronto file; non sono stati eseguiti.

```json
{
  "reviewed": [
    {
      "path": "/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle30/emitter-audit-proposal/rainEmitterAudit.ts",
      "bytes": 15404,
      "sha256": "ecf8bc35810c9e4b08cfd047b82f204276598bd77acb2de8ee3c6c4cd9499fa4"
    },
    {
      "path": "/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle30/emitter-audit-proposal/rainEmitterAudit.test.ts",
      "bytes": 5421,
      "sha256": "3f7ded21bcc64f3a7835a38006f9926d54990bd1bfc7d46dba033293143614a1"
    },
    {
      "path": "/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle30/emitter-audit-proposal/README.md",
      "bytes": 4111,
      "sha256": "8f213f816f8e0b2c1155817a96af944ce445d307d5a41af34025a68b916bde39"
    },
    {
      "path": "/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle30/audit-source/src/cumulonimbus/GPUSceneEngine.ts",
      "bytes": 76902,
      "sha256": "e2d03adce24f5c245dc92f6b577d82e1cd3881a0841dfa38e34f5db250694e00"
    },
    {
      "path": "/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle29/rain-source-light-plan.md",
      "bytes": 12189,
      "sha256": "fcc476073073d07808d0afafa373032947e64dce8cefec28f4ea43c5ea592009"
    }
  ],
  "unchangedBaselineSources": [
    {
      "path": "/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle30/base-source/src/cumulonimbus/volume.ts",
      "bytes": 29836,
      "sha256": "c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d"
    },
    {
      "path": "/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle30/base-source/src/cumulonimbus/precipitation.ts",
      "bytes": 5993,
      "sha256": "561dace4f0ab9cbba246cefe0c14f23f5406bbabb1a5e3a00799d5d8aa08ce72"
    },
    {
      "path": "/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle30/base-source/src/cumulonimbus/cloudShader.ts",
      "bytes": 15837,
      "sha256": "f9d05d60526904297a4aab1cb013b84895f928c23a49cdf984b48447fbb9e568"
    }
  ]
}
```
