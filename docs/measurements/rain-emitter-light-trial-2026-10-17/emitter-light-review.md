# Review statica — trial luce emettitore

17 ottobre 2026. **PASS statico di ambito, nessun blocker residuo.** Sola lettura/diff e hash di file piccoli: nessuna esecuzione helper/test/modello/Bun/build/GPU/browser, nessun product edit. Non è qualifica artistica o FPS.

- **Helper** `rainEmitterLight.ts:19–52`: stesso sampler ideale dell'audit approvato, XYZ=(u,baseY,v), half-texel/clamp, stride4/2 e tabella5endpoint Float32. R/G sono copiati byteexact; A viene calcolata per tutti i texel, anche R0. Nessun secondo warp, massa/colore/fase/broad precalcolati. Il packet possiede soltanto RGBA16KiB e tabella80KiB, senza trattenere i grandi buffer sorgente.
- **Packing** `:60–75`: finite[0,1], mix diretto dagli endpoint immutabili, B UNORM8; massFactor resta nel fragment. Le chiavi avanzano anche dentro lo stesso bin e il ritorno true indica un cambiamento effettivo di B. Stato esatto fermo termina subito. Il primo update può legittimamente restituire false con B0: install deve comunque caricare R/G/A.
- **Install/ownership** `GPUSceneEngine.ts:289–300,669–671,915`: upload iniziale incondizionato presente; bounds calcolati ancora sul RG8 originale; packet nuovo per volume accettato e stessa texture RGBA posseduta dall'engine. Update dopo i due scalar applicati, prima del draw. Non segue intent/sky pending, camera/vento o massFactor. Release azzera il packet e dispone la sola rainTexture; la sostituzione rende il vecchio packet raccoglibile dal GC.
- **Shader** `cloudShader.ts:249–252`: trasformazioni solo sul rainy source. La seconda lookup ritorna RGBA e aggiunge le due exp previste; numero lookup invariato. Il prefisso fino a `const rainIntegrationSource=` è byte-identico al baseline: integrationSource e dipendenze dry conservati. Matter/source RG/base, attachment, evaporazione, broad v59 `.15+1.85*sheets*sheets`, streak, estinzione e integrazione non cambiano. Il costo CPU iniziale della cache esiste comunque per volume anche se dry; la promessa corretta è shader dry esatto, non zero costo complessivo.

La formula coincide col piano29: sky*.25 invariato, ambient*.28 attenuato con `.18+.82*exp(-.35*tauUp*massFactor)`, solar attenuato con `exp(-tauSun*massFactor)`, shared aerial invariato. È visibilità alla base, non shadow ray delle gocce. L'audit non uniforme ma core molto scuro non dimostra utilità visiva: darkening uniforme/pannelli restano FAIL e stop prima di worker/FPS, senza fitting ulteriore.

La prima bozza d'integrazione importava un nome tipo inesistente `RainEmitterLight`; root lo ha corretto a `RainEmitterLightPacket` prima di questa chiusura, verificato alle righe32/68. Nessuna modifica al helper richiesta.

Ho letto i cinque test helper e i nuovi contratti shader/lifecycle: polinomio affine indipendente per assi/stride, RG/A e input senza alias, mix e cache key/quantizzazione, limiti; generazione sostitutiva con stessa texture/dispose; reverse SHA rainy dopo rimozione delle sole due espressioni nuove. Non li ho eseguiti né dichiaro i loro risultati.

## File effettivamente revisionati

- `light-proposal/rainEmitterLight.ts` — 4829 B; SHA256 `fc0bac8469f8134dbc38a12b78e47bf2aa01fb4976e02d518cc2340d4a887d44`.
- `light-proposal/rainEmitterLight.test.ts` — 4881 B; SHA256 `a27c062e2681326ac76495841f98967e62fdb26aceb46eb3309d6efaf42e3329`.
- `light-proposal/README.md` — 3316 B; SHA256 `888a5da1b27734f30e8ee1be85c4fcdcc171fbb7c97c0158c02d903984121e32`.
- `light-source/src/cumulonimbus/GPUSceneEngine.ts` — 76042 B; SHA256 `55773eb8a00ff02e6f4919ebeb120315531e43512ffa0bf619d4000d5c960764`.
- `light-source/src/cumulonimbus/cloudShader.ts` — 16351 B; SHA256 `e8eca6d8d2808b4bec50a1bc9fa6b1ae64cd279e96efe6c025eb027bf34d8759`.
- `light-source/src/cumulonimbus/lifecycle.test.ts` — 71272 B; SHA256 `e98a2558bc231162eba40814a14a77a8af63349951d7909c70ac70845eeb6b3c`.
- `light-source/src/cumulonimbus/cloudShader.test.ts` — 8175 B; SHA256 `54f78f5797d0d917b1bd344bba9211701f1c2a29b8e8d2c35a416330fd67673f`.
