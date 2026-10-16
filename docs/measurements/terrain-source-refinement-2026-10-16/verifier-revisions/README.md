# Storia del verificatore preparato

`r1/verify_saved.py.gz` conserva byte per byte la prima revisione preparata, prima dell'aggiunta dell'overlay finale v59 al pacchetto. Raw 44.729 byte, SHA256 `883ebf5fe05808f4ce0afafe08fec7388e1bcad9fe5dd517f6953d0e7a9fafb5`. Non era stata eseguita: nessuna syntax-check, verifica del package, test o replay.

Il manifest del package era ancora provvisorio, non un precedente archivio finale qualificato. Per richiesta del root l'overlay finale può essere controllato genericamente come payload/alias; la qualifica specifica finale è attestata dal file separato del root. Il verificatore alla radice mantiene il proprio scope esplicito e non esegue il modello.
