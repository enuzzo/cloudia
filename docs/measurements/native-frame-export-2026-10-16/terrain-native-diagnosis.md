# Terreno nel PNG nativo — diagnosi circoscritta, 16 ottobre 2026

**Stato: analisi e singola proposta NON IMPLEMENTATA. Nessun fix, art PASS o risultato FPS.** Sono stati letti codice, due PNG e metadati; nessun test, bake, build, GPU o browser eseguito.

## Evidenza e limite di attribuzione

I PNG Sole e Pioggia sono bitmap native 2474×1844, non JPEG della superficie CSS. I metadati hanno camera identica (confronto del record completo), seed74, t60 in pausa, growth[1,1,1], stesso Sole [-.6681265923,.7126683652,.2138005096], qualità384 e output100%. Pioggia: amount≈.8, haze2.6/overcast.85; Sole: amount0, haze1/overcast0. Entrambi sono assestati, skyPending=false e blend1. Cambiano illuminazione e trasporto atmosferico: non sono una coppia di parità radiometrica.

In entrambi si vedono piccole facce/scaglie scure sulle dorsali nel terzo sinistro. Nel Sole si distinguono meglio. Non sembrano il vecchio reticolo esteso R3; sono residui locali. L'immagine sola non dimostra che ogni scaglia sia auto-ombra errata: anche una piccola faccia realmente occultata può essere scura.

ROI **predette visivamente**, da fissare prima dell'ablazione; coordinate native con origine in alto a sinistra, rettangoli [x0,y0,x1,y1], non maschere misurate:

| ROI | Rettangolo | Predizione con solarVisibility=1 |
|---|---|---|
| L1 | [40,820,140,910] | Le due macchie triangolari sulla faccia sinistra devono schiarire se provengono dal confronto shadow. |
| L2 | [390,810,520,890] | Le sottili scaglie sotto la crestina devono perdere contrasto rispetto al pendio contiguo. |
| L3 | [860,620,970,715] | Le facce scure sulla dorsale alta, prima della nube, sono un terzo controllo; evitare pixel coperti dalla nube. |

Questa ablazione attribuisce il difetto al ramo shadow, **non certifica da sola acne**: elimina anche le ombre vere. Se le scaglie restano uguali, fermare il trial di bias e non adottare la proposta seguente.

## Causa sostenuta dal codice

`TerrainShadow.ts:84–97` sposta il ricevitore lungo il radiale terrestre di mezzo texel e usa un solo textureLoad seguito dal confronto binario height>=stored. La mappa2048 copre128km: texel62.5m, offset radiale e=31.25m. `:74–80` memorizza il minimo del piano del caster su un texel; la depth sceglie un triangolo al campione raster. Il file stesso (`:46–50`,`:162`) limita la garanzia quando più facce non complanari occupano lo stesso texel. Nearest+confronto0/1 rende visibile una piccola incongruenza come una scaglia netta.

**Difetto geometrico dimostrabile del solo offset, senza attribuzione ancora ai pixel:** sia ng la normale unitaria della faccia effettiva e r il radiale unitario. Il distacco dal piano locale vale ng·(e*r)=e*c, c=ng·r, non e. A60° dal radiale rimangono15.625m; a80° circa5.4265m. Nel fotogramma il guadagno della sola quota solare del bias radiale è circa22.2709m (e*sun.y); non è una costante di clearance rispetto a tutte le facce. Il criterio va quindi in difficoltà sui pendii senza che il valore e sia cambiato.

Le altre cause sono meno compatibili con margini triangolari netti: `terrainMesh.ts:31–52` accumula normali per area su vertici saldati; l'engine seleziona normalMode='geometry' (`GPUSceneEngine.ts:325`). A impronta pixel fissata, normali interpolate, rumori C1 e palette mixate in `terrainSurface.ts:160–197` sono continui; WorldCover è campionato per fragment con mip, non ai vertici. **Non è una prova di continuità del materiale completo:** pixelKm proviene dalle derivate del piano e può saltare fra facce; anche il LOD implicito delle cover può cambiare. Questa è un'alternativa reale, specie sulle facce radenti, che l'ablazione deve discriminare. Non esiste però nel materiale un interruttore esplicito0/1 equivalente alla shadow. Nessuna componente speculare è presente. Non ho prova di z-fighting o topologia sovrapposta in queste immagini.

## Un solo prossimo trial: completare il distacco dalla faccia

Conservare tutto il caster, la mappa, e e il lookup nearest. Cambiare **solo il punto del lookup**:

    c = clamp(dot(ng,r),0,1)
    delta = e*r + e*(1-c)*ng
    lookupPoint = point + delta

ng deve provenire dal piano del triangolo visibile (`cross(dpdx(point),dpdy(point))` normalizzato e orientato verso r), non dalla normale liscia del materiale e non dai rumori rock/canopy. UV e quota solare devono continuare a essere calcolate dallo stesso lookupPoint. Non aggiungere un offset globale a q.

Per un triangolo non degenere, in aritmetica reale, ng·delta=e e |delta|=e*sqrt(2-c²), fra31.25 e44.1942m. I piani radiali restano identici; si aggiunge soltanto il distacco mancante sui pendii. **Questa è una proprietà locale originale della formula, non una prova di assenza di acne in una scena multi-faccia o del corretto risultato f32.** Non elimina il problema generale del campionamento né certifica ombre di contatto.

La normale si può ottenere senza divisioni per ng·sun: derivate prima di qualsiasi branch; cross, dot(g,g), inverseSqrt(max(g²,eps)); orientamento con select. Per g² degenere, usare r come fallback senza normalizzare lo zero. eps è una protezione numerica, non un nuovo parametro artistico. Non usare la normale liscia per risparmiare le derivate: perderebbe il contratto con il piano geometrico.

**Costo strutturale esatto del trial, non tempo GPU:** zero nuove texture, zero lookup aggiuntivi (rimane1), zero draw, zero byte persistenti, zero campioni CPU del rilievo. Nel sorgente frammento: due derivate vec3, un cross, due dot se si riusa il dot di orientamento, un inverseSqrt protetto da max, scale/add vettoriali, abs/clamp/select e il coefficiente e*(1-c). Il wrapper usa già dpdx/dpdy(point) per pixelKm (`GPUSceneEngine.ts:311`), ma non assumo che il compilatore li riusi tra funzioni. Non è possibile derivare instruction count, registri o millisecondi dal solo WGSL. Nessuna previsione di guadagno FPS: è una piccola spesa ALU candidata a correggere qualità, non un'ottimizzazione dimostrata.

Rischio esplicito: su pendii il margine effettivo aumenta e può accorciare ombre vere o creare light leaks. Lo spostamento massimo44.2m non è una soglia universale di contatto perso: dipende da sole e geometria. Non aumentare ulteriormente e dopo aver visto il risultato per far passare il trial.

## Verifiche necessarie prima di qualunque adozione

1. Sullo stesso snapshot Sole, ablazione temporanea **solo** solarVisibility=1. Camera, LUT, macro/detail384, mesh, materiale, target e film invariati. Salvare PNG+metadata; guardare L1/L2/L3 e una valle con ombra grande riconoscibile. La variazione pre-atmosfera prevista è albedo*solar*.90*diffuse*(1-visibility); ambient non cambia. Pioggia come seconda verifica, non come sostituto del Sole.
2. Se la causa è nel ramo shadow: test CPU geometrici indipendenti del trial su piano inclinato60°/80°, cresta a due facce, limite di texel, occludente separato200m e caso di contatto20m dichiaratamente a rischio. Controllare finite, orientamento, fallback e UV/q dallo stesso punto; non limitarsi alla formula riscritta nel test.
3. Compilazione WGSL reale senza disabilitare derivative_uniformity, PNG nativi A/B dello snapshot e lieve rotazione camera per cercare scintillio. Rifiutare se si cancellano i dettagli scuri veri della valle, se le scaglie persistono o se compaiono aloni illuminati. Un eventuale tempo GPU richiede misura separata: non ricavarlo dal PNG né dalla conta ALU.

## Perché il resto appare liscio

Non basta questa correzione. Il DEM125m e la mesh annidata limitano i rilievi piccoli: la mesh usa passi32/64/128/256/512m e normali mediate, senza geometria di canopia. WorldCover dà frazioni di classi a125m, non una texture ottica del bosco o della roccia. Il materiale usa cinque rumori filtrati (`terrainSurface.ts:163–169`): i dettagli33/43 per km diventano quasi costanti quando l'impronta sul pendio supera circa15.15/11.63m. È un filtro deliberato, non un difetto risolvibile aumentando le ottave ovunque. Rimangono inoltre aerial perspective e, nella posa rain, la cortina. La proposta non cambia quote, frequenze, palette, classi o atmosfera e non promette fotorealismo globale.

## Fonti primarie controllate

- [WGSL §15.6.2](https://www.w3.org/TR/WGSL/#derivatives) e [§17.6](https://www.w3.org/TR/WGSL/#derivative-builtin-functions): le derivate collaborano fra invocazioni e richiedono controllo uniforme nel fragment; altrimenti il risultato è indeterminato e interviene derivative_uniformity. Calcolarle prima del branch UV fuori copertura e dei branch di normal fallback; anche il call-site deve essere uniforme. Un diagnostic disabilitato non rende valido il risultato. Questa regola è distinta dalla prova locale di delta.
- [Unity6, Light.shadowNormalBias](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Light-shadowNormalBias.html): documenta un bias legato a normale e dimensione del texel contro l'auto-ombra, con il rischio di restringere l'ombra. Unity descrive spostamento del caster: **non è la nostra formula receiver-side e non prova i suoi coefficienti**.
- [Microsoft, Common Techniques to Improve Shadow Depth Maps](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps#shadow-acne-and-erroneous-self-shadowing): distingue quantizzazione, errori di confronto e pendenze, e il compromesso fra acne e distacco dell'ombra. Il nostro R32F di quota relativa non eredita automaticamente le garanzie del depth bias descritto.

Non si ripropone il PCF3×3 con estrapolazione del ricevitore ritirato R3. Il bias R5 radiale aveva passato le viste CSS allora raccolte, non una garanzia su questa nuova coppia nativa con DEM/WorldCover.

## Provenienza dei file letti

- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle24/browser/main74-rain-terrain-native.png` — 2508514 byte; SHA256 `a913ecef59dc60d16d7362c4206de7f07c7c3f71be07a18e49076815bf43c20c`.
- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle24/browser/main74-rain-terrain-native.json` — 7024 byte; SHA256 `2718664c4f2b7abafa5a2480b4567ffaf8963058fab71059221b05e43395ddec`.
- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle24/browser/main74-sun-terrain-native.png` — 2817764 byte; SHA256 `af8877ac93db6fcd50ab3ceece43ac1a40fc7d21c41151afb3a9620ca7586be5`.
- `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle24/browser/main74-sun-terrain-native.json` — 6999 byte; SHA256 `f59d46a8b6a022f9b9a9e7e2faca1164e1d8acbfeb0aee05dbb10903f84fbbff`.
- `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/TerrainShadow.ts` — 12087 byte; SHA256 `0fa68e56eed14e400d7fb18381aac2d3a6823a5a4f28f927fa267e3d9a6d095e`.
- `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/terrainMesh.ts` — 18335 byte; SHA256 `f63dac6ea96144e7df44460f76f548068929ca6bc5c466fb49d4ee308e1697a7`.
- `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/terrainSurface.ts` — 13659 byte; SHA256 `0ff8de3514feb3714ba4e931c246d0bd339634661aa37a7d87e79f61c1ddff3f`.
- `/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/GPUSceneEngine.ts` — 74338 byte; SHA256 `7845618a1b043c07c66825c2906cf3b99ed304b1946c2df866b05c450e7a767a`.
