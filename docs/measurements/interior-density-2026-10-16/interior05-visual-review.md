# Interior .5: confronto visivo a camera fissa

**Esito: miglioramento del rilievo vicino non dimostrato; non promuoverei la variante per questa finalità sulla base del confronto.** La differenza è visibile, ma consiste soprattutto nella forma e nell'estensione delle cavità. Non la considero automaticamente una migliore lettura del volume.

Riguardate le quattro immagini locali complete: `a74-fixed60-sun.css.jpg`, `b74-fixed60-sun.css.jpg`, `a74-fixed60-sunset.css.jpg`, `b74-fixed60-sunset.css.jpg`. Nessun browser, GPU, sorgente, test o bake eseguito da questa review; unica scrittura questo documento.

Root qualifica la stessa camera effettiva per tutte4: origine `[.3515625,3.119140625,2.4401802442338285]`, target `[.3515625,3.119140625,-.0546875]`, surface `.7227685139973958`, approach `.6`, t60, vento55, flow pieno; output1920×1080, macro256³/dettaglio128³/384, cielo assestato. B usa la sola formula interior `.6→.5` con nuovo bake, oltre ai metadata versione. Questa review valuta JPEG CSS1237×922, non framebuffer nativi o valori radiometrici.

## Sole

- La cavità scura a sinistra e i suoi contorni verticali cambiano; la massa chiara centrale ha un profilo diverso e alcune separazioni sono più ampie. Anche il margine della massa scura alta cambia. È variazione morfologica riconoscibile, non una differenza indistinguibile.
- Non vedo una nuova gerarchia convincente di piccoli rigonfiamenti, fianchi e incisioni. Le zone chiare centrali/destra restano larghe e lisce; i contorni delle pieghe rimangono sfumati. Il risultato conserva l'aspetto di massa molto arrotondata e poco risolta.
- Le differenze di luminosità e di area chiara/scura non bastano a stabilire maggiore profondità o dettaglio.

## Tramonto

- B allarga/ridistribuisce le cavità: si legge soprattutto un vano scuro più ampio sul lato sinistro e una diversa separazione fra il lobo centrale e la zona scura a destra. La luce bassa rende questi cambiamenti facili da vedere.
- La separazione locale è talvolta più evidente, ma continua a essere quella fra poche masse grandi. Le superfici arancioni conservano la stessa morbidezza; non emergono rilievi fini chiaramente più leggibili. Non considero la maggiore ampiezza dei vuoti una prova di rilievo recuperato.
- Non attribuisco ai quattro stills nuovi fori passanti, distacchi globali o perdita di massa misurata: mostrano cavità, non ne certificano topologia e profondità.

## Giudizio circoscritto

Il confronto conferma che la revisione cambia il materiale visibile anche con camera invariata e bake aggiornato. **Non supera però il criterio percettivo che aveva motivato la prova:** il vicino continua a sembrare sfocato e povero di struttura risolta, sia in Sole sia in Tramonto. Le cave più grandi possono essere una preferenza di forma, ma non costituiscono qui un guadagno fotografico convincente.

Questo esito non dipende dal vincolo di preservare i vecchi punti front+5m: il cambiamento della frontiera non è, da solo, motivo di rifiuto. Il giudizio riguarda ciò che si vede nelle quattro immagini. Nessuna conclusione su altre pose/seed, camera ordinaria ricalcolata, moto, massima vicinanza, prestazioni o causa tecnica della morbidezza. Nessuna nuova ipotesi proposta.
