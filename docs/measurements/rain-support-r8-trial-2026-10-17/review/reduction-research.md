# Ricalcolo della durata: somma sequenziale

Il renderer canonico `performance.ts` usa `values.reduce((a,b)=>a+b,0)`. Nel Python 3.14.8 locale, `sum()` sui float usa un algoritmo differente: la [documentazione primaria Python](https://docs.python.org/3.14/library/functions.html#sum) registra dal 3.12 il passaggio a un algoritmo con maggiore accuratezza e migliore commutatività.

Osservazione effettiva sul medesimo array A2 salvato: `sum(values)` restituisce 90022.30000000002, mentre il ciclo esplicito `duration=0.0; duration+=interval` restituisce esattamente 90022.3, come il renderer. Percentili, contatori e FPS sono uguali già nella prima verifica; cambia soltanto la durata di un ULP. Il verificatore corretto riproduce lo stesso ordine di operazioni JavaScript, senza tolleranza aggiunta. Primo FAIL, vecchio programma e receipt della correzione sono conservati. Nessun nuovo benchmark o cambiamento della soglia di adozione.
