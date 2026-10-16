# Cortine di pioggia: rimappatura respinta, v59 conservata

17 ottobre 2026. Goal attivo; prodotto invariato rispetto a `9ea9840`.
Il trial passa test e compilazione ma **fallisce il gate artistico nativo**.

## Problema, intervento ed esito

Il bitmap della v59 mostra un velo di pioggia ampio e uniforme. La sorgente
64² è filtrata e i due modulatori mantengono un fondo positivo. Il trial cambia
soltanto il fattore delle cortine larghe già campionato:
`0.15 + 1.85*sheets²` → `2*smoothstep(0.35,0.65,sheets)²`.
Valori fissati prima della GPU, senza successive ricerche di parametri.
La rimappatura apre zeri e concentra i valori alti; conserva il massimo 2,
senza conservare la quantità integrale di pioggia o calibrare un'intensità fisica.

Restano identici sorgente/base, parametro originale passato alla virga, luce,
streak, passo 6 m, terreno v59, volumi 256³/128³, 384 passi e output pieno.
Nessuna nuova texture, lookup o pass. Template e dipendenze del ramo asciutto
rimangono identici; il nuovo helper è incluso soltanto nella specializzazione
pioggia. Questo costo strutturale non equivale a una misura FPS.

**FAIL root e review indipendente:** nella posa fissata i vuoti diventano due
fenditure quasi rettilinee all'interno della stessa cortina liscia. Il risultato
si legge come bande/pannelli verticali, senza profondità convincente fra le
cortine. Il cambiamento è visibile e non è una semplice attenuazione uniforme,
ma non raggiunge il risultato richiesto. La still non prova periodicità matematica.

## Evidenze e stop rule

| Controllo | Risultato | Limite |
|---|---|---|
| Candidato congelato | 128 sorgenti, 6 cambiati/nuovi rispetto a base126 | Soltanto copia esterna |
| Test e build | 10 mirati, 439/439 in47 file; APP→hero/typecheck PASS | Non certificano qualità visiva |
| PNG nativo Rain | 2474×1844, 2.589.151 B, 53 parti complete | Un draw fermo, non presentazione del compositore |
| Confronto con v59 | Seed74/t60, camera e luce uguali entro1e−12, stesso meteo assestato | Piccolo residuo rain floating point dichiarato |
| Review visiva | FAIL indipendente e root su fullPNG e ROI1:1 | Una posa, non un giudizio su ogni possibile formula |
| Worker/Sole/moto/FPS del trial | Non eseguiti dopo il FAIL | Stop rule rispettata |

PNG candidato SHA256
`665ee2e54bcde7ea2fcdeaa5fafceb9fde6a6e376ab93e3638d0af9350864389`.
La nuova esportazione owner v59 conferma il precedente bitmap SHA0dd971b6…;
non è stato trasferito nuovamente. Il confronto usa quell'originale già verificato.
ROI nativa prefissata `[900,1240,1800,1820]`, senza resize. Console del trial
senza warn/error osservati. Nessun difetto nuovo evidente di nube/terreno in
questa immagine, ma questo non salva il gate delle cortine.

## Direzione successiva, ancora non implementata

La rimappatura del solo campo orizzontale non supera questa prova. La proposta
successiva studia la luce dell'emettitore già disponibile nei buffer: una piccola
estensione della footprint potrebbe evitare lookup3D aggiunte a ogni campione.
Prima di implementarla va verificato se i valori alla base contengono variazione
utile o sono tutti saturi; nel secondo caso fermarsi prima della GPU. È un proxy
di illuminazione della sorgente, non visibilità fisica delle gocce discese, e non
promette di aprire vuoti. Piano conservato nell'archivio come **non eseguito**.

Lo studio sulle ombre esclude il trial ingenuo raw-nearest: già un piano inclinato
può auto-ombreggiarsi per il confronto fra centro texel e ricevitore. PCF media
confronti e non certifica quel piano. Nessun altro bias o trial GPU ombre è stato
applicato. Gli eventuali riferimenti fisici futuri devono usare la mesh v59:
faceID/classificazioni dei vecchi witness v58 non sono verità corrente.

## Riproducibilità e stato

Archivio `measurements/rain-shaft-trial-2026-10-17/`: 45 payload, 2.849.553 B,
manifest SHA256 `0f301ec3ed38c23e8518062a59f5063c755f9f715e7f27d1aa45c9f35887d629`.
Verifica saved-evidence PASS: base126 attuale e overlay128, PNG/ledger, risultati
salvati e stop rule. CPU0,070s/wall0,132s/RSS44.056.576B; nessun modello, test,
build o rendering ripetuto. Prova del run nel
[sidecar](RAIN-SHAFT-TRIAL-VERIFICATION-2026-10-17.json), esterno al manifest.

Preview4196 ripristinata: v59, Sole animato, canvas2474×1844, diagnostica assente,
console senza warn/error osservati. Trial53768 chiuso intenzionalmente exit130.
`node_modules 2/` e listener4201 estranei preservati. Checkpoint locale di prove,
senza adozione runtime, push o deploy. Anatomia/luce vicina, integrazione rain/virga,
paesaggio/materiali/ombre, UI e60FPS globali rimangono aperti.
