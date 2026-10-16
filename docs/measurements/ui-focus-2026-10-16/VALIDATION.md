# Due correzioni UI locali — ciclo 11

Fonti congelate: panels.ts, inspector.test.ts e scene.css. Patch completa
`ui-final.patch`; patch solo mobile `mobile-occlusion.patch`.

## Focus dopo chiusura esterna

Root ha riprodotto Vento → divisore del dock: pannello chiuso, focus BODY
(`browser-before.json`). La v2 ripristina il summary solo quando il pannello
conteneva il focus e il target non riceve focus; previene il default soltanto
in quel ramo. Root ha poi confermato nel browser: divisore→SUMMARY,
Sole→BUTTON, canvas→CANVAS, Escape→SUMMARY. Le prove del root restano distinte
dai 30/30 test DOM mirati iniziali.

## Controlli coperti dal pannello mobile

Durante la verifica390×844 root ha raggiunto Torna al panorama con ShiftTab,
mentre il pannello lo copriva; anche l'aiuto era tagliato al bordo del sheet.
La sola nuova regola CSS, max-width640px, usa `.cloud-scene:has(...)` per
nascondere view-controls e view-help mentre sky-inspector è open.
Visibility hidden rimuove anche i controlli coperti dalla navigazione e
accessibilità. Avvicinamento resta nel pannello. Desktop, finestra bassa,
Mani e renderer non cambiano.

## Verifiche locali finali

- Suite completa: **212/212 test,32 file**,3260ms. Nessun test CSS aggiunto.
- TypeScript noEmit: exit0.
- App→hero: build esterne entrambe exit0. Restano i warning dei chunk grandi.
- Node_modules: ignorata Git,zero file tracciati,ignore1 prima e dopo.
- Build precedente conservata in snapshots/focus-v2-before-mobile,27 asset
  verificati. Asset precedenti ancora presenti; nessun rm/emptyOutDir.
- Nessun comando ha indirizzato dist baseline o v46-dist.

Il manifesto `build-provenance.json` conserva hash/fonti,asset,log e controlli
sourcemap. Rispetto alla build v2 precedente cambia soltanto scene.css.
Sorgenti congelati in frozen-source. La verifica browser del CSS finale e
il gate complessivo delle tre viewport rimangono al root; questa consegna
non ne anticipa il PASS.
