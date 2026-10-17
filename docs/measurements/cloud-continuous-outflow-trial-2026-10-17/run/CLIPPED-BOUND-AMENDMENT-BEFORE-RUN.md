# Miglioramento del bound prima di qualunque esecuzione

R1 del helper è stato congelato, ma non eseguito. Prima di qualsiasi test, ricetta o raster candidato, root ha derivato un bound della variazione in t che usa la banda attiva anziché tutti i punti della box. Optical lo ha verificato indipendentemente in aritmetica reale; Rain prepara R2 mantenendo R1 byte-esatto. Non ci sono risultati prestazionali o immagini B che abbiano suggerito la revisione. Le catture A sono della baseline invariata.

Con `phi=m−norm(A*(p−c))`, `A=diag(m/r)`, m è un raggio affine su ciascun intervallo fra gli switch del minimo. Dove `phi>−b`, `norm((p−c)/r)<1+b/m`. La derivata soddisfa:

`|phi'| ≤ |m'| + norm(A*c') + max_i|m'−m*r_i'/r_i| * norm((p−c)/r)`.

Il numeratore `m'*r_i−m*r_i'` è costante su ciascun tratto. Un bound uniforme, indipendente dal punto p, per il kernel clippato `h=max(−b,phi)` è quindi:

`M_I = |m'| + sqrt(sum_i[(max_I(m/r_i)*|c_i'|)^2]) + (1+b/min_I(m))*max_i(|m'*r_i−m*r_i'|/min_I(r_i))`.

Il kernel clippato è assolutamente continuo in t: fuori dalla banda la derivata è zero; entrate/uscite non interrompono l'integrale del bound. Scegliere prima del raster una griglia fissa con `M_I*deltaT/2≤epsilon` delimita `0≤H−Hgrid≤epsilon`, dove H è il massimo dei kernel clippati continui e Hgrid il massimo dei campioni clippati. Entrambi rimangono1-Lipschitz nello spazio. Non si rivendica lo stesso errore F−G per valori molto negativi non clippati.

Questa modifica riguarda la certificazione e l'efficienza numerica della stessa banda/superficie, non centri, raggi, ricetta o criterio artistico. Epsilon, cap4096/256M/16MiB e risorse6CPU/10wall/384MiB rimangono fissati. Rasterizzare MAX poi una sola smooth-union.16, con omissione della banda già dimostrata irrilevante per densità/supporto. Il band a risoluzioni inferiori viene derivato conservativamente dal margine esistente, non dalla nuova immagine.

Il bound in aritmetica reale è distinto da Float64/Float32. Il helper riserva un piccolo margine ingegneristico, dichiarato nelle unità corrette; questo non è una prova formale completa di roundoff IEEE né un limite sul colore/trasmittanza. Test e misure successive devono conservare questa distinzione.
