# Cortina pioggia v56 — evidenze, ipotesi e singolo trial circoscritto

16 ottobre 2026. **SOLA LETTURA / PROPOSTA NON IMPLEMENTATA.** Checkout verificato `a8653c53ba617e7dd8ba56c868d28b7c3d4c5234`. Nessun source edit, bake, test, scanner, build, browser o GPU. Riletti i sorgenti e i documenti storici; l’immagine è stata aperta con view_image.

## Evidenza osservata e stato esatto

L’immagine [rain-native.css.jpg](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/shoulder-continuity-2026-10-16/browser/rain-native.css.jpg) è un **JPEG CSS 1237×922**, non il framebuffer nativo. Mostra una cortina grigia abbastanza omogenea, con poca separazione fra filamenti e un contorno verticale morbido. La parte bassa termina fuori dall’inquadratura/dietro il dock: questa foto non dimostra un fondo rettangolare, un distacco dal suolo o un errore di occlusione. Non è un video.

Il raw associato registra seme74, tempo60 in pausa, vento55%, dispersione0, rain≈.8, overcast del preset Pioggia, output e interno2474×1844, macro256³/detail128³/384 nominali, flusso completo. Camera `[15.108145390770279,7.1390324220971255,2.835301396133632]`, target `[0,2.7,0]`: distanza16km. forcingTime e precipitationTime rimangono0 all’inizio e alla fine; weatherTime avanza. Nessuna nuova ipotesi di clock errato.

## Mappa delle cause

| Evidenza dal codice | Implicazione supportata | Cosa resta ipotesi / falsificatore |
|---|---|---|
| `precipitation.ts:65–99`: massa delle colonne macro fino a y=2.5, filtro area su4×4 colonne, cap a1, Gaussian5×5 su mappa64², poi bilineare GPU | Sorgente con texel156.25×109.375m; filtro nominale σ≈un texel, supporto del kernel5celle. La struttura laterale della massa non può conservare piccoli nuclei indipendenti a scala12m. Il cap può appiattire le colonne più forti. | Non è stata letta la mappa RG8 effettiva del74: non dichiaro quanti texel siano saturi o che il cap domini questa foto. Una mappa R effettiva con ricche variazioni visibili alla scala della cortina smentirebbe la spiegazione “sorgente quasi piatta”. |
| `cloudShader.ts:116–134`: source statico backtraced; sheets segue la base emittente, poi è estruso lungo la caduta; fattori `(.15+1.85*sheets²)` e `(.35+1.3*streaks)` | Dove R, attachment ed evaporation sono positivi, i modulatori lasciano un fondo sempre positivo: minimo teorico del loro prodotto .0525. Non esistono veri vuoti prodotti dalle sole streak. La media lungo lo spessore può cancellare molto rumore fine pur mantenendo un velo continuo. | È una proprietà del modello, non prova di tau elevata. Occorre osservare tau rain e la sua variazione nella posa; da un JPEG non separo opacità e luce. |
| `cloudShader.ts:136–138`: rainLight usa soltanto sky del raggio, ambient globale, solar globale e fase; non usa nessuna profondità ottica locale della nube | Due punti di pioggia sullo stesso raggio ricevono lo stesso rainLight prima dell’aerial. Non possono mostrare variazioni dovute all’ombra della nube, anche se la cache della nube le contiene. Densità e sorgente luminosa sono oggi accoppiate solo nell’integrazione finale. | Non segue che aggiungere ombra risolva il velo: con luce coperta dominante potrebbe soltanto scurirlo. Una variazione di tau già leggibile ma RGB uniforme rende questa causa più plausibile; tau già uniforme indica invece anatomia/emissione da affrontare. |
| Detail.r: Worley32 più noise8; streak a2.6/km. Detail.g: noise16, sheets a.20/km | Scala dominante laterale delle streak≈12.019m, componente più larga≈48.1m; sheets≈312.5m. A16km/tanFov.2867 un pixel nativo vale≈4.975m, un pixel CSS≈9.951m: la componente12m occupa≈2.42pixel nativi ma appena1.21CSS, prima di integrazione/JPEG. | Le scale sono forme, non bande rigorosamente limitate. Non attribuisco tutta la levigatezza al downsample: il velo ampio resta liscio anche a scale molto maggiori. Un crop nativo senza ricampionamento può falsificare la parte “dettaglio fine nascosto dalla prova CSS”. |

La distanza entra già in `aerialTransmittance`: al preset Pioggia k=.006+.004×2.6=.0164/km, Tair(16km)≈.7692. Quindi un certo lavaggio del contrasto lontano è intenzionale. Non va eliminato per far sembrare la pioggia una texture vicina. L’occlusione attuale usa il primo triangolo del terrainRaster e ritaglia `far`/`rainFar` alla sua distanza (`cloudShader.ts:43–53,68–76`): il vecchio solver analitico in `landscape.ts` è diagnostico e non spiega questa cortina. Nessuna prova nuova autorizza a dichiarare tale integrazione globalmente perfetta.

## Una sola proposta di qualità: luce della colonna emittente dalla cache esistente

🌟 **Provare soltanto l’illuminazione spaziale dell’emettitore**, lasciando interamente invariati sorgente RG8, forza, attachment, evaporazione, sheets, streaks, estinzione .85, mapping, box, t/ds/jitter, 6m e quadratura cloud+rain. Non aggiungere rumore, aumentare contrasto delle streak o ricalibrare insieme estinzione/foschia.

Nel punto dove esistono già `column` e `rainUV`, la coordinata materiale dell’emettitore è:

```text
baseRef = column.g*3 - .5
emitterCoord = (rainUV.x, (baseRef+.5)/8.5, rainUV.y)
```

Una lookup GBA della macro cache a tale coordinata fornisce tau solare sinistra/destra e verticale. **Non applicare ancora cloudReference, crescita o drift:** rainUV/baseRef sono già le coordinate materiali del source statico; una seconda trasformazione sarebbe sbagliata. Usare la stessa interpolazione day/lowSun/side e massFactor della luce nube. A Tramonto serve anche la stessa lookup RG della cache lowSun. Nessuna nuova cache o risorsa; costo aggiunto reale: una lookup per campione sorgente positivo di giorno, due nel blend lowSun, più exp/ALU. Non è un’ottimizzazione FPS.

Definendo tauSun/tauUp con la decodifica16 e la correzione massFactor già usate per la nube:

```text
F = forwardRain * (1 - .7*overcast)
Vsun = exp(-tauSun)
Vsky = .18 + .82*exp(-.35*tauUp)   # stessa risposta ambient della nube
rainLightCandidate = .25*sky + .28*ambientColor*Vsky + solarColor*F*Vsun
rainSourceCandidate = mix(sky, rainLightCandidate, aerialTransmittance(t,haze))
```

Non sono coefficienti microfisici misurati; si riusa il modello luminoso già presente, senza un nuovo gain scelto per vincere la foto. `massFactor` modifica qui soltanto l’ombra della nube, **non spegne l’emissione o le gocce durante la dispersione**.

**Limite essenziale:** questa è illuminazione ereditata dall’emettitore, non la visibilità reale sole/goccia dopo chilometri di discesa e vento. Può trascinare troppo in basso un’ombra o produrre colonne scure ancora uniformi. La cache è UNORM8 tau16 e la luce è già un’approssimazione co-deformata. Non presentarla come shadow ray fisico, scattering multiplo della pioggia o soluzione completa. Se il proxy non aggiunge leggibilità nella guardia qui sotto, ritirarlo; non costruire prima una cache nuova per accelerarlo.

## Guardia minima e falsificatore prima di adozione

1. Sulla posa74 archiviata, acquisire **prima** un riferimento nativo della parte visibile e una diagnostica separata: tauRain accumulata nei segmenti visitati, T totale e sorgente rain media pesata. Marcare i raggi fermati dal cutoff come censurati, senza chiamare la loro tau un integrale fino al suolo. Questa misura distingue massa piatta, saturazione e luce piatta; non è un benchmark.
2. Se tau mostra già nuclei/canali ma la sorgente resta quasi costante, il singolo trial sopra è motivato. Se sono piatte entrambe, fermare la prova di luce e diagnosticare la sorgente effettiva; non sostenere che più ombra genererà anatomia assente.
3. A/B con identica posa, texture, clock, luce e quantità. T/tau e sequenza dei campioni devono rimanere identiche nel modello; il confronto GPU deve registrare l’eventuale differenza, non presumerla. RGB cambia intenzionalmente. Verificare finiti, clipping e console. ROI e criteri congelati prima del run.
4. **Falsificatore visivo:** se a luminanza comparabile della ROI la cortina conserva lo stesso profilo liscio e la differenza è principalmente oscuramento, il trial è FAIL. Chiedere nuova informazione spaziale leggibile, non solo un valore medio più basso. Non abbassare haze o alzare rainExtinction nello stesso trial.
5. Se la prima guardia migliora davvero, soltanto allora controllare Sole+rain, Tramonto, virga20/45%, vento0/55/100%, pioggia al mare e contro un monte, breve movimento e variazione della distanza. La foto attuale non vede l’impatto al suolo. Costi nativi e FPS vanno misurati dopo la qualità, includendo le nuove lookup; nessun guadagno promesso.

## Già fatto: cosa non ripetere come nuova ipotesi

- [QUALIFICATION:45–46,138–142,342–346](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/QUALIFICATION-2026-10-15.md): estinzione2.6→.85 già calibrata contro la parete grigia; broad sheets già riutilizzate per la virga0.98–1.82km e ancorate alla base. Un nuovo fade in y indipendente reintrodurrebbe lobi/strati; non chiamarlo novità.
- [RAIN-EMISSION-OPTIONS](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/RAIN-EMISSION-OPTIONS-2026-10-15.md): reservoir per la dispersione soltanto proposto, senza prova visiva; non spiega la posa dispersione0. Clock moto corretto in pausa, ipotesi del bug falsificata.
- [RAIN-CACHE-AUDIT](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/RAIN-CACHE-AUDIT-2026-10-16.md), [A-only](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/RAIN-AMPLITUDE-ONLY-2026-10-16.md): A/s fallisce il gate mapping massimo; A-only256 supera soltanto il gate CPU circoscritto. Nessun trial dimostra miglioramento artistico della cortina o FPS. Non ricampionare gli streak per mascherare la levigatezza.
- [RAIN-TERRAIN](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/EXPERIMENT-RAIN-TERRAIN-2026-10-15.md), [RAIN-EMPTY](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/EXPERIMENT-RAIN-EMPTY-2026-10-16.md): guardie del vuoto ritirate per costo, senza nuova anatomia. Zero-factor ha parità nativa della posa ma A/B/A interrotto: nessuna promozione o vantaggio FPS. Le narrow mask/R8 adottate sono percorsi di costo, non un modello nuovo di precipitazione.

## Fonti primarie mirate e interpretazione

[PBR book4, §14.1](https://pbr-book.org/4ed/Light_Transport_II_Volume_Rendering/The_Equation_of_Transfer) distingue attenuazione, sorgente locale e superficie che termina il raggio: sostiene la separazione diagnostica proposta, non i nostri coefficienti artistici. [Wronski, SIGGRAPH2014, pp23,31–36](https://bartwronski.com/wp-content/uploads/2014/08/bwronski_volumetric_fog_siggraph2014.pdf) include luce/ombre spaziali prima dell’integrazione; non trasferiamo il suo froxel morbido, risoluzione o prestazioni. [Garg e Nayar2006, §7/Fig5](https://cave.cs.columbia.edu/old/publications/pdfs/Garg_TOG06.pdf) mostrano che luce e vista modificano l’aspetto delle streak e che l’illuminazione coperta dà pattern più morbidi: è un motivo per evitare brightness costante, **non** per promettere gocce leggibili a16km o copiare un modello di streak vicine.

## Provenienza locale

| Input | SHA-256 |
|---|---|
| precipitation.ts | `561dace4f0ab9cbba246cefe0c14f23f5406bbabb1a5e3a00799d5d8aa08ce72` |
| cloudShader.ts | `f9d05d60526904297a4aab1cb013b84895f928c23a49cdf984b48447fbb9e568` |
| landscape.ts | `8a0e17f79d6ec5759dd0615ffa94434c479b7961d1f9e007df583fb463ca98ab` |
| volume.ts | `c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d` |
| rain-native.css.jpg | `58f12960f5d38aec0a2f0d221e45f571b0712d19bc212ad89bf539ad13685e40` |
| rain-native.raw.json.gz | `14ac823c22b6717f94672ae060cc9e91dd2fa0c628ffca69a7648fa2f1b32ca9` |

Le poche dimensioni/scale riportate sono aritmetica sui sorgenti e sul JSON salvato, non un nuovo run del modello. Nessun dato di visibilità per-goccia o tau per-pixel è stato acquisito da questa review. La diagnosi più forte resta strutturale; l’intervento proposto è deliberatamente falsificabile e non una qualifica già superata.
