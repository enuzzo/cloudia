# Radice incus orientata — archivio di un trial ritirato

Baseline prodotto `10493af`, candidato esterno r2. Sono conservati i 21 file
del manifest numerico originale, il manifest stesso, tre snapshot sorgente,
il manifest dei 109 input e due coppie JPEG browser. Nessun clone completo,
dist o buffer voxel duplicato. I testi originali sono gzip lossless; i file
già gzip e i JPEG conservano i byte originali.

```sh
python3 docs/measurements/cap-root-orientation-2026-10-16/verify.py
```

Il verificatore controlla hash/dimensioni e decompressione, record dei 20
probe CPU, controlli 72/73, RNG e selezione delle 25 primitive. Non ripete
bake, test, build o rendering e non ricostruisce i buffer voxel omessi.
La decisione visiva è in `VISUAL-DECISION.json`; le immagini sono JPEG CSS
1280×720 da canvas nativo 2560×1440, senza prova di framebuffer completo.

Il report storico e gli script rimangono intatti in `originals/`; descrivono
anche la correzione solo tipologica r1→r2, con JS emesso identico. I percorsi
esterni riportati nella provenienza sono riferimenti di origine: il replay
di integrità qui usa soltanto i payload locali e la libreria standard Python.
