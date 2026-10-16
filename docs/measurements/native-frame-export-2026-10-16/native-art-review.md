# Lettura indipendente delle PNG effettive — ciclo24

**Le PNG rendono più solida la prova, non correggono l'arte. Il vicino resta insufficiente; il prossimo lavoro sul terreno dovrebbe riguardare una cresta vicina e le sue facce, prima di altra grana o palette globale.**

Lette localmente quattro immagini in `browser/`, con metadata associati: `main74-near60-sun-1280x720.png`, `main74-near60-sun-native.png`, `main74-near95-sun-native.png`, `main74-rain-terrain-native.png`. Nessun browser, GPU, test, build o modifica prodotto. Unica scrittura questa nota. Il trasferimento a parti è qualificato separatamente da Root; non lo rieseguo e non lo trasformo in accettazione visiva.

## Perimetro

Versione dichiarata `observatory-v57-native-frame-export`, seed74, t60 in pausa, vento55%, dispersione0, flow pieno, ultra384, volume256³/dettaglio128³, ablation full. La prima PNG è il bitmap configurato1280×720; le altre tre sono2474×1844. Non contengono l'interfaccia o il letterbox della pagina; sono immagini display del canvas, non buffer lineari/HDR o prova di presentazione del compositor.

Le due near60 hanno origine e target uguali ma aspect1,77778 contro1,34165: cambia il campo orizzontale, quindi non sono un A/B ottico a composizione identica. Near60 e95 usano `comparisonSurfaceKm=.7227685139973958`, target fisso e probeSkipped=true. Near95 non è una nuova qualifica della navigazione ordinaria o della distanza reale da ogni filamento.

## Nube vicina

**Near60:** il bitmap nativo conserva cavità e grande separazione chiaro/scuro, ma pareti e protuberanze restano molto sfumate. Il corpo centrale/destra è quasi liscio; le incisioni a sinistra non recuperano una gerarchia di rilievi leggibile. La PNG720 mostra già questo limite e la PNG2474 non lo risolve. La morbidezza non può dunque essere attribuita interamente a JPEG CSS o ridimensionamento della pagina; da queste immagini non ricavo la sua causa tecnica.

**Near95:** domina una grande campitura bianca con ombra e cielo nella zona alta/destra. Non compare dettaglio locale convincente. L'immagine è insufficiente come esperienza ravvicinata, ma non dimostra che la camera sia entrata nella nube: uniformità e perdita di contesto possono esistere anche davanti a materiale otticamente spesso. Non trasferisco qui i103m del vecchio seed72, né la profondità dei13raggi della diversa posa near60 a16:9.

Nessun miglioramento fotografico deriva dall'export. Questi still non qualificano moto, scivolamento, cuciture o continuità delle transizioni.

## Terreno e montagne

Nel panorama pioggia si leggono catene, valli, costa e mare: il paesaggio ha più specificità geografica del vecchio screenshot utente con frecce sulle dune. Nella posa corrente non ritrovo le estese terrazze argentate che dominavano quello screenshot; il terreno appare opaco. È una lettura qualitativa fra prove diverse, non un A/B causale: cambiano versione, luce e inquadratura.

**Il limite più concreto è nel gruppo di creste a sinistra della nube, soprattutto nella metà bassa del fotogramma.** I versanti formano ampie facce abbastanza uniformi, con spigoli angolosi e piccole macchie scure geometriche lungo alcune creste. Questi segnali fanno ancora leggere il rilievo come un modellino, anche se le catene sono più plausibili. Non classifico le macchie come buchi, shadow acne o errore di normali: il solo PNG non distingue quelle cause. La foschia/pioggia riduce legittimamente il contrasto distante; non richiedo lo stesso dettaglio su tutti i piani.

La costa conserva un bordo duro/angoloso e il mare è molto uniforme, ma non li metterei davanti alla lettura delle montagne vicine. La vegetazione resta soprattutto una tessitura cromatica aerea; questa vista non dimostra una chioma tridimensionale.

🌟 **Prossimo confronto minimo sul terreno:** conservare questa camera e osservare la stessa cresta sinistra in Sole assestato, a pieno output, identificando prima la zona da giudicare. Chiedere se facce e macchie scure persistono e se crinale, versante illuminato e valle si separano con continuità. È una discriminante per scegliere il prossimo intervento, non una correzione già provata. Un aumento di grana o saturazione che lasci quelle facce intatte non chiuderebbe il difetto percettivo. Nessuna nuova acquisizione viene eseguita da questa review.

## Pioggia e accettazione

La PNG pioggia dichiara rain0,7999999706/target0,8, cielo assestato e blend1. La cortina sotto la nube rimane un velo ampio, quasi uniforme, con margine laterale piuttosto rettilineo. Base e precipitazione non mostrano qui un grande distacco evidente; il velo non ha però una lettura fotografica convincente. Il termine inferiore esce dal fotogramma: nessuna qualifica di impatto al suolo o virga completa.

**Esito:** prova nativa utile e vicino ancora FAIL artistico circoscritto; paesaggio migliorato rispetto al vecchio aspetto a dune ma senza PASS fotografico. Priorità alla cresta/versante vicino; resa della cortina ancora aperta. Nessuna equivalenza pixel, parità main/worker, FPS o accettazione generale dedotta dalle PNG.
