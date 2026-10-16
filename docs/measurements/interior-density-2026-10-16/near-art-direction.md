# Vicino: direzione percettiva — 16 ottobre 2026

**Priorità: rendere leggibile il rilievo del fianco già al40–60%, prima di giudicare il100%.** Le viste preservate del fix inward adottato in v56 conservano meglio cavità e torre giovane, ma non risolvono la credibilità ravvicinata. Nessun nuovo render, bake, sorgente o test eseguito.

Riguardati i JPEG CSS `cycle22/recenter-only-visual/b{74,77,80,926}-near{40,80}-sun.css.jpg`, il74near60 Sole e74near40 Tramonto. Sono le prove R5R2 conservate, non una nuova cattura della build finale. Rilette le due diagnosi `EXPERIMENT-NEAR-LIGHT-CAUSALITY` e `EXPERIMENT-NEAR-BOUNDARY-GUARD`, oltre al requisito del HANDOFF: credibilità da vicino/in moto a qualità massima, senza cuciture o scivolamento. Non emerge un obbligo dell'utente di preservare ogni punto del vecchio fronte.

L'originale utente `codex-clipboard-7a043316-026c-4320-bf9c-48645f369310.png` è una vista larga della nube con frecce sulle terrazze del terreno. Non è una fotografia di riferimento del bordo vicino, né fissa una clearance o impone dettaglio visibile dentro un mezzo opaco. Non ricavo da quella cattura una nuova specifica fotografica.

## Cosa manca

| Aspetto | Lettura delle immagini |
|---|---|
| Scala | Al40% si distinguono ancora torri e pieghe, ma il materiale sembra una massa di cera arrotondata; al60–80% si ingrandiscono soprattutto zone lisce. Manca una gerarchia leggibile fra volume grande, rilievi secondari e margine sfrangiato. Non basta aumentare il numero di granelli. |
| Silhouette | Le aperture contro il cielo sono utili e vanno conservate come controllo; al77near80 c'è ancora molto cielo ma il bordo è molto morbido. Quindi il problema non è solo una camera tutta immersa nel bianco. La grande U resta un limite macro distinto. |
| Rilievo | Le incisioni al40% spesso sembrano impronte molli su un involucro continuo. Al80% quasi scompaiono: manca una separazione persistente fra protuberanza illuminata, fianco e cavità, senza far diventare la nube roccia o plastica. Il926 conserva la cavità sinistra preesistente; non la classifico come nuovo foro. |
| Luce | Esiste già una differenza ampia chiaro/scuro. Il Tramonto74 rende alcune pieghe più leggibili, ma conserva la stessa morbidezza. Non c'è evidenza qui che basti scurire l'ambient, aumentare contrasto o cambiare esposizione per recuperare forma assente. |

## Previsto dal mezzo, oppure difetto?

Una piccola finestra su un corpo otticamente spesso può risultare uniforme anche da fuori. La fixture storica72 aveva primo materiale centrale a103m: impronta circa105×59m, inferiore a molti billow160–700m. L'assenza di un intero cavolfiore in quella finestra non dimostra un errore. Il margine corrente di3m del probe riguarda una soglia stimata, non certifica una superficie solida o il primo contributo di ogni raggio; non promette una vista fotografica ricca al100%.

È invece un limite artistico concreto che la perdita di lettura sia già forte nelle pose40–80 con cielo e cavità presenti. Le immagini hanno un aspetto fuori fuoco, ma non diagnosticano un filtro di sfocatura o una pipeline sbagliata. La diagnosi72 trovava gradiente CPU/JPEG concorde e poco effetto del passo/dettaglio fine; localizzava una perdita di risposta del carving prima del clamp. È una causa locale plausibile, non una misura dell'intera v56 o dei quattro seed odierni.

Lo scalare `.6→.5` svuotava i13 vecchi punti front+5m; la guardia successiva preservava il bordo ma quasi annullava l'effetto. Non furono app candidate con bake, nuova frontiera e camera ordinaria rivalutati. Sono controprove negative delle formule esaminate: non un veto a ogni modifica della frontiera, né una soluzione dimostrata. Non riproporre altra frequenza100–300m come se mancasse già dal generatore.

## Prossimo confronto minimo falsificante

🌟 **Una sola posa74near60 con cavità e cielo: controllo/candidato in Sole e Tramonto, quattro immagini.** Copiare la stessa origine, target, FOV e output del controllo; non riallineare il candidato con il suo probe e non cambiarne zoom/esposizione. Tempo60, meteo assestato, vento/flow e qualità256³/128³/384 identici. Se cambia la densità, rendering e bake devono usare lo stesso materiale nuovo.

Accanto alle immagini annotare prima densità, distanza ottica dominante e apertura del cielo sui medesimi raggi. Una frontiera nuova è consentita: se arretra, però, distinguere l'effetto dell'area più grande inquadrata dal recupero di rilievo. Poi si potrà valutare separatamente la navigazione ordinaria ricalcolata.

**Non dimostra il recupero di rilievo** un candidato che mostra soltanto più grana, media più scura o bordo ritirato. Nuovi fori e perdita del nucleo sono regressioni da giudicare. Cercare una piega/protuberanza riconoscibile nella stessa zona e una risposta coerente al sole; il contrasto può legittimamente differire fra Sole e Tramonto. Un vantaggio presente in un solo assetto è parziale. Non richiedere identità del vecchio fronte; non accettare il solo aumento di contrasto come prova.

Questo confronto può scartare presto un'idea. Un esito favorevole richiederà ancora un breve spostamento laterale e pausa/ripresa per escludere texture incollata allo schermo, oltre ad altri seed e alla massima vicinanza. Non propone un limite allo zoom e non chiude anatomia, vicino o FPS.
