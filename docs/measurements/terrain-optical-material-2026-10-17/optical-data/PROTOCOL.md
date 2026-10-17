# Singolo pack ottico RGBA16F — protocollo prima dell'esecuzione

17 ottobre2026. Ownership esclusiva di questa directory esterna. Nessuna
modifica al prodotto/candidate-source, modello terreno, mesh, GPU o download.

Input già acquisiti, letti una volta a strisce32righe e autenticati SHA durante
lo stesso stream usato dal calcolo, prima di pubblicare l'asset finale:

- cycle21/sentinel2-reference-r2/rgb-linear.f32,50331648B,
  SHA44205c43c1f243766716060b16e7f74948fba3a9366b6f38473d045c066a074e;
- cycle21/sentinel2-reference-r2/valid-area.f32,16777216B,
  SHAe89361dccb2b50a515f08ee7fee8500bdd3a535bdce4f5ea6159a736120f12c7.

2048² celle,62,5m, bordi X/Z−64/+64km; centri−64+(i+.5)*.0625km.
X Ovest/Z Nord, row-major prima riga Sud/prima colonna Est, RGB interleaved.
Origine44N10E, equirettangolare locale lat44+z/111.1950802335,
lon10−x/(111.1950802335*cos44°). Il pack non riproietta né riscampiona.

Output unico `optical-rgba16f.bin`, header assente,33554432B, RGBA interleaved,
IEEE754 binary16 little endian. Q=(R*v,G*v,B*v,v). InputFloat32→Float64 per
moltiplicazione (prodotto esatto dei due Float32), poi singolo arrotondamento
round-to-nearest/ties-to-even a binary16 tramite NumPy. Nessun gain/gamma,
palette fitting, clamp, maschera euristica, recupero ombre o de-lighting.
Validità esattamente0 deve avere RGBinput0 e Q quattro+0; invalidi non sono
pixel neri opachi. NIR non è un campo di output disponibile.

Gate: entrambe le sorgenti finite e in[0,1], metà finite e in[0,1], RGBpremul≤A;
zero-validity→quattro+0; nessuna saturazione. Errori assoluti misurati rispetto
al Q Float64, percanale, massimo≤2^-12 sul range[0,1]. Registrare range osservati,
conteggi validità0/parziale/1, underflow positivo→0 e massimi/mean/RMS degli
errori. I5witness preesistenti sono riletti per offset, non scelti dopo il pack;
verificare rounding dei Float32 contro i valoriFloat64 salvati e metà scritte.

Fixture CPU tiny prima del dato grande:2×2 validi/misti/invalidi, mip lineare
di Q e formula U+(1-v)*P+K*Q.rgb. Verificare commutazione della media con la
composizione per U/P/K costanti; caso tutto invalido→U+P e caso un valido su4
senza doppia attenuazione. Registrare anche rounding half di base/mip. È un
oracolo algebrico CPU, non una prova dell'esatto mip generator GPU/TSL.

Budget unico: CPU combinata wrapper+child≤10s, wall≤20s dalla partenza wrapper,
somma conservativa picchi RSS wrapper+child≤192MiB. Child RLIMIT_CPU10s,
timeout wrapper20s; RSS gate fra strisce e terminale, NON un limite preventivo
di allocazione o un'interruzione dentro NumPy. Nessun retry automatico.
Output `.partial` esclusivo; rename a finale solo dopo SHA/input/range/fixture.
Ogni eventuale FAIL resta registrato e non viene cancellato.

Metadati separati con formato, trasformazioni, input/source/licenza/SHA;
SHA dell'asset, report di quantizzazione, fixture e5witness conservati.
Nessun costo GPU, FPS, albedo fisica o accettazione artistica dedotto dal pack.
