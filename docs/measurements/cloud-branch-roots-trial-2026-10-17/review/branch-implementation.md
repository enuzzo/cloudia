# Branch hierarchy — implementazione esterna congelata

Stato: **sorgente pronto per review, non eseguito e non adottato**. È stato modificato soltanto `branched-source/src/cumulonimbus/volume.ts`; nessun prefix, modello, test, typecheck, build, browser o GPU è stato avviato da questo agente.

Base canonica: `volume.ts`, 29836 B, SHA256 `c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`. Candidato: 36234 B, SHA256 `d161e2efd350f38cce6ee353ef70a0af45a689c90c75d74f99d81213b4895003`. Backup, copia finale, patch e controlli statici sono in `branch-implementation-evidence/`; FREEZE SHA256 `d19230d37e88e630733f4fb19b91a8f0bcaa0d61583da307dec4392bde514d7d`.

## Operazione

- `turrets` conserva le reference reali di foundation, middle, neck, top e shoulders; `buried` lega il nucleo per-updraft già esistente delle famiglie non-sheared. `turretCores()` elenca questi core senza creare primitive.
- `branchGroups` è separata da `trackedGroups`: ogni core registra i suoi 18 figli e 72 nipoti durante l'append originale. Nessuna estrazione RNG viene aggiunta. Verifiche esplicite esigono 91 reference per gruppo, presenti nei lobi reali e con ownership disgiunta.
- Dopo la contrazione canonica X/Z, il top realmente più alto sceglie il turret dominante. Per ogni giovane, il raggio direzionale è `1/sqrt((ux/rx)^2+(uz/rz)^2)` e la distanza della fondazione diventa `min(d,(rYoung+rDominant)/2)`. Il delta verso il dominante è moltiplicato per `1-clamp((coreY-foundationY)/(topY-foundationY))`, una sola volta per core e rigidamente per i suoi 91 elementi. Y, raggi, blend e ordine dei lobi non vengono modificati.
- Gruppi dominanti e top non ricevono traslazioni dirette. Common-base, pulse, sharedBody, ice/cap/collar e rispettivi discendenti non appartengono alla branch map. L'addendum root include invece espressamente i nuclei buried per-updraft.
- I cap X/Z sono `max(4.35,actualPreBranchExtentX)` e `max(2.8,actualPreBranchExtentZ)`: preservano soltanto l'eventuale ULP già presente nella contrazione di base. Sia il risultato branch sia il risultato del joint successivo devono rimanere entro quei cap; altrimenti errore, senza epsilon, clipping o nuovo rescale.

## Contratto per il trace e metadati

Marker unici: `// Apply the branch hierarchy to actual core groups after horizontal contraction.` e `// The existing inward shoulder joint reads the moved young foundations.`. Variabili osservabili: `turrets`, `turretCores`, `branchGroups`, `dominant`, `dominantTurret`, `branchAnatomy`.

`CloudVolume.branchAnatomy` è opzionale nel tipo e viene popolato solo dal vero `generateVolume` che ritorna. Contiene conteggi derivati, movimento effettivo dei centri, massimo modulo del delta richiesto per gruppo, extents pre/branch/post-joint e cap, distanze/raggi della regola, più pin XYZ dei core prima/dopo branch/finali. `directionalRadiiKm` è `[young,dominant]` o `null` se non esiste una direzione non nulla. `groups.ordinal` è locale al ruolo (shoulder 0..N−1; 0 per gli altri ruoli).

I pin `afterBranchCoreXYZ` e `finalCoreXYZ` sono distinti: il vecchio joint sheared legge le fondazioni giovani già spostate e può quindi cambiare indirettamente il gruppo maturo selezionato. Il codice del joint, l'inclined shoulder e tutto il raster/bake sono conservati; non si promette identità finale del maturo.

## Verifiche effettuate e limiti

Sono stati confrontati soltanto testi/byte: sequenza dei token delle chiamate RNG invariata; suffisso raster/bake byte-identico alla base eccetto il campo aggiunto al return. Questo non sostituisce un trace reale, i test di contratto, un confronto densità o la prova nativa. Il payload non contiene array volumetrici nuovi né risorse GPU; Map/Set, pin e scansioni extents hanno comunque un costo CPU e memoria di generazione O(lobi). La diversa densità/supporto può cambiare il lavoro GPU: nessun vantaggio FPS o accettazione artistica è dedotto.

Prossimo proprietario: root/Anatomy per estrazione prefix indipendente, contratti esistenti, qualifica e poi eventuale confronto nativo front/side/near su tutte le tre famiglie. Il candidato può fallire il guard extents: nessun fallback che restituisce la forma precedente viene nascosto.
