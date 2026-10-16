# Cloudia — witness sulla mesh installata e ricevitore GPU

17 ottobre 2026, ciclo35. **Diagnostica completata, nessuna nuova modifica visiva adottata. Runtime v59/9ea9840 invariato; goal attivo.** La scelta del proprietario resta geografia reale, abitati rappresentati come materiale: nessun edificio, geometria o pass aggiuntivo. Non è un nuovo A/B FPS fra costa naturale e reale.

## Risultato che cambia la prossima azione

I dodici UV storici sono stati rimappati sulla mesh v59 realmente installata. Cinque ricevitori sono schermati da un'altra faccia lungo il Sole; sette sono liberi sull'intera mesh. La GPU diagnostica restituisce un solo punto in ombra: **quattro blocker fisici della mesh non sono rilevati**, zero falsi positivi nei sette controlli liberi. È un campione fissato, non frequenza globale dei difetti né verità del terreno geografico reale. Le etichette artifact/control sono identificatori storici, non classificazioni attuali.

La sonda del ricevitore GPU conferma tutti12 gli indirizzi CPU e tutti12 i segni q>=R32F. Scarto massimo CPU/GPU: quota lookup0,029281m, distanza ricevitore0,060589m, griglia0,000664texel. È escluso nel campione un errore grossolano di proiezione/indirizzo CPU come spiegazione dei quattro blocker persi. La review numerica indipendente conferma anche gli11R32F bitidentici fra owner e un margine minimo alla soglia di75,126m: gli scarti receiver centimetrici non ribaltano quei segni. Restano ignoti il caster winner-ID GPU e la causalità delle macchie RGB.

| Punto | Verità raggi sulla mesh | Visibilità GPU | qLookup−R32F, m |
|---|---|---:|---:|
| L1-artifact | schermato |0|−138,067|
| L1-control | schermato |1|+634,211|
| L2-artifact | libero intera mesh |1|+190,095|
| L2-control | schermato |1|+1018,736|
| L3-artifact | schermato |1|+800,598|
| L3-control | schermato |1|+875,038|

Gli altri sei controlli sono liberi e restituiscono1. La misura non attribuisce automaticamente le tre coppie di macchie alle ombre: il materiale applica la visibilità soltanto alla luce diretta terrestre. Ambiente, acqua e mare hanno altre risposte; normali interpolate e dettaglio rough non coincidono con la normale geometrica CPU. Alcuni dei punti schermati sono già rivolti lontano dal Sole. RGB invariato o una normale CPU non dimostrano da soli il contributo finale.

## Primo owner: geometria installata e lettura R32F

Versione esterna diagnostic-v59-installed-shadow-witness, query profile1&witness1. Helper browser senza rebuild, letture asset o copie/hash integrali: prende in prestito position Float32 e indice Uint32 della stessa geometry associata alla mesh; model identity e bounds/sphere esistenti richiesti. 591.788 vertici,1.182.550 triangoli,3.547.650 indici. Proxy CPU possiede soltanto un piccolo materiale, mai la geometria.

12raggi receiver FrontSide +12caster FrontSide al centro texel +12raggi fisici DoubleSide; sole e camera correnti. Limite36raggi,20km,offset1cm. L'endpoint dei sette raggi liberi è sopra la quota massima dell'intera mesh, con direzione solareY positiva. Tempo esplicito CPU helper2.273,6ms, owner complessivo2.277,6ms: elapsed performance.now, non consumo CPU o RSS. Guardia40s cooperativa tra raggi sincroni, non preemption. 12/12completi, nessun receiver assente, clip insicuro o caster assente.

Lettura pubblica Three r186 di11texel unici R32F agli indirizzi CPU, Float32+bitpattern. Cache stabile valida: submission1→1,epoch0; richieste2968→2969. CPU raw-q-centre winner + minimo affine non garantisce stesso winner/copertura/derivate GPU: scarti qStored arrivano circa28m. Non attribuirli a una causa non letta.

43test mirati e439/439 in47file. Primo typecheck fallisce per inferenza letterale di clearHeightKm nel nuovo helper; sola annotazione number, poi3helper test e APP→hero/typecheck PASS. Sorgente proposta R2 originale e overlay finale distinti, nessun errore nascosto.

## Secondo owner: variante del frammento reale

Versione esterna diagnostic-v59-shadow-receiver-fragments. Il WGSL diagnostico deriva dal receiver corrente cambiando nome, tipo/return soltanto, con ancore fail-closed; stessi uniform, texture e matematica lookup. Mantiene lo shading ordinario prima dell'If uniforme. Canali diagnostici RG=coordinate continue nella griglia ombre, B=qLookup in km, A=visibilità finale. Le12copie ordinarie conservano RGB lineare +alpha distanza in km. Questo resta una **variante di frammento**, non prova di identità delle operazioni della pipeline originale.

Riusa il target RGBA32F a2474×1844, la stessa geometria/camera/offaxis/viewport. Accoda12copie1×1 ordinarie, un solo draw debug con scissorBBOX[64,610,2137,491], poi12copie debug. Prima di qualsiasi await rimette mode0, ridisegna tutto il terreno normale e ripristina target/MRT/clear/depth/autoclear/scissor. Three186 invia la copia prima del primo await mapAsync: controllato nei sorgenti locali. Busy trattiene il ciclo owner fino al drain allSettled. Anche errori draw/read drenano le copie e tentano il ripristino; release attende il job. Camera/luce/qualità/target/cache e generazione devono restare stabili; terreno disattivato rifiutato.

La review indipendente ha trovato prima della GPU una sentinella clear errata: alpha negativo premoltiplicava RGB nel backend. Corretto alpha1 e expectedRGBA esplicito[-1e6,-1e6,-1e6,1], con controllo di riconoscimento nel test. Tre test nuovi coprono derivazione WGSL e sequenza/ripristino/drain, compreso errore. R1/R2 di qualifica sono conservate; nessuna esecuzione GPU su quelle revisioni. Finale83mirati,442/442 in47file, typecheck e APP→hero PASS. Nessuna installazione, lockfile invariato; esclusione Dropbox node_modules=1 prima/dopo.

BBOX1.049.267pixel: il costo non è soltanto12pixel; un traversal completo debug e un redraw ordinario completo. Nessun nuovo target grande.24RGBA1×1 +11R32F1×1=428byte nominali restituiti, non memoria staging/driver. Sonda11,8ms, owner13,7ms elapsed con copie attese, non timestamp GPU/FPS. Cache valida submission1→1,epoch0,richieste2574→2576. Stato ripristinato,12ricevitori validi, nessuna sentinella/errore. Report integrale trasferito in parti<=16.384caratteri senza il truncation profondo delle risposte oggetto.

## Parità immagine, limiti e continuità

Prima/dopo entrambi gli owner: PNG nativo2474×1844,2.909.134byte,SHA90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d. Coincide con il bitmap v59 già completamente trasferito nell'archivio terrain-source-refinement-2026-10-16. Qui conserviamo metadata freschi e alias verificato, non fingiamo un nuovo trasferimento dei byte PNG. Seed74,t60,Sole,256³/128³/384,fullflow,stessa camera e output. Console osservata vuota. Parità per questa posa, non per ogni controllo/seed.

I due owner sono distinti: identità UUID non portabile; funzioni geometriche/assets e manifest base invariati, conteggi/camera e bitmap coincidono. Nessuna misura worker, Tramonto, pioggia, moto o FPS in questo ciclo diagnostico. L'immagine fotorealistica complessiva resta FAIL/aperta; questa verifica non è un miglioramento artistico.

Preview ordinaria4196 ripristinata: Sole animato, output/interno2474×1844,384passi,256³/128³,console vuota. Screenshot UI salvato; valori live rAF/GPU sono singoli segnali, non benchmark. Server diagnostici53771/session66326 e53772/session36843 chiusi intenzionalmente, exit0.4201 e node_modules2/ estranei preservati.126sorgenti prodotto byte-identici al manifest fb6c231918e7a825f5b1a407efcd98aaacf5cca352c60cbdcdb9b5271a913ff2. Nessun push/deploy.

**Prossimo esperimento discriminante:** stesso terreno/camera/pixel, confrontare contributo diretto con visibilità ordinaria e forzata1 nel materiale GPU. Se la differenza è nulla o piccola nelle patch, spostare la correzione su normali/materiali; se sostanziale, qualificare un cambiamento ombre contro questi witness. La review propone anche una sonda caster-plane per separare qRaw e derivate: è conservata come ricerca successiva; prima viene il contributo RGB delle ombre alla richiesta visiva. Nessun nuovo bias arbitrario, raw-nearest/PCF ingenuo o fitting pioggia. Non usare la proposta come implementazione già verificata. Anatomia/vicino, pioggia/virga, paesaggio/UI e60FPS restano aperti.

Archivio di sorgenti overlay, metadata/JSON integrali, review e qualifica: [terrain-installed-shadow-witness-2026-10-17](measurements/terrain-installed-shadow-witness-2026-10-17/manifest.json). Source/dist completi esterni in /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle31. La verifica del pacchetto riguarda soltanto evidenze salvate e parità dei sorgenti; nessun replay del modello o benchmark.
