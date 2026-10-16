# S2 palette R2 — formula unica prima del calcolo e della GPU

R1 non è adottata: il collasso dei quattro endpoint forestali a una sola
cromaticità ha prodotto appiattimento nel giudizio visivo root e un lieve
peggioramento nella review indipendente. R1, freeze, foto e build restano intatti.
Questa è **una sola variante R2**, autorizzata senza sweep, gain o fitting.

## Formula fissata

Y(E)=dot((.2126,.7152,.0722),E). Per classe10 il riferimento è il centroide
aritmetico con peso uguale dei quattro endpoint RGB originali; per classe30
il centroide dei due endpoint. Nessun peso derivato dal risultato o dalla scena.

1. centroid=media aritmetica RGB degli endpoint originali della classe.
2. chromRef=centroid/Y(centroid).
3. target=mediana S2 RGB/Y già congelata, rinormalizzata a Y1 esatto.
4. F=target/chromRef, divisione componente per componente.
5. raw_i=old_i*F.
6. new_i=raw_i*Y(old_i)/Y(raw_i).

Lo stesso F agisce su tutti gli endpoint della classe, senza parametri di forza.
L'ultimo fattore è scalare: conserva Y originale senza alterare i rapporti RGB.
Per qualsiasi coppia i,j sono quindi conservate le differenze
log(R_i/G_i)−log(R_j/G_j) e log(B_i/G_i)−log(B_j/G_j) in aritmetica reale.
R2 conserva la struttura cromatica relativa; non impone che la mediana renderizzata
coincida con S2, e il centroide degli endpoint già rinormalizzati può differire
leggermente dal target. Non modificare la formula per eliminare tale residuo.

## Input, modifica e prove

Base119file v54 `cycle20/cover-r2-source`, verificata integralmente contro il
manifest prima della copia. S2 classe10 N80090 e classe30 N2628; nessun colore
bare/shrub LOW_N. Palette autoriale, non albedo fisica o texture fotografica.
Solo tre righe costanti colore, un commento e rendererVersion metadata
`observatory-v55-s2-palette-r2-trial`. Nessuna modifica di CSS, normale, grain,
matte, quota, ombra, classi, lookup, pass o formula di illuminazione.

Calcolo e verifica indipendente della formula; Y su ogni endpoint e contrasti
log RGB sulle sei coppie forest e una coppia erba. Dichiarare residui f32.
Verificare119hash sorgente prima/dopo; typecheck e sette test terrainSurface;
build app e poi hero in directory esterne distinte. Node_modules già esistente,
ignore1 da verificare prima/dopo, nessuna installazione o lockfile modificato.
Nessuna GPU/browser/server da questo agent. Porta53754 riservata al root.
Qualifica visiva e FPS ancora aperte: non promuovere in base ai soli numeri.
