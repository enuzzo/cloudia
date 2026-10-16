# Guardia del bordo — modello non promosso

La guardia risulta coerente nei vicinati campionati, ma conserva soltanto 12 dei 55 cambiamenti proposti e quasi annulla l'effetto nei nove UV di interesse. Il root ha deciso di non avviare un'app candidata. Nessuna immagine, misura FPS o prova GPU è stata prodotta da questo esperimento.

Il resoconto principale è [EXPERIMENT-NEAR-BOUNDARY-GUARD-2026-10-16.md](../../EXPERIMENT-NEAR-BOUNDARY-GUARD-2026-10-16.md). Si conserva la selezione locale, non un certificato della frontiera dell'intero volume.

## Originali preservati

- `provenance-original.tar.gz`: pacchetto congelato di provenienza cross-runtime, con 17 payload più manifest originale. Include i quattro output del prefisso geometrico, estratti dei vecchi metadata e trace 10493, differenze complete, sorgenti lossless, script e rapporto. Manifest interno SHA256 `9a8b921030f7f44cf92fc51ac056742acf9937da11890509457a9c982ae0b806`.
- `guard-original.tar.gz`: pacchetto congelato della guardia, con 7 payload più manifest originale: 461 nodi, risultati, codice del probe e dell'analisi, report e decisione. Manifest interno SHA256 `7312a600dbcffcdab9da9d7f3b3a62632f6b715991b6345c3a4e344800f7be2b`.
- `inputs/`: sette originali gzip lossless: i 252 nodi con 52 stencil e 394 campioni centrali, il modello provvisorio già fissato con script/report, l'estrattore storico, la proposta root della guardia e i metadati dei nove UV validi del precedente confronto JPEG.
- `lossless-provenance.json`: mapping, dimensioni e SHA256 degli originali. Ogni file interno dei pacchetti resta byte-identico al freeze, compresi whitespace e manifest. Non servono eccezioni whitespace del repository.

Non sono inclusi cache macro/dettaglio/flow, volumi, clone completi, dipendenze, app o dist. Gli hash dei dati esterni restano nei record: il verificatore non rilegge buffer omessi né ricostruisce il campo.

## Verifica offline indipendente

Dalla radice del repository:

```sh
python3 docs/measurements/near-boundary-guard-2026-10-16/verify.py
```

Usa solo la libreria standard Python e risolve i file dalla propria posizione; si può copiare la cartella altrove. Legge tar e gzip in memoria senza estrarli. Verifica tutti i payload, i due manifest originali e i sette input decompressi.

Per la provenienza ricontrolla il replay reciproco dei risultati sin/cos, gli stessi argomenti e RNG, i 299 centri differenti e la corrispondenza esatta dei cinque array. Per la guardia ricontrolla vecchi/provvisori già registrati, i 27 corner delle otto celle, bound e decisioni dei 55 nodi, monotonia dei revert, interpolazione degli stencil, densità salvate, statistiche dei nove UV e integrali tau della vecchia finestra centrale.

**Non esegue I1, JavaScript o il generatore**, non campiona nuove coordinate e non avvia probe, bake, test, build, decoder immagine, browser o GPU. Il PASS riguarda integrità e coerenza indipendente dei record conservati; gli originali descrivono le precedenti esecuzioni esterne.

## Limiti essenziali

Il perimetro è seed 72, forcing/dispersione zero, campi fini e flow fissi. Tutte le celle verificate risultano liquide: il ramo ice positivo non è esercitato. Gli slack numerici sono margini ingegneristici espliciti, non una prova delle approssimazioni di ogni GPU. Non sono qualificate frontiera globale, dinamica, forcing positivo, RGB, qualità artistica o prestazioni. Il modello resta non promosso e non viene cercata un'altra soglia per recuperare l'effetto perduto.
