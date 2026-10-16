# Raffinamento DEM, prototipo esterno R1 — NON eseguito

Overlay di **due file esistenti** (`terrainMesh.ts`, `.test.ts`) più copia byte-identica dell'helper Solar `terrainSplitTriangle.ts`. Base immutabile: v58 `908078042bda26471d57cb6a27d69dbec8655c3f`, `cycle27/source/`, manifest124 SHA `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`. Non è una app integrata: per una futura qualifica root dovrà applicare l'overlay a una nuova copia completa di quella base e aggiungere separatamente i test del pacchetto Solar. Nessun import punta al checkout live. Nessun sorgente prodotto, Git, dipendenza o asset modificato.

**Nessun run/Bun/typecheck/test/mesh/DEM sampler/build/GPU/browser eseguito per questo prototipo.** I test sono sorgenti preparati, non risultati PASS. Il preflight completo precedente è stato eseguito una volta da root, non da questo prototipo: `geometry-preflight/run/result.json` SHA `5ae2135e94ffca23757f07ae985b01033d5fedf985971e2439b04d6033c71a27`. Esso misura il bisogno di approssimazione geometrica, senza qualificare questa implementazione o la fotografia.

## API e regola congelata

`TerrainMeshOptions.refinement` è opzionale. Richiede:

- `sourceGrid`: `minXKm`, `minZKm`, `spacingKm`, `columns`, `rows`; min riferiti ai nodi/centri, non ai bordi pixel.
- `domain`: rettangolo chiuso `minXKm/maxXKm/minZKm/maxZKm`, dentro la griglia; soltanto i nodi sorgente al suo interno selezionano facce.
- `maxErrorKm`: soglia positiva; per il trial autorizzato **.005km =5m**, scelta ingegneristica di root, non precisione certificata del DSM o requisito artistico universale.
- `limits`: massimi espliciti di probe, vertici, triangoli e byte nominali geometria. I valori per il futuro run restano da approvare prima dell'esecuzione. Non si tronca il risultato per farlo rientrare.

Per la scena corrente, il futuro chiamante userà griglia `minX=minZ=-64`, passo `.125`, `columns=rows=1025`, dominio `[-48,48]²`, `maxErrorKm=.005` e limiti approvati. Questi valori **non sono incorporati nell'algoritmo**. La modalità iniziale ammessa è soltanto `normalMode:'geometry'`.

Prima si costruisce la mesh originale. Su tutti i nodi prefissati, in ordine Z poi X, `terrainMeshHitAt` riutilizza il kernel baricentrico di `heightAt`, con gli stessi livelli/celle vicine e soglia di bordo: restituisce Y e `faceIndex` del massimo. Nessun raycast o scansione completa dei triangoli per nodo. Si marca quella faccia **originale** soltanto se `abs(Yfield-Ymesh)>.005km` e il suo massimo span X/Z è almeno il passo della griglia sorgente. Questo include le facce da128m oltre a256/512m quando il passo sorgente è125m. Non esamina i figli o aggiunge punti dopo aver visto l'esito.

Tutti e tre gli edge di ogni faccia selezionata vengono marcati. Una mappa globale di coppie di endpoint originali assegna un solo ID a ciascun midpoint condiviso: chiave intera esatta `minID*originalVertexCount+maxID`, con guard sul range di interi esatti. I vicini green usano gli stessi ID anche fuori dominio. Il midpoint X/Z viene arrotondato Float32 prima del campionamento dello **stesso TerrainSampler**; Y, h e coast derivano da quel campione. Nessun dettaglio inventato o modifica al materiale. **5m è una soglia di selezione, non un errore massimo garantito dopo la singola passata**: un nodo selettore può non coincidere con nessun nuovo midpoint.

Helper Solar 0/1/2/3 edge→1/2/3/4 figli, winding conservato. I figli restano contigui per cella originale; il piccolo array temporaneo per cella contiene al massimo60 indici. `cellFirstIndex` viene ricostruito e `cellTriangleCount:Uint8Array` esiste soltanto con opzione accesa (max20 figli/cella fan, zero nei buchi). Il lookup successivo visita gli stessi vicini, ora con il numero effettivo dei figli. Le normali condivise pesate per area vengono ricalcolate **dopo** tutti gli split.

## Preservazione, statistiche e costo dichiarato

Spento: nessun probe, nessun `cellTriangleCount`, nessuna chiave `stats.refinement`; stessa generazione di vertici/indici, stesso calcolo delle normali e stessi campi/valori delle statistiche. I test preparati verificano assenza di payload/probe e confronto spento/undefined; **non sostituiscono un futuro confronto byte indipendente con il modulo v58 originale**. La ricerca numerica di Y conserva la medesima aritmetica; la nuova API aggiunge l'identità della faccia.

Acceso: vertici/attributi originali restano prefisso invariato; si aggiungono M vertici per M edge unici. Nessuna mutazione delle primitive/sorgenti, shader, caster/clipping, materiali, receiver, cache o `GPUSceneEngine`. `TerrainMesh` continuerà a calcolare box/sfera sul buffer finale come prima; inoltre `stats.refinement.boundsKm` riporta il box delle posizioni finali. La sola espressione di reporting della classe include i byte della tabella lookup aggiuntiva.

`sampleCalls` è esplicitamente **totale** = campioni dei vertici originali + probe sorgente + campioni dei M midpoint. `refinement` separa `probeSampleCalls`, `vertexSampleCalls` e `totalSampleCalls`; include facce red/green, M, vertici/triangoli/byte aggiunti, distribuzione delle maschere, massimo figli/cella, nodi sopra soglia ed eleggibili, dominio/griglia e midpoint fuori dominio. Nessun sampler per frame.

Bound di una passata: `M<=3*Toriginal`, `Tfinal<=4*Toriginal`, `ΔV=M`, `ΔT<=2*M` sul disco conforme originale; buffer geometria extra `32*M+12*ΔT<=56*M` byte. Guard espliciti sia sul bound strutturale sia sui limiti configurati. Il ring125/128m non è raffinato indefinitamente: una sola passata128→64 può aggiungere campioni bilineari, senza creare informazione geografica sotto125m;512→256 non certifica125m.

Per la scena v58, la tabella figli CPU aggiunge `9*256²=589824B`; `maxGeometryBytes` riguarda solo posizioni/normali/surface/indici, **non** tale tabella, mappe temporanee, copie originali o picco RSS. Count e byte sono bound nominali; tempo, RSS, geometria effettiva e costo GPU non sono ancora misurati. La mappa dei midpoint viene costruita prima del controllo finale del payload; baseline, nuovi buffer e accumulo normali possono coesistere: il futuro wrapper deve misurare e applicare il gate RSS concordato.

## Test preparati e prossimo gate

Tutte le asserzioni precedenti restano. Sette nuovi casi nominali preparati: off senza payload/probe; due picchi ±X/Z mancati sui nodi sorgente e recuperati tramite midpoint; topologia edge/Euler/winding e normali contro oracolo area indipendente; lookup dei figli contro intersezione di piani di tutte le facce su mesh minuscola; esclusione delle facce più piccole del passo sorgente; invalidità/budget prima dei midpoint. L'oracolo all-face è soltanto un test piccolo, non l'algoritmo di selezione/runtime. Solar conserva separatamente i test di tutte le8 maschere.

Prima di qualunque run: review dell'overlay e del helper, freeze e gate CPU/wall/RSS espliciti di root. Poi typecheck/test mirati e confronto indipendente off-v58; un unico confronto geometrico prefissato sui medesimi nodi deve riportare miglioramenti e regressioni, non solo il count dei triangoli. Nessuna adozione sulla base dei numeri: native A/B alla stessa posa per creste/costa e nuovi pattern, e benchmark separato. Non viene ripreso il trial shadow/caster scartato.
