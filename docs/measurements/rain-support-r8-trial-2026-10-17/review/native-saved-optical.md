# Support R8 — verifica indipendente nativa salvata

**PASS del singolo PNG/stato fermo qualificato.** Nessuna cattura, modello, test, build, browser o GPU del reviewer. Verifica tramite lettura/hash, confronto ricorsivo e integrità PNG.

Protocollo pre-GPU ancora esatto, SHA **`ec9365c6c68d8755530daf790e0348e58dd7e1c4a980aa1a656c44d91aceef81`**. Il confronto indipendente dell’intero DTO A/B restituisce precisamente le stesse **16 righe** del raw e del confronto qualificato: le 14 differenze locali/versione/weatherTime già consentite, nuovo `supportSampling` atteso e rain CPU. Nessun altro campo diverso; non è stato assunto corretto il solo booleano PASS del qualifier.

**Support B qualificato integralmente:** `r8unorm-extracted-alpha`, r8unorm, **128³**, **2097152 B** texture ed extra nominali CPU/GPU ciascuno. Sampler dichiarato `same detailSampler; linear/repeat/mip0; explicit half-detail-texel inset clamp; NoColorSpace`, reason `rain with valid supportR8 payload`, fallback null e accounting nominale esplicito. A non contiene questo nuovo oggetto, come atteso. Non è una differenza ignorata genericamente.

Rain CPU A **0.7999999999999975**, B **0.7999999999999995**: conversione Float32 identica, word **`0x3f4ccccd`**, secondo l’esenzione fissata prima dei dati. `weatherTime` A **28.06829999999999**, B **38.31930000000003** resta l’eccezione di clock locale con scena ferma/lampi spenti. Tutti gli altri clock di rendering sono esatti: sim60, forcing/precipitazione0, flow uniform/field60 e dispersione0.

**Immagine completa e provenienza:** i due nuovi DTO dichiarano lo stesso PNG **3258221 B,2474×1844**, SHA **`6ea5e9a22052c40ebdbd223594a1a9ec2761e321410e6a009086ea8ca5972fd1`**. Riautenticato il bitmap intero salvato e il bitmap sorgente cycle46 dell’alias A; stesso digest. Verificati firma, IHDR, CRC di tutti i chunk e IEND finale senza byte residui. Alias A collega il nuovo DTO/capture al file completo rehashato; alias B collega il proprio nuovo DTO/capture al medesimo file, senza affermare un secondo trasferimento di chunk.

Metadati: ready, non regenerating, seed74/main, ultra **256³/128³/384**, canvas/output/interno **2474×1844 screen**, full flow/ablation, pausa true e orbit false. Camera/materiali/luce uguali; skyPending false, progress/blend1, flash e flashCount0, cache colore e ombra valide. Questi controlli sono stati ricontrollati oltre alle differenze raw.

Pin dei nuovi DTO: A **`9e36b16b92b8a18b53868f3664443ab70980fd747b0c5f6715cce5a1555a014d`**, B **`48f5496bda30212dcf63da624a7015a7c9386aeea6664016ae6908d1ab166717`**.

La conclusione riguarda il PNG lossless di questa sola posa/stato con input CPU qualificati. Non prova buffer lineari/HDR, Float32 uniformi letti dalla GPU, identità universale del filtro, altre pose/meteo, animazione, FPS o presentazione del compositore. La microprova precedente non estende questo ambito; il confronto prestazionale A/B/A resta separato e non viene anticipato.
