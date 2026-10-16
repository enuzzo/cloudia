# Luce della base emittente nella mappa pioggia esistente

17 ottobre 2026. **Proposta unica, non implementata e non eseguita.** Sorgente letto: v59/`9ea98406706ef53412b3105987262397df232ccd`. Nessun product edit, modello, bake, test, build, browser o GPU. Il trial broad .35/.65/2 è **FAIL visivo** comunicato dal root: pannelli/bande verticali, stop prima di worker/moto/FPS. Questa proposta conserva la modulazione v59 originale; nessun nuovo fitting della sua soglia.

🌟 **Scelta:** estendere la sola rainMap da RG8 a RGBA8, mantenendo R/G identici, e mettere in B/A profondità ottica solare corrente e verticale alla base emittente. I cinque endpoint originali restano in una piccola tabella CPU64²×5, creata dai buffer già ricevuti. Durante i cambi di Sole/Tramonto si ripacchetta B con gli stessi scalar blend applicati alla nube. Il fragment legge BA nella lookup della colonna che già esiste: nessuna nuova lookup2D/3D, binding, pass o bake3D.

**Rischio decisivo:** la base potrebbe trovarsi sotto profondità già clippate a16 quasi ovunque. In quel caso questo proxy aggiunge soprattutto oscuramento uniforme, senza informazione utile. Non giustifica costruire una cache grande o promettere FPS. È una proposta di qualità con costo limitato da qualificare, non una cura già dimostrata del velo.

## 1. Canali ed equazione attuali, verificati nel codice

`volume.ts:438–451` cuoce la luce dal campo con erosione fine e rapporto di estinzione liquido/ghiaccio, poi codifica ogni τ con `round(clamp(τ/16)*255)`. Un codice equivale a16/255≈.062745 di profondità ottica, dimensionless; **non sono chilometri né visibilità già esponenziate**.

| Buffer già disponibile | Canale | Significato |
|---|---|---|
| `CloudVolume.data`,256³ RGBA8 |R|Macro densità sorgente, non τ|
|stesso|G/B|τ giorno verso SUN_LEFT/SUN_RIGHT, divisa16|
|stesso|A|τ verso zenit, divisa16|
|`CloudVolume.sunsetLight`,256³ RG8|R/G|τ verso i due endpoint bassi `solarDirection(side,true)`, divisa16|
|rainMap64² RG8|R|Forza della colonna, massa filtrata sotto2.5km|
|stesso|G|BaseRef codificata `(baseRef+.5)/3`|

`cloudShader.ts:177–190` interpola prima la **profondità** giorno sinistra/destra, poi giorno/Tramonto, quindi applica `massFactor` ed esponenziale. La direzione angolare del Sole interpola separatamente: il blend delle cache non è un ray trace della direzione intermedia. Riutilizzare la stessa approssimazione preserva la coerenza col modello luce della nube.

La pioggia oggi usa (`cloudShader.ts:125–138`):

```text
F = .08 + .2*max(dot(ray,sun),0)^8
Lrain = .25*sky(ray) + .28*ambientColor
      + solarColor*F*(1-.7*overcast)
Srain = mix(sky(ray), Lrain, aerialTransmittance(t,haze))
```

Nessun termine dipende dalla visibilità della colonna. La colorazione globale di Sole/Pioggia/Temporale/Tramonto è già in sky/solarColor/ambientColor: **non** ricuocerla nei canali BA, altrimenti si duplicano attenuazione atmosferica e interpolazioni del cielo.

## 2. Costruzione una volta per volume, senza doppio warp

Usare esattamente `rg=precipitationFootprint(textures.source)` nel punto già presente `GPUSceneEngine.installVolume:290`. `CloudTextures.source` contiene davvero size/data/sunsetLight (`:41,398–432`); non servono nuovi worker packet o trasferimenti. Calcolare i bounds sullo stesso RG originale **prima** dell'espansione: `precipitationSourceBounds` assume stride2 e non deve leggere accidentalmente RGBA come RG.

Per ogni texel `(i,j)`, inclusi R0:

```text
u=(i+.5)/64; v=(j+.5)/64
G=rg[2*(j*64+i)+1]/255
baseRef=3*G-.5
emitterUVW=(u, (baseRef+.5)/8.5, v) = (u, 3*G/8.5, v)
endpoint[i,j] = [dayLeft,dayRight,lowLeft,lowRight,up]
```

Campionare CPU trilineare ideale UNORM8/clamp-to-edge/mip0, con indice `p=u*N-.5` e nodi adiacenti clamped. Macro stride4, sunset stride2; indice `((z*N+y)*N+x)*stride+channel`. Il `sampleDetail` esistente hardcoda stride4: **non** passargli il buffer sunset RG8 senza un sampler appropriato. Conservare cinque Float32 normalizzati τ/16 per texel.

Usare la base **già codificata** G, come il renderer, e non la base Float32 precedente alla quantizzazione. Le coordinate sono già materiali: non applicare di nuovo cloudReference, crescita, drift, shear, flow o warp. La cache3D già contiene il campo ottico con erosione fine. Anche i texel trasparenti devono avere BA validi: mettere τ0 nei soli R0 inventerebbe un bordo illuminato attraverso il filtro bilineare. G dei texel senza forza rimane identico all'estrapolazione/sentinel esistente (`precipitation.ts:101–114`).

## 3. Packing dinamico piccolo e interpolazione coerente

Proposta API futura, non codice implementato:

```text
buildRainEmitterLight(rg, source:{size,data,sunsetLight},size=64)
  -> {rgba:Uint8Array, endpoints:Float32Array}
updateRainEmitterLight(packet, lightSide, sunsetAmount) -> changed:boolean
```

Il contenuto RGBA è R/G originali, B corrente, A verticale. Indicando con l/s i **valori correnti applicati** lightSide/sunsetAmount:

```text
qSun = mix(mix(dayLeft,dayRight,l), mix(lowLeft,lowRight,l), s)
B = round(255*clamp(qSun,0,1))
A = round(255*clamp(up,0,1))
```

A si scrive una volta; B solo se cambia `(volumeGeneration,l,s)`. La texture rimane RGBAFormat/UnsignedByteType, LinearFilter, ClampToEdge, NoColorSpace, no mip. R/G non vengono ricalcolati, ricampionati o riscalati. La prima guess lookup legge ancora `.g`; la seconda passa da `.rg` a `.rgba` restituendo anche BA. Nessuna lettura3D nel frammento.

Effettuare l'aggiornamento subito dopo l'assegnazione di lightSide/sunsetAmount in `advanceAtmosphere:662–663`, prima del draw. Cache key sugli scalar correnti, **non** su skyMode/side intent/ultimo endpoint richiesto. `applySky:640–657` riparte dallo stato mostrato anche su transizione interrotta: usare quei valori evita uno scatto all'endpoint. Richieste sky pendenti/stale non anticipano il packing. Gli input uniform sono CPU submitted: si possono froundare prima del packing per avvicinarsi ai scalar GPU, senza dichiarare equivalenza ALU/filtro bit per bit.

Sole↔Pioggia/Temporale/Velato con stessi l/s non richiede upload: colori/foschia/overcast cambiano già via uniform/LUT. Side flip e Tramonto ripacchettano nei2.4s di transizione; anche in pausa i controlli continuano ad assestarsi. A stato fermo zero upload aggiunti. Amount, precipitationTime, vento, drift, crescita e flow non sono nuove cache key: l'emettitore è statico nel materiale. `massFactor` rimane nel fragment per seguire la dispersione senza ripacchettare ogni frame.

Nuovo volume: costruzione e commit della tabella devono appartenere allo stesso packet accettato della rainMap. Rigenerazione fallita/payload scartato non sostituiscono il vecchio stato; release/device loss/destroy svuotano tabella e key. La texture rimane un solo oggetto posseduto dall'engine. Nessuna tabella trattenuta per ogni seme e nessun async callback nuovo.

## 4. Singola modifica luminosa, coefficienti originali mantenuti

```text
sunTau = column.b*16*massFactor
upTau  = column.a*16*massFactor
Vsun = exp(-sunTau)
Vsky = .18 + .82*exp(-.35*upTau)
LrainNew = .25*sky(ray) + .28*ambientColor*Vsky
         + solarColor*F*(1-.7*overcast)*Vsun
SrainNew = mix(sky(ray), LrainNew, aerialTransmittance(t,haze))
```

La risposta ambient riprende `.18+.82*pow(exp(-τup),.35)` della nube, non aggiunge multiple scattering o un gain di compensazione. Il termine sky.25 resta identico, insieme a fase F, colori e shared aerial. Source RG/base, attachment, evaporazione, broad **v59**, streak, estinzione.85, box, t/ds/jitter,6m, clip terreno, macro256³/detail128³/384 e output pieno rimangono invariati. Anche la specializzazione dry deve conservare template/deps WGSL baseline, senza nuovo calcolo quando hasRain è falso.

In aritmetica ideale Vsun/Vsky≤1: a T/τ invariati l'intervento può solo abbassare la radiance rain, creando contrasto **relativo**, non nuclei assolutamente più luminosi o nuovi vuoti. Se sembra soltanto un pannello scuro, è FAIL. L'eventuale monotonicità RGB GPU va osservata entro il suo errore, non dichiarata bitexact dal ragionamento scalare.

## 5. Budget concreto, non misure di prestazioni

| Voce | Prima | Proposta / delta |
|---|---:|---:|
|rainMap64² payload CPU/GPU ciascuno|8192B|16384B; +8192B ciascuno|
|Tabella CPU5×Float32 per texel|0|81920B|
|Delta CPU persistente nominale|—|90112B, circa88KiB|
|Delta GPU persistente nominale|—|8192B,8KiB; nessun nuovo binding|
|Nuova costruzione per install|—|4096posizioni,8corner×5canali=163840letture byte logiche dai buffer esistenti|
|Packing B durante l/s mutevoli|—|4096texel,3mix scalari ciascuno,round/clamp e upload16KiB per aggiornamento|
|Stato fermo|—|nessun packing/upload aggiunto|
|Per campione pioggia|2lookup rainMap +2detail|stesse4lookup; BA incluse nella seconda, +2exp e pocheALU|

A60aggiornamenti/s il tetto nominale upload è circa.94MiB/s;2.4s corrispondono a circa2.25MiB se144aggiornamenti. Non sono tempi misurati o disponibilità garantita. Lo RG temporaneo aggiunge8KiB nel momento di espansione e può essere rilasciato; i temporanei Float32 della footprint esistono già. Non si alloca un altro256³ né si ricuoce opticalDepth. RGBA raddoppia il payload formato di questa piccola texture: nessuna promessa che i fetch hardware o FPS restino identici, e nessuna pretesa di eliminare le exp per campione.

## 6. Approssimazioni e falsificatore prima di promozione

- **Proxy fisico:** luce al punto emittente, non visibilità reale della goccia dopo chilometri di discesa/vento. Può trascinare fino al mare l'ombra della base e scurire rain non più coperta dalla nube. Non sono shadow ray né conservazione dell'acqua; non risolve la proposta separata di emissione ritardata in dispersione.
- **Risoluzione/filtri:** bilineare dei valori τ già campionati sulla base64² non equivale al trilineare3D valutato alla quota base interpolata del singolo passo. La superficie base può variare entro un texel; si perde informazione laterale presente nel256³. Non promettere nuove striature12m da questa cache64².
- **Quantizzazione:** aggiungere un packing UNORM8 introduce al più mezzo codice ideale, circa.03137τ, oltre all'errore preesistente. Il blend di τ prima dell'exp è coerente con la nube; interpolare visibilità già esponenziate sarebbe un altro modello. La conservatività del sampler GPU non è dedotta da questo conto.
- **Saturazione:** τ clippata16 dà Vsun≈1.1e−7 e Vsky≈.183 a massFactor1. Colonne quasi tutte a quel valore hanno quasi la stessa risposta: l'idea può fallire prima di una prova artistica.

**Primo passo dopo eventuale autorizzazione:** costruire solo la tabella dal volume già installato e registrare range/quantili delle BA effettivamente packed, pesati anche da R, includendo i vicini R0 del supporto bilineare. Nessun nuovo bake3D. Se le BA sul supporto sono identiche, manca informazione spaziale nuova: fermare la proposta, senza un trial GPU per ottenere soltanto oscuramento. I range non nulli sono una condizione necessaria, non un PASS visivo o una soglia da adattare al risultato.

**Guardia singola se la tabella è informativa:** nativa Rain80 seed74/t60 stessa camera, clock, volume, flusso, sky assestato e output della baseline. T/τ e sequenza di integrazione devono restare invariati nel modello; RGB cambia intenzionalmente. Richiedere lettura spaziale credibile di parti illuminate/ombreggiate e profondità, senza pannelli/scacchi/frange o una macchia uniformemente più scura. Se non emerge questo, **FAIL e stop**, senza rifitting di estinzione, foschia, soglia/gain broad o nuova normalizzazione della luce. Niente FPS/worker/moto dopo FAIL.

Solo dopo un miglioramento reale: endpoint sinistra/destra, transizione giorno↔Tramonto e interruzione a metà, Rain/Temporale/clear+slider, dispersione e rigenerazione/loss/cleanup, virga/vento e breve moto. Misurare poi costo nativo A/B/A includendo packing/upload nelle transizioni; una posa statica non qualifica quel costo. Main/worker condividono lo stesso engine ma richiedono entrambe le prove. Il campo cloud e la materia della pioggia restano quelli qualificati v59.
