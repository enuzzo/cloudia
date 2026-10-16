# Protocollo congelato — A-only, 16 ottobre 2026

UNA esecuzione CPU autorizzata: 576 raggi storici (32×18), due grid 128³/256³.
Nessun nuovo generateVolume, GPU, browser, build, test prodotto, sweep o stato.

- Ricostruire con git show ab2e122 le dieci sorgenti elencate da
  rain-work/data/manifest.json.sourceHashesAfter e verificarle tutte esattamente.
  Conservare originali e copie runtime separate. La sola dipendenza aggiuntiva
  sun.ts viene presa dallo stesso commit. Import three/webgpu risolto verso il
  Three locale r186 verificato; niente installazioni o scritture dipendenze.
- Conservare script phase2 originali, trasformazioni e relativi SHA. Nessuna
  guardia originaria viene tolta; rafforzare il controllo alle dieci sorgenti.
- Verificare size/SHA degli input macro/detail/rain/flow, manifest e posa.
  Sunset non è necessario per tau/T: dichiararlo non letto, non fingere verifica.
- Riprodurre sequenza originale a0c2dfd79e1900dce9a677fceecbd5bfcfc138a2e94cd430938f4c4c7bf3ca7a,
  246399 iterazioni, 206466 rainRegion, 91572 contributori rain positivi;
  confrontare tutti i counts e lookup con il report storico prima dei risultati.
- Candidato: q.A del medesimo oracle half RG; q.s e s half ignorati. Non è
  un’allocazione scalare, né il costo di un rebuild GPU. Cache trilineare ideale
  CPU, coordinate/valori f32 e conversione binary16 RNE dichiarate.
- Ad ogni punto usare s originale, ricostruire le stesse xz e coordinate streak
  e verificarne uguaglianza. Conservare guardia UV e guessG originale. Mapping
  p99≤.75 m e massimo≤1.5 m; aspettativa zero, ma controllo esplicito e union A.
- Gate ottici invariati: max |deltaTau|≤.01, media≤.002 sui 576 raggi; riportare
  anche media sui raggi rain-positivi. Non aggiungere soglie a posteriori.
- Conservare errore A/sigma, A0→positivo e positivo→0, massimo errore T lungo
  ogni raggio e finale, tau/T per-ray e witness massimi con corner half/pesi.
  Misurare separatamente residuo del riordino moltiplicazioni sigma.
- La baseline governa t/ds/jitter/clip/cutoff; candidato integrato sugli stessi
  segmenti co-locati cloud+rain. Dichiarare censura se avrebbe proseguito oltre
  cutoff baseline. Nessuna pretesa di rendering candidato completo o sourceRGB.
- Nessuna probe aggiuntiva di cap, bordi, amount o crescita. Limite 45 s come
  audit precedente; un output incompleto non è qualifica e non si ritenta.
- Se fallisce un gate, fermarsi al report. Anche con tutti i gate superati:
  stato singolo, input CPU storico, sampler/flow nativi, transizioni, memoria,
  ricostruzione continua, costo dinamico, immagine e FPS rimangono non qualificati.

Il confronto è con il materiale storico invariato, non una riproduzione della
posa v50. Aerial/source sono omessi perché non cambiano tau/T: l’audit di fattibilità
separato usa comunque il coefficiente v50 k=.006+.004*haze.
