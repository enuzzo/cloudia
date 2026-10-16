# Confronto con la cattura browser reale

**Il gradiente largo previsto dal modello CPU è presente anche nella cattura. Non emerge un grande errore di stato, orientamento o pipeline capace di spiegare la mancanza di struttura locale.** Questo confronto sostiene la diagnosi precedente; non approva la qualità fotografica e non è una prova sui pixel nativi float.

Immagine: `docs/measurements/solar-continuity-2026-10-16/browser/solar-day-left-near.jpg`, 1280×720, JPEG RGB/JFIF senza profilo ICC incorporato. Lo stato inteso è la stessa fixture esterna seed72/t60, Sole sinistro, target e raggio1.4795113574194039km già registrati. La corrispondenza del gradiente non dimostra da sola ogni campo dello stato; il nome e la cronologia della cattura restano parte della provenienza.

Sono stati confrontati i13UV del probe CPU. Quattro ricadono su logo, indicatore Mani, dock e controllo zoom e sono esclusi. I nove punti utilizzabili sono campionati come media e mediana di un quadrato7×7, lasciando immutata l'immagine. I rettangoli esclusi e tutti i valori sono in `jpeg-comparison.json`.

| Misura sui9punti validi | Valore |
|---|---:|
| Luminanza JPEG, scala0–255 |208.0682–231.0682 |
| Luminanza CPU, scala0–255 |208.5995–231.2284 |
| Bias JPEG−CPU |−0.1084 |
| Errore quadratico medio, radice |0.3503 |
| Massimo errore assoluto |0.6969 |
| Correlazione |0.99854 |
| Pendenza JPEG rispetto a CPU |1.00299 |

Nel centro: JPEG medio `[219.184,218.184,216.184]`, CPU `[219.433,218.442,217.661]`. Il bias per canale è circa `[-.136,-.015,-.947]`: il blu è lievemente più basso nel JPEG. Compressione/campionamento cromatico, approssimazione del cielo CPU, conversione colore e differenze rispetto all'integrazione GPU impediscono di attribuire con certezza quel piccolo scarto a una sola causa. Non emerge una differenza grande che richieda prima una correzione della pipeline.

I punti confermano soprattutto una variazione morbida da sinistra a destra; non misurano la struttura locale di tutti i pixel. Il JPEG CSS non è il framebuffer nativo2560×1440, non conserva la precisione float e non rende questo un test di identità. La qualità ravvicinata resta insufficiente: la prossima prova geometrica resta un'ipotesi da verificare mantenendo questa stessa fixture e le guardie larghe.

Riproduzione numerica: `python3 compare-jpeg.py` dalla cartella del probe, con Pillow già presente sul Mac. Lo script legge soltanto il JPEG e il JSON CPU e scrive dati numerici esterni; nessun file del prodotto o pixel dell'immagine viene modificato.
