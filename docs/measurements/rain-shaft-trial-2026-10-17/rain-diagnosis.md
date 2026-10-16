# Cortina di pioggia v59: diagnosi e singolo prossimo trial

17 ottobre 2026. **Analisi in sola lettura; proposta esterna non eseguita e non adottata.** Base verificata `9ea98406706ef53412b3105987262397df232ccd`. Nessun source prodotto modificato, modello, bake, test, build, browser o GPU. Aperto il PNG nativo archiviato; lette le evidenze e i sorgenti attuali.

## Quello che il bitmap dimostra

[refine-main-rain-native.png](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/terrain-source-refinement-2026-10-16/browser/refine-main-rain-native.png), 2474×1844, mostra una fascia larga grigia davanti a costa e mare, con variazioni verticali molto deboli rispetto alla sua larghezza. È presente nel bitmap nativo: il JPEG CSS non è la spiegazione sufficiente. Il fondo esce dall'inquadratura; non deduco un fondo rettangolare o un errore d'impatto al mare.

Il [JSON dello stesso draw](/Users/enuzzo/Library/CloudStorage/Dropbox/Mitnick/Cloudia/docs/measurements/terrain-source-refinement-2026-10-16/browser/refine-main-rain-native.json) registra seed74/sheared, t60 in pausa, forcing/precipitationTime0, crescita [1,1,1], vento55%, dispersione0, rain≈.8, haze2.6, overcast.85, 256³/128³/384, output=interno2474×1844. Camera circa [15.4597,7.5582,2.7806], target [.3515625,3.119140625,−.0546875]. Il renderer della foto è il candidato v59 precedente al solo cambio tag: l'handoff e i manifest documentano che mesh/materiali della foto coincidono con il finale. Non è una nuova acquisizione v59.

## Le cause, ordinate per forza della spiegazione

| Codice verificato | Conseguenza reale | Limite dell'attribuzione |
|---|---|---|
| `precipitation.ts:65–99`: area filtering della massa sotto2.5km, cap1, Gaussian5×5 su64², poi bilineare | Le celle sorgente misurano156.25×109.375m; il filtro rende vicini i nuclei e allarga le periferie. La mappa non contiene nuclei sorgente indipendenti da12m. | Non ho letto la mappa RG8 effettiva del74: non affermo che il cap sia saturo o che R sia piatto in una percentuale misurata. |
| `cloudShader.ts:131–134`: `(.15+1.85*sheets²)*(.35+1.3*streaks)` | Dove R/attachment/evaporazione sono positivi, entrambe le modulazioni lasciano un fondo positivo; il prodotto minimo teorico è.0525. Lo streak modifica la densità ma non apre un intervallo vuoto. Un raggio che attraversa molte oscillazioni fini può vedere soprattutto la media continua. | La presenza di un fondo non prova da sola saturazione ottica della foto. Non è stata misurata τRain per questa posa. |
| `volume.ts:71–77` e shader: sheets usa noise16 a.20/km; streak usa Worley32/noise8 a2.6/km | Scala caratteristica sheets≈312.5m, streak≈12m più componente≈48m. Il campo ampio segue la colonna emittente; il fine vive dentro una copertura sempre positiva. | Non sono bande rigorosamente limitate. La soglia proposta può rivelare la periodicità5km già presente nel campo sheets. |
| `cloudShader.ts:136–138`: rainLight usa sky del raggio, ambient e solar globali, fase | A parità di raggio la luce rain non contiene ombra/variabilità della colonna sorgente. Non può aggiungere struttura spaziale che la densità media ha perso. | La proposta della luce emittente esisteva già nel ciclo23, mai provata; può soltanto scurire il velo e costa1–2lookup aggiunte per campione. Non è la prima scelta qui. |
| `weatherState.ts:5`, `aerial.ts`: Pioggia attiva insieme rain.8, haze2.6 e overcast.85 | Il preset combina pioggia e atmosfera coperta. k=.0164/km: a16km Tair≈.769; lo sfondo e i coefficienti tendono al cielo distante. Parte del velo globale fuori dalla cortina è quindi atmosfera, non R della pioggia. | Non eliminare l'aerial per rendere il dettaglio lontano artificialmente vicino. La fascia davanti al mare è una componente distinta dal lavaggio dell'intera scena. |

**Conclusione operativa:** il modello produce deliberatamente una copertura continua con grana interna. Per fare leggere nuclei e canali a questa distanza serve cambiare prima la distribuzione del fattore ampio, non aumentare campioni o aggiungere altro rumore12m. Questa è una spiegazione strutturale supportata dal codice e compatibile con la foto, non una separazione quantitativa già misurata di tutti i contributi.

L'occlusione termina al primo triangolo del terrainRaster (`cloudShader.ts:43–53,68–74`); il solver analitico storico non è il percorso attivo che genera questa fascia. Non attribuisco alla mesh il velo. `forcingTime` resta fermo in pausa (`GPUSceneEngine.ts:449–454`); il controllo di intensità può invece assestarsi sul tempo reale (`:660–667`). Il vecchio sospetto di clock è falsificato, non un nuovo fix.

## Un solo intervento proposto: copertura intermittente dal campo esistente

🌟 [Pacchetto esterno rain-proposal](rain-proposal/README.md): **solo** il fattore broad viene sostituito nella specializzazione pioggia, con valori fissati prima di qualunque trial:

```text
c = smoothstep(.35, .65, sheets)
broadNew = 2*c*c
broadOld = .15 + 1.85*sheets*sheets
```

| sheets | Prima | Proposta |
|---:|---:|---:|
|0.25|0.265625|0|
|0.50|0.6125|0.5|
|0.75|1.190625|2|
|1|2|2|

Le soglie simmetriche attorno a.5 aprono uno zero per valori≤.35 e raggiungono il nucleo pieno da.65. Il massimo2 è lo stesso del materiale precedente. Il punto.5 è il centro nominale del campo, **non la sua mediana misurata**. I coefficienti sono autoriali, senza calibrazione microfisica. È un cambiamento di forma/ampiezza: alcune regioni perdono densità, altre ne acquistano; non è un fade uniforme, un'ottimizzazione equivalente o una conservazione della massa integrale. Nessuna normalizzazione per seme o gain adattato dopo l'immagine.

Rimangono identici sorgente R/G e quota base, backtrace, luce/estinzione.85, aerial, mapping/fase/streak originali, vento, box, clip, jitter, passi massimi6m, macro256³/detail128³/384 e output pieno. **L'evaporazione continua a ricevere sheets originale**, non c: la variazione di caduta della virga non viene riscritta. Il supporto della nuova densità resta sottoinsieme del supporto positivo R/attachment/evaporazione già racchiuso dai bounds; il massimo globale broad non cresce, ma i valori puntuali possono aumentare. La diversa τ può anticipare/posticipare il cutoff T<.006, quindi il numero di campioni visitati non va dichiarato identico.

Costo strutturale: zero nuove texture, lookup, cache o pass; alcune ALU cubic/clamp aggiunte. Nessun guadagno FPS dedotto. La literal `integrationSource` dry e il suo insieme di dipendenze restano invariati; il nuovo helper WGSL viene incluso solo nel ramo compile-time rainy. La compilazione effettiva non è stata eseguita qui.

## Piano piccolo di implementazione e falsificatore

1. Root decide il singolo trial esterno e il tag. La patch aggiunge un helper CPU/WGSL e tre test piccoli proposti, non eseguiti: intervalli vuoti/nuclei, range/monotonia dei256codici UNORM8 e trasmissione ottica debole/forte con l'integratore CPU reale. Nessun nuovo framework o volume.
2. Prima guardia: PNG nativo Rain80 seed74/t60, medesima posa, clock, texture, cielo assestato e qualità della foto. Il confronto deve mostrare articolazione ampia e separazione costa/mare leggibili, non soltanto una media più chiara o più scura. Lasciare foschia, intensità e luce fisse. Si può riusare lo stesso volume installato per isolare la formula; la scelta tecnica del trial resta del root.
3. **FAIL e stop** se compaiono palizzata, ritagli/tubi duri, buchi scollegati dalla nube, trama periodica o se rimane una parete omogenea solo più debole. Non cambiare soglie/gain dopo la foto per salvarla. Non pretendere gocce individuali da12m alla distanza della nube.
4. Solo se questa guardia convince: virga20/45%, vento0/55/100, pioggia con Sole e Tramonto, una vista vicina/lontana e breve moto. Verificare attacco e occlusione a monte/mare, poi main/worker e costo nativo. La foto attuale non qualifica il fondo della cortina.

Le modeste differenze di media o di tempo GPU non sostituiscono il giudizio sulla struttura. Anche un PASS incrementale non risolve il fotorealismo generale né60FPS.

## Prove precedenti da non ricominciare

- `QUALIFICATION-2026-10-15.md:45–46,138–142`: estinzione2.6→.85 già adottata; cortina ancora larga. Non ripetere questa calibrazione come nuova anatomia.
- `:342–350`: virga0.98–1.82km e sheets ancorate alla base già adottate; non introdurre un fade Y indipendente o un clock nuovo.
- `EXPERIMENT-AERIAL-CONSISTENCY-2026-10-16.md`: aerial comune già adottata per coerenza; vecchia ipotesi di scala growth falsificata. Ridurre tutta la foschia non distingue il difetto della cortina.
- [Analisi precedente](../Cloudia-QA-2026-10-16-cycle23/rain-evidence-map.md): luce dalla cache emittente era una proposta, non un trial accettato né una novità odierna. Rimane seconda ipotesi se una densità già articolata avrà luce troppo uniforme.
- `RAIN-EMISSION-OPTIONS`: reservoir in dispersione soltanto proposto; non spiega dispersione0. Cache A/s, A-only e guardie del vuoto riguardano errori/costi, non hanno dimostrato un miglioramento artistico di questa cortina.

## Fonti primarie e limiti scientifici

[WMO, Virga](https://cloudatlas.wmo.int/en/clouds-supplementary-features-virga.html) descrive scie verticali o inclinate connesse alla nube che evaporano prima del suolo; [Praecipitatio](https://cloudatlas.wmo.int/en/clouds-supplementary-features-praecipitatio.html) distingue la precipitazione che lo raggiunge. Queste definizioni sostengono i gate di attacco/terminazione, **non** le soglie.35/.65 o l'obbligo di buchi in ogni acquazzone.

[Garg e Nayar, TOG2006](https://cave.cs.columbia.edu/old/publications/pdfs/Garg_TOG06.pdf), introduzione/Fig1 e risultati di illuminazione, distingue aspetto delle streak in funzione di luce e vista e consente modelli più semplici a grande distanza. Non importiamo il loro modello vicino o codice; non è una validazione della copertura intermittente proposta. La fotografia volumetrica distante può legittimamente avere veli continui: l'obiettivo qui è una singola variante di leggibilità coerente con il campo esistente, ancora da giudicare.

Input principali SHA256: cloudShader `f9d05d60526904297a4aab1cb013b84895f928c23a49cdf984b48447fbb9e568`; precipitation `561dace4f0ab9cbba246cefe0c14f23f5406bbabb1a5e3a00799d5d8aa08ce72`; PNG `0dd971b684b29c9d9855a405878d903da025eb729f17832dda813ac50051fa1b`; JSON `23c96235b85440351be72b5c1b890c4424de7f6a38e0730981d71800de3308d2`. Hash congelati della proposta in `rain-proposal/MANIFEST.json`. Nessun nuovo run numerico del modello.
