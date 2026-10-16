# Ombre v59: opzioni e prossimo contratto, sola lettura

17 ottobre2026; input prodotto dichiarato da root v59/`9ea9840`. Letti sorgenti attuali e report archiviati; ricerca breve su fonti primarie. `TerrainShadow.ts` letto: SHA256 `ed628cb7e81a77d8fe1d57ecabd7f43b8072cfee0c8959a6d2b5746965640692`. **Nessun runtime, browser, test, modello, bake o verifica massiccia eseguito. Nessuna proposta qui è già qualificata.**

## Diagnosi delimitata

In [TerrainShadow.ts:75](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/TerrainShadow.ts:75) il depth seleziona il vincitore alla posizione raster, mentre il colore salva `q−.5*(abs(dpdx(q))+abs(dpdy(q)))−.001`: un valore diverso, estrapolato sull'intero texel. Il lookup [riga84](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/src/cumulonimbus/TerrainShadow.ts:84) eleva inoltre il ricevitore di31,25m. Con2048²/128km, il texel misura62,5m. Sono approssimazioni spaziali che possono perdere ombre, non semplici errori di precisione Float32.

Il [trial per triangolo](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/TRIANGLE-SHADOW-TRIAL-2026-10-16.md) ha già respinto il minimo del solo vincitore ritagliato: CPU favorevole sui12punti, PNG con nuovi puntini/tratteggi e controesempio intrinseco con due triangoli complanari. Non lo ripropongo. Il [raffinamento v59](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/TERRAIN-SOURCE-REFINEMENT-2026-10-16.md) migliora le forme ma conserva le patch shadow; non cambia questo contratto di visibilità.

I12pixel/36raggi storici riguardano **mesh v58**. V59 ha591.788vertici/1.182.550triangoli: gli stessi UV possono servire da selezione congelata, ma receiver, caster, faceID e classificazioni vanno ricostruiti sulla v59 se un futuro audit sarà autorizzato. I dati precedenti non identificano da soli la causa di ogni macchia GPU corrente.

## Perché raw depth e PCF non bastano

Una mappa depth standard conserva la profondità del primo punto della mesh visto dalla luce. È una rappresentazione corretta **in quelle posizioni campionate**, non dell'intero texel. Esempio analitico senza run: su un piano illuminato `q=a*u+b*v+c`, con texel centrato in0 e ricevitore aδ, il confronto raw `q(δ)>=q(0)` dichiara ombra quando `a*δu+b*δv<0`: fino a metà footprint per un piano inclinato, senza blocker. Quindi **scartare il trial ingenuo raw-nearest senza offset prima della GPU**.

PCF media risultati di confronti, non profondità. Può antialiasare bordi, ma non certifica un piano auto-illuminato né recupera informazioni assenti. La correzione tramite piano del ricevitore assume continuità locale; estenderla oltre creste o su facce diverse ripeterebbe il limite già annotato nel vecchio PCF3×3. Questo è coerente con le avvertenze Microsoft su piani/texel vicini e bias eccessivi. [NVIDIA: PCF](https://developer.nvidia.com/gpugems/gpugems/part-ii-lighting-and-shadows/chapter-11-shadow-map-antialiasing), [Microsoft: campionamento e bias](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps), [Microsoft: PCF e depth bias](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps#depth-bias).

## Confronto delle rappresentazioni e costo

Payload nominali della tabella mantengono l'attuale coppia R32F+depth32; non sono RSS/residenza GPU o tempi. Un pass shadow processa la mesh v59 condivisa, senza il caster deindicizzato respinto. La cache evita il pass soltanto con input effettivamente invariati; il lookup nel pass colore resta per fragment.

| Opzione | Costo indicativo | Cosa risolve / cosa manca |
|---|---|---|
| Depth standard2048² + PCF2×2 limitato |32MiB come ora;4 confronti/fragment anziché1; un pass per invalidazione | Semantica di campioni puntuali e antialiasing definibile; self-shadow e facce multiple richiedono ancora un contratto corretto di ricevitore/footprint. Non adottabile solo perché standard. |
|4096², stessa copertura128km |31,25m/texel;128MiB, +96MiB;4×pixel da rasterizzare per aggiornamento, stessi triangoli | Riduce l'errore spaziale, non cambia la rappresentazione. Non dimostra correttezza e non elimina il controesempio del piano. |
| Due mappe2048² annidate, esempio128/64km |64MiB, +32MiB;31,25m nel quadrato interno; fino a due pass e doppio lookup solo nel raccordo | Miglior uso della risoluzione. L'esempio non è un fit approvato alle ROI. Una CSM legata alla camera aggiunge invalidazioni, seams e stabilizzazione; mappe fisse nel mondo preservano meglio la cache ma non garantiscono copertura vicino alla camera ovunque. |
|4campioni depth per texel2048² |Almeno64MiB per il solo depth multisample, più colore/resolve/owner;4 letture/confronti espliciti se si conservano i campioni | Conserva più posizioni di copertura/profondità, non tutte le facce/posizioni continue. Mediare prima il depth o replicare il colore calcolato al centro perde proprio l'informazione necessaria. |
| Copertura conservativa delle facce | Overdraw e memoria dipendono dalle sovrapposizioni; nessun costo qualificato | Essere toccato da una faccia non rende la sua profondità valida in ogni punto del texel. Un solo minimo/vincitore resta insufficiente. |

Le cascades migliorano la distribuzione dei texel, ma richiedono scelta/seams/padding e bounds stabili; non sono una prova di visibilità. Una CSM mobile deve includere anche fit/matrici della camera nella chiave cache, oggi basata su Sole/bounds/target. [Microsoft: CSM](https://learn.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps).

Copertura conservativa e profondità conservativa sono proprietà distinte: anche le API native ammettono estrapolazione e falsi positivi. Un bound utile a rilevare una possibile intersezione non va trattato come occlusione esatta. [Microsoft: conservative rasterization](https://learn.microsoft.com/en-us/windows/win32/direct3d12/conservative-rasterization), [NVIDIA: conservative depth](https://developer.nvidia.com/gpugems/gpugems2/part-v-image-oriented-computing/chapter-42-conservative-rasterization#424-conservative-depth).

## Vincoli concreti Three r186 / WGSL

- `ShadowNode.js:334–374` usa depth comparison con verso adattato al reversed depth. Il PCF stock di `ShadowFilterNode.js:34–80` usa5campioni Vogel con rotazione IGN e hardware filtering: non equivale a un PCF2×2 deterministico, né basta accendere renderer.shadowMap nel nostro WGSL personalizzato.
- `RenderTarget.js:41` documenta almeno un color attachment: non promettere16MiB totali/depth-only senza dimostrare un percorso supportato. `:194–197` dichiara che WebGPU non risolve il depth multisample: va letto come tale, non come mappa singola risolta.
- WGSL consente `textureLoad(texture_depth_multisampled_2d,…,sample_index)`; il confronto filtrato standard usa invece depth non-multisample. `textureSampleCompareLevel` evita il vincolo di uniformità del confronto implicito, ma non risolve la geometria. [WGSL corrente, texture builtins](https://www.w3.org/TR/2026/CRD-WGSL-20260921/#texture-builtin-functions).
- Non c'è un flag conservative-raster verificato nel percorso r186 o nell'API WebGPU standard consultata: non assumere la disponibilità della funzione DirectX. [GPUPrimitiveState ufficiale](https://gpuweb.github.io/types/interfaces/GPUPrimitiveState.html).

## Proposta concreta: contratto per campione prima di un nuovo trial

🌟 **Non autorizzerei un altro shader solo raw/blur/bias.** La prossima unità di progetto è una reference ridotta di **depth e ricevitore accoppiati nelle medesime posizioni**, con quattro campioni fissi conservati separatamente. Per ogni campione occorrono posizione della luce, copertura, profondità del caster e profondità del ricevitore reale; su un piano il confronto deve essere fra punti corrispondenti. Non applicare lo stesso q del ricevitore centrale a quattro posizioni diverse. Eventuali campioni che attraversano una crease richiedono la superficie effettiva o devono restare esplicitamente non risolti: non estendere il piano né sostituire l'incertezza con lit/shadow per far passare il caso.

Questo **non è ancora un'architettura runtime economica dimostrata**: conoscere il ricevitore reale nel footprint può richiedere più dati geometrici/lookup; quattro depth da soli non bastano. È il costo da chiarire prima di scegliere PCF/MSAA/cascata. Se il dato necessario non è accessibile entro il budget, la diagnosi resta negativa e si progetta una rappresentazione più completa, anziché aumentare un offset. Solo dopo quel contratto sceglierei fra mappa più fine e due mappe fisse: la prima è più semplice ma costa più memoria, le seconde conservano meglio densità locale/cache ma aggiungono raccordo e copertura da qualificare.

Falsificatori minimi futuri, da congelare prima di qualunque esecuzione: piano unico diviso in due facce, stessa geometria con triangolazione diversa, crease e blocker parziale dentro un texel; truth distinta per ciascuna posizione campionata. Un piano senza blocker non deve diventare una scacchiera o penombra; una faccia che copre solo parte del texel non può oscurarlo tutto. Dopo eventuale PASS analitico: rimappare i12UV sulla v59 e leggere separatamente q/profondità ricevitore e mappa GPU, poi native A/B Sole/Tramonto e movimento. Non usare i12point-ray come verità esatta della frazione PCF senza truth sugli stessi offsets.

Nessun bias in metri scelto a occhio: l'eventuale margine numerico va derivato/confermato sul percorso Float32 e tenuto distinto dall'errore spaziale del footprint; non è determinato da questo audit. Solo dopo il gate visivo si misurano lookup per fragment, aggiornamenti cache, target/cleanup e costo main/worker. Nessun guadagno FPS,60stabili o PASS fotografico dedotto dalle fonti. Priorità corrente Rain di root non interrotta.
