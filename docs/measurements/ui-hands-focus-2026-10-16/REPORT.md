# Cloudia — focus della guida Mani su mobile

Il difetto è riprodotto nel browser a viewport CSS **390 × 844**: aprendo «Mani in arrivo» e avanzando con Tab dal pulsante di chiusura, il focus raggiunge «Avvicinati alla nube» mentre il pannello copre il suo centro. La correzione estende alla guida Mani il selettore mobile che nasconde già zoom e aiuto quando il pannello del cielo è aperto. Il pannello resta non modale.

La proposta documentale in `proposed-docs.patch` non è applicata al repository. Questo archivio esterno non modifica prodotto, Git o documenti del repository.

## Prove e risultato circoscritto

| Azione osservata da Root | Raw conservato | Risultato del DOM |
| --- | --- | --- |
| Prima: Tab verso zoom con Mani aperto | `browser/before-focus.json`, evento 3 | `focusin` naturale su «Avvicinati alla nube»; `activeContainsCenterElement=false`, centro occupato da `diagnostics hand-panel` |
| Dopo: primo Tab oltre la chiusura | `browser/after-tab-focus.json`, ultimo evento | «Pausa», centro raggiungibile |
| Dopo: ciclo consecutivo | `browser/after-full-tab-cycle.json`, eventi 11–17 | Chiudi guida mani → Pausa → Sole → Tramonto → Pioggia → Temporale → Regola il cielo; **7/7** centri raggiungibili |
| Escape | `browser/after-escape-focus.json`, ultimo evento | Focus sul summary «Mani in arrivo», centro raggiungibile |
| Pulsante di chiusura | `browser/after-close-button-focus.json`, ultimo evento | Focus sul summary «Mani in arrivo», centro raggiungibile |
| Clic esterno | `browser/after-outside-focus.json`, ultimo evento | Focus sul canvas «Nube volumetrica ruotabile»; `activeContainsCenterElement=false` conservato esplicitamente |
| Zoom ripristinato dopo la chiusura | `browser/after-restored-zoom-focus.json`, ultimo evento | «Avvicinati alla nube», centro raggiungibile |

Il collegamento tra i nomi delle prove e le azioni Escape/chiusura/clic esterno proviene dalle interazioni native AX eseguite da Root. I JSON registrano il focus risultante e la geometria DOM, non i tasti/clic fisici né lo stato `open` del pannello.

Il log prima contiene anche un successivo snapshot manuale con `BODY` attivo: il clic sul pulsante del parent non ha conservato l'elemento attivo dell'iframe in quella cattura. La prova del difetto usa quindi l'evento naturale 3, non lo snapshot manuale. Il ciclo dopo contiene storia precedente, incluso un evento del canvas con centro non raggiungibile: il conteggio 7/7 riguarda soltanto gli ultimi sette eventi indicati. Il clic esterno documenta la destinazione canvas, senza attribuire la causa del suo esito geometrico e senza convertirlo in un PASS globale del focus.

## Sorgenti e build

I manifest congelati contengono **119 sorgenti prima e 119 dopo**. L'unica differenza è `src/cumulonimbus/scene.css`:

```css
@media(max-width:640px){
 .cloud-scene:has(.sky-inspector[open],.hands-guide[open]) :is(.view-controls,.view-help){visibility:hidden}
}
```

Il confronto esatto con il CSS prima è verificato offline. Hash SHA-256 del CSS prima: `6c45a2c39ad9d84555c7c5c98c37645ceedb99fbea31848f0f7d0bf63740ad46`; dopo: `f4127d2557bfcc8408e74bed7b9fe92aa47c44d1d93cb1c03b8b7708256f5ff8`.

Sono conservati i due manifest dei **30 file dist**, i manifest storici dell'host QA, i tre wrapper originali e i log di build app/hero compressi senza perdita. Non sono duplicati l'intero dist, i 119 sorgenti, gli asset runtime o le dipendenze. I log riportano app Vite 7.3.3, 60 moduli, build 2,71 s e hero 10 moduli, 646 ms; la build app riporta avvisi sull'outDir esterno e sui chunk oltre 500 kB. Questi sono log originali di Root, non build rieseguite dal curatore.

I raw DOM non incorporano hash dei bundle serviti. La loro associazione alle build congelate deriva dalla provenienza dell'host servito e dai manifest forniti da Root; non è un'attestazione autonoma del bundle da parte dell'osservatore.

## Console e limiti

Root ha osservato nel tool console, livello `error`, alle **2026-10-16T15:55:05.403Z**:

```text
Uncaught TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'.
```

L'URL non era presente. Il timestamp precede l'mtime riferito da Root per il wrapper fixed (**2026-10-16T16:00:39.277286+00:00**). È un'osservazione storica trascritta in `console-observation.json`, non un export raw e non una diagnosi della sua origine. Non si dichiara console globalmente priva di errori.

Le quattro immagini sono JPEG a scala CSS e includono il parent dell'osservatore. L'iframe è 390 × 844 CSS; questo non dimostra un output GPU nativo della stessa dimensione. Il wrapper usa l'app originale con `seed=74&profile=1`. Non sono prove di parità dei pixel, qualità radiometrica, FPS o touch fisico. La regola CSS copre per codice le larghezze fino a 640 px; il browser è stato qualificato qui soltanto a 390 × 844. Desktop, viewport bassi e reduced motion non sono stati nuovamente qualificati. Durante la cura non sono stati eseguiti browser, GPU, build o test del prodotto.

## Verifica e riuso

```sh
python3 verify.py
```

Il verificatore usa soltanto la libreria standard Python, legge i payload locali, verifica inventario e SHA, ricostruisce il cambio CSS e controlla gli eventi selezionati. Non riavvia l'app. Per verificare anche un albero sorgente o un dist già disponibili si possono passare, senza scansioni ricorsive:

```sh
python3 verify.py --frozen-source /percorso/fixed-source --dist /percorso/fixed-dist
```

Per un replay manuale, copiare `qa/after-qa-mobile.html` come `qa-mobile.html` nella radice di un dist corrispondente a `source/after-dist-30.json` e servirlo su localhost. Il wrapper deve condividere l'origine con `/index.html`; osserva soltanto eventi e geometria DOM. La verifica offline non equivale a un nuovo replay browser.

Destinazioni proposte per l'integrazione di Root: `docs/UI-HANDS-FOCUS-2026-10-16.md` e `docs/measurements/ui-hands-focus-2026-10-16/`. Nessuna di queste destinazioni viene creata da questa cura esterna.
