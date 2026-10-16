# Archivio narrow cloud, 16 ottobre 2026

L'archivio conserva tre revisioni distinte: v44 maschera in tutti gli scenari,
v45 gate uniforme hasRain e v46 shader asciutto originale separato. I README e
manifest preparatori sono byte congelati e possono ancora dire «pronto, non
eseguito»; il resoconto radice e i result.json successivi precisano lo stato
raggiunto. Non attribuire le prove di una revisione alle altre.

- `product-source/`: prodotto v44 e baseline locale 0d0ab21.
- `v45-source/`, `v46-source/`: successive revisioni, con provenienza separata.
- `gpu-audit/result.json`: audit finito del point guard v44, 62.544 query.
  Non esegue flow, materiale completo, Three.js o la scelta degli shader v46.
- `gpu-audit/input-snapshots/initial-sparse-no-zero/`: primo dataset sparso
  correttamente respinto perché non conteneva query narrow-zero. Non è un
  falso negativo sulla densità; runner e criteri successivi sono identici.
- `preliminary-*.json`: misure native 2560×1440, macro256³/dettaglio128³,
  384 passi nominali; invii e prefissi GPU, presentazione non misurata.
  Una scheda diagnostica terreno bloccata rende il contesto non controllato:
  non sono una certificazione hardware o del target60.
- `empty-certificate-research/`: ricerca CPU successiva, non implementata;
  errore sampler1–2m non qualificato. I suoi conteggi non sono FPS.

Verifiche ripetibili dalla cartella dell'archivio:

```
node verify-preliminary.mjs
python3 verify-variants.py
```

Entrambi riscrivono soltanto i rispettivi piccoli report di verifica. Per la
sola integrità controllare dimensione/SHA di ogni file in ARCHIVE-MANIFEST.json.
Le sorgenti sperimentali con percorsi assoluti sono conservate senza riscrittura:
prima di rieseguirle adattare i percorsi in una copia esterna, mantenendo gli
input originali e i relativi hash.

La cache macro RGBA8 da64MiB non è duplicata in Dropbox. `gpu-audit/inputs.json`
registra SHA e dimensioni. Per rieseguire l'audit GPU, creare una copia di lavoro
esterna di questo pacchetto, fornire lì macro-rgba8.bin verificato e narrow-r8.bin
(verificato contro il binario radice), poi servire quella copia su localhost.
I link simbolici della sessione non sono archiviati. I dati query piccoli sono
conservati. Non eseguire l'audit insieme a benchmark dell'app.

La texture narrow radice da2MiB è un input qualificato, non una dipendenza
installata o una cache di build. Dist, hero, mappe, cache109MiB e PDF del
fornitore restano fuori da Dropbox. Sorgenti, lockfile esistente, SHA degli
asset e verifiche sono conservati per ricostruire e controllare la provenienza.

I tredici percorsi congelati con righe vuote finali o spazi di contesto patch
sono elencati in checkpoint-validation.json. Non sono stati normalizzati: i
byte qualificati conservano i loro SHA. Il codice prodotto e gli altri file
passano il controllo whitespace dell’indice.
