# Shared aerial: prova GPU dei segmenti

Archivio curato della piccola app e dell'esecuzione effettuata dal root tramite UI. **Candidato ritirato e non promosso**: le misure FPS ripetute non hanno riprodotto un vantaggio rispetto alla deriva della baseline. Il PASS qui descritto riguarda soltanto i segmenti selezionati e non dimostra uno speedup.

Il root ha premuto «Esegui confronto segmenti» nel browser. Il JSON acquisito riporta esecuzione GPU dal `2026-10-16T09:09:00.619Z` al `2026-10-16T09:09:00.681Z`, adattatore Apple/Metal 3, **216 tuple e 864 canali RGBA f32 identici per bit** tra i due compute separati. Differenze, valori non finiti, sentinelle residue ed errori di validazione: zero; console catturata vuota. Questi timestamp delimitano l'app di prova e non sono un benchmark GPU.

Entrambi gli output hanno SHA256:

`02fda484196d60c13cb86cdcebcd6574e356e28478f7a6f514c1c98038248987`

## Contenuto e provenienza

- `app-original.tar.gz`: **app originale completa e immutata**, confezionata lossless con tutti i 17 payload e il manifest originale. Include sorgenti baseline `10493afa7f6d90389c39e17b2cad79397dfdac01`, candidato esterno e shader effettivi del witness. Il manifest app interno ha SHA256 `42ace1caa855700419cd549deeabf39ffbe8f53b9c380be8f7c356845c132f27`. L'archivio conserva anche spazi finali e righe vuote dei sorgenti originali: nessun byte è rifilato e non viene introdotta un'eccezione ai controlli whitespace del repository.
- `browser/`: JSON di riepilogo acquisito dal DOM, tutti i 216 record acquisiti dal DOM, console e JPEG originali della cattura root. La confezione non modifica questi file e non rigenera alcun output GPU.
- `candidate-template-witnesses.json`: record dei template effettivi dell'autore del candidato. È provenienza separata dal confronto GPU dei segmenti: non attribuisce il risultato delle 216 tuple a tutti i template o all'intera immagine.
- `manifest.json` e `verify.py`: elenco SHA256 di tutti i payload e verificatore portabile con sola libreria standard Python.

L'app originale conserva lo stato di preparazione nel proprio README e manifest: rimangono prove del freeze antecedente all'esecuzione. **Ogni file interno è byte-identico al freeze**, inclusi `index.html`, `app.js`, `cases.json`, `old.wgsl`, `new.wgsl` e `provenance.json`; restano identici tutti e quattro gli SHA nel risultato GPU. `prepare.py` resta la procedura storica di generazione: non serve alla pagina e non va rilanciata sull'archivio congelato. L'esito successivo è documentato dai raw in `browser/` e da questo README.

## Verifica dopo le misure FPS

Durante la confezione e il trasferimento sono state effettuate soltanto operazioni sui file; catture e app sono state copiate e confrontate per byte e SHA256. Il successivo confezionamento lossless ha conservato l'intera app senza modificare sorgenti, script o manifest, senza ripetere WebGPU. **Il verificatore non è stato eseguito durante l'A/B/A FPS**; i controlli dei file e della ricostruzione dei byte si eseguono separatamente dopo le misure. Dalla radice del repository:

```sh
python3 docs/measurements/shared-aerial-2026-10-16/gpu/verify.py
```

Il verificatore controlla il manifest radice, legge il tar **senza estrarlo**, controlla il manifest app originale e verifica **tutti i 17 payload originali** contro byte e SHA del freeze. Associa i record agli input e ricostruisce per ciascuno dei due output tutti gli **864 uint32** dalle stringhe esadecimali, in ordine e little-endian come la cattura Apple. Per ogni canale verifica che il valore JSON sia esattamente il float32 decodificato dai bit. Ricalcola SHA256 dei 3.456 byte per output, differenze, finitezza, sentinelle, range e conteggi per scenario, confrontandoli con il riepilogo raw. Nessun browser, GPU, render o bake viene avviato.

Per una nuova esecuzione manuale, dopo il PASS del verificatore, estrarre **fuori dal repository e da Dropbox** e servire con un semplice server statico. Esempio dalla radice del repository:

```sh
mkdir -p /Users/enuzzo/Documents/Codex/shared-aerial-replay
tar -xzf docs/measurements/shared-aerial-2026-10-16/gpu/app-original.tar.gz -C /Users/enuzzo/Documents/Codex/shared-aerial-replay
python3 -m http.server 4199 --bind 127.0.0.1 --directory /Users/enuzzo/Documents/Codex/shared-aerial-replay/app
```

Aprire `http://127.0.0.1:4199/` e usare il pulsante. Sarebbe una nuova prova distinta e non è necessaria per verificare questa cattura; l'app non avvia WebGPU automaticamente.

## Limiti

Il confronto usa sei distanze dalla camera (`0`, `0,006`, `1`, `10`, `16`, `60` km), tre haze (`0`, `0,35`, `1`) e dodici scenari finiti. Include pioggia e nube sovrapposte, pioggia nulla con nube positiva e colonna positiva azzerata da attachment o evaporazione. Il passo dei segmenti non nulli è 6 m; esiste anche il caso di lunghezza nulla.

`AERIAL_WGSL` e `MEDIA_WGSL` derivano dai sorgenti congelati. Entrambe le varianti mantengono l'esponenziale diretto; non è la ricorrenza v19. Il candidato modifica soltanto la specializzazione piovosa: conserva temporaneamente `rainLight` e, quando la pioggia ha estinzione positiva, applica il mix con il valore atmosferico comune dopo lo stesso gate dei mezzi nulli.

Risultati dei lookup, attachment, evaporazione e sorgenti luminose sono input espliciti. Non vengono verificati texture, traversata, accumulo dell'intera raggiera, film, compilazione dell'intero renderer o ogni valore f32 possibile. Il JPEG mostra l'esito dell'app diagnostica; non costituisce accettazione artistica. Il compilatore può già eliminare il lavoro duplicato nel prodotto: il PASS semantico non dimostra risparmio GPU, FPS superiori o superamento della deriva A/B/A. Le misure ripetute hanno portato al ritiro della proposta; i risultati dettagliati sono nell'archivio FPS superiore.
