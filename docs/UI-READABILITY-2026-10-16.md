# Testi leggibili sul cielo e risultato storico esplicito

16 ottobre 2026, decimo ciclo. Due modifiche locali al prodotto, conservando
font, dimensioni e posizione dei testi.

Il marchio con sottotitolo e l'aiuto in basso ricevono piccoli fondi carbone
`#202a2deb`. Il colore riprende i controlli. I pseudo-elementi sono limitati
ai testi, senza blur, animazioni o letture GPU; `pointer-events:none` rimane
su entrambi i blocchi. Si perde l'effetto del marchio interamente sospeso:
il rettangolo visibile è il costo della leggibilità sul bianco della nube.

Il risultato del benchmark comincia con **«Ultima misura completata»**.
Cambiando camera, il vecchio risultato rimane consultabile e viene distinto
dal contatore corrente. Nessun dato numerico viene aggiornato artificialmente.

## Verifiche e giudizio

**PASS circoscritto alla leggibilità dei testi modificati e alla distinzione
del risultato storico.** Non è accettazione artistica del proprietario né
certificazione dell'intera UI.

- Ispezionate immagini reali desktop 1280×720, mobile 375×812 e finestra
  1280×500. Il fondo resta aderente al marchio; aiuto leggibile quando previsto
  dal CSS e nascosto nella finestra bassa come prima.
- La vista ravvicinata del nuovo build a t=60 mostra nebbia grigia. Le immagini
  precedenti a t≈533 mostrano il bianco critico e i vecchi testi quasi invisibili.
  I due stati non sono una coppia pixel A/B. Il limite di contrasto sul bianco
  è calcolato separatamente.
- Temporale e panorama provati, ma le catture non rappresentano ogni possibile
  cielo notturno o flash. Il limite sul bianco non dipende dal meteo.
- Dopo le modifiche, clic sul canvas e ArrowRight cambiano l'azimut da 0 a −5°,
  leggibile nel pannello. Le superfici nuove non bloccano quell'interazione.
- Nel mobile, il risultato storico è visibile dopo scorrimento del pannello;
  il contatore corrente e il testo «Ultima misura completata» restano distinti
  dopo un cambio camera. La cattura anticipata prima del repaint non è usata
  come prova. Gli override viewport sono stati rimossi prima delle misure FPS.

Il testo pieno `#eeeee7` conserva sul fondo composto con bianco puro un rapporto
nominale 9,895:1 nel modello sRGB e 6,077:1 nella composizione lineare più
conservativa. Non è un rapporto misurato su ogni pixel antialias. Metodo e
numeri sono nel [calcolo archiviato](measurements/ui-readability-2026-10-16/contrast-bound.json).
Riferimenti primari: [W3C SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
e [tecnica G145](https://www.w3.org/WAI/WCAG22/Techniques/general/G145).

Il banner giallo della modalità profile è preesistente e non fa parte della
modifica. Nel mobile arriva al bordo destro; non attribuire a queste prove
un PASS generale del layout diagnostico. L'aspetto di nube, terreno, pioggia
e luce conserva i gate aperti.

## Evidenze

[Manifesto SHA](measurements/ui-readability-2026-10-16/archive-manifest.json),
[panorama nuovo](measurements/ui-readability-2026-10-16/browser-far.jpg),
[ravvicinata nuova](measurements/ui-readability-2026-10-16/browser-near.jpg),
[mobile](measurements/ui-readability-2026-10-16/browser-mobile.jpg),
[finestra bassa](measurements/ui-readability-2026-10-16/browser-short.jpg),
[risultato storico mobile](measurements/ui-readability-2026-10-16/latest-label-mobile.jpg).
La proposta originale, CSS prima/dopo e review sono conservati byte per byte;
le loro frasi «non applicata» descrivono la consegna dell'agente, precedente
all'applicazione del root. Questo documento registra lo stato del prodotto.
