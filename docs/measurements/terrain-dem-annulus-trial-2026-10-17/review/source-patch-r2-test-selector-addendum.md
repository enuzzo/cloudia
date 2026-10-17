# Addendum al selettore fixtureouterR2

17 ottobre2026. Review esclusivamente del diff del test, nessuna esecuzione. La prima reviewstatica non aveva rilevato questo errore del selettore, trovato dal fullsuiteR2a effettivo568PASS/1FAIL.

La vecchia condizione «tutti i corner r>=C» include due wedge interni agli angoli: tutti i vertici hanno r==C ma l’interno del triangolo ha r<C. Non sono facce exterior da preservare. La correzione richiede max(r)>C e poi asserisce ancora tutti r>=C, come il witness actual. Seleziona quindi le vere facceesterne senza attenuare l’assert sui corner né cambiare l’identitàXYZ/surface richiesta. Il resto dei test e i sorgenti runtime rimangono immutati; nessun aggiustamento delle quote o geometria.

Test nuovo SHA `57c88030300e62bf4a15e66ee896bc95666bb2d8d68643ffc149409d4bfcbf43`; helper `d27e8ed82b8e8ffab762b20d752c54e3ee5337138ad0c806b5bbc28372bb71e2` e mesh `fe04355e93aa331092e545bc4e8d4012c9e6373a66b9a9c35bc3690505d81f8e` ricontrollati immutati. Originali/logR2a conservati in `revisions/r2-before-fixture-predicate-correction/`. R1uniforme ebbe soltanto typecheck e fu superata prima dei test: il fullsuitefallito eraR2a. **Correzione del test giustificata; nessun blocker statico residuo nel delta.**
