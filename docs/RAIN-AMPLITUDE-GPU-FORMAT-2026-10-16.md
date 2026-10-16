# Prerequisito GPU per l'ampiezza della pioggia: R16F 3D

La prova piccola R3 supera sia il percorso core `pack2x16float → buffer u32 → copyBufferToTexture` sia lo storage diretto R16F con Tier1 esplicitamente abilitata. È un risultato sul formato, packing, copia e campionamento del Mac osservato. Non integra il campo A nel prodotto, non qualifica il campo completo, la resa visiva o gli FPS e non autorizza ancora un volume grande.

## Prova reale e revisioni conservate

Il root ha eseguito una volta il pulsante di ogni revisione tramite CUA, il 16 ottobre 2026. Browser dichiarato Chrome 155; adapter `apple`, architettura `metal-3`, fallback falso. La pagina usa WebGPU diretto e due device separati. Le griglie sono **16×2×3** e **17×2×3**, con una palette f32 di 16 valori: zero, normali, due punti medi e tre subnormali half esatti. Nessuna elaborazione GPU parte al caricamento.

| Revisione | Core pack/copy | Storage Tier1 | Significato |
|---|---|---|---|
| R1 | PASS | Errore di compilazione | `target` era una keyword WGSL riservata nel nostro shader diagnostico. API, estensione WGSL e device Tier1 risultavano presenti. |
| R2 | PASS | FAIL del witness RNE fisso | Corretto solo l'identificatore. L'input 1,00146484375 produce 0x3c01 invece di 0x3c02 in 6 e 7 texel; compilazione, copie, load, sampler e cleanup completano senza errori. |
| R3 | PASS | PASS | Prima dello store il solo shader diretto usa `unpack2x16float(pack2x16float(vec2<f32>(values[index],0.0))).x`. Palette, gate, tolleranze e app sono identici a R2. |

R3 verifica per ciascun percorso **198 texel e 24 campioni lineari**, ossia **222 record completi**. I 161 controlli normale/zero e i 37 subnormali non rilevano encoding inattesi; i tre subnormali half sono preservati in questa prova. Nessun nonfinito, sentinella residua, errore di copia, padding, load o sampler. Compilazione, error scope e console sono vuoti. Input, readback texture, half contigui e output load/sampler hanno SHA identici tra core e Tier1 per entrambe le griglie.

Le risorse serializzate per **ogni griglia completata** sono 9 buffer + 1 texture nel core, 7 buffer + 1 texture nel diretto: tutti risultano distrutti. I due device riportano `destroyCalled: true`. R1 Tier1 fallisce prima di restituire il report del caso: il conteggio delle risorse di quei due tentativi non è serializzato, quindi non viene dichiarato verificato.

## Perché R2 non dimostra un bug del device

Il punto medio R2 è fra 1,0009765625 (0x3c01) e 1,001953125 (0x3c02). Lo store [16float](https://gpuweb.github.io/gpuweb/wgsl/#texel-formats) usa [quantizeToF16](https://gpuweb.github.io/gpuweb/wgsl/#quantizeToF16-builtin). La [conversione WGSL §15.7.6](https://gpuweb.github.io/gpuweb/wgsl/#floating-point-conversion) consente uno dei due vicini per un input non rappresentabile; la definizione di [correctly rounded](https://gpuweb.github.io/gpuweb/wgsl/#floating-point-accuracy) non impone RNE. Anche [pack2x16float](https://gpuweb.github.io/gpuweb/wgsl/#pack2x16float-builtin) rinvia a quel contratto. Il FAIL R2 riguarda quindi il nostro witness più stretto ed è compatibile con la specifica, senza attribuzione causale a Metal. R3 conserva quel witness, ma il PASS empirico non garantisce la stessa scelta di arrotondamento su ogni compilatore o contesto. I subnormali possono essere azzerati secondo il contratto.

## Policy prodotto, padding e limiti

`GPUSceneEngine.start()` richiede un device esterno con la sola feature opzionale `timestamp-query`, quando il timing è attivo e l'adapter la supporta. La presenza di Tier1 nell'adapter non la abilita nel prodotto. Il percorso core diagnostico usa quella variante della policy; il diretto richiede un **secondo device opt-in** con `texture-formats-tier1`, distinto dal prodotto. Sono registrate sia la feature API sia l'estensione WGSL `texture_formats_tier1`.

Ogni immagine usa sei righe con `bytesPerRow=256`, `rowsPerImage=2`, readback di 1.536 byte. I tre elementi di padding hanno regole separate:

- Nel buffer sorgente core, i byte dopo `ceil(width/2)` u32 per riga restano 0x5a: 1.344 byte nella griglia pari, 1.320 nella dispari.
- Nella griglia dispari il secondo half dell'ultimo u32 è −2 (0xc000), verificato sulle sei righe ma escluso dall'estensione della texture.
- Nel readback i byte dopo `width×2` per riga restano 0xa5: 1.344/1.332 byte. Non vengono confrontati con il padding sorgente o con l'half dispari inutilizzato.

Il sampler usa filtro lineare 3D, clamp e LOD 0 su 12 coordinate fisse. La tolleranza diagnostica è `max(1,maxAbsNeighbor)×2⁻¹⁰ + 2⁻²⁰`, calcolata sui texel effettivamente conservati; l'errore massimo registrato è circa 0,000426276. Questa tolleranza non sostituisce un futuro gate ottico sul campo A. Nessun claim generale di parità RNE/subnormali, portabilità multi-device, worker, memoria di un volume completo, ciclo di vita integrato o 60 FPS stabili.

## Prove portabili

L'[archivio curato](measurements/rain-amplitude-gpu-format-2026-10-16/README.md) conserva i tre sorgenti originali deduplicati senza perdita, manifest e protocolli pre-run, tre JSON browser compressi, tre console e tre JPEG originali della pagina diagnostica. I manifest storici restano immutati anche dove dichiarano lo stato precedente al run.

Il verificatore offline ricostruisce **46 digest** dei piccoli buffer nei **10 casi completati**, inclusi i 13 vicini diversi R2, da palette/layout noti e bit sampler registrati. Non riesegue GPU e non pretende che siano stati esportati i buffer GPU completi. La pagina può essere ricostruita in una directory esterna nuova per una futura ripetizione esplicitamente autorizzata.

```sh
python3 docs/measurements/rain-amplitude-gpu-format-2026-10-16/verify.py
```

Il prodotto resta invariato da questa prova. Un'eventuale integrazione A-only richiederà una decisione separata e prove del campo completo, correttezza, qualità e costo effettivo.
