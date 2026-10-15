# Opzioni future per la ricostruzione della densità

15 ottobre 2026. **Proposta di prossimo esperimento isolato, non implementata.**
La baseline è ripristinata con estinzione liquida 18/km. Gli esperimenti
[v29](EXPERIMENT-SURFACE-BILLOWS-2026-10-15.md) e
[v30](EXPERIMENT-INTERFACE-2026-10-15.md) non hanno risolto la sfocatura.
Questa proposta non promette una soluzione della sorgente luminosa uniforme.

## Cambiare l'ordine della ricostruzione

Oggi R contiene il profilo di condensazione già applicato al campo scolpito:
il campione GPU è quindi, schematicamente, `interp(C(F) * M)`.
La proposta conserva F nella texture e applica C dopo l'interpolazione:
`C(interp(F)) * M`. Il confronto iniziale manterrebbe geometria, camera,
estinzione, dettaglio e moto; nessun TAA o riduzione di qualità.

Esempio analitico 1D: F affine con gradiente unitario, modulazione M=1,
`C(F)=clamp(32*(F-.05)+.5)`, h=10/256 km=39,0625 m; nessuna quantizzazione.

| Centro dell'interfaccia | `interp(C(F))`, fascia 10–90% | `C(interp(F))`, fascia 10–90% |
| --- | ---: | ---: |
| Su un nodo | 62,5 m | 25 m |
| A metà fra due nodi | 31,25 m | 25 m |

La rampa continua completa è 31,25 m. Il secondo ordine recupera esattamente
il caso affine; il primo dipende dalla fase rispetto alla griglia e può spostare
il livello 50% fino a circa 5,28 m. Sono calcoli del profilo ideale, non misure GPU.
Applicare la funzione di trasferimento dopo la ricostruzione scalare è un metodo
consolidato [1]; non ricrea dettagli geometrici assenti nei campioni 256³.

## Due formati, due esperimenti diversi

| Variante aggiuntiva 256³ | Payload GPU e backing CPU, ciascuno | Lookup densità | Materiale |
| --- | ---: | ---: | --- |
| R16F: F | 32 MiB | 2 byte/texel | M da `.65+.35*fine.g`: modello nuovo |
| RG16F: F e M originale | 64 MiB | 4 byte/texel | Conserva i campi n2, fibers e baseFade |

Entrambe sostituiscono la lettura R deformata, senza aggiungere una lettura di
densità per campione; la lettura GBA delle profondità ottiche resta separata.
Per RG16F la coppia densità/luce resta nominalmente 4+4 byte/texel come oggi.
R16F porta la coppia a 2+4; ciò non dimostra minore traffico o tempo GPU:
separazione delle cache, località e nuova memoria residente richiedono profiling.
I costi riportati escludono driver, staging e sovrapposizione vecchio/nuovo volume.

R16F con fine.g cambia anche scala, fase e seme della modulazione: n2 usa una
scala di circa 278 m, fine.g circa 208 m ed è già correlato al warp X.
Occorre inoltre decidere esplicitamente come mantenere base e modulazione ice.
RG16F è l'opzione più pulita per isolare la ricostruzione: campiona F e M alla
stessa coordinata deformata. Conserva il materiale originale campionato, non
l'identità con `interp(C(F)*M)`: cambia l'ordine di prodotto e interpolazione.
Generare M anche nelle celle necessarie che avevano condensazione nulla;
non ricavarlo tramite una divisione `rho/C` quando C è zero.

## Condizioni di correttezza prima di una build

- Il campo dopo carving non è una vera SDF: non garantisce gradiente unitario
  né passi di sphere tracing. La larghezza locale è circa `31,25 m / |grad F|`.
- CPU, bake, probe e shader devono usare gli stessi half quantizzati, centro
  del texel, clamp ai bordi, interpolazione e coordinate deformate, senza
  applicare il flusso due volte. Verificare valori finiti e conversione half.
- Conservare esplicitamente fase liquida/mista/ghiaccio e baseFade; provarne
  continuità e comportamento ai bordi. Il punto medio non prova massa globale.
- Il vecchio macro R resta un proxy della densità effettiva del nuovo modello
  per precipitazione e statistiche del supporto, rigenerato coerentemente.
  La maschera conservativa non deve dipendere dal solo R8 arrotondato.
- Con soglia di condensazione non negativa, vertici F>0 offrono un criterio
  conservativo prima delle dilatazioni per interpolazione, warp e moto.
  Provarlo su celle oblique, fasi miste e valori vicini allo zero; distinguere
  questa maschera dal proxy di massa usato dalla precipitazione.
- Ribattere tutte le cache luminose dalla stessa nuova densità CPU; GBA resta
  sulla griglia 256³ e non eredita automaticamente la sottile interfaccia GPU.
- Trasferire i nuovi buffer nel worker, installare e scambiare le texture insieme,
  liberarle su rigenerazione, errore e distruzione; misurare anche il picco RAM.

## Decisione sperimentale

Preferenza: RG16F se il budget di memoria è accettabile, con M originale,
geometria baseline fissa e identico profilo C nel controllo pre-interpolato
e nel candidato: cambiare anche gain confonderebbe il confronto. Prima test
1D su più fasi/allineamenti, sampler CPU/GPU e prova della maschera; poi guard
reale a camera fissa 80/95/100%, fronte/lato/controluce e convergenza del passo.
Conservare 256³/128³/384 passi nominali/output intero; misurare costo e memoria.
Il trasporto e la sorgente poco articolata restano problemi distinti: vedere
anche [le opzioni di luce](LIGHTING-OPTIONS-2026-10-15.md). Nessun beneficio
fotografico viene dedotto dalla sola tabella 1D o dalla precisione half.

## Fonte primaria

- [1] [GPU Gems, capitolo 39: Volume Rendering Techniques, §39.2 e §39.4.3](https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-39-volume-rendering-techniques): ricostruzione scalare e applicazione della funzione di trasferimento; la tabella 1D è un nostro calcolo, non un risultato della fonte.
