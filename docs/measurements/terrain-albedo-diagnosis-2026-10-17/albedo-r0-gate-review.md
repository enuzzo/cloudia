# R0 — gate ordinary0 fallito prima di mode1

**FAIL del gate di parità completa rispetto al canonico. Mode1 non è stata provata.** Il report interno `COMPLETE_IDENTICAL_F32` significa che cached e forced-fresh della candidata coincidono fra loro; non significa che coincidano con il target ordinario canonico.

| Prova salvata | Esito |
|---|---|
| R0 cached / fresh,2474×1844 RGBA32F | Entrambi `61209ebce8def7481d6b183eb479d2c5128a649fd0c4598ed1938dddca87aee5` |
| Canonico full-target | `e4435ce3a0a45e243c19dea24e5bc1133f6db1c8fd5ca168e94e644b1c6c9045`: **diverso** |
| PNG proprietario R0 | `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`,2909134 B: uguale al canonico |
| Dodici UV storiche R0 / ciclo32 | Tutti gli ID/pixel,12 tuple RGBA numeriche e48 parole uint32 uguali; anche cached/fresh witness uguali |

Il confronto dei metadati salvati R0/canonico conferma identità esatta di camera, lighting, material, weather, qualità, output/internal/canvas,256³/128³/384, pausa/orbita e flowMode. Simulation=60,forcing/precipitation=0; i wall/owner clock differiscono. Entrambi i readback R0 hanno72992896 B packed/73169824 B restituiti. Validità e delta cache dell'audit sono coerenti: colore e shadow validi prima/dopo,+1 richiesta/submission/epoch,0 hit aggiuntivi.

**Limiti:** non sono conservati qui i due buffer raw completi da confrontare punto per punto. Il solo hash non determina canali, coordinate, conteggio, segno, massimo o distribuzione delle differenze. Il PNG identico non pone un limite numerico sulle differenze HDR/alpha del target intermedio; i12 punti coincidono ma non coprono tutti i4.562.056 pixel. Nessuna causa viene attribuita al compilatore, al `select`, ai miss o alla precisione. Il dato dimostra riproducibilità interna della candidata, non distingue la causa della divergenza dal canonico; il requisito più forte fissato prima della diagnostica non è soddisfatto.

La scelta del root di fermare R0 e preparare R1 con libreria ordinaria canonica byte-identica, shader albedo separato e owner ricreato per modalità evita di assumere la parità di una nuova pipeline ordinary0. È una proposta successiva, ancora da qualificare; non viene dedotto alcun PASS di R1 da questi dati. Helper witness e audit possono essere riusati senza cambiare selezioni.

Fonti lette, nessun nuovo rendering/GPU/modello/test/build:

- `cycle34/browser/ordinary-before-f32.json`:23533 B,SHA256 `3da5359512f02078db21e5cf48e441ffd868db81d2d1115431ff63af7e371a2a`.
- `cycle34/browser/ordinary-before-native.json`:12481 B,SHA256 `86f5cf60930ff58108778c8f11962ccdeb70611be8139f903e7659b672772b70`.
- `cycle33/browser/cache-main-sun-f32.json`:18022 B,SHA256 `1035ba718c382a2eff717220da8482ecb82a6d516566ea325aab22ff91dee867`.
- `cycle32/browser/direct-counterfactual.json`:19558 B,SHA256 `2e04bc7fb451fbe0dc172046b64d6124bd2b0f80ff728be0df80a9b206ebcdb7`; confronto con `liveRGBA/liveFloat32Bits`, non con nuove selezioni.
