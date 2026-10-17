# Continuità geometrica: ricerca e scelta prima della prova

17 ottobre2026, ciclo44. Nessun nuovo modello o rendering eseguito per questa nota. La precedente traslazione dell'outflow è respinta e non è la baseline:141 sorgenti canonici v61, HEAD909d17a.

## Contesto primario consultato

- [Fuentes Suárez, Hubert, Zanni: Anisotropic convolution surfaces, Computers & Graphics82,2019](https://www.sciencedirect.com/science/article/abs/pii/S0097849319300792), DOI10.1016/j.cag.2019.05.018; [abstract dell'autrice presso Inria](https://www-sop.inria.fr/members/Evelyne.Hubert/publications/). Il lavoro usa scheletri con sezioni ellissoidali variabili per costruire forme organiche controllabili. Il nostro operatore proposto è un massimo di kernel, **non** il loro integrale di convoluzione e non un'implementazione del paper. Nessun codice copiato. Il primo URL full publisher ha restituito403; abstract e sezione pubblica dell'autrice letti, nessuna pretesa di aver consultato integralmente il PDF.
- [WMO: Cumulonimbus calvus](https://cloudatlas.wmo.int/en/clouds-species-calvus.html). Le protuberanze superiori perdono progressivamente i contorni cumuliformi e possono presentare striature verticali. È contesto morfologico per una transizione, non una convalida meteorologica del generatore.

## Scelta operativa

La proposta conservata dal ciclo43 sostituisce tre collar decorati e una spalla sovrapposta con un inviluppo neck→top→core ice. I keyframe e il resto della ricetta rimangono canonici; nessun secondo spostamento dell'incudine. Una nuova discretizzazione di tre dischi senza errore delimitato riprodurrebbe il difetto da rimuovere. Un optimizer adattivo per ogni voxel aggiungerebbe lavoro dipendente dal punto e richiederebbe una prova ulteriore della continuità spaziale.

La via scelta da rendere concreta è una griglia di parametri t preparata una volta dalla geometria, fissa per tutti i punti. Il massimo dei kernel1-Lipschitz resta1-Lipschitz in spazio. La griglia deve approssimare l'inviluppo continuo con errore scalare≤min(voxelXYZ)/8: a256, `.00341796875` unità mondo. Non è una garanzia sulla distanza della superficie, sulla densità quantizzata o sul colore finale.

Le omissioni del raster negativo richiedono un dominio anisotropo: per ogni asse il livello kernel≥−b è contenuto nell'AABB endpoint allargato di `b*max_endpoint(r_i/min(r))`, non semplicemente di b in coordinate cartesiane. Il MAX del raccordo va calcolato separatamente e unito una sola volta al campo con il blend canonico.16; ripetere smooth-union per ogni campione farebbe dipendere la massa dal numero dei campioni.

Prima dei costi reali: limite4096 kernel,256.000.000 visite voxel previste,16MiB massimi per il raster temporaneo locale. Solo dopo helper/contratto congelati, un preflight limitato alle cinque ricette74/77/80/72/73 e alla preparazione dei kernel:6CPU/10wall/384MiB, senza raster denso/bake/GPU. Non alzare epsilon o limiti dopo il risultato per farlo passare. In caso di superamento, niente full-model: migliorare l'efficienza preservando lo stesso campo/errore, oppure respingere il metodo.

L'obiettivo rimane la macrostruttura credibile e poi luce vicina/movimento delle tre famiglie, con pioggia/virga, terreno,UI e60FPS ancora aperti. Un helper numericamente coerente non è un risultato fotografico.
