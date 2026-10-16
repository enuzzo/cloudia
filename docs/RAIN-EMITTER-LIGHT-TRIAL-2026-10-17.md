# Cloudia — audit della base emittente e trial luce pioggia

17 ottobre 2026, ciclo 34. **Trial implementato e respinto: FAIL nativo root e indipendente. Runtime v59/9ea9840 conservato. Goal attivo.** Il turno ha misurato i buffer installati e provato una sola formula fissata prima della GPU; non ha migliorato il prodotto.

## Misura dai buffer realmente installati

Copia diagnostica esterna della v59, query `profile=1&emitterAudit=1`: il solo export PNG intenzionale allega un audit CPU read-only. Le identità delle array macro e sunset coincidono con quelle usate per costruire le texture installate. Macro256³ RGBA8/67.108.864B e sunset256³ RG8/33.554.432B sono presi in prestito: nessun hash/copia integrale, ricottura luce o nuova lettura GPU.

Sampler trilineare ideale UNORM8/clamp/mip0 ai punti XYZ=((x+.5)/64,3*(G/255)/8.5,(z+.5)/64). Cinque endpoint Float32, tabella 80 KiB temporanea; G è la base già quantizzata. Nessun warp/growth/drift duplicato. Questa è una previsione CPU della possibile BA, non readback del filtro GPU o BA già installata. Audit locale 13,7 ms al capture; nessuna deduzione FPS. Report compatto 50.966 B; la textarea completa, 285.876 caratteri, è stata trasferita in 18 parti, senza tagli di profondità. La prima lettura abbreviata resta soltanto nel workspace esterno e non è l'evidenza archiviata.

| Insieme | Celle | Coppie BA correnti distinte |
|---|---:|---:|
| R>0 |963|441|
| R0 con vicino positivo3×3 |148|26|
| Resto R0 |2.985|154|
| Nucleo+halo |1.111|459|

Le statistiche del resto non giustificano un trial. Sul nucleo, pesando per i codici R (forza sorgente, **non massa fisica**), la visibilità solare ha p50=1,125e−7, p75=8,923e−7, p95=.08128; risposta cielo p50=.18303, p75=.18746, p95=.29614. Quindi esiste variazione anche sul nucleo, ma il peso prevalente è già al limite di ombra. `VARIATION_ONLY_NOT_ART_PASS` abilita soltanto la guardia visiva.

Export diagnostico nativo 2474×1844: SHA 0dd971b684b29c9d9855a405878d903da025eb729f17832dda813ac50051fa1b, 2.585.113 B, identico al precedente bitmap v59 completamente trasferito. In questo audit si conserva un alias verificato di quel bitmap, senza fingere un nuovo trasferimento PNG.

## Unica candidata luminosa, esterna e non adottata

`experiment-v59-rain-emitter-light`: RG8→RGBA8 nella stessa rainTexture 64². R/G byte-identici; B=blend dei quattro endpoint solari, A=zenit, entrambiτ/16. Tutti i texel R0 hanno luce valida. Bounds calcolati ancora sul RG originale prima dell'espansione. Nuovo packet per volume; update dopo gli scalar applicati della luce, chiavi esatte e upload soltanto se cambia B. Upload iniziale incondizionato; release azzera il packet.

La seconda lookup esistente restituisce BA; nessuna lookup, binding o pass nuovo. Solo nel rainy shader:

```text
Vsun = exp(-column.b*16*massFactor)
Vsky = .18+.82*exp(-.35*column.a*16*massFactor)
Lrain = .25*sky + .28*ambientColor*Vsky
      + solarColor*forwardRain*(1-.7*overcast)*Vsun
```

Sky/aerial e coefficienti originali mantenuti. Broad v59 `.15+1.85*sheets*sheets`, base, attachment, evaporazione/virga, streak, estinzione, passo 6 m, materia e sequenza d'integrazione invariati. Shader/dipendenze dry byte-identici: la trasformazione riguarda `rainIntegrationSource`. La cache CPU si costruisce una volta per volume anche dry; non è costo complessivo zero. Budget aggiuntivo persistente CPU 90.112 B, GPU 8.192 B; RG temporaneo 8 KiB; due exp aggiunte per campione pioggia. Sono payload/operazioni, non costi GPU misurati.

Review statica indipendente PASS. Audit: 45 test mirati,441/441 in 47 file, typecheck e APP→hero PASS. Candidata: 52 mirati,442/442 in 47 file. Il primo typecheck ha trovato un nullable nel nuovo fixture; aggiunta guardia esplicita, poi 40 lifecycle e APP→hero PASS. Il fix riguarda soltanto il test; runtime della suite completa immutato. Nessuna installazione dipendenze; esclusione Dropbox node_modules=1 verificata prima e dopo.

## Gate nativo: FAIL e stop

Una sola posa Rain80, seed74/t60, main, piena 256³/128³/384 e 2474×1844, flusso completo. PNG 2.569.912 B, SHA fa80da6695f7f3eafd2a3dab134beaab804894e1fe57018bd3ee167a0c3f08d8, 53 parti complete, hash e IHDR verificati. Camera/materiale/luci e clock di nube/flusso/precipitazione match entro1e−12. WeatherTime è wall time distinto e differisce: flash uniform/counter tutti 0. Rain CPU differisce 1,17e−8, ma entrambi i valori si convertono nello stesso float32 .800000011920929; nessun readback GPU dichiarato.

**Verdetto root e indipendente:** scompare buona parte del pannello grigio chiaro, sostituito soprattutto da una zona ampia scura quasi uniforme. Non emergono aperture o piani di pioggia con profondità credibile. Non vediamo la nuova palizzata netta del trial broad precedente; il gate richiede comunque un miglioramento, non sola attenuazione. Viste PNG intere e ROI 1:1 fissa [900,1240,1800,1820]. Non è una misura fisica delle gocce né un giudizio su tutti i seed.

Stop rispettato: nessun worker, Sole candidato, moto o FPS dopo FAIL; nessun fitting di broad/estinzione/haze/light gain. Non promuovere helper o shader. La luce all'emettitore non dimostra la visibilità della goccia durante chilometri di discesa: questa singola prova non risolve il velo.

## Evidenze e continuità

Archivio [rain-emitter-light-trial-2026-10-17](measurements/rain-emitter-light-trial-2026-10-17/manifest.json):49 payload, 3.566.885 B, manifest SHA f565e05cde5887bf3f28ec9fba8008bba25e87bdecec21e11d9ef6e6fce03880. Include manifest base 126, overlay audit128 e luce128, helper/test/review, log qualifica completi, JSON integrale, PNG/ledger/ROI e ripristino UI. Saved-evidence verifica solo file salvati e contratti di stop; non riesegue modello/GPU/benchmark. Source/dist completi esterni in `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle30`.

Preview4196 ordinaria v59 ripristinata: Sole, animazione attiva, console osservata vuota. Server audit53769/session34247 e trial53770/session21789 chiusi intenzionalmente, terminal0.4201 e node_modules2/ estranei intatti. Sorgenti126 prodotto byte-identici al manifest fb6c2319… . Nessun push/deploy.

Prossimo passo concreto: tornare alle patch d'ombra del terreno, rimappando i 12 UV già selezionati su receiver/caster/faceID della mesh **v59 effettiva**. I blocker v58 non sono verità fisica corrente. Nessun raw-nearest/PCF ingenuo o nuovo bias arbitrario: prima un piccolo witness discriminante sulla geometria corrente. Anatomia/vicino, pioggia/virga, fotorealismo paesaggio/UI e 60 FPS restano aperti.
