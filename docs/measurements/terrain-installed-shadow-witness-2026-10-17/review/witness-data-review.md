# Review dati — witness installato v59

17 ottobre2026. Sola lettura del JSON e aritmetica sui valori salvati; nessun raggio, test, modello, build, browser/GPU o product edit. Input `browser/installed-shadow-witness.json`,62.341B, SHA256 `ec3187ebc895e0aed4e3bd723d995e0196aa2825fa3167ea4e03c78898348d43`.

**Fatto circoscritto:** i12 confronti di segno CPU e R32F concordano agli indirizzi scelti dalla CPU. Sulla mesh v59 attuale i riferimenti fisici sono5schermati/7non schermati: il confronto ibrido rileva1dei5blocker e ne perde4. Nessuna falsa ombra ai12indirizzi selezionati. Non è ancora la visibility del vero fragment GPU né una spiegazione degli RGB scuri.

## Tabella compatta

B=blocker DoubleSide presente fra ricevitore+1cm e20km; U=nessun blocker e raggio oltre il massimoY dell'intera mesh. CPU=confronto del riferimento affine centrale. La colonna GPU è **R32F reale in km / confronto ibrido con qlookup CPU**. Margine=`1000*(qlookupCPU−R32F)`: negativo=ombra. Tutti i12fade di copertura sono0. Δ=`1000*(R32F−qminCPU)`.

| ID storico | Classe mesh attuale | CPU | GPU @ indirizzo CPU: km / confronto | Margine m | Δ GPU−CPU m |
|---|---|---|---|---:|---:|
| L1-artifact | B | ombra | 15.648098 / ombra | -138.060 | -0.305 |
| L1-control | B | luce | 14.886384 / luce | +634.224 | +26.981 |
| L2-artifact | U | luce | 14.378764 / luce | +190.080 | -27.967 |
| L2-control | B | luce | 13.630920 / luce | +1018.737 | +3.933 |
| L3-artifact | B | luce | 17.894213 / luce | +800.594 | -0.337 |
| L3-control | B | luce | 17.894213 / luce | +875.041 | -0.337 |
| C1-ocean | U | luce | 4.892080 / luce | +77.137 | -0.029 |
| C2-coastal-lowland | U | luce | 9.002164 / luce | +82.427 | -0.016 |
| C3-plain | U | luce | 12.808914 / luce | +75.114 | -0.067 |
| C4-ridge-L1 | U | luce | 16.091894 / luce | +222.520 | -0.363 |
| C5-ridge-L2 | U | luce | 15.926682 / luce | +116.298 | +25.766 |
| C6-ridge-L3 | U | luce | 20.586792 / luce | +160.334 | -3.625 |

## Fatti e limiti decisivi

-36raggi,12record completi, nessun miss/clip unsafe e11texel distinti. L3-artifact/L3-control condividono `[883,1302]`, ma hanno qlookup e blocker diversi. Cache valida, submissions1→1/epoch0; questo campione non presenta una ricottura concorrente del target. CPU elapsed salvato2273.6ms, intera azione2277.6ms, dentro40s osservati; non sono CPUusage, RSS o FPS.
-Il massimo |Δ| è27.967254m su L2-artifact; quindi non c'è parità numerica perfetta fra piano CPU e valore raster. Il margine assoluto più piccolo è75.114471m (C3-plain) e tutti i12segni restano uguali. Non attribuisco il delta a una causa specifica: mancano casterID e receiver/address effettivi del fragment GPU.
-L2-artifact è ora U, non B. Gli ID, i vecchi RGB e i precedenti risultati6+6 non sono verità della mesh raffinata attuale. I quattro blocker non rilevati al confronto ibrido sono L1-control, L2-control, L3-artifact e L3-control; margini positivi circa634/1019/801/875m. Il solo blocker rilevato è L1-artifact (−138m).
-Il raggio fisico parte dal punto visibile CPU+1cm e va verso Sole; il confronto ombra usa invece lookup elevata radialmente31.25m e centro del texel. Non sono lo stesso raggio. La discrepanza è una perdita di ombra nel riferimento attuale, non misura diretta dell'errore di un singolo confronto co-localizzato.
-Normale geometrica e normale vertice interpolata sono salvate separatamente; entrambe differiscono dal normalWorld+rough finale. Alcuni N·sun sono negativi, ma non deduco assenza di contributo diretto finale o RGB: ambient e termini acqua/mare possono seguire altre risposte. In particolare zero false-shadow **a indirizzi CPU** non prova che le macchie native non dipendano dal ramo ombra.
-L'identità fra native prima/dopo è stata comunicata dal root; questa review non riapre immagini né ricava nuovi punti dalla fotografia. Stabilità del bitmap non certifica da sola il mapping CPU→fragment.

## Un solo prossimo esperimento proposto — NON implementato

🌟 **Leggere il vero indirizzo e confronto del ricevitore nel fragment GPU, sulle stesse12UV.** Una sola variante diagnostica del terrain pass, stessa geometria/Sole/cache e nessun coefficiente cambiato: restituire in RGBA32F `[gridU,gridV,qlookup,visibilityFinale]` usando esattamente le espressioni live del receiver. R/G restano coordinate continue del texel prima di floor; B è q dopo lookup radiale; A è la visibility realmente applicata. Readback dei12pixel terreno, poi dei massimi12R32F a `floor(gridUV_GPU)`, senza ricercare replacement. Si può riusare temporaneamente il target terreno e ripristinare il normale draw; non richiede una nuova rappresentazione delle ombre o un nuovo target persistente.

**Falsificatore:** se address/q/visibility GPU differiscono da quelli CPU abbastanza da cambiare uno dei12confronti, il presente conteggio non descrive quei fragment: prima va localizzato quel mapping. Se coincidono e i quattro blocker restano lit, la perdita appartiene effettivamente alla rappresentazione/bias attuale per quei receiver; resta da distinguere il suo impatto RGB dalla risposta del materiale. Il nuovo debug non deve cambiare il clear/caster/target/camera per ottenere accordo; qualsiasi cambio di input invalida il confronto. Se la variante non può esporre le stesse espressioni live senza duplicarle divergendo, fermarsi e correggere il protocollo, non tarare bias.

Questo esperimento precede depth/coverage/cascate o PCF. Non riapre il winner clipping respinto, non prova che un blur o un bias diverso risolvano il difetto e non certifica costo o arte.
