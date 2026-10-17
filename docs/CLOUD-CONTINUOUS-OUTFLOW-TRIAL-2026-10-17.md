# Cloudia — raccordo continuo, prova respinta

17 ottobre 2026, ciclo44. **Implementazione esterna verificata e respinta: regressione di densità a64 e beneficio visivo insufficiente a256. Prodotto v61 invariato, goal attivo.**

Il tentativo sostituisce i tre collar discreti dell'outflow inclinato, i loro discendenti e la vecchia spalla con un unico inviluppo neck→top maturo→primo core di ghiaccio. Conserva tutte1918 primitive della ricetta74, ordine, RNG e contrazioni;273 primitive vengono escluse soltanto dal raster. Le altre famiglie conservano la ricetta. Non è una simulazione CFD. Terreno, shader, erosione, luce e qualità restano canonici.

Il campo è il massimo di ellissoidi interpolati, clippato alla banda negativa; una sola unione `.16` lo combina con il corpo. Il limite analitico di discretizzazione del campo è3,418m a256, con riserva numerica non formale: non è un limite sull'errore della superficie, sull'immagine o sulla densità dopo erosione. Il riferimento sulle [superfici di convoluzione anisotropa](https://www.sciencedirect.com/science/article/abs/pii/S0097849319300792) ha motivato la ricerca; il nostro operatore MAX non implementa l'integrale del paper. Le [caratteristiche WMO del calvus](https://cloudatlas.wmo.int/en/clouds-species-calvus.html) motivano la transizione della sommità, senza convalidare questo risultato.

## Costo, correttezza e regressione

Il primo preflight fallisce prima del raster: il solo conteggio parziale74 supera256 milioni di visite. Il valore256603112 è parziale, non il costo completo. Nessun volume o GPU viene eseguito da quel runner. Il fallimento è conservato, senza aumento di cap o epsilon.

La revisione scanline omette gli angoli inutili dei box, usando il medesimo sd canonico al picco discreto e ai due vicini esterni. Il fallback conserva l'intera vecchia riga nei casi dubbi. Griglia dei kernel e campo restano identici;29 test mirati passano, incluso confronto dei bit Float32 con il raster AABB su casi sintetici. La review indipendente non trova blocker nel culling. Il prepare e il raster ripetono le guardie: il costo non viene nascosto.

Cinque fixture di contratto passano; il solo preflight R2 effettivo verifica i cinque layout74/77/80/72/73 e i tre prepare256 in1,746s wall,2,007s CPU,209,2MB RSS. Il replay usa lo stesso enumerator: è controllo contabile, non solver geometrico indipendente.

| Seed | Kernel | Visite raster, guardie e merge | Tile |
| --- | ---: | ---: | ---: |
| 74 | 601 | 210.658.600 | 12.593.816B |
| 77 | 531 | 177.503.516 | 11.011.512B |
| 80 | 578 | 174.790.761 | 11.821.440B |

Per74 l'intera generazione prevede222.486.942 unità di lavoro includendo le guardie del prepare; i vecchi collar e la spalla avevano8.946.487 visite analitiche. Non sono tempi né risparmi FPS. Il nuovo costo di generazione resta considerevole.

**Typecheck e APP build PASS. Suite completa:589 PASS,1 FAIL su590 test/55 file.** Il test conservato `inclinedShoulder.test.ts:18` richiede densità positiva dopo erosione su una sezione della spalla del seed74 a64. Con la nuova sostituzione la sezione risulta vuota. Nessuna aspettativa è stata rimossa o indebolita. Un precedente errore TypeScript nei soli test e la sua correzione esplicita sono anch'essi conservati.

La review separata esclude come causa diretta luce, support pruning e occupancy: il test legge il canaleR e detailRGB, che quei passaggi non cancellano. Il campo ideale del nuovo inviluppo è positivo presso un campione reale della sezione; manca però il margine utile dopo raster, warp, interpolazione ed erosione. I contributi locali esatti restano indeterminati. Il FAIL a64 non dimostra un vuoto a256.

## Diagnosi visiva a qualità piena

La suite fallita aveva già escluso l'adozione. Una sola diagnosi nativa74 fronte/lato è stata autorizzata prima di B per collegare il cambiamento alla forma. Full quality256³/128³/384,2474×1844, Sole assestato, t60 in pausa. Camera mondiale, luce e controlli di rendering coincidono con il riferimento, senza ricentraggio sui bounds. Le eccezioni owner-local e weatherTime in cielo chiaro, rain0, flashoff erano dichiarate prima di B. Rimane una qualifica formale: `terrainRaster.cache.submissions` differisce149/148 ed era accettato dal primo classificatore come contatore dell'owner, ma non nominato esplicitamente nella lista precedente di richieste/hit. Il primo report è conservato e la rettifica non dichiara un PASS incondizionato dell'intero DTO. Il DTO stesso definisce quel valore come tentativi CPU di render, non un input fisico. Nessun rerun o modifica tardiva degli input; nessuna inferenza di uguale densità o campo luminoso.

| Posa | A v61 SHA256 | B R2 SHA256 |
| --- | --- | --- |
| Fronte | `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9` | `60757e475a67cb50976d220f4d8fee5444ad494c65ab85aeb0ed3af08349af97` |
| Lato | `c9c4681b03b9c4771c7be62974712b12b516e8b8717c22dc0907f18318aa2749` | `e0b47ea7d238b6649e5720004dead4b832eb7c2db33777905bef4ce7664f9860` |

A: nuovi DTO effettivi e alias dei bitmap già conservati, rihashati indipendentemente. B: PNG interi,74 e28 parti, verificati per byte/SHA/IHDR. Console candidata[]. Root e revisore indipendente hanno letto i quattro full native.

**FAIL visivo:** davanti resta il cappello quasi piatto sopra un collo scuro e liscio. Di lato il bordo inferiore è localmente più regolare e rastremato, ma la grande U resta e appare più esposta dopo il ritiro delle masse. Non compare un ponte massiccio nuovo; manca il beneficio complessivo richiesto in entrambe le pose. Non si attribuisce questo giudizio al test64.

Nessun tuning successivo, altra posa vicina, seed GPU, meteo/moto/worker o benchmark. Preview ordinaria4196 ripristinata su v61, Sole e nube matura animata, canvas2474×1844; console[]. QA53787/session52097 chiuso con exit0; owner4196/session48736 vivo. I141 sorgenti prodotto sono esatti; il candidato144 con7 percorsi differenti resta soltanto nell'archivio. Dipendenze ignorate da Git, non tracciate e Dropboxignore1 prima dei comandi; nessun install o lock edit. `node_modules 2/` e4201 estranei preservati. Nessun push/deploy.

Il terreno reale con aree abitate nella medesima texture resta la scelta autorizzata, senza edifici3D o pass aggiuntivi per le città; il payload ottico nominale resta44.739.240B, non costo zero. Nessuna nuova conclusione sui60FPS: la precedente pioggia pesante intorno a19 invii/s non è stata rimisurata. I [gate completi](measurements/terrain-face-direct-trial-2026-10-17/review/full-goal-gates.md) restano aperti.

Prossima azione: prima di un'altra modifica della silhouette, misurare in modo circoscritto il margine posterosione della sezione fallita e confrontarlo con il vecchio raccordo, riusando le sorgenti congelate. Il vincolo è conservare supporto utile e ridurre il costo, evitando di ripetere spostamenti della cap o sweep di raggi. Nessuna nuova esecuzione di questa diagnosi è stata effettuata qui.

[Archivio, sorgenti e risultati grezzi](measurements/cloud-continuous-outflow-trial-2026-10-17/README.md):142 payload/7.389.215B, manifest SHA256 `5f1824f6922e4e84d3fbdcc0580f0f30737c287808c959a85986bd46f8afed98`. La [verifica di conservazione](CLOUD-CONTINUOUS-OUTFLOW-VERIFICATION-2026-10-17.json) passa in0,101s leggendo120,3MB: archivio,141 correnti, ricostruzione144, PNG e parti/alias esatti. Non riesegue modello/GPU/FPS e non cambia i risultati falliti. Il goal resta attivo; questa prova non completa anatomia, luce ravvicinata, pioggia/virga, terreno finale, UI o FPS.
