# R1 — dodici campioni ordinary / albedo, prima del giudizio visivo

Solo aritmetica dei JSON salvati, nessun nuovo GPU/render/modello. Il ritorno all'owner ordinario non è ancora disponibile. Il nuovo PNG albedo e le ROI non sono stati ispezionati in questa fase.

Il gate iniziale ordinary è tornato al target canonico `e4435ce3…`, PNG proprietario `90641c32…` e48 parolebit esatte ciclo32. Albedo ha cached=fresh `0ed1d665…`, stable/cacheStateQualified=true. L'intero alpha ha lo stesso SHA256 nei due modi: `29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c`,**18248224 B /4562056 pixel**. Anche tutti i12 alpha selezionati coincidono nei bit; questo non identifica il caster o il triangolo.

Luminanza del **target lineare prima del trasporto atmosferico/film**: `Y=.2126R+.7152G+.0722B`. Non è luminosità sRGB del PNG né misura fisica dell'albedo. Numeri sotto arrotondati; precisione completa e hash delle fonti in `albedo-r1-point-analysis.json`.

| ID storico | RGB ordinary | RGB albedo | Y ordinary | Y albedo | Rapporto Y | Alpha km, bit identici |
|---|---|---|---:|---:|---:|---:|
| L1-artifact | .006063,.008783,.008711 | .075068,.084034,.055833 | .008199271 | .080091776 | 9.76816 | 36.562218 |
| L1-control | .007891,.010145,.010306 | .097199,.096581,.065715 | .009677651 | .094484070 | 9.76312 | 36.556862 |
| L2-artifact | .022848,.023887,.017092 | .088677,.090445,.058569 | .023175815 | .087767865 | 3.78705 | 36.058144 |
| L2-control | .013982,.015723,.012387 | .084501,.086921,.056074 | .015111778 | .084179599 | 5.57046 | 36.133770 |
| L3-artifact | .006783,.008857,.008527 | .086678,.087468,.056409 | .008392030 | .085057442 | 10.13550 | 43.868622 |
| L3-control | .007045,.009199,.008825 | .085868,.086653,.055682 | .008714411 | .084250018 | 9.66790 | 43.906857 |
| C1-ocean | .008159,.025175,.040440 | .008159,.025175,.040440 | .022659590 | .022659590 | 1 | 32.397785 |
| C2-coastal-lowland | .066347,.069183,.060934 | .097263,.102105,.091603 | .067984485 | .100317572 | 1.47560 | 36.340931 |
| C3-plain | .008942,.027353,.035330 | .008942,.027353,.035330 | .024014687 | .024014687 | 1 | 47.584698 |
| C4-ridge-L1 | .027148,.027391,.020368 | .099860,.098055,.065721 | .026831903 | .096104279 | 3.58172 | 37.668720 |
| C5-ridge-L2 | .021612,.025570,.016147 | .052494,.062877,.038382 | .024048056 | .058900693 | 2.44929 | 38.439312 |
| C6-ridge-L3 | .022997,.029048,.017912 | .049874,.064413,.039123 | .026957237 | .059496132 | 2.20706 | 47.441372 |

Tutti gli ID sono etichette della selezione storica, non classificazioni attuali. C1-ocean e C3-plain mantengono l'intera RGBA nei bit; il primo è il controllo storico richiesto, il secondo non va reinterpretato come prova di una classe geografica. Gli altri10 RGB cambiano. Cached/fresh hanno lo stesso witness all'interno di ciascun modo.

## Tre coppie, nessuna nuova selezione

Michelson assoluto `abs(Yfirst−Ycontrol)/(Yfirst+Ycontrol)`; segno separato con numeratore senza abs. Sono soltanto due campioni per coppia, non contrasto dell'intera ROI.

| Coppia | Michelson ordinary | Michelson albedo | Delta assoluto | Segno ordinary→albedo |
|---|---:|---:|---:|---|
| L1 | .08269767 | .08244149 | −.00025618 | negativo→negativo |
| L2 | .21061750 | .02086839 | −.18974912 | positivo→positivo |
| L3 | .01884558 | .00476898 | −.01407660 | negativo→positivo |

L1 conserva quasi lo stesso contrasto relativo mentre entrambi i punti diventano circa9.76 volte più luminosi. L2 mostra un contrasto molto minore; L3 diminuisce e inverte l'ordine dei due valori. Queste sono risposte locali alla sostituzione del termine ground: non dimostrano che una scaglia dell'intera immagine scompaia, né attribuiscono tutte le superfici a illuminazione, albedo o una classe del suolo. Il rapporto Y non è un'esposizione globale da applicare al prodotto.

## Metadati e limiti

Identità esatta dei campi confrontati: seed/family, qualità e384passi, step/emptyStep, output/internal/canvas2474×1844, viewport, spazio colore/tone mapping,256³/128³/motion16³, ablation, flowMode/compute/sampling, percorso densità, specializzazione nube, camera completa, pausa/orbita/speed, material, weather, lighting e terrain. Nei clocks differisce soltanto weatherTime(16.0191vs10.7340); simulation60/forcing0/precipitation0/flow60 sono identici. Frame/wall/owner counter e UUID locali delle texture cielo sono esclusi dall'identità portabile; il modo materiale è la differenza intenzionale. Non vengono dedotti hash dei buffer cielo dai loro identificatori.

I metadati PNG indicano ordinary `90641c32…`2909134 B e albedo `5eb7d8bef55d6e707ee552bd2f0ed5f93b39d97dcaf4e69f7a3cd2033f0e0f2b`3005033 B, entrambi2474×1844. La lettura numerica non sostituisce trasferimento/hash PNG, nativa+ROI1:1 e ritorno ordinary. Nessun massimo/numero di differenze RGB dell'intero target è inferito dai due digest.

Artefatto numerico: `albedo-r1-point-analysis.json`,15507 B,SHA256 `177d613f1b859669f0a5f851a63588e844c06b6c88523238ccee2b09c7db0dde`; contiene formule, fonti lossless e tutti i valori completi. Non è una prova artistica né un nuovo modello adottato.
