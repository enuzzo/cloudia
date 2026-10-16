# Causalità del carving esistente: revisione scalare respinta

**Risultato: non aggiungere un altro campo100–300m e non promuovere il coefficiente `.6→.5`.** La banda geometrica esiste già. L'attenuazione interna e il clamp cancellano parte della sua risposta nel materiale otticamente dominante, ma la revisione scalare provata modifica anche il fronte e azzera punti che prima contenevano nube. Non costituisce una correzione conservativa pronta per il prodotto.

Questo documento corregge la genericità della precedente proposta di un nuovo rilievo mesoscopico. Gli altri candidati di anatomia sono gestiti separatamente; qui non è stata generata una nuova variante, texture, cache luminosa o build.

## Cosa è già presente

La baseline08c33cb comprende già c1 a1,8/km, c2 a4,5/km, n2 a3,6/km e n3 a9/km: scale nominali556/222/278/111m. Contiene inoltre billow con raggi nominali160–700m e figli più piccoli. Una nuova frequenza100–300m, motivata solo dalla scala, duplicherebbe struttura esistente.

Il materiale è prodotto nell'ordine:

```text
I = 1 - .6*smoothstep(.04,.28,F)
C = negativeNoise * heightScale * I       // zona liquida esaminata
U = (F + C - .025) * 10
R = round255(float32(clamp(U,0,1) * (.65+.35*n2)))
```

F è il campo dei primitivi uniti, non una distanza esatta dall'intera nube. SopraU=1, cambiare c1/c2 senza uscire dal plateau non cambiaR; resta la modulazione n2. Questa perdita precede la cache luminosa.

## Verifica contro il materiale effettivo

La costruzione dei primitivi è estratta dal sorgente congelato e termina **prima** di rasterizzazione, generazione del dettaglio e bake. Sono ricostruiti solo i nodi macro vicini ai punti realmente campionati dopo warp, conservando ordine delle unioni e arrotondamento Float32. I196 nodi dei52 campioni riproducono196/196 byteR esistenti; aggiungendo una breve traccia centrale il totale è252/252, senza discrepanze. Non è un nuovo volume o una prova di tutti i256³ voxel.

La zona non è costituita solo da un genitore liscio. Il nucleo#24 ha raggi1,367×1,015×1,259km; i billow contribuiscono mediamente circa60m al campo nei punti a tau1. Tuttavia il materiale che contribuisce di più diventa un plateau denso:

| Posizione campionata sui13raggi | F medio | I medio | Peso medio degli stencil in clamp alto |
|---|---:|---:|---:|
| Prima densità+5m |.20780 |.53063 |0% |
| Vecchia tau1 |.27083 |.40541 |86,38% |
| Distanza media di contributo |.26676 |.40824 |84,50% |
| Vecchia tau3 |.33648 |.40000 |92,31% |

Nel centro a tau1 tutti gli8 nodi sono saturi: U1,182–1,353. Per rientrare appena nel tratto non saturato servirebbero18,2–35,3m aggiuntivi di carving negativo ai singoli nodi. La traccia centrale a1m attribuisce il **76,53% del peso d'opacità** a stencil saturi, il23,47% al tratto attivo. Il fronte sottile è inciso; buona parte della massa visibile successiva non conserva la risposta del carving al clamp.

Le precedenti misure di luce rimangono pertinenti: nei13 punti la tau solare corrente e la cache concordano nel centro; il JPEG reale concorda con il gradiente CPU, RMSE0,350/255. Non emerge un grande filtro o errore di pipeline che abbia cancellato quel gradiente. Questi campioni non escludono ogni perdita sub-voxel, ma non sostengono un nuovo cache come prima azione.

## Un solo controfattuale, con esito negativo

È stato riprodotto esattamente **`I'=1-.5*smoothstep(.04,.28,F)`** sui196 nodi esistenti. Non è `max(.5,I)`: cambiare il coefficiente modifica anche la transizione esterna. Campo, rumore, soglie e modulazione restano quelli congelati. Sono conservati storage Float32 e arrotondamento JS; la vecchia formula riproduce nuovamente196/196 byte. La stessa erosione fine filtrata viene riapplicata alle52 coordinate già note, tutte liquide. Non sono ricalcolati luce o confine.

| Campioni | Densità render media prima→dopo | Clamp alto medio prima→dopo | Nuovi campioni vuoti |
|---|---:|---:|---:|
| Prima densità+5m |.09111→0 |0→0 |13/13 |
| Vecchia tau1 |.66005→.52587 |86,38→24,57% |1/13 |
| Distanza media di contributo |.65655→.52271 |84,50→22,46% |1/13 |
| Vecchia tau3 |.77136→.71653 |92,31→81,12% |1/13 |

Nel centro a tau1 desatura7/8 nodi senza azzerarli: densità.68039→.60775; peso saturo100→9,89%. Ma tutti i13 vecchi punti appena5m dentro il fronte diventano vuoti. Il raggio deboleUV(.05,.05) diventa vuoto anche nelle vecchie posizioni tau1 e tau3. La posizione della nuova frontiera e le nuove tau non sono note: non si deve chiamare questo risultato una miglioria di contrasto a distacco invariato.

**La revisione viene conservata come risultato negativo e non va promossa.** Disattivare del tutto l'attenuazione interna è ancora meno selettivo: nei campioni a tau1 quasi tutto il macro materiale si annulla. Nessun ulteriore parametro è stato cercato per forzare un risultato favorevole.

## Differenza dagli esperimenti ritirati

- Meso v26 aggiungeva un lookupR a frequenza1,2, scala nominale26m, con erosione massima.12 **dopo** la formazione del macroR. Il bake usava lo stesso materiale. Non cambiava il carving originario dei primitivi prima del clamp.
- U/M v35 conservavaU0 prima del clamp e spostava la condensazione dopo l'interpolazione; manteneva il carving originario. In uno stencil i cui8U sono tutti>1, la sola interpolazione diU rimane>1: non recupera quel tratto. Le varianti successive modificavano rampa, estinzione o applicazione del dettaglio e non sono equivalenti alla revisione qui misurata.
- Le precedenti immagini usavano seed1571198069 e raggio dal target.6045067691053366km, con altri output e camera. La fixture attuale seed72 è qualificata esterna; questa qualifica non si trasferisce retroattivamente al vecchio seed. I risultati negativi precedenti non sono cancellati, ma non sono un confronto alla stessa frontiera né autorizzano un'equivalenza tra gli interventi.

## Limiti e riproduzione

Il replay è scalare e locale: non misura massa globale, connettività, tutte le famiglie, nuove ombre, prestazioni o qualità artistica. Le vecchie coordinate e l'erosione fine sono mantenute fisse; una vera modifica richiederebbe un bake coerente e nuove guardie. Qui non è autorizzata o realizzata quella modifica.

`counterfactual-coefficient.py` riproduce il risultato con soli moduli Python standard, senza dipendenze del progetto. `probe-carving.ts`, `geometry-scalar.ts` e `carving-causality.json` preservano l'estrazione e il controllo contro la cache originale. L'archivio curato mantiene una versione compressa dei dati e un replay che confronta tutti i risultati congelati. Nessun file del prodotto è stato modificato.
