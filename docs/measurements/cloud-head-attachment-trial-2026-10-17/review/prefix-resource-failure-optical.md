# Prefix head attachment — verifica indipendente dei dati salvati

**FAIL di risorse confermato; nessuna promozione della candidata.** Verifica limitata a I/O, hash e lettura del witness: nessun modello, test, build, nuovo witness o GPU eseguito dal reviewer.

- Sorgente candidata: **143/143 file** elencati in `run/SOURCE-FREEZE-R1.json` ancora identici; SHA del freeze `ae6369636efc203ced8d0ad4afed74d95b805e77abff5619ca46cc59b2295ecb`.
- `run/prefix-execution.json` riporta exit 1, `FAIL`, errore `Prefix CPU/RSS budget exceeded`, senza wall kill. CPU terminale 1.035744 s e wall 0.7525472500128672 s; il limite fallito è RSS **403062784 B > 402653184 B**, eccedenza **409600 B**. Il campione interno al witness era già **402735104 B**, eccedenza **81920 B**. Sono misure distinte, rispettivamente terminale del PID tramite Darwin `wait4` e campione cooperativo tra chiamate; non misurano memoria isolata di un singolo algoritmo né FPS.
- Il log termina con `FAIL_STOP_NO_FALLBACK`, fase `candidate-legacy`, seed **37**, `completed: 37`. Le **37 righe complete sono i seed 0–36**: includono hash post-attachment e verifiche di ricetta/ownership/rigidità/RNG/extent completate. Rimangono evidenza parziale, senza PASS complessivo dei 305 seed previsti.
- Per il **seed 37**, `traceA` e `traceLegacy` sono stati chiamati, ma il controllo RSS immediatamente dopo `traceLegacy` interrompe il flusso **prima** delle asserzioni di parità legacy e di `tracePost`/invarianti post-attachment. Non è un 38° caso qualificato. `focus` è vuoto: i seed 72/73/74 non sono stati raggiunti in questo witness.

Lo stop/no-retry del protocollo resta applicabile: nessun modello candidato, test, build o native B qualificato da questo risultato. La precedente precondizione A isolata PASS rimane distinta e non trasforma questo fallimento in un PASS funzionale della candidata. I dati non dimostrano un difetto morfologico né consentono di attribuire il picco RSS al solo builder.

Ricevute autenticate: `prefix-execution.json` SHA `5f89eeb9e7883235350d566e9675efed4338ad3206a2c1aed463ba11f561a8cf`; `prefix.log` SHA `161f6a4044c500ea16623a76181675650dc8d4a9771be063740d3aa3aa87e240`, identico al pin nella ricevuta.
