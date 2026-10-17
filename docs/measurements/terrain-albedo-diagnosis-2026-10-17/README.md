# Archivio diagnosi albedo,17 ottobre2026

Il prodotto resta v60/8b3a144. Source base129 e overlay R0/R1 qui salvati ricostruiscono gli esperimenti esterni, non una modifica adottata. R0 fallisce il target canonico prima del modo albedo; R1 conclude A/B/A e il confronto nativo con risultato misto.

`qualification-r0/results.json` conserva il vecchio percorso originale `qualification/*.log`; i log raw R0 sono stati spostati in questa cartella separata. `run-qualification.py` e i log `qualification/` appartengono a R1. `material-diagnostic-freeze.json` appartiene a R0; `decision-protocol.json` sostituisce il protocollo dopo il suo FAIL. L'analisi numerica R1 è stata scritta prima del ritorno A e della review visiva; l'addendum della review nativa chiude quei gate senza riscrivere la cronologia.

Il PNG B è stato trasferito interamente. Ordinary iniziale e ritorno sono metadata/alias del bitmap precedente, non un nuovo trasferimento. I ritagli sono lossless1:1 secondo `browser/roi-ledger.json`. Lo screenshot finale è UI ordinaria animata, non il canvas fisso del confronto.

`next-dem-resolution-candidate.md` è una proposta di fattibilità; il lavoro successivo è separato in cycle35. Non è prova di una mesh GLO30 o di adozione. Nessuna misuraFPS/worker/pioggia/Tramonto/moto in questa diagnosi.
