# Interior `.6 → .5`: prova app a camera fissa

16 ottobre 2026. **Trial scartato; renderer adottato v56 invariato.**
La revisione rende più ampie alcune cavità ma non recupera una struttura
ravvicinata convincente in Sole o Tramonto. Il goal resta attivo.

## Perché questa prova

La precedente diagnosi su seed72 aveva desaturato alcuni vecchi stencil con
`interior=1-.5*smoothstep(.04,.28,F)`, ma senza nuovo campo, luce o app.
L'arretramento dei vecchi punti front+5m non era un veto artistico del
proprietario. Questa prova completa proprio quel confronto mancante.

Base `a8653c53ba617e7dd8ba56c868d28b7c3d4c5234`, manifest122 sorgenti
`e826b119ff2758fa51ed04cf8748d0d40ad1ff09516fc498826466ceae3974b7`.
Variante esterna congelata122 file, manifest
`07d8fbb4ee270cdd5e8f6d4d5408fbc2c8c3ab2d4766e55457e7c804459705cf`.
Cambia una sola formula materiale; gli altri due diff sono versione del report
`observatory-v57-interior05-trial` e relativa aspettativa lifecycle. Shader,
generatore del dettaglio RGB, primitive, flusso, coefficienti ottici e camera
invariati; l'occupancy alpha del dettaglio è rigenerata dalla nuova densità.

Typecheck,31/31 test mirati volume/inclinedShoulder e build APP→hero PASS;
30 file nel dist comune,39.268.585 B. Nessuna suite completa richiesta a una
variante che fallisce già la guardia visiva; nessuna adozione o benchmark rain.
Il nuovo volume e la sua cache di luce sono generati realmente dall'app.

## Confronto riproducibile

Seed74, t60 in pausa, vento55%, dispersione0, flusso completo, macro256³,
dettaglio128³,384 passi nominali, output e interno1920×1080.
Il probe ordinario near60 produce surface0.7227685139973958km e target
[.3515625,3.119140625,-.0546875]. Il confronto fissa entrambi in A e B:
origine[.3515625,3.119140625,2.4401802442338285], yaw/pitch0, approach.6.

Cinque finestre30s: baseline a probe reale, A/B Sole e A/B Tramonto.
I raw confermano **stessa camera mondiale effettiva**, qualità, tempo e
vettori solari A/B; skyPending=false e atmosphereTransition=1 in tutte5.
Ogni prefisso misurato è completato, confermati tutti gli invii, zero residui.
Non è prova della presentazione del compositor o di un vantaggio causale FPS.
Sono finestre sequenziali a1920×1080; il contratto nativo completo resta
qualificato separatamente e i60FPS globali non sono raggiunti.

Le immagini sono JPEG CSS1237×922 del canvas configurato1920×1080, con
letterbox; **non sono framebuffer nativi**. Il limite vale per entrambe.

## Esito percettivo

La review indipendente delle quattro catture e la lettura del root concordano:
B cambia contorni e distribuzione delle cavità, senza recuperare piccoli
rigonfiamenti o incisioni leggibili nel corpo. Restano poche masse molto morbide.
La separazione più ampia è una differenza di forma, non una prova di maggiore
credibilità. Nessuna bocciatura fondata sulla preservazione del vecchio fronte.
Nessuna conclusione su topologia, altre famiglie, orbita o moto.

Console candidata: nessun warn/error osservato nella lettura finale CUA
(limit50), senza pretesa di copertura universale. La variante è rimasta esterna;
preview ordinaria v56 ripristinata sul server4196, Sole animato/output nativo.

## Misura geometrica complementare

Il protocollo congelato misura separatamente fronte e distribuzione d'opacità,
con13 UV fissati, offset verticale-.064 e microerosione pesata per inspection.6.
Il modello CPU non replica jitter/skip/adaptive step/f32 del renderer; non
promuove la variante né sostituisce il giudizio delle immagini.

Unico run seriale A→B, ciascuno con256³/128³ e13raggi: entrambi terminati
exit0 osservato da Popen,23,96/24,00s CPU getrusage, picco complessivo RSS
1.001.537.536B sotto2GiB. Nessun retry o cambio risoluzione. Il bug dei bounds
R1 è stato trovato dalla review prima del bake: mancava l'halo engine[1.3,0,.65].
R1 conservata non eseguita; R2 corregge solo quello, poi review/freeze/preflight.
Nessun raggio risulta limitato dal terreno nella prova conservativa.

Il primo materialeρ≥.002 arretra in13/13raggi, da11 a407m sulla griglia1m.
Al centro: fronte1.760,5→1.798,5m, τ1+69,790m e profondità media pesata
per contributo all'opacità+63,303m. Il centro ripetuto a0,5m dà rispettivamente
+69,790m e+63,315m. Non estendere questa convergenza agli altri12raggi.
La prima soglia registra filamenti deboli e non coincide con la massa otticamente
dominante; le due misure sono archiviate separatamente. Il raggio del probe
0,7228km non era una distanza dal materiale nella posa60: al centro il fronte
è ancora a circa1,76km. Questo confronto non qualifica la massima vicinanza. Nei13raggi il primo
materiale è a1,55–2,51km; la microerosione limitata ai primi300m è quindi inattiva
in questa posa, anche se il modello diagnostico ne include correttamente il peso.

Il cambiamento include quindi un arretramento reale della materia visibile,
senza un miglioramento percettivo sufficiente nelle immagini. Non è una misura
RGB né una prova che tutto il cambiamento fotografico sia spiegato dal solo
arretramento. Le impronte SHA-256 di macro, cache e flow sono archiviate nei risultati; l'alpha del
dettaglio contiene occupancy derivata e può cambiare, perciò il digest RGBA
intero non è un test di uguaglianza del solo dettaglio RGB.

Erratum del solo monitor: i campioni libproc CPU erano tick Mach divisi per1e9
senza timebase125/3, quindi il campo cpuSeconds grezzo era sottostimato×41,6667.
Conservati byte originali e correzione offline. RLIMIT_CPU180 del kernel,
getrusage terminale, RSS e wall240 restano indipendenti e corretti. Nessuna
rigenerazione del volume per correggere questa etichetta.

## Prossima discriminante

Prima di altre modifiche al materiale, rendere disponibile una cattura PNG
intenzionale del framebuffer con metadati dello stesso frame. Il JPEG CSS non
consente di distinguere tutta la perdita nel render dalla riduzione di scala.
Il piano è separato dalla cura della nube e non introduce un cambio di qualità.

Archivio esterno completo: `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-16-cycle23`.
[Evidenze curate e verificatore offline](measurements/interior-density-2026-10-16/README.md).
79payload,3.166.309B; manifest SHA-256
`d1b351951ee3ff964f878fad260b64901475f788dfc088ff63c4468e8284bf61`.
Il verificatore controlla anche i cinque raw e, opzionalmente,122sorgenti base
più la candidata virtuale ricostruita con tre override, senza scrivere o ricompilare.
