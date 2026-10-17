# Review statica — diagnostica materiale albedo

**Nessun blocker concreto individuato** nell'integrazione congelata letta. Nessun file sorgente modificato e nessuna esecuzione di test, build, browser o GPU da questa review. I risultati 52 mirati/516 full e APP→hero sono comunicati dal root, non eseguiti qui.

- La factory mantiene il WGSL originale per default/false. La variante true deriva dalla stessa libreria con tre sostituzioni a occorrenza unica; una firma/return/fallback assente o duplicata fallisce esplicitamente. La selezione finale uniforme conserva `ground` in modo0 e sceglie `albedo+inlandWater*coverB.w` in modo1. I termini mare, acqua interna e blend costiero rimangono; i calcoli/material noise precedenti hanno una sola copia sorgente e nessun nuovo branch prima delle derivate.
- L'Engine usa intenzionalmente la libreria diagnostica true sia in0 sia in1. Il modo compare tra i valori `cacheInputs`, nella firma di stabilità dell'audit, nei metadati del draw e nel contesto benchmark. Un toggle invalida il seriale ordinario e svuota il vecchio report: il primo audit dopo il cambio viene rifiutato finché non avviene il draw ordinario aggiornato.
- Pulsante e textarea sono controlli visibili soltanto in profile/materialAudit1. Toggle vietato con owner indisponibile, acquisizione/conversione PNG, audit/readback o benchmark attivo. In modo1 i pulsanti benchmark sono disabilitati e `startBenchmark` ha anche un guard diretto; il PNG resta disponibile perché è la prova diagnostica richiesta. Destroy disabilita il nuovo pulsante insieme agli altri controlli.
- Il witness usa i byte già packed di ciascuno dei due readback completi, dopo il digest, e conserva soltanto dodici piccoli record numerici/bit. Nessun terzo readback, clone del target, nuova texture o riferimento ai buffer full nel report. Le UV sono quelle archiviate; origine righe in alto, niente mezzo pixel aggiuntivo, offset byte rispettato. I bit restano la rappresentazione lossless per NaN/zero firmato.
- Rimangono i guard esistenti pausa/no-orbit/cielo assestato/ground/ultimo draw, stop dei frame prima di compute mentre audit busy, doppio readback sequenziale e attesa di `terrainAuditPromise` prima del rilascio GPU. La logica di ripristino delle risorse non è stata sostituita da un percorso diagnostico separato.

**Gate GPU ancora necessario:** modo0 qui significa formula ordinaria selezionata dentro una nuova libreria/pipeline diagnostica; non significa bytecode identico al v60. Prima di usare modo1 servono nella posa fissata target Float32 `e4435ce3…`, PNG proprietario `90641c32…` e le dodici tuple di bit uguali alla baseline storica; poi modo1 e ritorno0 con owner/stato coerenti. Questa review non dichiara già passati tali confronti. L'albedo diagnostica mantiene la dipendenza dei blend di bioma da quota/pendenza: una macchia residua non è automaticamente una classe geografica o prova su una singola causa del materiale.

Identità di file verificate contro il checkout v60: `terrainSurface.ts` (`0ff8de3514feb3714ba4e931c246d0bd339634661aa37a7d87e79f61c1ddff3f`), `terrainMesh.ts`, `TerrainShadow.ts`, `cloudShader.ts` e `rgba32fReadback.ts` sono byte-identici. Nessuna deduzione di identità GPU segue da ciò.

Freeze letto in `cycle34/albedo-source/src/cumulonimbus`:

| File | SHA256 |
|---|---|
| terrainMaterialDiagnostic.ts | ed11bde13898149db9c0beed1bfe23f18e3420c43712b2d1a8c55409fd724235 |
| terrainMaterialDiagnostic.test.ts | 508a80dcd8d156e410748d98da9a1d26e200d600b8487ee76a1aefc115815ddc |
| terrainMaterialWitness.ts | bfc06597edad45689e4b656133f5cb2647de237265a2684af17f9d76588d808b |
| terrainMaterialWitness.test.ts | 3814c7e7782e1c22e8fa8cc82d96da33eb6bc2ecaef8150bd13291d7ba4ee90d |
| GPUSceneEngine.ts | cf659878286ba014eded32bf1882797f63c8dabaa9986ed91e66650cf29bffe1 |
| CumulonimbusApp.ts | 9c0b63860a933203d5d1146b93c338efb7ab1bfca01c96d97279e078db63b379 |
| sceneMarkup.ts | 46e55b28e5e691525ef5ec7b0ca274fc185977ccec9813e817a503c1e3b9e715 |
| lifecycle.test.ts | ad8110092fa724e94e1cc8b7b00b793a547a5d16c0696c52e084c4e557610001 |

Una seconda lettura indipendente della factory ha concluso anch'essa senza blocker. Le prove di sorgente/test restano distinte dall'attribuzione visiva e dall'eventuale scelta artistica successiva.
