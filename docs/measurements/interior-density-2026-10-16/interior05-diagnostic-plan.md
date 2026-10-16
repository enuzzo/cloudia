# Piano diagnostico74 near60 — NON ESEGUITO

Autorizzato ora soltanto il piano; nessun campo/bake/probe aggiuntivo. Esecuzione subordinata al verdetto visivo e al via CPU del root. Input congelati in `interior05-diagnostic-inputs.json`, camera originale `CAMERA.json`. A e B devono riprodurre origine `[.3515625,3.119140625,2.4401802442338285]`, target `[.3515625,3.119140625,-.0546875]`, surface `.7227685139973958`, yaw/pitch0,approach `.6`,t60,1920×1080,vento.55,dispersione0,flowfull. La surface è un raggio del probe; non è la distanza del primo materiale dal punto di vista attuale.

**13 UV fissati**, top-left continui, ordine per righe: x=.05,.5,.95 a y=.05,.5,.95; poi [.35,.5],[.65,.5],[.5,.35],[.5,.65]. Mantenerli identici tra A/B; nessun nuovo pixel scelto a risultato noto. Per confronti RGB le zone UI possono essere segnalate ma non eliminate dalle statistiche fisiche dei raggi.

## Ricostruzione necessaria

- Fonti A: snapshot122 `cycle22/anatomy-r5-v55-source`, manifest e826…; B: `interior05-source`, manifest07d8…. Verificare tutti i digest, stessa versione Bun1.3.11, nessuna rigenerazione via prefix riscritto. Se autorizzati, generare256³/128³ **in serie**, una variante viva per volta; registrare hash di macroRGBA8,detailRGBA8,lowSunRG8,flowRGBA16F e supportbounds, poi liberare i buffer. Nessun file binario enorme obbligatorio: bastano digest/metadata e campioni per il confronto pianificato.
- Ray = normalize(forward+right*(2u−1)*aspect*.2867+up*(1−2v−.16*(1−.6))*.2867), base forward[0,0,−1],right[1,0,0],up[0,1,0]. **Il vecchio probe-light seed72 aveva inspection1: copiarlo senza l'offset verticale−.064 cambia il raggio attuale.** Fonte `cloudShader.ts:32–33`.
- Stato t60/seed74 da motionState; drift e wind dalle formule engine442–445, stessi forcing/dispersione0. `fillMotionField`16³→half→trilineare/clamp e `writeFilteredSourcePosition` dopo sottrazione drift; niente sostituzione col flow analitico continuo. Usare i centri normalizzati con halftexel di motionField25–43.
- Il campionamento fine usa il medesimo `sampleCloudDensity` con warp, ghiaccio, R8 trilineare e flow.a. Micro aggiuntiva = `.6*(1-smoothstep(.08,.3,t))*(1-ice)*(1-detailB(local*8))*.055` quando il peso>.001; non l'ampiezza intera della vecchia posa100. Forcing0⇒massFactor1,fragments1. Se density<.002,zero. Fonti `cloudShader.ts:147–172`; `volume.ts:82–114`. Non usare il sampler conservativo del probe navigazione, che omette micro.

## Misure predefinite

Integrare lungo ciascuno dei13 raggi dalla camera al far della **comune AABB conservativa A∪B**, con passo midpoint1m; fuori dal dominio materiale density0. Verificare che nessun terreno intercetti prima la porzione di nube; se il bound terreno non lo prova, dichiarare quel raggio non confrontabile con lo shader senza depth raster, senza inventare una distanza. Terminazione ottica T<.006 come shader, conservando il termine residuo. Solo il centro ripetuto a.5m per stimare l'errore numerico: nessun passo cercato per salvare l'esito.

Registrare per variante/UV: direzione esatta, primoρ≥.002 e primoρ>.025 (soglie distinte), posizione mondiale/materiale e intervallo di risoluzione del fronte; τ1/τ3 con interpolazione nel segmento, eventuali null, τfinale/Tresidua; profondità media pesata **w=T_before*(1−exp(−sigma*ds))**, sigma=ρ*materialExtinction(ice); sommaw e normalizzazione esplicite. Conservare piccoli stencil R8/flow/detail e termini micro/ice sui checkpoint per audit aritmetico.

Il centro della vista è inclinato dall'offset screenY: distinguere distanza lungo raggio e profondità assiale `z=t*dot(ray,forward)`. Footprint sul piano assiale di primo fronte/τ1/media: larghezza=2*z*aspect*.2867,altezza=2*z*.2867; non scambiare la superficie del probe per questo footprint. Riportare Δfronte/Δτ1/Δmedia A→B in metri, separati da densità e variazione RGB.

Sole e Tramonto cambiano l'illuminazione, non questi percorsi di densità alla stessa camera/stato; bastano13 raggi per variante per la geometria ottica. Nessuna nuova calibrazione RGB o solar-shadow trace è inclusa in questo piano. Il vecchio modulo storico fornisce lo schema, non una prova della posa corrente: usa inspection1,2km fissi,tempo/seed diversi e aerial precedente. Non riciclarne quei risultati.

## Budget e limiti

Un solo job seriale A/B, RSS≤2GiB, CPUkernel≤180s,wall≤240s; heartbeat15s e handle vivo, nessun riavvio automatico. Il limite RSS richiede un monitor dedicato (RLIMIT_AS da solo non certifica RSS); in caso di superamento interrompere conservando parziali e stato, senza ridurre256/128. Scrivere protocollo/eseguibile/digest prima di avviare il job, dopo esplicito via root.

È una misura CPU continua della frontiera e della distribuzione d'opacità, non replica bitexactGPU di jitter,occupancy skipping,step adattivo o f32; non certifica RGB/arte/FPS. Lo spostamento dei vecchi front+5m non impone un FAIL artistico. Il confronto visivo alla stessa posa deve stabilire se è apparso rilievo coerente o soltanto meno materiale, più luce o perdita di contesto.
