# Spalla inclinata dell'incudine — pacchetto di revisione

Baseline `08c33cb`; candidato 14.1, test revisione 2. Questo pacchetto raccoglie sorgenti esatti, risultati CPU e comandi di riproduzione. Non modifica il prodotto e non assegna un PASS artistico generale. Il root ha autorizzato la promozione locale della connessione. Le immagini pertinenti sono ora incluse in `browser/`, con i limiti indicati in `VISUAL-VERDICT.md`; non costituiscono un PASS fotografico generale.

## Contenuto e lettura

- `PROPOSTA-DOC.md`: bozza originaria conservata come storia della revisione; il documento definitivo è `../../EXPERIMENT-INCLINED-SHOULDER-2026-10-16.md`.
- `candidate/`: volume, helper, test finali e patch del volume rispetto al baseline.
- `baseline/` e `shared-source/`: sorgenti di confronto e dipendenze CPU congelate.
- `proof/comparison-256.json`: misure complete, hash dei dati, sei margini delle facce, contatori e identità di sorgenti/bundle.
- `proof/comparison-32-64.json` e `baseline-sections.json`: individuazione del vuoto e confronto iniziale.
- `proof/tests-observed.json`: risultato realmente osservato dei 31 test, trascritto dall'output dello strumento. Non è presentato come log grezzo.
- `qualified-bundles/`: due piccoli moduli JavaScript esatti impiegati nella verifica CPU, più le sorgenti strumentate. Non sono volumi binari.
- `dependency-manifests/`: manifest e lockfile conservati; nessuna dipendenza installata o copiata.
- `manifest.json`: SHA256 e dimensione di ogni file del payload, escluso il manifest stesso.

## Controllare l'archivio senza calcoli pesanti

Dalla cartella del pacchetto:

```sh
node verify-package.mjs
node replay-numeric.mjs
node replay-tests.mjs --repo '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia'
```

Questi comandi verificano integrità e corrispondenza delle sorgenti. Non generano volumi e non eseguono test. Il terzo rifiuta checkout che non coincidono con i file qualificati; non ripristina o modifica sorgenti.

## Riprodurre i numeri

```sh
node --expose-gc replay-numeric.mjs --run 64
node --expose-gc replay-numeric.mjs --run 256
```

La riproduzione esegue serialmente baseline e candidato sui seed 72/73/74/77/80, confronta gli hash dei quattro buffer e i contatori del supporto con le prove archiviate, e rilascia i buffer fra i volumi. Il secondo comando è un calcolo CPU consistente: eseguirlo fuori da misure FPS. Non salva grandi buffer, non avvia il browser e non misura la GPU. Versioni e architettura originarie sono in `proof/runtime-versions.json`.

I moduli qualificati rendono il replay indipendente da esbuild e dalle dipendenze installate. Il precedente script di compilazione e confronto da sorgenti è conservato in `original-replay/` come documento della procedura originaria, con i suoi percorsi originali.

## Riprodurre i 31 test mirati

Con le dipendenze locali già disponibili nel checkout qualificato:

```sh
node replay-tests.mjs --repo '/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia' --run
```

Lo script verifica prima gli hash di sorgenti e test. Nei checkout Dropbox controlla anche che `node_modules` sia ignorato da Git, non tracciato e marcato localmente con l'attributo File Provider uguale a 1. Non installa dipendenze e non applica esclusioni automaticamente.

## Limiti della prova

La correttezza dei contatori e degli hash non dimostra naturalità fotografica. Il riempimento della sezione misurata è un risultato locale; il profilo globale a uncino/U resta un gate aperto. I JPEG browser restituiti a 1280×720 documentano viste di un output configurato a 2560×1440; non sono PNG nativi esportati. Pioggia, moto, FPS e approvazione artistica devono mantenere le rispettive prove separate.
