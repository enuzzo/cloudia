# Occupazione della vecchia spalla — review indipendente

17 ottobre 2026. Solo lettura di test/codice e algebra sui keyframe74 già salvati in `preflight-r2/result.json`. Nessuna ricetta, prepare, generazione, bake, nuovo test o GPU eseguiti; nessun sorgente modificato.

**Il FAIL è una regressione reale del contratto di occupazione dopo erosione a64. SupportMargin, pruning ottico e occupancy mask non la spiegano. Non è invece dimostrato un vuoto dell’inviluppo continuo né un FAIL a256.**

Il test conservato `inclinedShoulder.test.ts` richiede che almeno uno dei96 campioni Z abbia `sampleCloudDensity>0` sul piano x=.5609226029381325, y=4.0458440042043025, dopo `generateVolume(64,74)`. Non verifica il solo kernel ideale o la luce: richiede densità campionata, deformata e nuovamente erosa. È il precedente contratto del raccordo che il nuovo operatore sostituisce; il PASS di identità layout/costo non lo implica.

| Possibile causa | Che cosa prova il codice |
| --- | --- |
| Support prune del bake | Escluso come causa diretta: `data[R]` è impacchettato prima del loop `field<−supportMargin`; quel loop riusa il buffer Float32 density per la luce, senza cambiare R. |
| Occupancy o luce | Il test legge envelopeR e detailRGB. `bakeOccupancy` scrive soltanto detailalpha; i bake ottici scrivono i canali non-R. Non possono cancellare ciò che questo test campiona. |
| Halo negativo troppo piccolo a64 | Il wrapper usa `b=max(.35,supportMargin+.16+1e−6)`: a64 supportMargin=.3624136684 e b=.5224146684. Non sta riusando ciecamente il b=.35 nativo256. |
| Corner culling scanline | Il sorgente R3 conserva i siti capaci di aumentare il MAX Float32 mediante picco/boundary canonici. Nessun meccanismo di falso culling è stato individuato nella precedente review statica; questa lettura non aggiunge una prova numerica eseguita. |

L’inviluppo ideale non è interamente assente dalla sezione: interpolando soltanto neck→top a t=.6, dai tuple salvati risulta phi=.0762564747km sullo stesso x/y e z=−.3413771116. Il campione del test i43 ha z=−.328125: dista .0132521116km. Il bound spaziale1 dà quindi phi≥.0630043631km>0 anche in un punto effettivamente interrogato dal test. È un singolo argomento algebrico, non una scansione o un massimo calcolato. Non prova densità positiva dopo raster/erosione.

Il punto è sotto iceStart=4.5114671487 (derivato dal cap salvato e dalla trasformazione canonica), quindi il test usa ice0. La densità iniziale aggiunge un carving nonpositivo e sottrae il bias.025 dal campo. `sampleCloudDensity` applica poi warp fino±.08/±.06/±.08km, interpolazione della macrotexture e ulteriore erosione liquida `(1−r)*.38+(1−b)*.08`, fino.46 in unità di densità. Rimuovere i273 collar/figli e la vecchia ellissoide inclinata non conserva spessore o margine contro queste sottrazioni.

A64 i voxel misurano .15625/.1328125/.109375km e il budget della discretizzazione t è .013671875km, contro .00341796875 a256. La sola positività del campo ideale non garantisce i valori nei vicini warped/interpolati né il margine residuo dopo erosione. Il guard Float64/Float32 dichiarato è1e−6km e non formale; mancando valori locali di campo/densità/detail e margine dalla soglia, non attribuisco con certezza l’esito a floating point o al solo campionamento t. La quantizzazione/interpolazione a64 può contribuire, ma non è un errore di support prune.

La diagnosi sostenuta è una perdita di supporto **utile dopo erosione e campionamento** nella sostituzione del vecchio raccordo. La causa locale esatta fra carving, interpolazione, fine warp/erosione e minore margine del nuovo campo resta indeterminata senza nuova evidenza autorizzata. Non declasserei il test a obsoleto, non cambierei pruning/luce per farlo passare e non userei i601 kernel del prepare256 come prova di occupazione. Il FAIL resta aperto; questa review non autorizza nuovi run o modifiche.
