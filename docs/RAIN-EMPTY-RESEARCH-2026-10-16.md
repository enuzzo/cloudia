# Ricerca sul riuso dei punti di nube vuota

16 ottobre 2026. Ricerca esterna conservata come ipotesi, senza applicazione al renderer.

Una distanza esatta dalla maschera occupata permette, nel modello CPU, di riusare
per alcuni passi il certificato di nube vuota senza ripetere le letture flow e
maschera. I passi della pioggia, t, ds e jitter restano identici. Sul replay di
576 raggi il risparmio condizionale è circa il 9,94% delle chiamate semantiche
rispetto alla maschera binaria. Non è una previsione FPS e non include tutti i
costi ALU.

Il limite geometrico dell'interpolante ideale è L = 6,31084. Il problema ancora
aperto è il filtro nativo della texture flow: gli scenari di errore 0, 1 e 2 m
non sono misure del device e non autorizzano a scegliere un margine di 1 m.
La documentazione [WebGPU](https://www.w3.org/TR/webgpu/#samplers) e
[Metal](https://developer.apple.com/metal/Metal-Shading-Language-Specification.pdf)
non fornisce qui un limite assoluto dei pesi del filtro sufficiente a chiudere
la prova. La conversione half dei nodi non determina la precisione del filtro.

Il prossimo passo possibile è soltanto un audit finito del filtro sul device,
con ipotesi di estensione alle coordinate non campionate esplicita. Senza quel
passaggio non si promuove la cache di intervalli. Una BFS e un replay CPU sono
stati eseguiti dalla cache esistente; nessun nuovo bake o audit GPU.

[Prova, derivazione, fonti e risultati grezzi](measurements/narrow-cloud-2026-10-16/empty-certificate-research/RESEARCH.md).
I byte originali sono elencati in [ARCHIVE-MANIFEST.json](measurements/narrow-cloud-2026-10-16/ARCHIVE-MANIFEST.json).
PDF del fornitore e binario distanza rigenerabile restano fuori da Dropbox;
sorgenti, hash e istruzioni sono conservati. Goal FPS e gate visivi aperti.
