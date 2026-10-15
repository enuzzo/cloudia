# Pioggia e terreno — prove del settimo ciclo

Prove del15 ottobre 2026, archiviate alla ripresa del16 ottobre dopo la pausa Dropbox.
Il checkpoint sorgente qualificato è ora nel commit locale `792e764`.
Questo ciclo non promuove un nuovo renderer: il prodotto conserva v40,
materiale v34, macro256³, dettaglio128³,384 passi nominali e output pieno.

## Pioggia: esclusione delle letture fuori dal supporto, ritirata

La candidata evitava il riferimento e la maschera della nube fuori dal suo box
di supporto durante i passi della pioggia. I passi pioggia restavano6m; non
riduceva il campionamento della nube dove presente. È stata provata modificando
soltanto il bundle main compilato. Il sorgente prodotto e il worker non sono
stati modificati. Il bundle originale è stato ripristinato byte per byte e le
build app e hero alla ripresa hanno rigenerato gli asset qualificati.

Il confronto valido usa main, seme72, stato60s in pausa, forcing0, vento0,55,
pioggia0,8, camera e target uguali, Massima384 e output interno3344×1882.
Le111 foglie di configurazione confrontate non mostrano differenze materiali;
la sola differenza numerica della pioggia è1,11e−16.

| Prova30s | Frame inviati/rAF al secondo | GPU: media delle somme dei pass campionati |
| --- | ---: | ---: |
| Controllo | 7,043 | 278,644ms |
| Candidata | 6,681 | 293,364ms |

La candidata misura−5,14% nella frequenza dei frame e+5,28% nel tempo GPU
riportato. Una sola coppia non dimostra una regressione causale stabile;
**non mostra alcuna accelerazione e non giustifica la promozione**. Il tempo GPU
è una misura campionata dei pass, non una misura diretta del frame presentato.
Le pose guardano verso l'alto: il solver terreno condizionato dall'intersezione
marina non viene chiamato da questi raggi e non spiega il costo osservato.

Due prove sono esplicitamente escluse: una aveva output dimezzato perché
l'override viewport impostava DPR1; l'altra aveva inclinazione diversa perché
l'incremento della tastiera dipende dall'altezza CSS. Il report nativo precedente
con CSS1672×941/DPR2 rimane un riferimento, non il controllo della coppia sopra.

L'equivalenza visiva dell'intero fotogramma **non è dimostrata**. I due file
di immagine, JPEG pur avendo estensione PNG, hanno inquadrature/crop diversi
e altezze1876/1882px. Una registrazione diagnostica della sola porzione comune
mostra differenze piccole, ma copre circa47,49% del controllo e non sostituisce
un confronto completo. Non è una prova di regressione del materiale.

## Terreno: prototipo CPU, geometria non promossa

Un prototipo esterno interseca una superficie bilineare campionata con una
gerarchia min/max e radici quadratiche nelle foglie. In324 raggi locali la
gerarchia concorda con DDA, che condivide il solver delle foglie; non è una
validazione indipendente di quel solver. I budget insufficienti sono segnalati
come irrisolti. Include un monte con distanza marina nulla.

Sul witness noto il reticolo125m differisce dal riferimento analitico di circa
7,8cm. Questo buon risultato locale non rappresenta la fedeltà globale:
su24.096 campioni l'errore massimo arriva a31,894m; col reticolo62,5m a14,327m.
La superficie campionata modifica il paesaggio e può appiattire alcune creste.
Non è implementata nel prodotto, non ha prove GPU/FPS o copertura mondiale.
La proposta di reticoli core/far richiede una scelta esplicita della geometria
e una qualificazione visiva. Per conservare l'analitico occorrono invece limiti
locali realmente conservativi: i massimi dei soli vertici non lo sono.

## Archivio riproducibile e prossimo passo

I37 file originali sono conservati in
[measurements/rain-terrain-trials-2026-10-15](measurements/rain-terrain-trials-2026-10-15/archive-manifest.json),
con SHA256 e dimensioni. Comprendono report validi/esclusi, immagini originali,
review indipendente, patch e bundle base/candidato, ripristino, script e
qualificazione CPU. I percorsi assoluti interni ai report sono storici.

La nuova ipotesi è riutilizzare un intervallo di densità nube certificata zero
dalla maschera conservativa, continuando a campionare la pioggia ogni6m e la
nube occupata a ogni passo originale. È distinta dal box globale ritirato.
Prima di applicarla servono prova del margine continuo e limiti durante la
formazione; poi confronto browser identico e misura sostenuta. Nessun guadagno
FPS è già acquisito. Restano tutti i gate di anatomia, luce, virga/paesaggio e UI.
