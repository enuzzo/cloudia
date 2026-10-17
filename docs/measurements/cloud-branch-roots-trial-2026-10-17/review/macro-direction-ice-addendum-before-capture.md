# Addendum prima di no-detail — bande globali e corone72

17 ottobre 2026. Nessuna modifica alla nota congelata `macro-direction.md` (`12a4c66d…`). Ispezionati i due nuovi full native 2474×1844, `baseline-72-front.png` SHA256 `1448b7d984cd01256227a458efacfa82c4ab7cc5d37aef4ee07a7688b47b6676` e `baseline-72-side.png` `a7b406461e238ebf48296271f3590cf80772e8c749a1dc8c39f4adae612333cf`. Nessun codice, modello, prepare, test o GPU eseguiti dal reviewer. Questa previsione precede qualunque mia lettura del controfattuale73 no-detail.

In72 vedo tre torrette con corone larghe e quasi piatte, soprattutto di lato. La ricetta congestus attribuisce il cap soltanto al summit più alto: **il solo cap non spiega direttamente tre corone**. I top ellissoidali, le sovrapposizioni e il carving possono comunque contribuire. La proposta gerarchica precedente rimane una possibilità macro, non è una diagnosi sufficiente di questo appiattimento.

`volume.ts:93–96` sceglie `iceHeights` dalle quote 5.15/5.95 scalate con il solo `towerHeight`: nessun riferimento alla maturità o alla quota del singolo top. `cloudShader.ts:150–171` applica `ice(local.y)` a tutto il liquido che attraversa quella banda. Non è un taglio geometrico netto; può sopprimere gradualmente le parti alte di qualunque cella. A ice=1 il moltiplicatore materiale è al massimo 0.572, ulteriormente ridotto lungo X, e l'estinzione passa da 18 a 6.5. Quindi una punta convettiva può perdere peso ottico per sola quota, senza essere una primitiva ice. È un candidato causale concreto, non ancora un'attribuzione di pixel.

🌟 La singola ablation disponibile `no-detail` sulla stessa73 laterale è utile per mettere alla prova questa predizione: **più corpo/opacità alle regioni alte e possibile ricomparsa di punte o rigonfiamenti cancellati dal pacchetto fine**. Non prevedo necessariamente una sommità cumuliforme riuscita.

- Se le corone restano quasi identiche, pesano l'inviluppo e/o le operazioni già cotte nel macro; non prova che ice sia irrilevante, perché parte del trattamento ice resta.
- Se recuperano rilievo, il pacchetto fine contribuisce alla lettura piatta; non distingue wisp/materiale, erosione e warp e non dimostra che la gerarchia sia corretta.
- Se cambia soprattutto trasparenza/luminosità, è evidenza di peso ottico, non di una nuova relazione anatomica.

Limiti esatti: `probeMode=4` usa fine=.6, quindi erosione base 0.184+flow.a e warp positivo costante dipendente da ice, **non warp zero**; salta materiale/erosione wisp. Restano banda ice, estinzione ice, campo macro con carving/fibre e luce/occupazione cotte per ordinary. Non è né inviluppo puro né materiale fisicamente isolato; non ricostruisce una nuova luce coerente con la densità modificata. La differenza può orientare il prossimo isolamento, non promuovere una soluzione o riscrivere i FAIL.
