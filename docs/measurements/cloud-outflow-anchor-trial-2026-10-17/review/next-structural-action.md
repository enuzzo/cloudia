# Dopo il FAIL dell’outflow R1: sostituire il raccordo, non spostarlo ancora

17 ottobre 2026. **Diagnosi source-only e proposta non implementata/non autorizzata al run.** Il FAIL nativo comunicato da root resta terminale: cap frontale piatto sopra un collo scuro; grande U laterale persistente. Nessuna nuova immagine, recipe, generazione, test, GPU o taratura è stata eseguita per questa nota. Il prossimo checkpoint deve conservare il trial negativo, non partire dalla sua traslazione come nuova baseline.

## Che cosa costruisce davvero la forma

Riferimenti alla snapshot esterna `outflow-source/src/cumulonimbus/volume.ts`, SHA `3f67f044d9bfe653d60fa2daac3521f69680f98d6838b0441249c4b9a35b6eb7`; base v61 `c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`.

| Costrutto | Conseguenza geometrica supportata dal codice | Limite dell’attribuzione |
|---|---|---|
| `turret`, righe 173–197: foundation, corpo medio, neck sepolto e top sono ellissoidi distinti; due chiamate sheared a 229–232 | Le parti alte rimangono due torri autonome. Il `sharedBody` a 235–240 occupa soprattutto lo spazio basso/medio, non è un inviluppo comune delle teste. Il modello ammette deliberatamente una sella fra le celle. | Una sella/U non è di per sé un errore meteorologico; non ho attribuito i pixel del nuovo PNG a singole primitive. |
| Tre collar a 270–285, `t=[.1,.42,.78]`, espansione `sqrt(t)`, spessore verticale `.3+(cap.y-top.y)*.48` uguale per tutti | L’uscita si allarga presto in tre masse orizzontali sovrapposte, invece di possedere una sezione continua lungo il percorso. Ciascun collar riceve poi la stessa decorazione da 18 figli +72 nipoti di una massa liquida: **273 primitive complessive per i tre collar**. | L’unione liscia evita una disconnessione, ma non garantisce una silhouette priva di gradino o vita stretta. |
| Due core ice a 243 e billow/puff/streak a 295–347 | Il core prossimale ha raggi X/Y `1.45/.44`, quello distale `2.25/.36`; i puff sheared restano vicini alla quota del core e gli streaks sono molto sottili in Y. L’outflow è costruito esplicitamente come una mensola oblate. | L’incus deve allargarsi orizzontalmente: non basta dichiarare sbagliata qualsiasi parte piatta. |
| `prepareInclinedShoulder`, 393–410, e relativo helper | Il raccordo 14.1 è una singola ellissoide inclinata. La sua sezione cresce verso il centro e torna a restringersi verso entrambe le estremità. Aggiunge sostegno sotto il cap, senza sostituire collar, teste o mensola. | Il precedente miglioramento locale è documentato; non è una soluzione del profilo globale. |

La traslazione R1 cambia l’allineamento X/Z, ma conserva proprio questi raggi, quote, collar e regole di decorazione. Il suo FAIL rende debole l’ipotesi «basta spostare l’incudine sull’asse». Non prova che un unico costrutto sia responsabile di tutta la U.

**Il colore scuro del collo non è ancora una proprietà geometrica isolata.** Il campo risultante determina densità, profondità ottica e luce; materiale ice e fase dipendono anche dalla quota. Senza attribuzione del nuovo PNG non si può separare una faccia del volume in ombra da una strozzatura o dalla sovrapposizione di più masse. Cambiare solo luce/erosione non sostituisce il vuoto strutturale, ma neppure il colore da solo dimostra un vuoto.

## Una sola prossima modifica: inviluppo continuo dell’uscita matura

🌟 Ripartire dalla **v61 canonica**, senza traslazione R1. Sostituire i tre collar sheared e la spalla ellissoidale 14.1 con un unico campo di raccordo continuo fra i **tre keyframe già esistenti**: neck della cella matura, suo top e primo core ice prossimale. Non cambiare i keyframe, il corpo comune, la torre giovane, il cap distale o le loro dimensioni. È un cambio dell’operatore di composizione, non un altro lift, allineamento o aumento di raggi.

Per ogni coppia consecutiva di keyframe, interpolare linearmente centri e tre raggi:

`c(t)=(1−t)c0+t*c1`, `r(t)=(1−t)r0+t*r1`, con `0≤t≤1`.

Il campo proposto è l’inviluppo degli stessi kernel ellissoidali già usati:

`F_loft(p)=max sui due segmenti e su t { min(r(t)) * [1−length((p−c(t))/r(t))] }`.

L’intento causale è eliminare l’alternanza fra tre dischi larghi e un’ellissoide che si assottiglia all’estremità. La transizione di sezione è definita dai keyframe, senza un nuovo coefficiente di larghezza, quota, erosione o soglia artistica. Non lo chiamo SDF né inviluppo convesso esatto: con raggi anisotropi diversi quella proprietà non è implicita.

### Contratto implementabile e circoscritto

- Registrare il riferimento al neck in `turret`; nessun nuovo draw RNG. Selezionare il maturo con la stessa regola di quota già esistente, e il suo primo cap prossimale esplicitamente.
- Continuare a produrre la vecchia sequenza dei collar/figli per preservare RNG, ordine e fattori della contrazione globale. Escludere **dal raster** i tre collar e i loro 270 discendenti: lasciarli nel campo ricreerebbe le sporgenze che si vogliono sostituire. Conservare i valori necessari alla contrazione baseline, senza compensazioni per seed. Il resto del layout rimane invariato.
- Valutare il nuovo raccordo sui keyframe **già contratti**, al posto del vecchio `prepareInclinedShoulder`. I core originali possono restare nel raster: l’inviluppo include esattamente gli endpoint, quindi non serve sottrarre o abbassare il top. Le loro decorazioni locali restano quelle canoniche.
- Per ogni asse, `c(t)±r(t)` è lineare: il raccordo resta nell’AABB unione dei tre keyframe. Non introduce un nuovo soffitto o allargamento del corpo. Questo non conserva massa/integrale di densità: riempie porzioni fra gli endpoint e ritira altre porzioni dei collar.
- Ogni kernel conserva il bound di gradiente ≤1 già usato dal generatore; anche il massimo esatto di tali kernel è 1-Lipschitz. Il bake di luce, occupazione e pioggia deve usare il nuovo campo normalmente. Nessuna nuova texture o lettura per campione nel renderer; 256³/128³/384/output pieno restano invariati.
- La ricerca del massimo in `t` è lavoro CPU nuovo, **non gratuito**. Prima di implementare va scelto un valutatore con errore numerico delimitato e bounds coerenti. Tre campioni riciclati dai vecchi collar non dimostrerebbero il campo continuo; un’approssimazione adattiva senza bound non autorizza a riusare ciecamente la prova Lipschitz/prefiltro. Se il costo o il bound non sono sostenibili, questa proposta si ferma lì: niente discretizzazione estetica scelta dopo l’immagine.

È più impegnativo di cambiare due coordinate, ma è una sostituzione locale di quattro supporti con un solo raccordo semanticamente alimentato. Non richiede un framework di simulazione, nuove primitive casuali o una riscrittura delle tre famiglie.

## Perché non ripete i trial già falliti

- La rotazione delle 25 primitive prossimali cambiava una calotta già definita; R1 ne spostava l’intero sistema. Qui cambiano le sezioni occupate **fra** neck, testa e radice, mentre gli endpoint restano fermi.
- Il roof R3/R4 gonfiava corpo e relativo gruppo da 91 primitive, producendo cuscino e invasione vicino. Qui sharedBody/giovane rimangono canonici e non si alza il loro tetto.
- Il trial della torre giovane abbassata modificava la gerarchia delle teste, lasciando U/uncino. Qui non si abbassa la giovane e non la si collega al cap con un tetto comune.
- Ho letto anche il helper e il volume del vecchio plume 3: usavano capsule rastremate con uno stretch comune, ma **mantenevano il loop dei tre collar** e cambiavano colonne, cap e decorazioni di più famiglie. Questa proposta interpola i tre raggi endpoint ed elimina dal campo proprio i collar con i loro figli; conserva il resto della ricetta. La distinzione è concreta, senza trasformare il vecchio FAIL in una prova a favore.

## Limiti e verifica futura, senza nuovi gate

La sella fra **due** celle può rimanere: il raccordo maturo non deve diventare un ponte orizzontale sulla giovane solo per cancellare una U. Il rischio concreto è una nuova superficie liscia/parete allargata, o un incus che appare ancora piatto perché la mensola distale resta tale. Anche il vicino può peggiorare per maggiore occupazione locale. Nessun risultato è previsto come certo.

Qualora root autorizzi un futuro trial, riusare il piano nativo già fissato: prima 74 fronte/lato con camera mondiale e mira baseline ferme; stop se cap/collo/U non migliorano o compare parete/cuscino. Solo dopo beneficio: vicino sulla stessa camera baseline, 77/80 e identità canonici 72/73. Per congestus e multicell il nuovo ramo è assente: niente «normalizzazione» delle tre famiglie nello stesso plume. Non aggiungo soglie, nuovi gate del goal, nuove prove prestazionali o autorizzazioni implicite. Il FAIL R1 va checkpointato prima.

Letture mirate: ricetta `volume.ts`, `inclinedShoulder.ts`, `SHOULDER-CONTINUITY`, `EXPERIMENT-SECONDARY-HIERARCHY`, `EXPERIMENT-CAP-ROOT-ORIENTATION`, `EXPERIMENT-INCLINED-SHOULDER` e `EXPERIMENT-PLUME-ANATOMY`, compresi `sources/candidate-3/{morphology,volume}.ts` dell’archivio. Nessuna nuova fonte esterna è necessaria per le proprietà algebriche dichiarate; nessuna calibrazione meteorologica rivendicata.
