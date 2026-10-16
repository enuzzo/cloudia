# Ombre v59 — review statica parallela

17 ottobre2026. **Sola lettura di sorgenti/evidenze; nessun test, modello, raycast, bake, GPU o browser.** Prodotto letto a HEAD `4b281116ab9a61f41c499062bb5de9daf41e4412`. Questa nota distingue il materiale realmente attivo dalla reference CPU. Review finale del helper R2 e del hook esterno completata staticamente; gli hash letti sono riportati sotto. Nessuna esecuzione o qualifica GPU implicita.

## Cosa può e non può spiegare una macchia RGB

1. **NdotSun non è solo shadow.** `terrainSurface.ts:161,189–197` normalizza la normale interpolata dei vertici, aggiunge roughness filtrata di roccia/bosco e calcola `max(dot(n,sun),0)`. La normale di faccia del Raycaster è quella geometrica: non coincide con la normale shading. Un Ngeometric·Sun negativo o positivo non ricostruisce da solo il diretto effettivo; la normale media interpolata può attraversare le crease. La proxy skylight/valley e l'albedo WorldCover variano separatamente.
2. **Shadow attenua solo una componente.** Il materiale è, prima del blend costa, `albedo*(solar*.90*diffuse*V + ambient*1.12*skyVisibility) + inlandWater*coverB.w`. Acqua interna, mare (`:196,199`) e ambient non dipendono da V. Lungo costa il fattore land è `smoothstep(-width,width,coast)`. Quindi un pixel invariato con visibility=1 non dimostra che prima fosse illuminato: può essere mare/acqua, diffuse0, materiale scuro o un delta perso nella quantizzazione.
3. **La PNG non è il solo terrainRaster.** `cloudShader.ts:43–53,201–211` applica aerial al backdrop, poi trasmittanza nube/pioggia, film e conversione output. Il primo receiver terreno può contribuire pochissimo al pixel finale. Un'ablazione realmente isolata di V, con stato e shader verificati, attribuisce il ramo modificato; il solo confronto RGB o un raycast non lo sostituisce.

In aritmetica ideale, per la sola ablazione V→1:

```text
DeltaLterrain = landWeight * albedo * solar * .90 * diffuse * (1-V)
DeltaLpreFilm = TcloudRain * ground * Tair(distance) * DeltaLterrain
```

Tutti i coefficienti sono non negativi: la rimozione dell'ombra può solo aumentare il contributo, ma l'aumento può essere zero. Questa è una proprietà del modello, non prova bitexact GPU né validazione del colore di ogni pixel. Non normalizzare materiale/ambient per far coincidere classificazioni.

## Contratti da preservare nel witness condiviso

- Usare **geometria v59 installata**, senza buildTerrainMeshData, clone delle grandi attribute o ricampionamento DEM. V58 aveva465409vertici/929792triangoli; v59 ha591788/1182550. I vecchi12UV sono una selezione ripetibile, non i vecchi faceID né la promessa6blocked/6liberi. Conservare NO_RECEIVER/coverage/far irrisolti, senza nuovi casi adattivi.
- Camera: configureTerrainCamera, basis/aspect/tan/inspection effettivi arrotondati come il frame, pixel centre/top-origin e shift `.16*(1-inspection)`. Il raycaster near/far misura distanza lungo il raggio, il camera clip è planare: verificare il receiver entro i piani. È reference CPU, non lettura di q ricevitore GPU.
- Caster: FrontSide come il materiale shadow corrente, raggio dal Sole al **centro del texel indirizzato**, prima intersezione=max RAW q; soltanto dopo applicare al piano vincente `q-.5*(abs(dqdx)+abs(dqdy))-.001`. Non scegliere il massimo dei minimi fra facce. Top-origin: `dqdx=-dot(N,right)/dot(N,sun)*texelKm`, `dqdy=+dot(N,up)/dot(N,sun)*texelKm`.
- Receiver lookup: spostamento radiale31.25m per UV e q insieme, stesso frame Sole/AABB reale. Compare CPU `qLookup>=stored`, identico verso logico del WGSL; reverseZ seleziona il caster ma non inverte questo confronto. Fuori coverage lit e fade ultimo15% vanno registrati, non trattati come blocker fisici.
- Sole fisico: DoubleSide da receiver+1cm, ignore own/shared-near come nel precedente, far20km e flag che la sua Y finale supera tutto il boundingBox. Solo quest'ultimo rende il no-hit globale per Sole con y>0; altrimenti classificare soltanto “nessun blocker entro20km”. Un blocker nel riferimento mesh non è accuratezza DEM o verità del mondo reale.
- Separare normale geometrica, eventuale normale vertice interpolata e normale materiale: non chiamare una misura della prima NdotL shader. `normalMode:'geometry'` significa medie area-pesate dei triangoli ai vertici (`terrainMesh.ts:52–73`), non flat normal per faccia.
- Helper non deve cambiare camera/geometry/material/scene live, distruggere risorse condivise o lasciare material.side=DoubleSide. Se crea solo un Mesh/material CPU temporaneo che condivide la geometry, disporre soltanto ciò che possiede. Per transform non identità, face.normal va portata nel mondo con normal matrix o il caso va rifiutato esplicitamente.

## Limite di attribuzione da stampare nel report

Il helper produce receiver/caster/reference visibilità e un raggio fisico sulla mesh attuale. Il hook aggiunge altezza e bit R32F agli indirizzi scelti dalla reference CPU, con deduplica massima12; **non legge** q/indirizzo del ricevitore GPU, winner-ID, normale rough shader, albedo/mip reali o radiance finale. Perciò concordanza/divergenza CPU non autorizza a chiamare le macchie acne, perdita di ombra, alias o errore shader. Il dato utile è la geometria corrente più lo stored R32F effettivo a indirizzi dichiarati; non un fix, un'adozione o un nuovo bias.


## Chiusura statica R2 + owner hook

**Nessun ulteriore blocker concreto trovato per il run previsto**, dopo le due correzioni del parent. Non ho eseguito i tre test sintetici, typecheck, raycast, browser o GPU.

- Helper R2: `witness-proposal/terrainShadowWitness.ts`,19488B, SHA256 `f3c0592543529affce96832814840823f7c868bb92af7d17470d0a22226b13a3`. Test4196B, SHA256 `d790317962c9cc0ebb881aba4cfe120903a52930f21e3080e4c5c7bb7e323f29`. Caps700000vertici/1300000triangoli, position Float32 e index Uint32, bounds e sphere preesistenti richiesti. R1 conservata separatamente. Le12UV sono bloccate anche nell'ordine; nessuna sostituzione adattiva.
- Receiver/caster FrontSide e fisico DoubleSide usano soltanto il proxy locale; `finally` dispone il solo materiale posseduto. AABB, sphere e grandi array installati sono presi in prestito. Il contratto è la mesh corrente con trasformazione identità, non geometria arbitrariamente trasformata. Le normali interpolate eventualmente presenti sono etichettate come interpolazione CPU non necessariamente unitaria, distinte dalla normale di faccia e da quella rough shader.
- Il budget è cooperativo tra raggi sincroni: non preempte una singola chiamata Raycaster. R2 registra anche uno sforamento dopo l'ultimo raggio come partial, anziché chiamarlo completo. Non è un limite kernel CPU/RSS.
- Hook `GPUSceneEngine.ts:609–656`: i punti fuori coverage o incompleti privi di `pixel` sono ora esclusi da entrambe le letture e riportano value:null. `cpuComplete` richiede status completo, visited12 e soltanto righe COMPLETE/NO_RECEIVER; uno sforamento/receiver fuori safe clip resta `PARTIAL_REFERENCE_STABLE_OWNER`, non completo.
- Il readback esige Float32Array.length1 finito, registra valore+bits e deduplica gli address; validazione contro i bounds del target. Il report separa stable owner, CPU complete e scope del R32F. Nessun nuovo lookup shader o modifica della mappa shadow.
- Owner: profilo+witness, paused/sky settled, ready/visible/no regeneration, esclusione export/misure durante il job; generation/fingerprint e cache valid/submissions/epoch prima/dopo qualificano la stabilità. Le azioni che cambiano input invalidano la generazione. Il frame ordinario può continuare nei tempi asincroni: non dichiarare rAF sospeso. Release attende il job prima di disporre target/mesh. La textarea visibile proietta soltanto il reportKind previsto.

Hash dei file hook effettivamente letti (snapshot esterna, non prodotto):

| File sotto diagnostic-source/src/cumulonimbus | SHA256 |
| --- | --- |
| GPUSceneEngine.ts | d9ffe19e1bee31cb1180b52bedd818f47a79e60470a576fbdf545361fed275c0 |
| CumulonimbusApp.ts | 8cd5a991dc9c279d8d7916841943d9a635633b87f158a2ebafb57060d5ea15a1 |
| sceneMarkup.ts | e713618fa84cf75d46af51b44d6a5593267cc434085af7f935144b7cab70f5b7 |
| lifecycle.test.ts | fd3b1afc395623af3922ce998e49491a2655df83193663a557924f78d6af2655 |

La verifica statica non anticipa quali12 classificazioni produrrà il campo corrente, né PASS artistico, accuratezza DEM, frequenza globale di falsi shadow o costo FPS. La parità PNG nativa prima/dopo resta una prova distinta del draw completo.
