# Seed80 — review visiva indipendente A/B Sole

**Esito: miglioramento locale del supporto centrale, senza nuova regressione bloccante evidente nelle tre pose. Torrione giovane e polso/appendici esterne conservati visivamente; nessun PASS fotografico globale.** Tutte le sei immagini sono state viste tramite `view_image`; nessun browser/GPU o rigenerazione.

| Posa | Osservazione A→B |
| --- | --- |
| Fronte | Sale il riempimento sotto la sella e si attenua il dente interno. Il torrione giovane a destra resta distinto, senza perdita evidente del coronamento o del contorno esterno. La U diventa meno profonda ma rimane. |
| Lato | La sagoma cambia poco. Il corpo sotto il raccordo appare più pieno; il profilo della torre anteriore e le appendici alla base restano leggibili. Non emerge una nuova mensola orizzontale. La sovrapposizione dei torrioni limita questa vista come prova della loro separazione. |
| Retro | La massa centrale risulta più incorporata e compatta; il giovane a sinistra resta riconoscibile. La cavità centrale perde un po' di profondità visiva e il pannello in ombra è più continuo: compromesso da tenere esplicito, senza un nuovo pallone o un taglio piano evidente. |

Non vedo un nuovo foro, una spalla staccata, un rigonfiamento che cancelli un torrione o un'amputazione evidente del polso/contorno esterno. La conservazione del polso qui è una lettura della sagoma, non identità del vecchio raggio o della sua profondità ottica. La grande U e la colonna alta relativamente stretta sotto l'incudine sono ancora presenti e già leggibili in A; la correzione del corpo non li risolve.

I record `a80-ui.json` e `b80-ui.json`, entrambi riferiti al fronte, confermano seed80/sheared, t60, vento55%, dispersione0, output/interno1920×1080,256³/128³/384, nessun TAA. Le tre pose sono quelle appaiate di `PROTOCOL.json`; catture JPEG CSS1237×922. Non è un readback nativo del curatore né una misura FPS: i contatori live UI restano fuori dal giudizio.

Qualifica circoscritta a queste viste Sole: non vicino, Tramonto/Pioggia, movimento, altre famiglie, parità pixel o promozione artistica generale.

## Originali visti e SHA-256

| File | Byte | SHA-256 |
| --- | ---: | --- |
| `a80-front-sun.css.jpg` | 51507 | `febebc6b829c619da8d1ecaf0a877687b8e59eaba1082a4be048019ed19ec2e4` |
| `b80-front-sun.css.jpg` | 51490 | `fb4bbbf4833b6332e188706a640c3c113af3b5104f4860e2999c72c04e07fc53` |
| `a80-side-sun.css.jpg` | 63478 | `0c72bcfeccabb10ced376589645ce27ff582550ff09bc42e276f9a0b6f69ede6` |
| `b80-side-sun.css.jpg` | 63441 | `8a2cf6ca8ab3d7fd69cf9ff3aeb604840441072dd31edd9ecbd28d2514334d95` |
| `a80-back-sun.css.jpg` | 70502 | `dbc8b6172dda7c277a986d8a211d0a5c6f1e85f1f8cc64dca1e8711e76b3447d` |
| `b80-back-sun.css.jpg` | 70316 | `20be728fcc70ca64a75edf62978a089dc7ccdb72e086d151e48a8487f205254b` |

Metadati originali letti:

- `a80-ui.json` SHA-256: `30bec7a6a517b66896ecd56f59c3d028b5547986d16cbc8f72aea4ca2eb9de1e`.
- `b80-ui.json` SHA-256: `50838ddfb3833eb95aa037cb8dc5fea5e47dfc3d40a3cf2499ea7dfa23e400c1`.
- `PROTOCOL.json` SHA-256: `3ce99dea3c4b2c4d0edc56f472d3a0139b2b728882f4f684b0b1b5b5013fab38`.
