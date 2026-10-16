# Gerarchia della torre secondaria: candidato ritirato

Il candidato abbassa la testa giovane e il suo collo nella famiglia sheared. Il confronto visivo mostra una distinzione più netta dal summit maturo, ma la testa giovane diventa larga e tozza, soprattutto nel seed 77; la U e l'uncino sotto l'incudine restano evidenti. **Non promosso.** Le verifiche numeriche circoscritte sono passate, senza costituire un PASS artistico, una prova nativa a 256³ o una misura FPS.

L'[archivio verificabile](measurements/secondary-hierarchy-2026-10-16/README.md) conserva originali, sei JPEG, dati e decisione. La baseline è `10493afa7f6d90389c39e17b2cad79397dfdac01`, uguale alla copia finale del ciclo 14. L'unico sorgente diverso è `volume.ts`: SHA256 baseline `a53410c45b04143710cffd098b6a33deade3242c66ecf7eecc6405a214a93b00`, candidato `3db1246ae8741521be70d336a8ecdbee92bf33ea24f83246359faa909bad1b35`. Il candidato è rimasto esterno al prodotto.

## Ipotesi e ambito della modifica

Una sola traslazione verticale sposta collo, testa e decorazioni esistenti della torre giovane. Il delta vale metà della differenza di quota originaria fra i due summit: il dislivello finale diventa quindi 1,5 volte quello iniziale. Non vengono introdotti nuovi rumori o nuove primitive.

La selezione usa riferimenti semantici in un `Set`, non indici fissi. Per ogni seed sheared sono **182 primitive distinte**: due core, ciascuno con 18 billow e 72 figli. Ogni riferimento viene traslato una volta. Le primitive prima dello spostamento e le sequenze RNG risultano identiche alla baseline; fondazioni, corpo comune, incudine e parametri della spalla inclinata restano invariati. Questo riguarda i parametri delle primitive: l'unione liscia e il bake possono modificare densità e luce nelle zone sovrapposte.

| Seed | Primitive traslate | Abbassamento | Esito numerico disponibile |
|---|---:|---:|---|
| 72 / 73 | 0 | 0 m | Canali identici a 32³ e 64³ |
| 74 | 182 | 403,113 m | Spostamento e chiusura dei figli coerenti |
| 77 | 182 | 401,888 m | Spostamento e chiusura dei figli coerenti |
| 80 | 182 | 452,008 m | Spostamento e chiusura dei figli coerenti |

## Risultati numerici e loro limiti

Sono salvati i risultati di **20 volumi CPU** generati: baseline e candidato per cinque seed, a 32³ e 64³, con dettaglio alla stessa risoluzione del rispettivo probe. I buffer voxel non sono duplicati nell'archivio. Tutti i 2.066.839 voxel esclusi dal pre-filtro sono stati rivalutati dall'autore con il campionatore fine: nessuna omissione positiva registrata. Il risultato vale per questi probe; non è una dimostrazione a 256³/128³.

Per i seed 72 e 73 densità, RGBA, luce bassa e dettaglio completo restano identici byte per byte a entrambe le risoluzioni. Nei tre sheared il rumore RGB resta identico; densità, luce e maschera di occupazione cambiano. A 64³ la somma di R/255 diminuisce dello 0,558% nel seed 74, dello 0,723% nel 77 e dell'1,353% nell'80. È un integrale discreto della densità quantizzata, non massa meteorologica. I margini alle sei facce e i support bounds restano uguali nelle coppie confrontate.

L'autore ha registrato typecheck, **31/31 test mirati** su volume e spalla e build APP passati; nessuna build hero o misura FPS del trial. Una generazione aggiuntiva non strumentata a 64³, seed 74, coincide con gli hash e support bounds del probe. L'archivio ne verifica i record senza ripetere generazioni o test.

## Confronto visivo e decisione

Tre coppie browser confrontano **seed 74 frontale, seed 74 laterale a 88° e seed 77 frontale**, con vento 55%, dispersione zero, Sole e stato di confronto fissato tramite UI. Le pagine usano `profile=1`, `surface=1`, target `[0,2.7,0]`. È osservato un canvas nativo 2560×1440; le catture sono JPEG CSS 1280×720. Sono confronti di posa UI, senza pretesa di identità dei pixel del framebuffer.

| Vista | JPEG originali | Risultato del giudizio visivo |
|---|---|---|
| 74 frontale | [Baseline](measurements/secondary-hierarchy-2026-10-16/browser/baseline-74-front.jpg) · [Candidato](measurements/secondary-hierarchy-2026-10-16/browser/candidate-74-front.jpg) | Torre giovane meno competitiva in altezza; U e uncino ancora leggibili |
| 74 laterale | [Baseline](measurements/secondary-hierarchy-2026-10-16/browser/baseline-74-side.jpg) · [Candidato](measurements/secondary-hierarchy-2026-10-16/browser/candidate-74-side.jpg) | Separazione delle altezze non risolve la forma sotto l'incudine |
| 77 frontale | [Baseline](measurements/secondary-hierarchy-2026-10-16/browser/baseline-77-front.jpg) · [Candidato](measurements/secondary-hierarchy-2026-10-16/browser/candidate-77-front.jpg) | Testa abbassata particolarmente larga e tozza |

Il guadagno locale di gerarchia non compensa la perdita apparente di sviluppo verticale convettivo. Il trial viene conservato come risultato negativo, senza autorizzare un'ulteriore taratura o una prova costosa a risoluzione nativa. Il report numerico precedente al confronto resta intatto nell'archivio; la [decisione finale](measurements/secondary-hierarchy-2026-10-16/VISUAL-DECISION.json) ne supera lo stato provvisorio. Nessun PASS artistico o progresso FPS viene dedotto dai numeri.
