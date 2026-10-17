# Support alpha R8 — primo trial, sorgente soltanto

Proprietà dell’agente: esclusivamente i sei file elencati in author-freeze.json della copia esterna cycle47, base canonica141 v61 senza hoist. Il backup dei quattro file esistenti precede gli edit; i due supportR8 sono nuovi. Root possiede Engine/lifecycle/version e tutte le esecuzioni.

API: SupportR8 {size,data}, SupportR8Packet {supportR8?}, extractSupportR8(detail), readSupportR8({detail,supportR8}). Estrazione di A=RGBA[4*i+3], byte per byte, in un array indipendente. Il reader ritorna il packet originale solo con shape/lunghezze valide, dimensione uguale al detail e buffer separato; altrimenti null. Non verifica l’uguaglianza contenutistica del packet al detail a ogni bind. Nessun nuovo campo, bake, soglia, normalizzazione o rebuild per frame.

Il worker estrae dopo generateVolume e aggiunge il sesto buffer trasferibile, distinto dai cinque precedenti. Nessuna copia RGBA persistente aggiunta. A128³: 2.097.152 byte CPU + altrettanti GPU nominali da integrare; la memoria totale cresce perché detail RGBA resta necessario. Nessuna misura di residenza o banda fisica.

createCloudIntegrator(mode=0,useNarrow=false,useDensityR8=false,useSupportR8=false) attiva la sostituzione soltanto con useNarrow&&useSupportR8. Nuovo binding supportR8 texture_3d, lettura .r con lo STESSO detailSampler e identiche referenceCoord/clamp/maskInset/LOD0. maskInset continua a derivare dal detail. Default dry/wet e wetR8 senza support flag mantengono la sorgente precedente. Il confronto I/O del blocco template dimostra byte identici; rimuovere la sola nuova derivazione e il quarto argomento restituisce l’intero cloudShader canonico f9d05d60… esatto. Nessuna factory WGSL eseguita dall’agente.

Test scritti, NON eseguiti: copia alpha indipendente da RGB/source view offset e non mutazione; reader shape/alias/fallback/identità; structuredClone reale di sei buffer con distacco e canali conservati; dry invariato e inversione letterale della sola sostituzione wet per sei diagnostiche e due scelte density. Hash storici dry/wet conservati; il nuovo inverse wet controlla anche 6d30dc1d…. Questi test non sostituiscono campionamento GPU/parità nativa né dimostrano un vantaggio FPS.

Nessun import/esecuzione di modello, test, typecheck, build, browser/GPU, installazione o modifica lockfile effettuati. Stato: candidata source-only non adottata.
