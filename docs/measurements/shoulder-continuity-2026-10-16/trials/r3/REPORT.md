# R3 su baseline v55 — snapshot esterna per qualifica visiva

16 ottobre 2026. Nessuna adozione o modifica al prodotto. Il dist è pronto in
`../anatomy-r3-v55-source/dist/` per il server del root sulla porta 53755.

## Sorgente e ambito

I 119 file provengono esclusivamente da `cycle21/v55-final/source`, manifest
SHA256 `30c5448e87fb60c3bd3fdc8ca133993c49e54503a9950f9da1815fd59883171f`.
Tutti gli hash sono stati verificati prima della copia. Baseline del repository:
`ede11e0fda5f7f7a81e6e6cb1f76fbfbb08a4e3f`.

L'overlay di `volume.ts` è quello R3 già congelato, SHA256
`ebacc5ad2bca3515f34bfa4d2a4fe028ef4d20c09bcbe446104cfc794569a190`.
Nessuna nuova geometria, soglia o condizione: roof del corpo condiviso sempre
`max(oldRoof, selected.pivotY)`; recenter del gruppo interno soltanto quando la
proiezione selezionata è positiva. Le spalle rivolte all'esterno restano legittime.
La qualifica dei layout 1024, inclusi i 18 casi outward, resta l'evidenza del ciclo21;
non è stata ripetuta in questo pacchetto.

Le sole altre differenze sono la versione metadata
`observatory-v56-joint-r3-trial` in `GPUSceneEngine.ts` e la corrispondente attesa
esistente in `lifecycle.test.ts`. Terreno DEM, WorldCover, palette v55, CSS,
shading e motore sono quelli della baseline. Non sono stati adottati nuovi helper
o test di regressione in attesa della review Rain.

Il manifest candidato `e65c9209938773d3e4d1e3e6f649e4fb11bad01c731a4ee38258ebefdf39e3e9`
e il freeze `ba315751c3b768056bce1e5fbc27f2a7964a28920105cb9df8b2f2455fad93d4`
sono stati scritti prima di qualsiasi esecuzione; tutti i 119 hash sono identici
dopo i controlli e le build. Il vecchio R3 non è stato modificato. La provenienza
di questa snapshot usa direttamente i manifest e l'hash del volume, senza
dipendere dal precedente `audit-script-inputs.json` del ciclo21.

## Qualifica CPU a piena risoluzione: artefatto completo, comando WRAPPERFAIL

È stata eseguita una sola copia byte-esatta di `qa-approach.ts`, SHA256
`7e80d5e44aa047467f87b891476e2158e3156a122d370557ed1f145f0786c986`.
Il relativo import `../src` punta esclusivamente alla snapshot R3 di questo ciclo;
non importa il prodotto live. Runtime Bun 1.3.11, arm64. Budget dichiarato prima
dell'avvio: 20 minuti wall e 18 minuti CPU, nessun riavvio automatico.

Il risultato salvato contiene il volume effettivo 256³, dettaglio 128³, seed
1571198069, tempo 60, vento `[.3,.1]`, drift `[.2,0,0]`, campo di moto filtrato
half-float 16³ e tutte le 18 pose fisse dello script. Non conserva un buffer
volumetrico: il JSON contiene i risultati della ricerca sul volume generato.

| Misura salvata | Valore |
|---|---:|
| Durata interna dello script | 21,6625 s |
| Pose complete / superfici trovate | 18 / 18 |
| Errore massimo probe vs ricerca CPU densa 2,5 m | 0,011056 m |
| Errore massimo vecchia ricerca vs riferimento denso | 0,134249 m |
| Massimo campioni del probe | 213 |
| Probe CPU mediana / p95 / massimo | 0,0963 / 0,1570 / 0,2537 ms |
| Campo + probe CPU mediana / p95 / massimo | 2,3486 / 3,1987 / 3,2754 ms |
| Massimo spostamento fra campo filtrato e moto analitico | 136,4624 m |

**Stato comando: WRAPPERFAIL; exit code Bun sconosciuto.** Il wrapper Python si
è interrotto al primo heartbeat di 15 s perché la sandbox ha negato `ps`.
Il processo Bun originale ha continuato e scritto il JSON finale completo dopo
tutte le pose; al controllo successivo il PID non esisteva più. Il log stdout
non contiene quindi il riepilogo finale né un exit code recuperabile. Non è
corretto dichiarare un PASS del comando o exit 0. Nessun nuovo `ps`, riavvio o
seconda generazione è stato eseguito.

`qa-run-control.json`, `qa-monitor-error.txt` e il wrapper effettivamente eseguito
`run-qa.initial.py` conservano l'anomalia. `run-qa.py` è soltanto un wrapper di
replay con heartbeat del tempo trascorso, senza `ps`; non è stato eseguito.
Il raw SHA256 è `7a8124164deb9a98877058c32ab442fc49fb4335e9dbcf42bcb0481cd44d72a6`.

Il risultato numerico completo e la sua aritmetica sono verificabili offline;
non dimostrano che la superficie analitica e quella filtrata coincidano, né
costituiscono readback GPU f32. Lo script omette conservativamente microerosione
dipendente dalla camera ed erosione da dispersione aggiuntiva. Le pose del suo
seed fisso non sostituiscono il confronto visivo 74/77/80/617, né provano qualità
artistica globale, FPS o tutte le possibili posizioni della camera.

## Altri controlli eseguiti

- Typecheck: exit 0.
- I 31 test esistenti di `volume.test.ts` e `inclinedShoulder.test.ts`: exit 0,
  tutti passati. Nessuna suite completa aggiuntiva e nessun nuovo test adottato.
- Build app: exit 0; build hero successiva: exit 0. `emptyOutDir:false` della
  configurazione hero conserva il bundle app. Il dist combinato contiene 30 file.
- `node_modules` esistente collegato simbolicamente, senza installazione o copia:
  ignorato da Git, zero percorsi tracciati, attributo File Provider `1` prima e
  dopo. `node_modules 2` non è stato letto o modificato.
- Stato root finale invariato: HEAD `ede11e0…`, solo l'untracked estraneo
  `node_modules 2/`. Nessun browser, GPU, server o asset esterno nuovo.

## Riproduzione e verifica

La verifica seguente legge soltanto gli artefatti e gli hash, senza eseguire
modello, JS, bake o GPU. Il pacchetto è composto dalle due directory adiacenti
`anatomy-r3-v55-evidence/` e `anatomy-r3-v55-source/`:

```sh
python3 /percorso/cycle22/anatomy-r3-v55-evidence/verify.py
```

Per un futuro run esplicito, dopo aver preservato questo pacchetto, creare una
nuova directory di output e lanciare la copia `audit-scripts/qa-approach.ts` con
Bun e un nuovo percorso JSON; `src` deve puntare alla sola snapshot. Il modello
non richiede file del root. Le dipendenze devono essere ricostruite dal lockfile
sul Mac corrente oppure collegate a quelle locali già protette, senza copiarle
tra Mac. `run-qa.py` rifiuta di sovrascrivere i risultati presenti.

Il root svolge separatamente il confronto GPU A/B. Il candidato resta esterno,
senza approvazione artistica globale o adozione.
