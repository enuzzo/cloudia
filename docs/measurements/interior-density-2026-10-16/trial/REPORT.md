# Interior05 r1 — build esterna pronta, nessun verdetto artistico

Base122 verificata sia sul root HEAD `a8653c53ba617e7dd8ba56c868d28b7c3d4c5234` sia sulla snapshot v56: manifest `e826b119ff2758fa51ed04cf8748d0d40ad1ff09516fc498826466ceae3974b7`. Nessuna modifica al prodotto.

Candidato122 in `../interior05-source`: soltanto `volume.ts` cambia la formula `const interior=1-.6*smoothstep(.04,.28,field[idx]);` in `.5`; gli altri due diff sono rendererVersion ed expected lifecycle `observatory-v57-interior05-trial`. Nessuna modifica a primitivi/RNG, shader, camera, dettaglio o coefficienti ottici. La funzione esistente continua a ricavare le cache luminose dal medesimo campo fine generato: non viene riutilizzata una cache A per B.

Manifest sorgenti `07d8fbb4ee270cdd5e8f6d4d5408fbc2c8c3ab2d4766e55457e7c804459705cf`; volume `1b25c84300c2315cbba229f838cd3da50d0fe9d5a402a624d499e843af1af04a`; patch `61073a7430c6d514fe6d41d323af581f0f2e05060679b50b2d57aaf31836cc70`. `source-freeze.json` è stato scritto prima dell'esecuzione.

| Comando dalla snapshot | Esito | Durata |
|---|---|---:|
| `bun run typecheck` | exit0 | 1,503s |
| `bun run test -- src/cumulonimbus/volume.test.ts src/cumulonimbus/inclinedShoulder.test.ts --reporter=json --outputFile=<evidence>/targeted-test-results.json` | 31/31 PASS,2file,exit0 | 2,144s |
| `bun run build` | APP exit0 | 4,134s |
| `bun run build:hero` | hero exit0,APP preservata | 2,046s |

Dipendenze esistenti collegate tramite symlink: nessuna installazione. `com.apple.fileprovider.ignore#P=1` verificato prima e dopo. Tutti122 file root ancora byteesatti baseline; tutti122 file candidati ancora conformi al freeze dopo i comandi. Nessuna suite completa, scanner1024, nuovo audit256 CPU, browser o GPU eseguiti da questo task. I test mirati usano soltanto i loro bake piccoli già esistenti; nessun test è stato adattato per far passare il coefficiente.

`../interior05-source/dist` contiene30file,39.268.585B, con index e ambedue gli hero; manifest `704fb7e3d1c26dc58222a39e381726d955f05c50fe04f6361f2cd08d36000c8e`. Bun1.3.11/Node26.11.0/Vite7.3.3. I warning standard dei chunk>500kB sono registrati nel log e non bloccano la build.

Il precedente `.5` CPU del seed72 non ricalcolava frontiera, luce o render; non qualifica questo candidato. Il vuoto dei vecchi front+5m è un avviso di arretramento, non un veto artistico imposto dall'utente. Attendiamo A/B74 near60 Sole/Tramonto a identica posa mondiale e qualità piena. Ridurre densità può anche aumentare la luce residua: non viene anticipata una cura del bianco. Piano diagnostico separato, non eseguito, in `../interior05-diagnostic-plan.md`.
