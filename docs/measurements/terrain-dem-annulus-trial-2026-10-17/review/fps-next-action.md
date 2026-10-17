# Pioggia v61 — una piccola ridondanza, nessun guadagno dimostrato

17 ottobre 2026. Sola lettura su HEAD `0dc9b4b3ecdf741958c6fb7dc5b43ab4fc8699ce`, shader canonico SHA256 `f9d05d60…`. Nessun codice, runner, modello, test, build o GPU eseguito. Contratti invariati:256³/128³/384, output pieno, passo rain6m e campo streak originale.

**Unica possibilità nuova individuata: estrarre `forwardRain` e `rainLight` dal loop, soltanto nella specializzazione piovosa.** In `src/cumulonimbus/cloudShader.ts:136–137`, entrambe le espressioni dipendono esclusivamente da ray/sun, sky, ambientColor, solarColor e weather.y, tutti costanti durante quel raggio. Oggi sono dichiarate sotto `column.r>0`, dentro il loop8192 delle righe91–209. Non dipendono da t, posizione, source/base, sheets, streaks o densità. Il mix `rainSource=mix(sky,rainLight,aerialTransmittance(t,weather.x))` della riga138 resta invece nel punto originale.

🌟 Intervento minimo eventuale: in `rainIntegrationSource` (righe218–249), spostare **identiche** le due dichiarazioni subito prima del loop, senza usare mu al posto del dot, rifattorizzare prodotti o sostituire pow. Rimuoverle soltanto dalla posizione vecchia. `integrationSource` asciutto e sei modi diagnostici devono conservare il contratto precedente; non introdurre texture, pass, cache, risorse o parametri. La dipendenza dalla distanza, la co-locazione dei mezzi e tutte le letture restano invariate.

La catena di effetto a livello sorgente è concreta: da una valutazione di pow8/dot e combinazione RGB per campione piovoso positivo a una per raggio della variante piovosa. **Il risparmio GPU reale non è provato:** il compilatore può già fare loop-invariant code motion/CSE. La nuova posizione allunga la vita dei registri e calcola quei termini anche per raggi senza R positiva; la variante piovosa può inoltre restare installata durante transizioni. Questi costi possono annullare o invertire il vantaggio. Nessuna percentuale o promessa60FPS è giustificata.

## Cosa sostiene il ledger

L'ultimo ABA pioggia pertinente salvato è quello della cache raster, antecedente al materiale ottico v61: `docs/measurements/terrain-raster-cache-2026-10-17/browser/bench-B-on-rain.json`. Registra585 invii in30.051,8ms,19,4664invii/s, prefisso585/585 completato e19,2828invii/s includendo drain, a2474×1844 e256³/128³/384. Timestamp completi584/585: due render e un compute attesi per draw; nessuna misura separata della funzione pioggia o delle sue ALU. La somma dei pass non è tempo frame esclusivo. I più recenti ABA v61 sono Sole, circa60invii/s al limite rAF: **non costituiscono una nuova misura rain v61**.

## Prova mancante e decisione

È solo un candidato di pulizia locale a costo d'implementazione ridotto, non una nuova ottimizzazione sostanziale già sostenuta dai dati. Prima di timing servirebbero template dry identico, inversione esatta della sola estrazione e parità nativa Float32 nella stessa scena piovosa; poi un confronto continuo secondo i gate FPS già fissati. Non preparo tali prove senza incarico. Se il compilatore ha già estratto le due espressioni o il confronto non supera i controlli, fermare questa strada. Shared-aerial è già ritirato e non viene riproposto. Non emerge dal ledger un'altra ridondanza nuova e dimostrabile che giustifichi cache, bounds o riscritture dei campioni.
