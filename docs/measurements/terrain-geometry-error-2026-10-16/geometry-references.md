# Riferimenti primari per il ramo geometrico

Consultati il16ottobre2026. Studio di metodi, non librerie da installare o codice copiato.

- Losasso/Hoppe, Geometry Clipmaps (SIGGRAPH2004): https://hhoppe.com/proj/geomclipmap/ . Griglie regolari annidate, aggiornate incrementalmente al movimento del punto di vista. La mesh v58 usa griglie annidate ma statiche nel mondo; il confronto è architetturale, non identità del metodo né una promessa dei60FPS mostrati nel lavoro storico.
- Boubekeur/Schlick, Generic Adaptive Mesh Refinement, GPU Gems3: https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-5-generic-adaptive-mesh-refinement . Distingue tessellazione e spostamento mediante funzione di altezza; sottolinea coerenza dei bordi tra facce e rapporto fra complessità coarse/refined. I dati prestazionali sono del loro hardware/implementazione storici, non trasferibili a Cloudia/WebGPU.

Decisione locale ancora da verificare: preferire inizialmente raffinamento statico limitato agli errori osservati nel DEM, preservando cache ombre e assenza di costruzione CPU perframe. Evitare un passaggio simultaneo a LODcamera/GPUprocedurale: cambierebbe dominio, ownership e invalidazioni senza misurare prima il bisogno. Questa scelta è un'inferenza dal codice corrente e dai vincoli del progetto, non una conclusione dimostrata dai riferimenti.

Per la credibilità geografica, spostare i nuovi vertici sullo stesso DEM invece di aggiungere dettagliofrattale non presente nei dati. Non confondere aumento dei triangoli e aggiunta di informazione geografica sotto125m.
