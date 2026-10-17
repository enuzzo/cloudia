# Broad support alpha R8 — trial respinto

17 ottobre 2026, ciclo51. Candidata esterna `experiment-v61-support-alpha-r8-r1`; canonico `observatory-v61-observed-terrain-material` invariato. [Rapporto](../../RAIN-SUPPORT-R8-TRIAL-2026-10-17.md). Goal completo attivo.

R8 copia esattamente il canale alpha del detail128³; shader wet con sampler/coordinate/passi invariati. Typecheck,580test/54file eAPP PASS. MicroGPU sintetica e un PNG nativo qualificato passano. Il confronto attivo90s A/B/A14,507662→15,146316→16,318179 invii/s fallisce il gate prefissato. Variazione dei controlli12,48%, nessun beneficio causale dimostrato. Nessuna adozione o60FPS presentati certificati.

- `source-overlay/`: nove delta rispetto ai141 pin canonici; ricostruisce la candidata R2 di143file. Runtime R1 invariato; per ricostruire R1 usare il `narrowCloud.test.ts` canonico al posto dell'unico test riparato R2.
- `run/`: protocolli pre-GPU, freeze R1/R2, launcher e log CPU,579PASS/1FAIL R1 conservato,580PASS R2, correzione esplicita del verificatore di somma, pagina della microprova e controlli saved-only.
- `browser/`: risultati GPU completi, F32 di input/output, PNG A intero e alias da nuovi export A/B, confronto integrale dei DTO, tre rapporti90s completi, ledger dei trasferimenti, primo FAIL aritmetico A2 e risultato corretto, preview ordinaria ripristinata.
- `review/`: freeze autore, copie before/after, patch, verifiche indipendenti, fonti primarie e proposta anatomica ancora da progettare. Non è una nuova ricetta implementata.
- `analysis/verify-saved.py`: verifica conservazione, sorgenti e verdetti salvati; nessun modello/test/build/browser/GPU rieseguito.

Il manifest autentica i payload per byte eSHA256. I chunk di trasferimento intermedi restano soltanto nel workspace esterno `Cloudia-QA-2026-10-17-cycle47`; l'archivio conserva gli export completi e i ledger con gli hash. Sono esclusi dipendenze, cache e dist. I tre shader congelati conservano la riga vuota finale del canonico; le due righe whitespace della patch sono contesto vuoto del formato unified diff. Questi byte vengono controllati separatamente senza normalizzarli.

Preview4196v61 conservata; solo candidato53790 chiuso. Nessuna installazione, lock edit, push o deploy. Questa conservazione non sostituisce accettazione artistica, fluidità percepita, prova universale del filtro o completamento del goal.
