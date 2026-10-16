# Raffinamento statico locale della mesh DEM — fattibilità v58

**Fattibile, ma non è ancora una correzione dimostrata delle ombre.** Una passata sui soli edge originali può migliorare l'approssimazione del DEM senza T-junction o dipendenza dalla camera. Occorrono una tabella di conteggi per cella e una selezione d'errore che non venga scambiata per un certificato globale. Non trasferire qui il caster/clipping scartato: la base di questa proposta è v58 `908078042bda26471d57cb6a27d69dbec8655c3f`.

Studio di sola lettura su `cycle27/source`, manifest 124 file `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`. Nessuna implementazione, generazione mesh, campionamento DEM, test, build o GPU. I conteggi seguenti sono formule della struttura, non risultati di un nuovo run.

## Cosa rappresenta la baseline

`GPUSceneEngine.ts:247–249,325` costruisce una sola mesh con il sampler DEM caricato, cellsPerSide=256, levels=9, spacing=.032 km e normalMode=geometry. Il default 128/10 del builder non è la configurazione dell'app.

| Livello / quadrato esterno | Passo delle celle |
|---|---:|
| 0, ±4.096 km | 32 m |
| 1, ±8.192 km | 64 m |
| 2, ±16.384 km | 128 m |
| 3, ±32.768 km | 256 m |
| 4, ±65.536 km | 512 m |
| 5–8, fino a ±1048.576 km | 1.024–8.192 km |

Il DEM è bilineare, senza ulteriore noise geometrico nel core: `terrainDem.ts:26–39,46–63`. Il quadrato misurato puro è |x|,|z|≤48 km; 48–64 km è il raccordo separabile con il campo procedurale. Distinguere **125 m di passo orizzontale** dai **0.125 m di quantizzazione verticale** CDM1. Il campionamento bilineare non aggiunge informazione geografica sotto il passo della sorgente.

Il builder (`terrainMesh.ts:79–118`) salda vertici per coordinata della griglia fine, genera due triangoli per cella ordinaria e cinque per le celle fan al raccordo fra livelli. Normali condivise pesate per area sono calcolate sui triangoli Float32 finali (`:31–52`). Posizioni, normali, h/coast e indici sono poi condivisi dalle strutture CPU e dalla BufferGeometry (`:207–212`); il pass shadow v58 usa la stessa geometria. Il witness già conservato dà V=465409, T=929792; non li ho rigenerati.

## Una sola trasformazione strutturale possibile

Conservare tutti i vertici originali. Dopo la triangolazione base, prima delle normali finali, valutare i midpoint degli **edge originali unici** candidati nel core. Per ogni coppia di indici ordinata min/max, una edgeMap deve registrare decisione, campione e, se marcato, il solo nuovo indice midpoint. I due triangoli adiacenti consultano la stessa decisione; nessuna decisione indipendente per lato.

Il midpoint X/Z viene arrotondato Float32 una volta, poi campionato con lo stesso TerrainSampler. La nuova Y deve essere terrainMeshSurfaceY(x,z,h), non la media delle Y; h e coast del nuovo attributo surface vengono dal medesimo campione. L'errore geometrico osservato all'edge è |Ysampler(mid)−(Ya+Yb)/2|, in km/m dichiarati: confrontare soltanto h ignorerebbe curvatura terrestre e superficie effettivamente rasterizzata. Non alterare albedo, WorldCover, luce o shader.

Ogni triangolo base legge la maschera dei tre edge e produce:

| Edge marcati | Figli | Vincolo |
|---:|---:|---|
| 0 | 1 | Tripletto originale invariato |
| 1 | 2 | Midpoint condiviso, due facce con winding originale |
| 2 | 3 | Piccolo triangolo al corner comune più quad restante; diagonale deterministica, indipendente dalla camera |
| 3 | 4 | Red split con triangolo centrale e tre corner |

Le facce green ricevono solo i midpoint già marcati dagli edge originali: **non** applicare nuovamente la selezione ai nuovi edge/figli. Questo evita una cascata e dà un limite finito. Conformità e assenza di T-junction seguono dalla decisione condivisa su ogni edge della triangolazione base, incluse le facce fan esistenti. Non ricostruire una griglia quadrata alternativa sopra i fan.

Al bordo del core occorre consentire il green split alla faccia adiacente che condivide un edge marcato. Rifiutarlo perché il suo centro è fuori dal core crea esattamente la T-junction da evitare. La selezione iniziale può restare limitata ai midpoint nel core; la conformità cambia al massimo le facce incidenti, non tutta una nuova fascia ricorsiva. La chiave min/max degli indici evita alias di coordinate arrotondate e conserva una sola posizione per edge.

## Modifiche minime e bug concreti da evitare

1. **Lookup CPU:** cellFirstIndex oggi conserva l'offset negli indici e heightAt assume `stitchEdge?5:2` (`terrainMesh.ts:99,129–147`). Dopo il raffinamento questa assunzione legge triangoli sbagliati o ne perde alcuni. Conservare il parent originale di ogni faccia e scrivere tutti i suoi figli **contigui nella cella originale**; ricostruire cellFirstIndex e aggiungere cellTriangleCount. Una sola passata dà massimo 8 figli/cella ordinaria e 20/cella fan, quindi Uint8 basta. Il buffer conteggi aggiunge 9*256²=589824 B CPU. Hole: sentinel invariato e conteggio zero.
2. **Dominio di heightAt:** resta valido scegliere i livelli/celle originali e il vicinato attuale, perché i figli sono contenuti nella proiezione XZ del triangolo padre. L'iterazione deve però usare il conteggio salvato. Non appendere tutti i figli in coda lasciando i vecchi offset. Il confronto indipendente con tutte le facce, già usato nei test `terrainMesh.test.ts:166–208`, è un oracolo appropriato per la futura estensione.
3. **Normali e materiali:** ricalcolare le normali incidenti di **tutti** i vertici dopo tutti gli split; anche i normali dei vecchi vertici cambiano quando cambiano le facce incidenti. Il percorso geometry attuale è adatto. Il percorso opzionale analytic-blend calcola il peso dalla larghezza del ring, non dal nuovo triangolo: la prima proposta va limitata a normalMode=geometry oppure quel contratto va rivisto esplicitamente. Non introdurre normali distinte per faccia che spezzino di nuovo le creste.
4. **Bounds/ownership:** aggiornare min/max e BufferGeometry bounds dopo i nuovi campioni, prima di costruire lo shadow owner. Nuovi midpoint possono scoprire una quota massima assente ai vecchi vertici. Preferire una costruzione statica completa prima del render: la cache shadow nasce già con la geometria finale. Un'eventuale modifica in-place successiva richiederebbe invalidate esplicito (`TerrainShadow.ts:155–168`), non basta cambiare i buffer dietro lo stesso owner. Dispose, render target e camera restano quelli di TerrainMesh (`:206–257`).
5. **Statistiche/costruzione:** sampleCalls non coincide più necessariamente con vertices: anche gli edge rifiutati sono stati sondati. Distinguere campioni base, probe unici, campioni riusati e nuovi vertici; non rinominare tutti i probe «vertici». La cache dei campioni evita valutazioni duplicate e decisioni differenti fra i due lati.

## Selezione minima e limite d'accuratezza

Il solo parametro artistico/geometrico da fissare prima del trial è una tolleranza verticale assoluta ε, con unità esplicite. Core e passo sorgente provengono dai metadati DEM, non da zoom, seed, FOV, Sole o FPS. La profondità massima è una passata strutturale, non un loop finché la foto piace.

Una prima eleggibilità coerente con lo scopo «256→128 m» può limitarsi agli edge con estensione XZ pari ad almeno due passi sorgente, cioè 250 m qui, e midpoint nel core. Evita di aggiungere densità ai ring già a 32/64/128 m. Non è un nuovo limite fisico della sorgente: serve a delimitare questo esperimento geometrico e deve essere dichiarato. Nel settore 32.768–48 km le celle partono da 512 m: **una passata le porta a 256 m, non a 125/128 m**. Eventuali residui restano nel report, senza un secondo raffinamento automatico.

**Errore ai midpoint ≠ errore massimo del triangolo.** Una cuspide bilineare DEM interna può non essere osservata dai tre midpoint. Esempio strutturale, coordinate locali in metri: triangolo [(0,0),(0,512),(512,512)], compatibile con la diagonale della baseline; un unico nodo DEM elevato a (125,375), con gli altri nodi a quota zero, ha supporto bilineare x∈[0,250], z∈[250,500]. Vertici e midpoint del triangolo leggono quota zero, mentre il picco è interno. La sola curvatura terrestre produce un piccolo errore distinto, non rivela l'altezza del picco. È quindi scorretto promettere |errore|≤ε sull'intera superficie dopo questa selezione. Una verifica futura deve usare punti indipendenti dai midpoint, almeno nodi DEM e interni delle facce; un campionamento finito resta un massimo osservato, non una prova continua. La geometria raffinata può anche spostare il massimo errore altrove: non basta misurare di nuovo dove è stata scelta.

## Limiti finiti di geometria e lavoro

Se M edge originali sono marcati: ΔV=M; ΔT è la somma delle maschere incidenti, quindi ≤2M (esatto 2M per edge interni). Il payload retained geometria cresce di **32M+12ΔT≤56M B**, perché ogni vertice ha posizione/normal/surface=32 B e ogni triangolo 12 B di indici. Aggiungere separatamente 589824 B CPU dei conteggi. Nessun per-frame sample o buffer nuovo necessario.

Il limite globale, puramente di sicurezza, è T'≤4T per una passata; **non è la proposta di raffinare tutta la mesh**. Con l'eleggibilità geometrica appena descritta, i soli parent candidati sono nei livelli 3/4. Da loop della griglia: ring3 ≤99840 triangoli; celle ring4 che intersecano il quadrato ±48 km ≤188²−128²=18960 celle, quindi ≤39456 triangoli incluse le 512 celle fan. Tc≤139296 è un limite analitico dei parent candidati, non il numero effettivamente marcato. Il bound prudente M≤3Tc dà ΔV≤417888, ΔT≤835776 e payload extra ≤23401728 B, prima di lookup/temporanei. È volutamente largo: edge condivisi e ε riducono il valore reale, che non è stato contato qui.

Tempo di costruzione: O(V+T+U) con U edge candidati unici, più i sample DEM e l'emissione dei figli; seconda scansione O(T') per le normali. È finito e una tantum, **non temporalmente qualificato**. Una Map JS per edge, array JS temporanei, Float64 di accumulo normali e conversione finale possono dominare il picco RAM rispetto ai soli payload. Registrare tempo/RSS reali nel futuro preflight; non dedurli dai byte GPU. Non costruire per comodità una edgeMap di tutti gli edge lontani se la selezione riguarda solo il core.

## Alternativa più semplice, con limite diverso

Se lo scopo iniziale è verificare rilievi **interni** sottocampionati, un solo vertice al baricentro di ciascun triangolo segnalato e fan di tre figli non cambia alcun edge esterno. Non richiede edgeMap né green split e non genera T-junction; ΔV≤K, ΔT=2K per K facce selezionate. Richiede comunque parent/cella e normali finali aggiornati. **Non** migliora la risoluzione delle lunghe creste sugli edge, può creare facce sottili e non certifica l'errore massimo. È un controllo geometrico più economico da implementare, non una soluzione equivalente al raffinamento degli edge.

Preferenza per il prossimo ciclo: prima stabilire, con dati spaziali indipendenti, se l'errore dominante riguarda edge o interni delle facce nelle creste interessate. Se è sugli edge, il red/green locale è giustificabile; se è già piccolo, aggiungere triangoli non ha una base causale come correzione delle ombre. Il controesempio multifaccia del caster non viene risolto automaticamente da una mesh più fine: possono comparire più facce per texel shadow. Nessun PASS FPS o fotografico deriva da questa fattibilità.

## Minimo di test futuro, non eseguito

Otto maschere di split e permutazioni di winding; edge condivisi ordinari/fan con un lato solo inizialmente eleggibile; zero edge aperti interni, nessun vertice nell'interno di un edge non spezzato, Euler del disco preservato; affine e DEM con picco interno che falsifichi il solo midpoint; heightAt contro facce brute-force su figli/seam; h/coast del midpoint coerenti e zero resampling nel lookup; normali condivise finite con Y positiva; limiti M/ΔT/bytes e opzione disattiva byte-identica. Poi, separatamente, nativa alla stessa posa e misure di costruzione/FPS. Non allentare i vecchi contratti per accomodare nuovi numeri senza spiegare il nuovo dominio.

Fonti congelate SHA256: terrainMesh.ts `f63dac6ea96144e7df44460f76f548068929ca6bc5c466fb49d4ee308e1697a7`; terrainDem.ts `335dfde27717448fa58b7e8d26fc4ce684a1d42ed6ead007f36fb345fe9dd386`; terrainSurface.ts `0ff8de3514feb3714ba4e931c246d0bd339634661aa37a7d87e79f61c1ddff3f`; GPUSceneEngine.ts `7fde13a8da2a4f1035915ef64ecc3b663d4213ec471596534faf4432bdb44ce0`.
