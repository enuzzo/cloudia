# Face-direct — risultato numerico A/B/A

**Confronto salvato qualificato; nessuna conclusione di miglioramento visivo.** Script e protocollo erano congelati prima della lettura effettiva. Analisi eseguita con limite esterno di 30 secondi, terminata in meno di un secondo, senza browser, GPU, modello o raggi.

I 101 gate sono superati. Cached/fresh di A e ritorno A coincidono con il whole RGBA32F `07fa43ec5de6d77b9bdf83d5a78e73cb607ae573d875ce382b3c28f909fb2fb9`. B cached/fresh coincide con `efcfeab71e90f5c6a22b30f1473e75c414e661493c5aa70a5d8ff52419767a4d`. Tutti e sei i digest alpha sono `29a4e01526e01077dad44a2fa4e45b10619c92292e8d3711bf0980174a55a79c`; le dodici parole distanza coincidono in tutti i sei record.

I due nuovi export PNG A/ritorno dichiarano SHA `6d7a8c836c0ae51ca058c6b634e633481eb42e61f09f20b5be68bed128625fc9`. L'analisi ha riaperto e ricalcolato il digest del bitmap esistente degli alias: 3.599.836 B, 2474×1844, contenuto esatto. Questo autentica il riuso dei byte, senza nuova ispezione artistica del revisore.

Camera, luce, controlli selezionati, qualità piena e statistiche geometriche coincidono nei tre snapshot. Le statistiche non sostituiscono una verifica indipendente dei buffer GPU. Il confronto alpha completo dimostra il ritorno degli stessi bit distanza/miss in questa vista; non è un confronto del raw depth né una prova globale della geometria.

| Coppia storica | Michelson lineare A | Michelson lineare B | Risultato locale |
| --- | ---: | ---: | --- |
| L1 | +0,0703905285 | +0,0703905285 | Entrambi i pixel sono RGBA bit-esatti. |
| L2 | +0,1751908550 | −0,1853544464 | L'ordine di luminosità si inverte; la magnitudine del contrasto non si riduce. |
| L3 | −0,0268981764 | −0,0268981764 | Entrambi i pixel sono RGBA bit-esatti. |

Nei dodici campioni cambiano sei pixel e diciotto parole RGB: L2 artifact/control, C2, C4, C5 e C6. Massimo delta RGB assoluto selezionato 0,0194354672. L2 artifact perde il 19,47% di luminanza lineare; L2 control guadagna il 66,95%. Il ritorno A recupera tutte le 48 parole selezionate esattamente.

Questo risultato associa una variazione del radiance alla sostituzione controllata della formula del diretto, sotto i gate dichiarati. **Non sono stati letti D né la normale geometrica da derivate nel candidato B.** I valori D o le facce della precedente reference CPU non vanno presentati come misure di questa variante.

La coppia L2 non sostiene una riduzione locale del contrasto con questa modifica. L1 e L3 restano invariati ai punti: non si può descrivere il cambiamento come una correzione delle tre ribbon. I nomi artifact/control sono storici e la selezione non misura tutta l'immagine. L'accettazione o il rifiuto artistico del PNG B e qualsiasi esito FPS restano prove separate del root; non vengono dedotti da questi numeri. Nessuna ulteriore variante o correzione è proposta da questa analisi.
