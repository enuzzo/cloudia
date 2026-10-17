# Prossimo controllo delle creste — proposta, non eseguita

**Una sola proposta: ledger GPU delle normali e dei fattori di luce nei dodici pixel già fissati.** Prima di scegliere una correzione, distinguere la normale della faccia, la normale interpolata realmente ricevuta dal materiale e la normale finale perturbata. Nessuna nuova palette, soglia crease, intensità delle normali, quote, bias o filtro shadow. Prodotto v60 invariato; nessuna implementazione, modello o GPU del revisore.

## Evidenza che motiva il controllo

Ho aperto i PNG nativi A/B di cycle36 e i ritagli primari già salvati, senza ridimensionare o modificarli. A SHA `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`; B SHA `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9`. Entrambi2474×1844, camera e luce coincidono nei JSON. L'ottica articola i versanti; piccoli segmenti scuri restano nelle stesse zone delle creste. Questo non identifica il loro termine shader, né dimostra che ogni segmento sia un errore. L'ottica contiene inoltre ombre del composito: il solo PNG B non separa colore osservato e ombra del renderer.

I tentativi precedenti delimitano il problema:

- **Forced-lit:** nei12pixel storici, sostituire solo solarVisibility con1 non cambiò nessuno dei48float RGBA. Non ripetere un trial unshadowed come se mancasse questa prova; non estendere il risultato all'intera ROI.
- **Crease45:** quote/corner identici, alcune linee più nette ma nessun beneficio visivo; respinta. Non scegliere un altro angolo.
- **Albedo-only:** L1 conserva quasi tutto il contrasto relativo, L2−90% e L3−75%; rimosso però l'intero ramo normale/diretto/ambiente. Non attribuisce la differenza alle sole ombre o normali.
- **GLO30:** lieve miglioramento di fedeltà numerica, native FAIL e nessuna adozione; non giustifica un altro aumento cieco di triangoli.

Riferimenti locali: `docs/TERRAIN-DIRECT-LIGHT-AND-CREASE-2026-10-17.md`, `TERRAIN-ALBEDO-DIAGNOSIS-2026-10-17.md`, `TERRAIN-GLO30-STATIC-TRIAL-2026-10-17.md`.

## Causa verificabile nel codice

`terrainMesh.ts:52–73` somma le normali delle facce pesate per area e conserva una normale condivisa per vertice; `:419–420` passa `normalWorld.normalize()` al materiale. **La modalità chiamata geometry non implica una normale costante per triangolo nel frammento.** Il materiale normalizza questa interpolazione a `terrainSurface.ts:161`, calcola slope e biomi da essa, poi a`:189–195` costruisce

`n = normalize(Nmacro − (rough.x,0,rough.y))`,
`D = max(0,dot(n,sun))`,
`S = clamp(.62+.38*max(0,n.y)−.12*valley,.45,1)`.

Il colore del suolo contiene `albedo*(.90*solar*D*V + 1.12*ambient*S)` più acqua interna. Se D è zero, una visibility V errata non può cambiare quel contributo diretto: è compatibile con il forced-lit nullo, ma il valore di D non è ancora stato letto. Nella zona misurata WorldCover guida anche rockCover/treeCover e quindi rough; la texture ottica cambia albedo, non queste normali. Non chiamare automaticamente il residuo «acne».

Three r186 distingue proprio normale di faccia da derivate e normale smooth interpolata: [Normal.js, righe34–85](https://github.com/mrdoob/three.js/blob/r186/src/nodes/accessors/Normal.js#L34-L85). L'eventuale ricostruzione geometrica via derivate deve rispettare spazio/orientamento e controllo uniforme, come specificato dal [W3C WGSL](https://www.w3.org/TR/WGSL/#derivative-builtin-functions). Non serve aggiungerla al primo ledger: esistono già corner e normale geometrica del witness installato, riutilizzabili soltanto dopo identità di geometria/camera/luce verificata, con limite CPU ideale esplicito.

## Protocollo minimo proposto

1. Congelare source/asset, camera/Sole2474×1844 e gli stessi12pixel di `TERRAIN_SHADOW_WITNESS_POINTS`. Nessun nuovo raggio, sostituzione di punti o ricerca del pixel favorevole. Prima eseguire sulla variante materiale effettivamente scelta dopo checkpoint/FPS, senza confrontare per errore v60ordinary con optical B. Annotare che gli ID artifact/control sono storici.
2. Una diagnostica derivata con anchor esatti dal materiale attuale esporta **tre record RGBA32F per pixel**, riusando il target terreno/camera/mesh installati: `(Nmacro.xyz,distanza)`, `(n.xyz,distanza)`, `(D,S,V,distanza)`. Sono tre draw diagnostici con BBOX prefissato; nessuna sostituzione di normale nel colore ordinario, lookup aggiuntivo, mesh/bake o nuovo grande target. Tutti i calcoli e le textureSample restano fuori da eventuali rami divergenti. Non rivendicare identità del codegen diagnostico con il materiale prodotto.
3. Leggere anche i12RGBA ordinari prima, ripristinare subito il materiale ordinario e il target completo prima degli await, drenare le copie in errore; gate full-target cached/fresh/ritorno e PNG ordinary esatti. Alpha/distanza dei36record deve coincidere ai punti. Se ordinary o geometria visibile non coincidono, fermare l'attribuzione. Formula factory(false) byte-esatta; evitare il precedente errore R0 di accettare soltanto PNG+12pixel mentre il digest intero differisce.
4. Confrontare solo aritmetica salvata: dot signed di faccia/Nmacro/n con il Sole, angoli e differenza macro→finale, D/S/V e moltiplicatore RGB di luce. Conservare originali, finite/range e cache prima/dopo. Dimensione restituita nominale:12×4×16=768B per ordinario+3record, esclusi staging/renderer. Tre draw attraversano comunque la geometria; lo scissor limita i frammenti, non rende gratis il vertex work. Nessun benchmark durante l'audit.

## Falsificatori e stop

| Risultato nei punti | Conseguenza locale, senza promuovere un fix |
|---|---|
| D=0 in entrambi i membri di una coppia | V non spiega il suo contrasto diretto; non cambiare shadow per correggerlo. |
| macro·sun e finale·sun attraversano0 solo dopo rough | Perturbazione materiale coinvolta nel terminatore; non è ancora prova che eliminarla migliori la cresta. |
| faccia e macro hanno segni diversi, rough non li cambia | Smoothing/interpolazione è un candidato causale specifico; non dimostra un buco o triangolo errato. |
| D e S quasi uguali, contrasto RGB persistente | Cercare colore/maschera/acqua o trasporto, non correggere normali da questa prova. |
| Tutti i campioni non distinguono i termini | Esito inconclusivo: non cambiare parametri. Un protocollo separato potrà fissare un breve transetto che attraversi una ribbon, prima di qualunque nuova lettura. |

Il ledger può escludere meccanismi o spiegare singoli punti; non misura la forma dell'intera ribbon, correttezza geografica, fotorealismo o FPS. Nessuna nuova architettura caster/clip, bias, blur, sweep o adozione automatica segue questa proposta. Letture/ricerca e stesura terminate prima delle finestre FPS; nessun altro job del revisore.
