# Diagnosi della luce ravvicinata — baseline08c33cb, seed72

**Aggiornamento successivo:** [PRECLAMP-CAUSALITY.md](PRECLAMP-CAUSALITY.md) verifica che la banda100–300m esiste già e corregge la proposta generica seguente. Il solo controfattuale `.6→.5` è negativo perché erode il fronte: non promuoverlo. Le misure CPU/JPEG originali restano valide.


Il confronto successivo con il JPEG browser reale è in [JPEG-COMPARISON.md](JPEG-COMPARISON.md): nove punti senza UI concordano con il modello, correlazione0,99854, RMSE0,3503/255 e bias−0,1084/255. Non emerge un grande errore di pipeline. Il gate fotografico resta aperto.

## Conclusione operativa

La camera della fixture è **esterna**, non immersa nel materiale. La quasi uniformità locale non deriva da una cache completamente piatta né da un passo di integrazione troppo largo nei campioni verificati. La scena inquadra una piccola porzione quasi continua del fronte; dopo circa100m di materiale è già otticamente spessa. Il dettaglio metrico aggiunto modifica soltanto la densità, mentre la sorgente luminosa dipende dalle cache su27–39m. In questo regime la densità fine cambia poco il colore integrato: la microerosione on/off vale appena0,10–1,18 livelli display su255 nel modello.

Il campo luce conserva un gradiente ampio, ma non genera struttura locale nuova. Il prossimo cambiamento giustificato è **geometrico**: una sola famiglia di rilievi mesoscopici coerenti con il fianco dell'updraft, indicativamente100–300m, con profondità effettiva comparabile al tratto ottico visibile; deve modificare la densità condivisa da rendering e bake, non essere rumore aggiunto solo dalla camera. Va provato nella stessa fixture esterna, senza cambiare zoom massimo, FOV o contrasto, e con guardia delle viste larghe. È un'ipotesi verificabile; non è ancora un'implementazione o un risultato fotografico. Non propongo nuovi coefficienti di fase, una cache cielo aggiuntiva, un'altra ricostruzione del trasferimento o un ritorno alla vecchia coda d'ombra locale.

## Stato e metodo

- HEAD verificato08c33cb; working tree iniziale contiene solo `node_modules 2/` non tracciato. Nessun file del prodotto modificato.
- Seed72, t60, wind.55, dispersione0, Sole sinistro, nessun lampo/pioggia; target[-.28995623264629566,2.4981598424383944,-.02734375], yaw/pitch0, approach1, radius1.4795113574194039km. Origine[-.28995623264629566,2.4981598424383944,1.4521676074194039].
- Macro256³, dettaglio128³ e flow16³ half già esistenti; verificati SHA256 e corrispondenza dei sorgenti materiali. Non sono stati rigenerati volumi, skyLUT o cache.
-13raggi: griglia3×3 ai bordi .05/.5/.95 e quattro raggi centrali .35/.65. Integrazione CPU Float64 con campioni medi ogni1m fino aT<.006 o2km; centro ripetuto0,5m. È un riferimento continuo, non il rendering WebGPU.
- Le sorgenti solare/ambiente usano la funzione attuale `atmosphereLighting`. Il fondo usa `skyRadiance` analitica per raggio, non il LUT128² effettivamente caricato. Nessun terreno: il residuo dopo la nube è inferiore allo0,6% nei raggi provati. Mapping film attuale e conversione sRGB standard separati; il default sRGB/NoToneMapping è stato verificato nel renderer Three locale. Nessuna pretesa di equivalenza ai pixel della schermata.

## Scala realmente inquadrata

FOV verticale 31.99519°, orizzontale 54.01487° a16:9; `tanFov=.2867` non cambia durante l'avvicinamento.

| Profondità assiale dal punto di vista | Impronta del rettangolo FOV |
|---|---|
| Primo materiale centrale103m |105,0×59,1m |
| Tau1 centrale207,46m |211,5×119,0m |
| Distanza media pesata per opacità201,42m |205,3×115,5m |
| Tau3 centrale355,73m |362,6×204,0m |

L'impronta è su un piano perpendicolare alla direzione centrale: non è area di una superficie curva né clearance minima. I13raggi incontrano densità tra103e123m. Tau1 arriva tra204,23e272,25m; tau5 tra465,66e656,09m. Tutti risultano opachi prima di uscire dal corpo: nella porzione esaminata non compare un bordo della nube contro il cielo. Questo è compatibile con una banca di nube localmente continua osservata da fuori; non trasforma il fallimento fotografico in PASS.

I voxel macro misurano39,06×33,20×27,34m. La trama RGB di densità principale è campionata a coordinate local*.3 e usa una griglia cellulare32: scala nominale della cella104,17m. La microerosione local*8 ha cella nominale3,906m, ma ampiezza massima.055 nell'erosione e non modifica la sorgente luminosa. La prima impronta comprende appena~2,7×1,8 voxel macro; quella media otticamente visibile~5,3×3,5. Queste scale non autorizzano una stima di risoluzione effettiva universale: la trilineare e il campo deformato contano.

## Variazione luminosa effettivamente conservata

| Misura sui13raggi | Minimo | Massimo |
|---|---:|---:|
| Densità media pesata per opacità |.40588 |.68156 |
| SunTau media pesata |.35362 |1.77879 |
| SkyTau media pesata |.37644 |5.11508 |
| Luminanza lineare integrata |.52976 |1.18463 |
| Luminanza dopo film+sRGB |.81804 |.92473 |

Il gradiente di luce è quindi presente. Sui cinque raggi centrali la luminanza lineare varia.60982–.75074 (intervallo20,91% della media), mentre dopo film+sRGB varia.84234–.87351 (intervallo3,64%; deviazione relativa1,24%). Il mapping comprime il gradiente, senza essere un nuovo difetto o una motivazione per inventare un contrasto locale.

Nel centro il contributo lineare è circa48.9% diretto, 10.5% ambiente e 40.6% termine multiplo approssimato. Sono contributi del modello attuale: cambiarne i pesi per far emergere dettagli assenti non è una correzione dimostrata.

La sorgente dello shader non dipende direttamente dalla microerosione: cache solare/zenitale, fase per raggio, colori e termine multiplo restano gli stessi. Per un mezzo con sorgente costanteS, il risultato esatto èS(1−T)+B*T, indipendentemente da come la densità distribuisce quell'opacità. QuandoTè già<.006, introdurre variazioni di densità prive di risposta luminosa sposta soprattutto il punto di accumulo. Il controllo reale microerosione on/off conferma un effetto piccolo, non solo l'identità ideale.

## Controlli che escludono le scorciatoie già tentate

- La schedulazione adattiva dello shader (min1,5m, poi t*.008) confrontata con1m continuo cambia al massimo0.01940/255 nella luminanza display dei13raggi. Jitter, salti del vuoto e aritmetica GPU non sono riprodotti: questo esclude soltanto un grande effetto del passo nel riferimento campionato.
- Dimezzare il passo centrale1m→0,5m cambia0.000463/255. Non è la prova di tutti i pixel.
- Per ciascun raggio, dal punto a tau1 ho integrato lungo il sole per8km con passo2m lo stesso materiale deformato corrente, omettendo il dettaglio dipendente dalla distanza della camera. Centro ripetuto1m: differenza tau0,00003423. La cache varia.19828–2.12094, il riferimento corrente.09775–2.18849. Al centro1.36901 contro1.38461; sui cinque punti centrali lo scarto resta piccolo. Non emerge una saturazione piatta della cache o una sorgente diversa capace da sola di spiegare la nebbia.
- Il controllo solare è diagnostico puntuale, non una nuova integrazione di tutto il rendering o un candidato di ombra locale. Il suo gradiente resta ampio: non dimostra che una ricostruzione o un cache aggiuntivo possa creare texture fotografica.

## Passo successivo e criterio di fallimento

L'intervento candidato deve dare una forma risolta alla superficie e mantenere lo stesso campo materiale nel bake. Servono sostegno/conservatività preservati e confronto dello stessoseed/t60/target/FOV103m; nessun riposizionamento verso un bordo più favorevole per dichiarare risolto il massimo avvicinamento. Se il nuovo rilievo torna a essere una ripetizione di globuli o cambia solo il rumore, va respinto anche se aumenta una metrica di contrasto. Le viste larghe delle tre famiglie restano guardie obbligatorie.

Questa diagnosi mostra dove manca il segnale utile nel modello e restringe il prossimo cambiamento; non è una verifica artistica né una prova che la qualità desiderata sia fisicamente impossibile.

## File

`near-light.json` contiene tutti i campioni e i controlli; `derived-summary.json` le quantità derivate; `probe-light.ts` e `source-snapshots/` il codice congelato. Il cache originale è referenziato per SHA, non copiato. Runtime usato: `bun --no-install probe-light.ts`; l'adattatore Three preesistente è esplicito e non installa nulla. Non sono stati usati browser, GPU, bake o file prodotto.
