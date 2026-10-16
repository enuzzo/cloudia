# Cache della shadowmap: review preventiva, sola lettura

**Proposta fattibile nel contratto attuale di Cloudia:** riusare il contenuto R32F quando mesh statica, Sole effettivo, proiezione e risorse restano identici. Non è una revisione del bias, non elimina le scaglie già note e non autorizza uno speedup atteso. Nessuna implementazione, build, test, browser o GPU eseguita in questa review.

## Dipendenze effettive

`TerrainShadow.render` costruisce il frame da Sole e AABB, imposta una camera ortografica propria e disegna la stessa scena con overrideMaterial. Il caster scrive altezza solare relativa e derivate della faccia; non usa camera utente, colore del cielo, nube, pioggia, tempo o materiale colore del terreno. `TerrainMesh` costruisce una sola mesh in world space e non ne aggiorna vertici/trasformazioni per frame. La sua render chiama prima shadow.render, poi il pass colore con camera, distanza, footprint e uniform correnti.

La cache può quindi saltare SOLO clear/draw della shadowmap. Il pass colore/distanza del terreno resta vivo e alla risoluzione richiesta, così come nube, flow, pioggia e atmosfera. Restano R32F2048²+depth32, medesima camera della luce, shader, bias e textureLoad. Nessuna risorsa GPU aggiuntiva: il target esiste già (32MiB nominali).

## Contratto e chiave minima

Prima verificare disposed e calcolare/validare `terrainShadowFrame` come oggi: una cache calda non deve nascondere Sole nullo/NaN o bounds invalidi. Aggiornare lo stato diagnostico coerentemente anche su hit.

Confrontare snapshot di numeri, non riferimenti a Vector3/Box3 mutabili: Sole/frame effettivo, sei componenti bounds e costanti che determinano radius/resolution/clear/caster. Usare uguaglianza esatta, senza epsilon; `Object.is` distingue anche±0. Aggiungere identità renderer e reversedDepthBuffer, identità/dimensioni/configurazione target, riferimenti e versioni delle texture colore/depth, più una generazione esplicita caster/contenuto. Non includere camera utente o RGB atmosferici. Cambiare output/size del target COLORE di TerrainMesh non modifica di per sé il target SHADOW fisso2048.

Un semplice `invalidate()` incrementa la generazione. Il proprietario lo deve chiamare per mutazioni future di casters, indici, trasformazioni, shader caster o scritture esterne nel target, aggiornando anche l'AABB world quando serve. La proposta non certifica una scena arbitrariamente mutabile: oggi quei casters sono immutabili. Non servono scansioni o hash dei vertici ogni frame.

**Il contenuto deve essere esclusivo del proprietario.** Un renderer.clear/copy diretto sul target pubblico può cambiarlo senza incrementare Texture.version: nessuna chiave basata solo su version lo scopre. Queste scritture richiedono invalidate esplicito; non promettere rilevamento automatico.

## Tre condizioni necessarie per non introdurre stale map

1. **Invalidare la validità prima del primo clear/draw su miss.** Se la mappaA viene cancellata durante il tentativoB e il render fallisce, tornare a SoleA non può usare la vecchia chiaveA: il contenuto non esiste più. Aggiornare la chiave soltanto a fine successo non basta se si lascia valida quella precedente.
2. **Commit solo dopo render E finally di ripristino riusciti**, acquisendo versioni delle risorse DOPO il draw. Three186 `Textures.updateRenderTarget` imposta needsUpdate al primo bind/cambio dimensioni o samples; salvare versioni pre-draw può causare un miss spurio subito dopo il warmup. Non aspettare un fence GPU a ogni hit: nello stesso device la coda conserva l'ordine dei comandi; il cold draw deve comunque essere stato emesso normalmente.
3. **Non perdere un'invalidazione durante render/ripristino.** Conservare la generazione del tentativo e fare commit solo se resta uguale. Un callback che chiama invalidate non deve essere sovrascritto dal successo finale.

`RenderTarget.setSize` emette dispose quando cambia dimensione; `RenderTarget.dispose` e `Texture.dispose` emettono eventi senza incrementare automaticamente Texture.version. Servono listener di invalidazione su target e attachment, non il solo confronto version. Se cambiano i riferimenti attachment, riallineare i listener; rimuoverli nel dispose della classe. Dispose della classe è terminale e render deve continuare a rifiutarlo.

Renderer diverso impone miss. Il solo riferimento renderer non certifica un reset del suo backend/device: in Cloudia `releaseGPU` distrugge TerrainMesh/Shadow prima del renderer, quindi l'owner nuovo parte freddo. Per un futuro reset con stesso owner occorre invalidate/epoch esplicito del contesto, oppure un'identità backend/device affidabile; non leggere metadati Three privati per simulare una garanzia universale.

## Warmup e comportamento previsto

Il primo render rimane obbligatorio: l'engine esegue già terrain+quad prima di ready e attende il validation error scope. Una cache non inizializzata non può saltare compilazione/allocation/cold draw. Se quel warmup fallisce, il lifecycle corrente rilascia l'owner. Non aggiungere un'uscita anticipata che dichiari ready senza shader qualificati.

Sole stabile: dopo il cold draw sono possibili hit. Durante una transizione solare ogni vettore effettivamente diverso richiede un draw; dopo assestamento tornano gli hit. L'intento luce in attesa non invalida finché il Sole mostrato non cambia. Camera, animazione nube, vento, pioggia e soli cambi RGB possono lasciare la mappa valida. Ground off→on può riusarla se Sole e risorse sono rimasti identici; altrimenti il primo ritorno è miss.

## Qualifica minima prima dell'adozione

- Mock del renderer: cold miss seguito da ripetizioni identiche senza clear/render, nessuna modifica allo stato del chiamante su hit. Sole diverso e bounds mutati causano miss; input invalidi continuano a generare errore anche a cache calda.
- Invalidazioni: renderer/reverse-depth, target dispose/resize, texture version/riferimento/dispose e invalidate esplicito. Simulare incremento version al primo draw: quello successivo deve essere hit. Dispose ripetuto rilascia una sola volta risorse/listener; owner nuovo è freddo.
- Fallimenti: clear, render e ripristino che lanciano non lasciano una key valida; ritorno alla vecchia chiave ridisegna. Invalidate chiamato durante il render impedisce il commit.
- Integrazione TerrainMesh: camera/output/colore cambiano con pass colore vivo, shadow riusata quando valida. La compilazione cold resta nel percorso iniziale. Il ledger deve seguire i draw/query realmente emessi, senza aspettarsi sempre gli stessi pass né sommare intervalli sovrapposti come costo esclusivo.
- Root GPU: PNG nativa del controllo live e della candidata cold/hit alla stessa camera, seed/t60/flow/Sole/output256³/128³/384. Attesa uguaglianza pixel su quel backend, inclusi gli artefatti preesistenti; differenze richiedono spiegazione, non tolleranza inventata. Poi un cambio Sole e una rotazione camera verificano che la mappa si aggiorni quando deve e il colore non congeli. Un avvio worker reale controlla l'owner separato, senza dedurre parità dall'unico main.

Solo dopo questi controlli, un A/B/A con un solo renderer attivo può misurare la cadenza e i prefissi completati a stato stabile. Nessuna stima numerica: ridurre lavoro shadow ripetuto non prova che esso domini né che60FPS siano raggiungibili. Tenere cold/transition e steady separati; non attribuire il beneficio ai vecchi pass-sum GPU non additivi.

Fonti autorevoli lette: `src/cumulonimbus/TerrainShadow.ts`, `terrainMesh.ts`, lifecycle engine iniziale/rilascio; Three locale fissato186, `core/RenderTarget.js` setSize/dispose, `textures/Texture.js` dispose/needsUpdate e `renderers/common/Textures.js` updateRenderTarget/updateTexture. La proposta conserva la qualità attuale; i limiti artistici del terreno e le scaglie della shadowmap restano aperti.
