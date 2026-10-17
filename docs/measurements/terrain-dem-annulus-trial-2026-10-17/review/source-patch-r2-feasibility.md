# R2 annulus DEM — verifica algebrica pre-review

17 ottobre2026. Sola lettura/algebra: nessuna esecuzione sorgente, sampler, modello, test, build oGPU. R2 distinta da R1uniforme, superata prima della costruzione per le regressioni near già salvate.

I=fround(128*.256), J=.125*ceil(I/.125)=32.875km, H48km; C=fround(94*.512). Retain geometria canonica rL∞<=I e>=C; fonte125m nella coronaJ..H, con due annuli conformi senza nuovi vertici interni. Proprietà/lookup della futura implementazione ancora da rivedere al suo freeze.

- FonteV=769²−525²=315736; fonteT=2*(768²−526²)=626296.
- Innerbase:215809V/430592T. Aggiungere conservativamente TUTTO il vecchio refinement126379V/252758T (non solo la parte interna).
- Outer bound conservato:231512V/460496T, come propostaR1.
- Bordo sourceinterno4*526=2104edge; bordo canonicoI4*256=1024edge, al massimo raddoppiati da una passata midpoint:2048edge. InnerannulusT<=2104+2048=4152.
- OuterannulusT<=3072+1504=4576.
- SommaV<=215809+126379+231512+315736=889436. SommaT<=430592+252758+460496+626296+4152+4576=1778870.
- Payload attributi/indici32V+12T<=49808392B: sotto1MV/2MT/64MiB. Lookup, temporanei e piccoRSS non inclusi; nessuna misura di costo o artPASS.

Nessun impedimento algebrico rispetto ai cap. Necessari nella source-review: bordiI/CactualFloat32 con ogni midpoint canonico, sourcehole correttamente escluso, entrambe le cuciture weldate e lookup legacyinner/outer più sourceannulus/CSRseam senza null nel dominio. Normali incidenti alle cuciture possono cambiare; nessuna identità shading promessa.
