# Trial clipping caster∩texel — design del modulo isolato

16 ottobre 2026. Baseline ciclo27 `source`/`candidate-source`: 124 file, source manifest SHA256 `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`. Questa nota e i soli nuovi `terrainShadowClip.ts`/`.test.ts` non modificano il prodotto. Il wrapper, il caster instanziato e l’eventuale GPU restano al root.

## API

`TERRAIN_SHADOW_CLIP_WGSL` inizia con la funzione float `terrainShadowClippedMinimum(aUVQ,bUVQ,cUVQ,screenPixel,mapSize,baselineMinimum) -> f32`, per il parser WGSLNodeFunction di Three186. Ogni UVQ è vec3(UV normalizzato,q in km), screenPixel è vec2(screenCoordinate.xy) dell’effettivo shadow target e mapSize è vec2 delle sue dimensioni. Il baseline va calcolato dal wrapper PRIMA di ogni branch/loop: il modulo non contiene derivate, texture sampling, discard o frag_depth.

La funzione interna `terrainShadowClipResult` restituisce struct `{minimum:f32, valid:u32, count:u32, reason:u32}`. Reason: 0 valido, 1 input non finito, 2 target/indirizzo invalido, 3 geometria degenerata, 4 intersezione vuota, 5 capacità superata, 6 aritmetica non finita/incrocio invalido. Tutti i fallback restituiscono il baseline ricevuto; non sostituiscono il valore con lit/clear. Un baseline non finito rimane tale e viene segnalato, senza inventare un valore valido.

Il riferimento CPU `clipTerrainShadowTexel(triangle,screenPixel,mapSize,baselineMinimum,precision='float64')` restituisce validità, minimum, count, reason e vertici locali. `float32` arrotonda esplicitamente input e operazioni scalari con Math.fround; non è un emulatore WGSL né una prova di parità GPU.

## Algoritmo e capacità

Si trasformano XY in coordinate locali `UV*mapSize-floor(screenPixel)`, preservando q. Sutherland–Hodgman taglia contro x≥0, x≤1, y≥0, y≤1. Ogni incrocio usa t=da/(da−db), interpola anche q e fissa la coordinata dell’asse al valore esatto del piano. Il minimo dell’affine sul poligono convesso è il minimo q ai suoi vertici; viene sottratto lo stesso 1m (.001km), senza un secondo bias al receiver.

Due array locali di 7 vec3 sono sufficienti in aritmetica ideale: l’intersezione di triangolo e quadrato ha al massimo 7 lati/vertici. Le quattro scansioni attraversano al massimo 3+4+5+6=18 edge; i loop WGSL sono comunque limitati a 4×7. Non si dichiara un costo di soli 12 test o un’allocazione reale di registri già qualificata.

Punti esattamente sul bordo possono essere emessi due volte. L’append sopprime duplicati XY consecutivi e il duplicato di chiusura PRIMA di un eventuale ottavo write, mantenendo il minore q se lo stesso XY ha q diversi per arrotondamento. Non usa epsilon e non espande la copertura. Il guard di capacità precede ogni write: overflow numerico inatteso torna al baseline, senza una ottava posizione o un accesso fuori array.

## Limiti f32 e selezione depth

Degenerazione significa determinante proiettato esattamente zero, meno di tre vertici o area finale esattamente zero nell’aritmetica scelta. Non è introdotta una soglia estetica/tolleranza tarata sui sei casi. Un triangolo molto sottile può essere valido Float64 e collassare f32; un determinante nonzero non certifica il suo condizionamento. Divisioni/candidate non finite e t fuori [0,1] falliscono esplicitamente. I controlli WGSL di finitezza leggono l’esponente via bitcast; la gestione reale di valori non finiti del backend rimane da qualificare, non viene promessa come diagnostica universale.

UV dei tre corner devono derivare dalle stesse matrici effettive di proiezione/view del raster, identici e flat sui tre vertici dell’istanza. Il q di corner mantiene il dot originale. screenCoordinate deve appartenere al target2048 con viewport pieno origin0; per un viewport offset diverso occorrerebbe esplicitare la conversione, non usare pixel della camera principale. Matrici f32, FMA/riassociazione e copertura edge quantizzata possono produrre una intersezione vuota o diversa vicino ai bordi. Il fallback conserva dichiaratamente il precedente minimo affine, con la sua erosione, e non prova l’assenza di tutti i mismatch non vuoti.

La geometria/winding/FrontSide, i clip positions e il depth grezzo non cambiano. Il depth seleziona sempre il caster RAW al centro; solo il colore R32F diventa il minimo della porzione di QUELLA faccia nel texel. Non scrivere il minimum in frag_depth e non selezionare il vincitore in base ai minimum.

## Evidenza e gate ancora aperti

Il CPU clipping ciclo26 sui sei record congelati mostrava tutti shadow, ma tutti avevano blocker fisico. Non basta a escludere false ombre: i nuovi controlli unoccluded del root/Rain vanno mantenuti, insieme agli artefatti e ai controlli originali. Un solo valore per texel resta incapace di rappresentare facce diverse dal caster centrale; il lookup può cadere fuori da quella faccia. Non si chiama il risultato esatta visibilità fisica multifaccia.

Test autorizzati soltanto CPU mirati e typecheck: affine noto, triangolo interno, boundary/dedup, intersezione con 7 vertici, addressing e winding, faccia positiva/occluder separato, empty/degenerate/nonfinite e collasso grazing f32. Il test del testo WGSL protegge il contratto parser/derivate, non compila uno shader GPU. Servono ancora WGSL effettivo compilato, raw-depth/corner correspondence, conteggi fallback, confronti nativi artistici con controlli lit e shadow, lifecycle/storage e costo del caster nei miss/sole in transizione. Nessuna previsione FPS o adozione da questi test.

I dodici record CPU del successivo `positive-witness/clipping/result.json` sono incorporati nel test come numeri congelati, senza letture esterne o dipendenze dati nel runtime: 6 fisicamente schermati e 6 lit nel replay, nessun falso positivo/negativo per il clipping Float64 del campione. I test confronteranno il nuovo oracle Float64 e la sua variante f32 esplicita con quelle classificazioni, senza promuovere la selezione a prova globale o GPU.
