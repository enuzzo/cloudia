# Luce ravvicinata: diagnosi e controprova negativa — 16 ottobre 2026

**Il browser mostra il gradiente morbido previsto dal modello; non emerge un grande errore di pipeline. Il gate fotografico resta aperto.** La diagnosi successiva individua una perdita di risposta del carving prima del clamp, ma la sola revisione scalare provata erode anche il fronte: **non viene promossa**. Questo lavoro non modifica il prodotto.

L'[archivio verificabile](measurements/near-light-causality-2026-10-16/README.md) conserva il modello CPU, una cattura browser con nove campioni validi, sorgenti e dati compressi, confronto numerico e replay autonomo del controfattuale. La baseline dei sorgenti è congelata a `08c33cb`; questa è una diagnosi di quella fixture, non una verifica delle modifiche successive.

## Camera esterna e scala osservata

La fixture usa seed 72, t60 in pausa, Sole sinistro, vento 55%, dispersione/pioggia/lampi zero, yaw/pitch zero, avvicinamento 100%. Il target è `[-.28995623264629566,2.4981598424383944,-.02734375]`; `surface=1.4795113574194039` è il raggio dal target, non la clearance.

Il primo materiale centrale arriva **103 m davanti alla camera**. Il FOV è circa 32° verticale e 54° orizzontale: inquadra circa 105×59 m alla prima densità e 205×115 m alla distanza media di contributo ottico, 201 m. Nei 13 raggi campionati il primo materiale arriva fra 103 e 123 m; tutti diventano opachi dentro il corpo. Il cache luminoso conserva variazione: non è un campo costante.

La sessione era configurata per macro 256³, dettaglio 128³, 384 passi e output nativo 2560×1440. Il JPEG è una cattura CSS **1280×720**, non un framebuffer nativo float; da solo non certifica la risoluzione interna.

## Confronto con il JPEG effettivo

Sono confrontati gli stessi 13 UV del modello. Quattro patch ricadono su logo, indicatore Mani, dock e zoom e vengono escluse: rimangono **nove campioni di una sola immagine**, ciascuno come media di 7×7 pixel.

| Misura sui nove campioni | Risultato, scala RGB 0–255 |
| --- | ---: |
| Intervallo nel JPEG | 208,068–231,068 |
| Intervallo previsto dalla CPU | 208,599–231,228 |
| Bias JPEG−CPU | −0,108 |
| RMSE | 0,350 |
| Massimo errore assoluto | 0,697 |
| Correlazione | 0,99854 |

La misura usa RGB sRGB pesati, non luminanza fisica in nit. Il centro JPEG vale circa `[219,184;218,184;216,184]`, contro `[219,433;218,442;217,661]` del modello. Il piccolo bias blu non è attribuito a una causa unica: JPEG, campionamento cromatico e approssimazioni CPU impediscono una pretesa d'identità dei pixel.

Il gradiente largo concorda; la struttura locale richiesta rimane poco leggibile. Nel riferimento CPU la microerosione on/off cambia solo 0,10–1,18 livelli su 255; il confronto del passo adattivo con 1 m continuo cambia meno di 0,020/255. Non sono prove di tutti i pixel GPU.

## Perché aggiungere altra scala non basta

Il generatore contiene già cellule nominali da 556/222 m, rumore da 278/111 m e billow con raggi da 160–700 m. La sola proposta di un nuovo campo 100–300 m era quindi troppo generica.

La ricostruzione conserva l'ordine delle unioni e il Float32 e riproduce **252/252 byte macro** osservati. Di questi, **196 nodi** appartengono agli stencil dei 52 campioni usati nel controfattuale; gli altri 56 servono alla traccia ottica centrale. Non è una verifica dell'intero volume 256³.

Nel centro a tau1 gli otto nodi sono già nel clamp alto: il carving esistente non cambia più il loro valore fino a uscire dal plateau. La traccia centrale attribuisce il **76,53% del peso d'opacità** a stencil saturi. Il fronte sottile conserva incisioni; molta massa visibile successiva perde quella risposta. I controlli solari e il confronto JPEG non indicano un grande errore luminoso che abbia cancellato il gradiente osservato.

## Controfattuale respinto

È stata riprodotta soltanto la formula `I'=1-.5*smoothstep(.04,.28,F)`, al posto del coefficiente `.6`, mantenendo campi, rumore e soglie. Non equivale a `max(.5,I)`. Il replay ricalcola i 196 nodi e applica la stessa erosione fine alle vecchie coordinate, senza nuovo volume o bake.

Nel centro a tau1 desatura sette nodi su otto senza svuotarli: densità 0,6804→0,6078. Ma **tutti i 13 campioni appena 5 m dentro il vecchio fronte diventano vuoti**, e un raggio debole si svuota anche alle vecchie tau1/tau3. Il cambiamento non preserva la frontiera: viene conservato come risultato negativo, senza cercare altri parametri per forzare un esito favorevole.

La [diagnosi preclamp completa](measurements/near-light-causality-2026-10-16/preclamp/PRECLAMP-CAUSALITY.md) distingue questa operazione dal meso aggiunto dopo il macroR e dalla ricostruzione U/M ritirati. Il vecchio seed e la vecchia camera sono diversi: nessuna equivalenza o classificazione retroattiva viene dichiarata.

Dopo le misure FPS, i controlli della copia in repository sono stati eseguiti da `/private/tmp`: integrità PASS su 42 payload e 24 originali gzip; replay JPEG PASS su nove campioni validi e quattro esclusi, con RMSE `0,3503173476757166` e correlazione `0,9985398808608538`; replay preclamp PASS su 196 byte e 52 record. Durante il trasferimento erano state effettuate soltanto operazioni sui file per non interferire con le misure parallele; la precedente indicazione «predisposto, non rieseguito» è quindi superata. Questi controlli non cambiano l'esito negativo della revisione né chiudono il goal fotografico complessivo.
