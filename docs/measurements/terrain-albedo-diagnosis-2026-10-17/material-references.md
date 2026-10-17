# Riferimenti primari per il confronto materiale

Consultati il17ottobre2026, prima della modalita albedoGPU.

- [PBRT4, Diffuse Reflection](https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection): distingue il fattore di riflettanza del diffusore dall'illuminazione incidente e dal coseno nell'equazione di trasporto. Motiva separare colore e risposta luminosa per la diagnosi; non calibra le palette Cloudia e non prova la causa delle sue patch.
- [Portsmouth,Kutz,Hill, EON,v3](https://arxiv.org/abs/2410.18026v3), revisione29dicembre2025, JCGT2025: modello di diffusione ruvida con compensazione energetica analitica. Solo alternativa documentata se la risposta diffusa risulta causale; non implementato, nessun codice copiato, nessuna stima FPS o roughness scelta da questo abstract.

Il terreno corrente non include un termine speculare esplicito: osservazione del sorgente locale terrainSurfaceMaterial, non deduzione dai riferimenti. La modalita albedo e una diagnostica terrestre; mare e acqua interna rimangono illuminati, cloud/aerial/film sono conservati.
