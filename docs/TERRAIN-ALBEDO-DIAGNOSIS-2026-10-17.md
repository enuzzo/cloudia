# Cloudia — diagnosi del materiale del terreno

17 ottobre 2026. **Risultato misto, diagnostica conclusa; nessun nuovo materiale adottato.** La v60 resta il prodotto (`8b3a1448553dae248de7ae846fe0459b1be1a962`). Le letture GPU indicano che il ramo di illuminazione contribuisce ad alcuni contrasti locali; non spiega da solo tutte le macchie. Nel confronto nativo senza illuminazione del suolo restano grandi campiture e versanti levigati. Il fotorealismo richiesto e i 60 FPS a qualità piena restano aperti.

## Cosa è stato confrontato

Una snapshot esterna deriva dai 129 sorgenti v60. A è il materiale originale; B sostituisce soltanto la riga `ground` con `albedo+inlandWater*coverB.w`; il ritorno A usa un nuovo proprietario del renderer. Il materiale di mare/acque interne, geometria, copertura reale, ombre, atmosfera, nube e film restano gli stessi. B è uno strumento diagnostico, non un materiale finale.

R1 usa una scelta immutabile alla compilazione: il ramo ordinary restituisce il WGSL originale byte per byte e conserva wrapper e binding originali. Le pipeline A/B sono diverse: il compilatore può eliminare lavoro in B. Il confronto misura l'effetto di quella sostituzione nel renderer; non promette isolamento algebrico di ogni float né permette un confronto FPS.

Seed 74, Sole assestato, posa fissa, simulazione t60 in pausa, forcing0, nessuna orbita o lampo, flusso completo, output nativo 2474×1844, qualità 256³ macro /128³ dettaglio /384 passi nominali. Un renderer attivo alla volta.

## Gate prima e dopo la variante

| Lettura | Target RGBA32F, SHA256 | Alpha su tutti i pixel | PNG nativo |
|---|---|---|---|
| A iniziale | `e4435ce3…` | `29a4e015…` | `90641c32…` |
| B albedo | `0ed1d665…` | `29a4e015…` | `5eb7d8be…` |
| A ritorno | `e4435ce3…` | `29a4e015…` | `90641c32…` |

Ogni target corrente è anche bit-identico al suo ridisegno forzato. Alpha contiene distanza/miss: il digest corrisponde su **4.562.056 pixel /18.248.224 byte**, oltre ai dodici campioni. Tutte le 48 parole RGBA dei dodici campioni A/ritorno corrispondono al riferimento precedente. I metadati applicati selezionati coincidono; cambia soltanto il clock `weatherTime`, mentre simulazione/forcing/precipitazione sono fissi.

Il target packed completo ha 72.992.896 byte; il readback con stride ne restituisce 73.169.824. Gli helper ricavano alpha e dodici campioni dalle due letture già presenti: nessun nuovo target o readback GPU. Alpha aggiunge 18.248.224 byte CPU per lettura; picco di residency, GC e staging non misurato.

B: PNG lossless 2474×1844, **3.005.033 byte**, SHA256 `5eb7d8bef55d6e707ee552bd2f0ed5f93b39d97dcaf4e69f7a3cd2033f0e0f2b`. Trasferite e verificate tutte le 62 parti dell'esportazione visibile. I PNG ordinary sono metadati freschi con alias al bitmap già verificato `90641c32d46bf62874bf4855dbd26cd01013d4a2b220cbf76acb8ee2816d2a7d`; nessun nuovo trasferimento di quei pixel. Console salvate vuote.

## Risultato locale e visivo

Y lineare = .2126R+.7152G+.0722B sul target prima dell'atmosfera. Contrasto di Michelson assoluto nelle tre coppie storiche:

| Coppia | A | B | Interpretazione limitata alla coppia |
|---|---:|---:|---|
| L1 | .082698 | .082441 | contrasto relativo quasi invariato |
| L2 | .210618 | .020868 | forte attenuazione |
| L3 | .018846 | .004769 | attenuazione e inversione del segno |

C1-ocean e C3-plain restano RGBA bit-identici; i nomi sono etichette storiche, non una classificazione attuale del suolo. Negli altri dieci campioni cambia RGB. Tutti gli alpha coincidono. Questo separa una parte della risposta normale/luce diretta/ambiente dalla miscela di colore, ma non separa i singoli fattori dentro il ramo rimosso e non attribuisce ogni patch dell'immagine a una causa unica.

Root e revisione indipendente hanno ispezionato il PNG B completo e gli stessi ritagli 1:1: primario [0,560,1000,1000], secondario [700,540,1030,780], senza ridimensionamento o correzione tonale. Diverse scaglie scure si attenuano; la chiazza triangolare nel secondo ritaglio quasi scompare. Persistono campiture beige/grigio/verdi e crinali arrotondati; manca una struttura rocciosa credibile. La variante appare più piatta/cartografica. **Nessun PASS fotografico.** Il PNG contiene ancora atmosfera/nube/film; non è stata catturata un'immagine colore dell'intero target raw. Dodici valori raw non provano la forma globale delle macchie prima dell'atmosfera.

## Tentativo R0 respinto e qualifica

R0 usava una modalità uniforme condivisa. Il suo ordinary produceva cached=fresh `61209ebc…`, diverso dal target canonico, pur mantenendo PNG e dodici campioni esatti. Il gate sull'intero target è fallito: **nessun B R0 è stato eseguito**. Causa, posizione, quantità e grandezza delle differenze non sono identificate; non si deducono da due hash. R1 conserva lo shader ordinary originale e recupera il target canonico prima di B e al ritorno. R0 e R1 rimangono archiviati separatamente.

R0: 52 test mirati,516 completi in50 file, typecheck e APP→hero PASS. R1: **55 mirati,519 completi in50 file**, typecheck e APP→hero PASS. Le prove coprono derivazione stretta del WGSL, punti/alpha bytewise anche con offset e valori speciali, guardie e lifecycle. Il superamento dei test non costituisce accettazione visiva. I `results.json` R0 conservano i percorsi originali dei log; questi log sono stati spostati in `qualification-r0`, non ricostruiti. Il runner archiviato è la revisione R1.

## Conseguenza pratica

Nessun nuovo coefficiente di ambiente, bias ombre o sweep di normali. La diagnosi non giustifica un'altra regolazione cieca. Il passo successivo è verificare un candidato con dati Copernicus GLO30 reali, campionati a62,5m, e una costruzione geometrica con budget espliciti. La maggiore risoluzione della sorgente non garantisce una mesh altrettanto fine né più FPS. La fonte è un DSM: include superfici di vegetazione/edifici, non un terreno nudo. La proposta di fattibilità è distinta dall'implementazione e dall'eventuale adozione.

Il materiale attuale non contiene un termine speculare: l'aspetto apparentemente lucido non prova una riflessione speculare. La separazione fra riflettanza e luce incidente segue [PBRT, Diffuse Reflection](https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection). [EON v3](https://arxiv.org/abs/2410.18026v3) rimane un riferimento per un eventuale modello diffuso ruvido; nessun codice o parametro di quel modello è stato adottato.

## Stato locale e riproducibilità

Workspace diagnostico `/Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle34`; sorgenti/dist fuori Dropbox. Manifest base129 `a4e38cfc…`, R0/R1 ciascuno133 sorgenti; overlay rispettivamente8 e7 percorsi sulla stessa base. Tutti i129 sorgenti prodotto sono rimasti byte-identici. `node_modules` ignorato da Git/non tracciato, attributo Dropbox1 verificato prima/dopo qualifica; nessuna installazione o modifica lockfile. `node_modules 2/` e servizio4201 estranei preservati. Nessun push o deploy.

Preview ordinaria4196 ripristinata su v60, Sole e nube matura animata, output nativo, vista14sinistra/3giù; screenshot UI separato dai PNG fissi. QA53777/53778 chiusi intenzionalmente, exit0. Nessun worker, pioggia/Tramonto, moto o FPS misurato in questa diagnosi.

Archivio e verifica finale sono indicati nel manifest accanto al rapporto. Il goal resta attivo: terreno, anatomia/luce ravvicinata, pioggia/virga, UI e60FPS non sono dichiarati conclusi.

Archivio: [manifest](measurements/terrain-albedo-diagnosis-2026-10-17/manifest.json), **67 payload /4313291 byte**, manifest SHA256 `dbc232cda1bc8a319d7797289887a492b617bdfe57831a888f4a1e4375a2c8d8`. Overlay, protocolli, qualifiche, JSON, B nativo, ledger/ritagli e review indipendenti conservati.
