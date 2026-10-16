# Audit CPU cache A/s — posa storica, 2026-10-16

**Audit valido, gate della candidata non superato.** Entrambi i grid falliscono
il limite massimo di spostamento1,5m. Il256³ supera p99 e i due gate tau; il128³
fallisce anche p99 e tau massimo. Come concordato, qui si ferma la prova:
nessuno sweep di altre pose/amount/growth, nessuna crescita della memoria,
nessun bake, GPU, browser, build o modifica prodotto.

È una misura numerica di un modello CPU ricampionato, non una prova di difetto
visibile. I massimi mapping appartengono a sorgenti debolissime; interpretarli
come perdita fotografica dimostrata sarebbe scorretto. Non sono stati cambiati
i gate dopo aver visto questi risultati.

## Ripetibilità e percorso fissato

Un solo processo Bun1.3.11 arm64, completato con exit0 in1,957s di tempo interno
audit; il conteggio storico, prima della sintesi, registra1,747s. Questi tempi
non sono throughput del renderer né costo di un vero rebuild cache3D. Controllo
node_modules prima del run: ignore File Provider=1, Git ignored e non tracked.
Nessuna installazione o cartella rigenerabile aggiunta.

Riutilizzati i dati cycle10/rain-work/data, verificandone bytes/SHA. I helper CPU
usati dal bake storico risultano invariati. cloudShader/GPUSceneEngine sono
successivi, dichiarati come tali; il blocco rain attuale è verificato identico
al blocco dello snapshot storico. Il replay non attribuisce alla GPU la precisione
del suo filtro CPU o del flow half analitico originario.

Posa seed72 congestus, t60, wind.55, dispersion0, pausa, output2560×1440,
macro256³/detail128³/flow16³,384passi nominali. Camera storica esatta, non
ricentrata sui bounds. forcing/precipitationTime0 è **inferito** dalla sequenza UI
documentata; manca nel JSON benchmark storico. Sono quelli del report sorgente:

```
origin = [-.28995623264629566,-3.0278343591735393,9.665778756295405]
target = [-.28995623264629566,2.4981598424383944,-.02734375]
sequenceSHA = a0c2dfd79e1900dce9a677fceecbd5bfcfc138a2e94cd430938f4c4c7bf3ca7a
```

Riprodotte esattamente246.399iterazioni,206.466campioni rainRegion e91572
contributori rain positivi. Sequenza SHA identica al vecchio counter,1613controlli
indipendenti delle formule A/s esatti,6casi della conversione half RNE passati.
Separato il solo riordino delle moltiplicazioni f32: massimo delta sigma
2,38419e−7/km, molto inferiore agli errori di ricostruzione qui sotto.

## Misure e gate

Il mapping è `|wind|*|sInterpolato-sOriginale|`, in metri. P99 e massimo sono
non pesati sui91572campioni con Aoriginale>0; il report conserva anche l'unione
dei contributori originali/candidati e le medie pesate per opacità. Il peso è
la quota rain dell'opacità co-locata cloud+rain, con la Tbaseline entrante.

|Misura|128³|256³|Gate proposto|
|---|---:|---:|---|
|Mapping p99, m|1,63469|0,36121|≤.75: FAIL / PASS|
|Mapping massimo, m|15,25057|6,12657|≤1.5: FAIL / FAIL|
|Mapping medio pesato per opacità, m|.03717|.01570|Informativo|
|Errore A assoluto: media / massimo|.001555 / .075134|.000424 / .028749|Informativo|
|Errore sigma assoluto medio, /km|.00106172|.00029740|Informativo|
|Delta tau assoluto massimo|.0120674|.00335735|≤.01: FAIL / PASS|
|Delta tau medio, tutti576raggi|.00062697|.00018635|≤.002: PASS / PASS|
|Delta tau medio, soli247raggi con rain baseline positiva|.00146208|.00043456|≤.002 anche senza diluire con raggi vuoti|
|Delta T assoluto massimo|.00510389|.00145096|Informativo, nessun gate T inventato|

Sull'unione dei contributori il mapping p99 è3,07061/.45601m e il massimo
16,42532/7,00697m: stesso esito globale. Le medie degli errori A/sigma in tabella
comprendono tutti206466campioni rainRegion; i denominatori sono espliciti nel JSON.

Il percorso, ds/jitter/clip e cutoff rimangono comandati dalla baseline.
Le T candidate sono integrate su quegli stessi segmenti, senza poter interrompere
o prolungare il replay. In4raggi128 e1raggio256 la candidata avrebbe continuato
oltre il cutoff baseline: il seguito è **censurato**, non stimato. Non sono quindi
tau/T di un nuovo rendering completo con il proprio early exit.

## Witness: gli errori massimi sono in sorgenti deboli

|Grid|Raggio / t, km|Aoriginale|Ainterpolata|Errore mapping|Peso opacità del segmento|
|---|---|---:|---:|---:|---:|
|128³|379 /9,413945|.000106690|.000142504|15,25057m|3,79571e−7|
|256³|347 /9,688971|.000103462|.000072560|6,12657m|3,41456e−7|

Le coordinate rp, originali/candidate A/s/sigma e gli8corner half con pesi
sono salvati integralmente in `result.json.worstMapping`. Il128 ha s originale
.392848 e ricostruito.447482; il256 ha.697876 contro.675928. Le T entranti sono
vicine a1: questi errori sono in sorgenti tenui, non nascosti dietro opacità.
Il loro peso minuscolo limita quanto possono provare sul danno all'immagine.
Il fatto che il256superi i gate tau non costituisce però accettazione degli
spostamenti o della dinamica; non si promuove automaticamente la candidata.

## A=0 non autorizza s=0; cap e bordi

Il lazy builder ha valutato165815nodi128 e324642nodi256, includendo le probe.
93067/182273nodi hanno A=0 ma s non zero. Nessuna texture cache densa è stata
allocata: sono Map di packed half; il loro overhead heap non è misurato. Le
ipotetiche risorse complete restano8/64MiB RG16F, non la memoria di questo audit.

Il controllo intenzionalmente sbagliato s=0 nei corner A0 porta, nei punti con
corner misti e Ainterpolata>0, a mapping p99≈210,92/206,64m e massimi267,82/258,58m.
Questo conferma numericamente il motivo per conservare s anche nei nodi vuoti.
Non è una variante candidata né un risultato GPU.

Probe aggiuntive limitate:64punti sulla cap rp.y=2.8 e64sulle facce laterali
del dominio cache, per ciascun grid. Alla cap Aoriginale=Ainterpolata=0 in tutti
i64punti, mentre s originale è non zero in tutti. Sulle facce laterali Aoriginale
è sempre0, ma l'interpolazione produce Apositiva in4/2punti, massimo
.00063723/.00028276. Il report conserva tutti i punti, non soltanto i massimi.

Sul replay A0→Apositiva avviene3986/1868volte; Apositiva→A0 avviene0/1volte.
Questi contatori descrivono cambiamenti di supporto del modello ricampionato,
senza dedurre una silhouette GPU o una violazione del vecchio mask cloud.

## Decisione

**Candidata non promossa con il contratto iniziale; strada non definitivamente scartata.**
Non allargare adesso grid o sweep. Il risultato più favorevole al256 è ottico:
tau contenuto e mapping medio pesato piccolo. Il risultato contrario è un
errore di fase localmente grande nei contributor marginali e supporto A
diverso ai bordi. Una scelta futura di diversa rappresentazione o di un gate
ottico richiede una motivazione indipendente, non una soglia ritoccata per far
passare questi dati.

Non sono misurati costo dinamico di build/upload, flow nativo, precisione
sampler GPU, sourceRGB, contrasto striature, immagine o FPS. I test di cap sono
finiti e riferiti a questo singolo stato; nessuna qualifica di tutti i climi,
growth, amount, tempi o famiglie. Sorgenti e risultati completi hanno SHA nel
manifest finale; i109MB di dati del bake restano soltanto nella cache esterna.

## Analisi condizionata richiesta dopo il run

Le statistiche complete di mapping max/p99 con Aoriginale≥.01 o≥.1, o condizionate
sul peso ottico, **non sono recuperabili dai raw salvati**: il processo ha conservato
aggregati, medie pesate, metriche per raggio e witness, ma non le associazioni
A/mapping/peso di tutti i campioni. Anche l'erroreT condizionato non si ricava dal
solo T finale del raggio. I pochi witness non possono sostituire quelle distribuzioni.
La disponibilità è esplicita in conditional-analysis.json; nessun replay aggiuntivo.

Restano disponibili la media del mapping pesata per opacità e gli erroriT globali
sul percorso fissato. Non si attribuisce ai contributor significativi un errore
massimo di6.13m sulla base del witness marginale256. I gate .75/1.5m restano
identici a quelli dichiarati prima del run e rimangono FAIL come specificato.

Un eventuale nuovo esperimento deve motivare **prima** un contratto ottico/visivo
diverso, con trattamento esplicito delle code deboli e test nativi di striature,
bordi e virga. Deve includere rebuildGPU/upload e dinamica nel costo misurato,
oltre al render, e distinguere pausa da animazione. Il buon tau256 non fornisce
da solo questo contratto né rende il metodo una regressione visiva dimostrata.
