# Witness positivo terreno — ciclo 27

**Risultato CPU circoscritto:** i sei nuovi controlli C1–C6 sono realmente non schermati nella mesh. Restano illuminati anche con il minimo del triangolo ristretto al texel. Nessun fix implementato o adottato, nessun PASS GPU, visivo o FPS.

Protocollo root: `../PROTOCOL.json`, SHA `003f4622d2fe166b8215e4d1765c6c6e99f50e34fdbe5d34e841b80a3f0517d8`. Fonte v58: 124 file verificati, manifest SHA `21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`. Fra c26 e c27 cambiano soltanto engine/metadati, cache ombre e relativi test; geometria, DEM e template WGSL rimangono invariati. Le PNG pin provengono dalle catture native precedenti, non da un nuovo render di questo run.

## Esecuzione congelata

- `PRE-RUN-FREEZE.json` SHA `4f1079b944b697eb7cb66289fe3e3f10e9ffc3b6790ec8ebf479c4d34ac52e34` e `witness.ts` SHA `71bb80711c5a523494be66beb58ef6cfd51655423ac0ecd5eb40214f39d45be2` salvati prima dell'unico run.
- Mesh Float32 realmente ricostruita: 465409 vertici e 929792 triangoli, 256 celle/lato, nove livelli, normali geometry. Non è stato generato alcun volume nube.
- Esattamente 12 pixel fissati prima del run e 36 raggi: ricevitore FrontSide della camera effettiva f32/off-axis, caster FrontSide al centro del texel indirizzato, raggio fisico DoubleSide dal ricevitore+1cm verso Sole. Nessuna sostituzione o ricerca adattiva.
- Unico processo Bun: exit0; CPU **3.061125s**, wall **2.7710925s**, RSS massimo **877789184B**. Limiti CPU20s/wall40s/RSS terminale2GiB rispettati; nessun retry. Il wrapper conserva stderr e risultato integrale.
- Tutti12 ricevitori sono interni ai piani camera; tutti12 texel hanno caster valido. Nessun miss o punto scartato. Nessun mismatch fra i tre artefatti selezionati e il pattern ombra CPU. I primi sei record condivisi sono esattamente uguali a c26, esclusi i tempi osservati.
- L'assenza di blocker è classificata sull'intera mesh soltanto se l'estremo del raggio20km è sopra il suo massimo Y globale. Questa condizione è verificata per tutti6 Ck. I nomi ocean/plain/ridge sono intenzioni della selezione, non nuove classificazioni del materiale.

## Risultati per pixel

`1` significa illuminato, `0` schermato. Il margine è qlookup−stored: il suo segno determina il confronto, non misura un errore fisico fra raggi identici.

| Pixel | Raggio fisico | Baseline | Clamp triangolo intero | Clip triangolo∩texel | Margine clip m |
|---|---|---:|---:|---:|---:|
| L1-artifact | schermato | 0 | 0 | 0 | -212.062 |
| L1-control | schermato | 1 | 1 | 0 | -57.558 |
| L2-artifact | schermato | 0 | 0 | 0 | -162.181 |
| L2-control | schermato | 1 | 0 | 0 | -95.521 |
| L3-artifact | schermato | 0 | 0 | 0 | -141.344 |
| L3-control | schermato | 1 | 1 | 0 | -34.865 |
| C1-ocean | non schermato | 1 | 1 | 1 | +77.009 |
| C2-coastal-lowland | non schermato | 1 | 1 | 1 | +82.410 |
| C3-plain | non schermato | 1 | 1 | 1 | +75.048 |
| C4-ridge-L1 | non schermato | 1 | 1 | 1 | +243.059 |
| C5-ridge-L2 | non schermato | 1 | 1 | 1 | +104.087 |
| C6-ridge-L3 | non schermato | 1 | 1 | 1 | +146.435 |

La baseline ha tre false illuminazioni fra i sei punti fisicamente schermati e nessuna falsa ombra sui sei Ck. Il clamp dell'intero triangolo ne lascia due; il minimo del poligono intersezione ne lascia zero in questo campione e mantiene **6/6 controlli non schermati illuminati, zero false shadows**. Il minimo margine positivo dei controlli rimane **+75.047526m** (C3). Questa copertura ora comprende veri controlli positivi, mentre tutti sei punti c26 erano schermati.

## Calcolo clipping separato

`clipping/PRE-RUN-FREEZE.json` SHA `69fa9a6732b13c7233a767451a7f4b7da8e7ec5fb1248ba9df47765c4b31bfab` precede il solo calcolo sui record salvati. Nessuna mesh ricostruita o raggio aggiunto: proiezione UVQ dei tre vertici caster salvati, clamp al minimo dei vertici, poi quattro piani Sutherland–Hodgman con q affine e minimo del poligono meno1m invariato. Verifiche Float64 di continuità del piano, texel, centro vincente e monotonicità con tolleranza1e−8km; confronto visibility senza epsilon.

Unico calcolo Python: exit0; CPU0.027119s, wall0.0322782s, RSS20676608B, sotto i limiti separati1s/5s/2GiB. Risultato SHA `9c685934f80950b0f82c315a80b54173c88b58be8f26410887f5f59b643b0a18`. Per i sei vecchi punti il lookup è fuori dal triangolo caster vincente; fra i nuovi Ck lo è anche C2, che resta comunque illuminato. L'intersezione non presuppone quindi che il lookup giaccia sullo stesso triangolo.

## Limiti e riproducibilità

Questi sono riferimenti CPU di un numero prefissato di raggi, non rasterizzazione GPU, prova bit/f32, assenza globale di acne o qualità artistica. Il blocker fisico riguarda la mesh esatta e il punto visibile; la lookup ombra è spostata radialmente. I due raggi UV possono differire: i loro gap q non sono un bound di errore fisico della texture. Il winner resta quello a massimo RAW q al centro del texel; analizzare soltanto la sua faccia non prova quale altra faccia copra il resto del texel. Nessuna stima di costo di un eventuale clipping GPU viene dedotta.

`witness-vs-cycle26.patch` e `clipping-vs-cycle26.patch` documentano gli adattamenti. `selected-pixels.json` conserva coordinate e RGB originali/ablazione. Input e tutte124 sorgenti sono stati riverificati dopo i calcoli. Nessun file prodotto, dipendenza, lockfile, GPU, browser, build, test o raycast aggiuntivo è stato usato.

`verify_archive.py` controlla hash/byte dell'archivio e ricava i conteggi dai risultati salvati; **non** ricostruisce la mesh né ripete i raggi. Le sorgenti/input voluminosi restano esterni al pacchetto e sono identificati dai manifest/freezes. Il risultato non è una raccomandazione di adozione automatica.
