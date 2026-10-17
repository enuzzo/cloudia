# S2 osservato: pack unico RGBA16F premoltiplicato

17 ottobre2026. **Pack dati PASS**, nessun modello, mesh, GPU, download o modifica
del prodotto/candidate-source. Un'unica esecuzione, fonti cycle21 inalterate.

Asset finale `optical-rgba16f.bin`: **33554432B**,
SHA256`217325bcdb50dd58076b2f5068ee0b5ba524f6f076a70d4345f279f233f5dd62`.
Header assente,2048²×RGBA×binary16 little-endian, row stride16384B.
Q=(R*valid,G*valid,B*valid,valid). `optical-rgba16f.metadata.json` descrive
completamente formato/orientamento, input, trasformazioni ed errori osservati.

Bordi X/Z±64km, celle62,5m, centri−64+(i+.5)*.0625km; X Ovest/Z Nord,
prima riga Sud/prima colonna Est, flipY=false. Stessa equirettangolare locale
del dato originale, origine44N10E. Non usare sRGB/gain3 della figura scientifica.
Per un futuro upload: NoColorSpace, HalfFloatType/RGBA, premultiplyAlpha=false
perché RGB è già premoltiplicato per la copertura valida, non opacità geometrica.

## Evidenza del singolo run

`run/execution.json`: exit0, CPU combinata0,518575s, wall0,598721s,
picco child78856192B e wrapper27656192B; somma conservativa**106512384B**.
Limiti prima del run:10CPU/20wall/192MiB. RSS Python/macOS è espresso in byte;
è un gate fra strisce/terminale, non un hard allocation cap.

| Proprietà | Osservato |
|---|---|
|Range Q decodificato minimo RGBA|[0,0,0,0]|
|Range Q decodificato massimo RGBA|[0.72021484375,0.66259765625,0.59326171875,1]|
|Validità0 / parziale /1|1388039 /3562 /2802703 pixel|
|Zeri validità|quattro word+0, tutti; alpha0 identici al numero v0|
|Nonfiniti / saturazioni / underflow positivo|0 /0 /0|
|Vincolo premoltiplicato|0≤RGB≤A≤1 su tutto il campo|
|Max errore assoluto RGBA|[0.0002393722534,0.0002382993698,0.0002431869507,0.0002412796021]|
|RMS errore RGBA|[1.06731413e−5,1.12926902e−5,8.20427676e−6,2.85094724e−6]|

Gli errori riguardano il RGB **premoltiplicato** Q, non il colore condizionale
ricostruito dividendo per alpha. Riferimento: inputFloat32 promossi aFloat64,
prodotto binario esatto, singolo round-to-nearest/ties-to-even a half. Massimi
entro2^-12, senza clamp/gain/gamma/mask o modifica della luminanza autoriale.

`witnesses.json`: stessi cinque punti preesistenti, nessuna nuova selezione;
byte di output confrontati con `struct.pack('<4e',...)` della stdlib, indipendente
dal cast NumPy. `mip-fixtures.json`: casi2×2 validi/misti/invalidi, tutti invalidi
e un valido su4; algebra U+(1−v)P+KQ.rgb commuta con media lineare entro5,56e−17.
Tie/subnormal binary16 coincidono fra NumPy e stdlibstruct. Il mip di Q non
duplica l'attenuazione della copertura e tutto invalido restituisce U+P.
Sono fixture CPU, non prova del generatore mip GPU o di un'assenza visiva di bordi.

**Non è stato generato un mip reale dell'intera asset.** Pianificazione nominale
12livelli:33554432B base+11184808B extra=44739240B GPU. Driver/residency/tempo
GPU, texture loader e resa del materiale restano da verificare separatamente.
Il composito annuale L2A include osservazioni e ombre residue, non è albedo
fisica indipendente da vista/illuminazione; NIR non è presente in questo output.

## Fonte, licenza e riproduzione

Gli input non sono duplicati qui. Attesi, autenticati durante lo stream:

- `rgb-linear.f32`,50331648B,
  SHA`44205c43c1f243766716060b16e7f74948fba3a9366b6f38473d045c066a074e`;
- `valid-area.f32`,16777216B,
  SHA`e89361dccb2b50a515f08ee7fee8500bdd3a535bdce4f5ea6159a736120f12c7`.

Source root usata: `Cloudia-QA-2026-10-16-cycle21/sentinel2-reference-r2/`.
RGB e validità derivano dagli originali overview4 già acquisiti; nessun TIFF
letto o raster riscampionato. `provenance/` conserva copie byte identiche di
notice, licenza CC BY4.0 completa, fonti, protocollo e witness/report originali.
`NOTICE-OPTICAL-DERIVATIVE.txt` documenta questo ulteriore pack e i suoi limiti.
Fonti: [ESA WorldCover](https://esa-worldcover.org/en/data-access),
[registro del produttore](https://registry.opendata.aws/esa-worldcover-vito-composites/).

Per riprodurre **in una nuova directory**, con gli stessi script/provenance/freeze
e Python già dotato di NumPy (qui3.12.14,NumPy2.3.5,arm64):

```sh
python3 run.py --source-root /percorso/sentinel2-reference-r2
```

Nessuna installazione/venv necessaria qui. Non ripetere nel pacchetto congelato:
overwrite, directory run o partial esistenti sono rifiutati e non cancellati.
`PRE-RUN-FREEZE.json` precede l'unico run; `MANIFEST.json` è l'inventario finale
dei payload, escluso se stesso per non creare autoriferimenti.
