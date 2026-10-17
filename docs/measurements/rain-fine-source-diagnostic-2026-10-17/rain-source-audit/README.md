# Rain source diagnostic — pronto, non eseguito

Una sola generazione canonica v61, seed74 a64³, con dettaglio64³ e tutti i cinque bake luce originali. **È una diagnosi CPU a risoluzione ridotta autorizzata, non una modifica di qualità del prodotto né un trial nativo256³/128³/384.** Non misura FPS e non qualifica il risultato artistico.

## Provenienza e gancio

`canonical-141-manifest.json` è il manifest finale v61 SHA256 `2577f187602a3d4cbb3be2d2d23a9fd3e87e30c64f01a21aa93cf428ff4abf73`. In `baseline/` sono copiati soltanto i nove moduli TS necessari, verificati individualmente contro quel manifest; nessun asset terreno o dipendenza va caricato. Non si dichiara che tutti gli altri132 file siano stati ricontrollati qui.

`prepare_source.py` fa soltanto lettura/copia/derivazione di testo, già completata. **Non importa TypeScript e non genera un volume.** I due file in `instrumented/` sono derivati dalla base, con inverse guards esatti e patch salvata:

- In `volume.ts`, il quarto argomento facoltativo è un callback sincrono `auditFineDensity(density,envelope)`, aggiunto subito prima della riga canonica440 (`// Parallel light-space rays...`). A quel punto il buffer `density` riusato è già stato sovrascritto dal loop fine delle righe432–438, mentre i bake ottici e occupancy devono ancora proseguire. Non si importa precipitation dal volume e non si crea un ciclo.
- La funzione canonica `precipitationFootprint`, riga65 fino a fine modulo, produce l'unico corpo del reducer diagnostico: cambiano solo la firma, i riferimenti alla dimensione e l'accessor scalare. L'inverso della derivazione ricostruisce il corpo originale byte per byte. Il callback esegue prima il reducer canonico su R8, poi lo stesso corpo derivato su R8/255: senza uguaglianza di tutti8192 byte interrompe la prova. Solo dopo usa quel medesimo corpo con accessor Float32.

I percorsi d'import sono riscritti esplicitamente verso i moduli canonici locali. Nessuna formula di riduzione viene riscritta, copiata a mano o rifittata. Il callback legge gli input e confronta SHA256 integrali prima/dopo le tre riduzioni; non li serializza né li conserva dopo il callback. Il generatore continua fino al return originale; sono registrati anche i cinque eventi progress successivi al gancio. Il confronto a un generatore canonico eseguito una seconda volta NON fa parte di questa prova.

## Unità e limite fisico

Il riferimento è R8/255, dopo la prima generazione della densità macro. L'alternativa è il vero Float32 `sampleCloudDensity * materialExtinction(ice) / 18` usato dall'illuminazione. Il reducer considera soloY≤2,5km; il runner richiede `iceStart>2.5`, quindi lì `ice=0` e il rapporto di estinzione è1. **Nessun fattore estetico o scala nuova viene applicato.** È la densità fine statica del bake, senza flow/dispersione runtime: non rappresenta una simulazione delle gocce e non prova che ogni colonna del velo attuale nasca da un punto vuoto.

Warp/interpolazione possono spostare supporto e il threshold originale.05 è discontinuo: non si assume che ogni texel fine sia minore del macro. In particolare la nuova mappa potrebbe sia perdere sia acquistare texelR>0. L'area filter e il Gaussian5×5 possono comunque ridurre la differenza a un'attenuazione quasi uniforme; questo non sarebbe sufficiente da solo a giustificare un trial visivo. Una pioggia meno opaca può anche allungare il cammino prima del cutoffT e costare di più.

## Output spaziale prefissato

- `macro-rg.bin` e `fine-rg.bin`: tutte le RG8 post filtro,8192B ciascuna, senza normalizzazione.
- `spatial.csv`: tutti4096 texel, coordinate X/Z, codiciR/G, delta, base decodificata e transizione del supporto. Nessuna selezione dei casi dopo il risultato.
- `comparison.ppm`: quattro pannelli64×64 sul medesimo range0–255: Rmacro, Rfine, |deltaR|, deltaR positivo rosso/negativo blu. Non è un'immagine del renderer né uno stretch ottimizzato. X aumenta verso destra, Z aumenta verso il basso; bounds nube X[−5,+5], Z[−3.5,+3.5] km.
- `hook.json` e `result.json`: uguaglianza macro, input SHA invariati, tempi del gancio/riduzioni, transizioniR>0, centroidi/support bounds, differenze G per supporti espliciti, correlazione, rapporti e128 profili X/Z. La TV delle distribuzioniR normalizzate è SOLO una statistica di forma: non modifica i byte prodotti. Se il bake successivo fallisce, `hook.json` resta una prova parziale e `failure.json`/`run.json` mantengono il fallimento terminale.

Non c'è un gate artistico inventato da queste statistiche. Root deve prima stabilire se esiste una differenza strutturale interessante; questa prova non autorizza un secondo seed/risoluzione, modello, GPU o integrazione.

## Budget ed esecuzione riservata al root

`PROTOCOL.json` fissa **20s CPU kernel,40s wall e384MiB peakRSS terminale** per un solo child Bun. RSS è un gate `getrusage` a posteriori, non una garanzia live; nessun RLIMIT_AS e nessuna scansione `ps`. Se un input, l'uguaglianza macro, le unità, la generazione o il budget fallisce: preservare e fermarsi. Il launcher rifiuta una directory `run/` preesistente e non riavvia automaticamente.

Il reducer ha tre Float32[4096]+RG8:57.344B per chiamata. Il diagnostico conserva due outputRG8 più il riferimento temporaneo e piccoli CSV/statistiche/PPM; hash di input e output usano viste senza copie del volume. I buffer Float3264³ già vivi nel generatore NON sono nuovi buffer del reducer. Ci sono comunque costi CPU/GC/serializzazione diagnostici: i tempi non descrivono un futuro percorso prodotto. Nessun nuovo pass, binding o byteGPU.

Comando da eseguire **solo dal root, dopo review del freeze e conferma del budget**:

```sh
python3 /Users/enuzzo/Documents/Codex/Cloudia-QA-2026-10-17-cycle42/rain-source-audit/launch.py --bun /percorso/assoluto/al/Bun/esistente
```

Nessun npm, install, build o test è necessario. `FREEZE.json` contiene protocollo, runner, launcher, trasformazione, patch e nove input locali. Il launcher e il runner li ricontrollano prima dell'unica generazione. Il root deve scegliere un Bun esistente: il launcher ne registra SHA/dimensione prima del run e controlla che non cambi. Tutto rimane esterno al repository.
