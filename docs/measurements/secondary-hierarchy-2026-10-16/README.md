# Gerarchia della torre secondaria — archivio ritirato

Il candidato non è promosso. Le verifiche numeriche mirate sono passate; il confronto visivo del root ha rilevato una gerarchia locale migliore, ma testa giovane larga/tozza e persistenza di U e uncino. Non è un PASS artistico e non sono state misurate prestazioni.

Il documento principale è [EXPERIMENT-SECONDARY-HIERARCHY-2026-10-16.md](../../EXPERIMENT-SECONDARY-HIERARCHY-2026-10-16.md). La decisione conclusiva originale è [VISUAL-DECISION.json](VISUAL-DECISION.json). Il report in `reports/NUMERIC-REPORT.md.gz` e il manifest in `manifests/evidence-manifest.json.gz` precedono tale decisione: il loro stato «QA visiva ancora di root» è storico e viene superato dal ritiro.

## Contenuto curato

- `browser/`: sei JPEG CSS originali, sei metadati e un diagnostico in gzip lossless, due console originali vuote. I JPEG confrontano seed 74 frontale/laterale e seed 77 frontale.
- `sources/`: i soli `volume.ts` baseline e candidato, gzip lossless. Baseline `10493afa7f6d90389c39e17b2cad79397dfdac01`; SHA volume baseline `a53410c45b04143710cffd098b6a33deade3242c66ecf7eecc6405a214a93b00`, candidato `3db1246ae8741521be70d336a8ecdbee92bf33ea24f83246359faa909bad1b35`.
- `raw/`: 20 record di volumi CPU a 32³/64³, trace completo prima/dopo, chiusura semantica dei tag, invarianza dei parametri della spalla, conferma non strumentata e validazione.
- `audit-code/`, `logs/`, `reports/`: script originali del probe e della conferma, piccole versioni diagnostiche sorgente/bundle, patch, log e report; compressi senza modificare i byte originali.
- `manifests/`: i manifest dei due snapshot da 108 file, del build APP da 20 file e dell'evidenza precedente al verdetto. Non sono inclusi clone, dipendenze, dist, cache o buffer voxel.
- `provenance.json`: ogni originale selezionato è associato al percorso conservato, ai suoi byte e SHA256; sono censiti anche tutti i contenuti decompressi.

## Verifica portabile

Dalla radice del repository:

```sh
python3 docs/measurements/secondary-hierarchy-2026-10-16/verify.py
```

È sufficiente la libreria standard Python; lo script risolve i file dalla propria posizione. Verifica ogni payload, originali gzip, manifest precedente al verdetto e catture associate alla decisione. Ricontrolla nei record le coppie baseline/candidato, hash dichiarati dei canali e flussi RNG, chiusura dei due gruppi da 91 primitive, applicazione singola della traslazione, parametri invariati della spalla e conferma del candidato non strumentato. Non ricrea volumi né ricalcola gli hash dei buffer assenti; non esegue probe, test, build, GPU o FPS.

Gli script originali conservati sono documentazione riproducibile con il checkout e le dipendenze originali, non un generatore autonomo incluso nel piccolo archivio. I manifest descrivono i file omessi; non sostituiscono i loro contenuti. Il verificatore qui incluso è autonomo e limita il suo PASS all'integrità e coerenza dei dati salvati.
