# Evidenze v56: spalla inward

Provenienza: source122 e826b119ff2758fa51ed04cf8748d0d40ad1ff09516fc498826466ceae3974b7,
volume c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d.
Il prodotto usa la sola componente inward; corpo e offset perpendicolare conservati.

`qualification/` conserva i45 payload evidence della qualifica finale:350/44,
9regressioni,7mutanti, scanner1024 eseguito una volta. Il manifesto completo
descrive anche source/dist esterni; non confondere la loro assenza da questo
archivio compatto con una nuova esecuzione o con un errore di hash.
`trials/` conserva i fallimenti e le alternative non adottate, inclusi R1RSSFAIL,
approachWRAPPERFAIL ed exitnull. Il suo verifier annidato verifica i dati salvati.
`rejected-visual/` spiega il rifiuto R3; `visual/` contiene i confronti della
correzione proiettata, con gli early-sky separati e i limiti luce/pixel dichiarati.
`browser/` contiene raw nativi main Sole/Pioggia e smoke worker/preview.

JPEG CSS, non framebuffer nativi. Prefissi coda completati, presentazione non
misurata, nessuno speedup causale o PASS fotografico/60FPS complessivo.
I gzip sono lossless; copy-record conserva byte/hash originali. Nessun volume
raw, sorgente completo, dist o dipendenza copiati.

Verifica stdlib, senza generare campi o avviare GPU:

    python3 verify.py
    python3 verify.py --verify-runtime /percorso/Cloudia
