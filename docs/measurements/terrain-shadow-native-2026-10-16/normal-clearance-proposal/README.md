# Normal clearance — proposta esterna congelata, NON ADOTTATA

Il primo trial nativo non rimuove tutti gli artefatti. Root osserva ancora un grande cuneo in L1, tagli in L2 e un cuneo/nuovo gradino scuro in L3. Il PASS CPU sotto riportato riguarda la proprietà del piano locale, **non è un PASS artistico**. Non aumentare e o coefficienti per fare passare questa immagine. Nessun nuovo run è stato eseguito dopo l'esito nativo comunicato da root.

## Patch e contratto

- `before/TerrainShadow.ts`: base v57 SHA `0fa68e56eed14e400d7fb18381aac2d3a6823a5a4f28f927fa267e3d9a6d095e`.
- `after/src/cumulonimbus/TerrainShadow.ts`: candidata SHA `5529dc52040f45a108a89f3b7675b393f4e27cebe04ae17c08984b6bc104bcb1`.
- `TerrainShadow.patch`: patch unificata SHA `a2425b4cd3b84eef7316b5dd2d4481455a8a859fe0bcad2234626fcd7b92402a`.
- `lookup-point.wgsl`: solo il blocco proposto, leggibile prima dell'oracolo.
- `prepare.py`: rigeneratore dal nostro before protetto da SHA. I tre altri file in after sono copie di supporto byte-identiche, non modifiche proposte. Non contiene snapshot completo/app/dist o texture.

    e = radius / resolution
    c = clamp(dot(ng,radial),0,1)
    lookup = point + e*radial + e*(1-c)*ng

ng viene dal piano del triangolo effettivo tramite due derivate, orientato verso il radiale. Ogni derivata viene divisa per il proprio massimo componente assoluto (denominatore almeno1e−20) **prima** del cross. Quindi, per derivate finite, i componenti scalati sono limitati, cross e length² non possono traboccare. Normalizzazione protetta e fallback radiale se il cross è degenere/quasi parallelo. Le derivate avvengono prima del branch UV; select evita un nuovo branch di normalizzazione.

Per un piano non degenere, unitari esatti e 0≤c≤1: ng·delta=e, |delta|=e*sqrt(2−c²). Il trial completa il distacco normale ma non certifica la corretta faccia vincente della mappa nearest. La proprietà non implica visibilità monotona: la componente aggiunta può cambiare il texel nearest e, su una faccia rivolta altrove rispetto al Sole, anche ridurre la quota solare. Le variazioni RGB negative del trial non sono quindi, da sole, prova di un errore f32. La finitezza richiede anche il radiale valido del dominio del terreno, radius/resolution validi e **derivate finite**: non si dichiara che l'offset ripari derivate indeterminate o NaN/Inf.

Nessun nuovo lookup (sempre1), texture, pass, byte persistente, campione CPU del terreno o modifica di quota/materiale/estinzione. Costo WGSL aggiuntivo: due derivate vec3, cross, due dot, inverseSqrt protetto, scale/add/select; la riscalatura richiede anche 6 max scalari e 2 divisioni vec3. Il compilatore può abbassare o riusare operazioni: non è un conteggio di istruzioni hardware e non permette una previsione FPS.

La funzione CPU `terrainShadowLookupPoint` accetta la coppia opzionale derivativeX/derivativeY; anche `terrainShadowVisibility` può passarla. Senza coppia conserva il vecchio fallback radiale, perché il CPU caller storico non possiede la normale del triangolo. Passare una sola derivata è errore. Non si finge che la vecchia firma sia un oracolo completo della nuova normale GPU.

## Freeze, esecuzione e fallimento del launcher

`PROTOCOL.json`, kernel, patch e previsioni sono stati scritti prima dell'oracolo. PRE-RUN-FREEZE-R1 conserva il primo freeze; PRE-RUN-FREEZE aggiorna solo la provenienza del rigeneratore quando root ha applicato la patch nella propria snapshot esterna. Nessun caso o gate numerico è stato cambiato.

R1 **FAIL del wrapper prima dell'exec Bun**: Popen/preexec_fn fallisce sul setrlimit RSS a2 GiB; isolamento separato riporta `ValueError: current limit exceeds maximum limit`. CPU setrlimit5 s funziona. `run-oracle-r1.py`, `cpu-r1-failure.json` e stdout/stderr vuoti sono conservati. Nessun risultato numerico R1 e nessuna esecuzione del kernel R1.

Root autorizza R2 dello stesso kernel/casi/candidata/gate: hard CPU5 s, wall15 s, picco RSS controllato a posteriori con getrusage, senza RLIMIT_AS che può rompere lo spazio virtuale JIT. `R2-PRE-RUN-FREEZE.json` SHA `570196ea639f2c4b8151c72c071f4165320011ad820158b201aceaf9c1277733` precede il run. Nessuna installazione; Bun 1.3.11 arm64 e dipendenze esistenti ignored1/untracked, node_modules2 mai usato.

R2: **654 assert / 126 righe di piani PASS nel solo perimetro numerico**. CPU 0,122854 s, wall 0,168507 s, picco RSS 119.701.504 byte (<2 GiB), exit0. Errori massimi della distanza dal piano: double6.6960e−16km, surrogate f32 locale3.14685e−7km (~0.315mm);108 controlli negativi mostrano che il vecchio radiale non soddisfa la proprietà del piano inclinato. Risultati completi `cpu-r2.stdout.json`; budget/exit `cpu-r2-run.json`.

L'oracolo importa il vero helper CPU della candidata. La misura indipendente usa l'equazione del piano y=y0+a(x−x0)+b(z−z0), non ricalcola delta come aspettativa. Esercita pendenze0/15/30/45/60/80/89°, azimut, segno/scala delle derivate, due facce di cresta, degeneri ed estremi f32. Il surrogate f32 è un calcolo ALU esplicitamente etichettato: **non esegue WGSL né derivate GPU**. Il suo radialY collassa l'addizione in p.y+6375, invece di (p.y+4)+6371; i punti di accuratezza hanno Y interi−4/−3, quindi lì coincidono, ma non è un replay ALU bitexact generale.

Limiti verificati, non nascosti fra i PASS: un occludente separato200 m resta riconosciuto; un contatto reale35 m conservato dal vecchio bias può sparire; un texel contenente un'altra faccia piana può ancora produrre una falsa ombra. Non esiste una garanzia globale di assenza acne e non c'è certificato per ogni bordo/cresta o angolo radente.

## Evidenza nativa di root — esito negativo

L'ablazione precedente solarVisibility=1 cambia1.778 / 4.562.056 pixel con soli incrementi RGB. Conferma il ramo shadow nei punti osservati; non prova da sola quali ombre fossero fisicamente false. La candidata normal-clearance cambia 1.006 pixel rispetto al baseline e 782 rispetto all'ablazione; variazioni RGB fino a −9. L3 conserva 287 pixel diversi dall'ablazione e introduce variazioni negative. Dati in `evidence/normal-comparison.json`, confronti/root PNG originali referenziati da `NATIVE-EVIDENCE-REFERENCES.json` senza ricopiarli.

Camera/materiale/weather/lighting/quality e gli altri campi elencati nel confronto sono uguali nello snapshot Sole di root. I numeri sono differenze dei valori PNG, non radiometria lineare o prova dell'ombra fisica. Root ha anche compilato typecheck/app/hero nella sua snapshot: tali esecuzioni non sono state compiute dall'autore di questo pacchetto e non sostituiscono la critica visiva. Nessuna misura FPS della candidata è qui attribuita.

## Fonti e verificabilità

[WGSL §15.6.2](https://www.w3.org/TR/WGSL/#derivatives) e [§17.6](https://www.w3.org/TR/WGSL/#derivative-builtin-functions): derivate in controllo uniforme nel fragment, anche al call-site; prima dei branch per-pixel. Disabilitare il diagnostic non rende definito un risultato altrimenti indeterminato. Root deve verificare il compilato reale; l'oracolo non lo qualifica.

[Unity6 shadowNormalBias](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Light-shadowNormalBias.html) documenta bias orientato alla normale e al texel contro auto-ombra, con restringimento dell'ombra come rischio. Lì si sposta il caster; questa formula receiver-side e la proprietà del piano sono originali, non una garanzia ricavata da Unity.

`verify.py` verifica payload e SHA, summary/casi registrati e coerenza f32 ricostruibile dalle126 righe. Non riesegue il helper, non ricompila WGSL e non attribuisce art PASS. Il `node_modules` è un link di esecuzione escluso dal manifest, non un payload riproducibile portabile. Non eseguire il wrapper R1; qualunque nuovo modello/run richiede una nuova decisione, dato il FAIL visivo.
