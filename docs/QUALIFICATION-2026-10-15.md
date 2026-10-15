# Cloudia — anatomia, trasporto e controlli

15 ottobre 2026. Continuazione locale da `83eab63` sul ramo
`codex/cumulonimbus-webgpu`; baseline del prodotto `971ce25`.

## Contratto e riproduzione

Restano configurati 256³ macro, 128³ dettaglio, 384 passi nominali, scala interna
1 e assenza di ricostruzione temporale. La modalità diagnostica Finestra
(`window`) usa un pixel per pixel CSS; Schermo (`screen`) considera il DPR.
Le dimensioni effettive sono nei report. Pioggia: passo massimo esplicito di
6 m nella regione che può contenerla, anche nel jitter iniziale. È lavoro
aggiuntivo rispetto al passo nominale, non una riduzione di qualità.

Baseline iniziale rieseguita: 113 test in 24 file. Mac ARM64, Bun 1.3.11;
dipendenze e lockfile conservati. `node_modules` ignorata, senza file tracciati,
attributo locale Dropbox riletto a 1 prima e dopo i comandi. La directory
preesistente `node_modules 2/` resta intatta e fuori dai commit.

I comandi riproducibili sono `bun run test`, `bun run typecheck`,
`bun run build` e, dopo la build applicazione, `bun run build:hero`.
Gli audit CPU sono `scripts/qa-approach.ts`, `scripts/qa-morphology.ts` e
`scripts/qa-light-transport.ts`; accettano il percorso JSON di destinazione.
`qa:browser` continua a riferire uno script assente e non è stato usato.

## Implementato

- Torrioni con quote, direzioni e larghezze proprie; spalle legate al singolo
  updraft; billow proporzionati alla massa principale. La prima prova visiva
  mostrava ancora una U eccessiva: un nucleo intermedio derivato dai summit
  effettivi ora collega il corpo basso/medio della famiglia inclinata. Tre
  raccordi sovrapposti espandono il torrione dominante prima dell'incudine.
- Nube e pioggia presenti nello stesso segmento sommano le estinzioni e
  pesano le sorgenti prima di una sola integrazione esponenziale. Il segmento
  termina all'uscita del volume, della regione pioggia o sul terreno.
- La sorgente pioggia integra tutte le colonne macro coperte dal texel.
  Forza e quota base sono filtrate insieme; le celle trasparenti adiacenti
  conservano una quota compatibile con il filtro bilineare. Mappa sempre RG8,
  64², 8.192 byte. Una colonna senza base qualificante non genera pioggia.
- Debole precipitazione evapora sotto la nube; sorgenti forti possono arrivare
  al mare. La quota marina resta in coordinate mondo, con deriva della nube
  separata. Distanze e coefficienti sono artistici, non microfisica misurata.
- Backtrace della sorgente con una correzione della quota, shear e caduta.
  Rimane un'approssimazione da una mappa statica, non trasporto di gocce.
- L'estinzione artistica della pioggia è calibrata a 0,85 km⁻¹: il valore 2,6
  della prima iterazione rendeva la cortina simile a una parete grigia. Il
  coefficiente è esplicito nei metadati delle nuove misure.
- Bounds della sorgente con alone bilineare, crescita e vento firmato.
  Il massimo spostamento è limitato da `7,25 × 0,32 + 0,1538 < 2,5` volte il
  vento. La regione arriva a base + 0,3 km per conservare l'attacco superiore.
  Nessun salto dello spazio vuoto della nube è usato per saltare pioggia.
- Il cielo coperto modifica luce e foschia, senza dissolvere il paesaggio.
  Restano soltanto foreste, monti, costa e mare; generatore del terreno invariato.
- UI: safe area condivisa da dock/zoom/help, focus esplicito sulle tab e
  ritorno senza scroll, Escape rispettoso dei controlli annidati, testi lunghi
  contenuti. `label for` esplicito sui range evita che l'output percentuale ne
  sottragga il nome accessibile. Desktop ampio: pannello 432 px, testo 14–15 px,
  dock più leggibile; mobile e vista bassa conservano la propria composizione.

La relazione usata per i mezzi sovrapposti segue l'integrazione di un segmento
omogeneo della [trasmissione volumetrica](https://pbr-book.org/4ed/Volume_Scattering/Transmittance).
La distinzione fra pioggia al suolo e
[virga](https://cloudatlas.wmo.int/clouds-supplementary-features-virga.html)
guida il profilo artistico, senza validarne quantitativamente le distanze.

## Verificato numericamente

131 test in 25 file, TypeScript e build applicazione → hero superati.
Rimane l'avviso Vite sui bundle oltre 500 kB. I test includono ciclo di vita,
main/worker, visibilità, pausa, cleanup e perdita del device con mock: non sono
esecuzioni GPU reali.

Audit anatomia a 128³ macro / 128³ dettaglio, diagnostico e distinto dalla
qualità configurata del renderer:

| Seme | Famiglia | Massa densa connessa | Massa integrata rispetto alla baseline |
| --- | --- | ---: | ---: |
| 72 | congestus | 99,9954% | −18,72% |
| 73 | multicell | 99,8481% | −4,43% |
| 74 | sheared | 99,9036% | +0,019% |
| 1571198069 | sheared | 99,9932% | −1,31% |

La connessione è misurata sulla massa macro sopra densità 0,16, con sei vicini.
Non misura le fibre sottili o la densità finale deformata. L'inclinazione
alto−basso della sheared resta sopra il limite regressione 0,65 km; il confronto
usa bande di quota per non confondere inclinazione e bilancio delle masse.

Connessione e compattezza sono criteri diversi. Le viste reali del congestus
72 mostrano ancora grandi aperture sotto il cap e una fascia laterale che
separa base e massa superiore; il corpo è collegato, ma il criterio di massa
compatta non è superato. Non c'è evidenza sufficiente per chiamare questa
fascia una cucitura shader. Il cap resta sottile/laminare e il retro mostra
troppi piccoli rigonfiamenti di scala simile.

Anche il multicell 73 è stato visto a 0°, −88° e 180°, tempo 60 s e sole.
Conserva una grande apertura ad arco fra le due torri e due tetti laminari:
compattezza e cap restano aperti anche per questa famiglia. Le immagini delle
tre famiglie sono nel [manifest screenshot](measurements/screenshots-2026-10-15.json).

Audit frontiera completo 256³ / 128³, seme 1571198069, tempo 60 s, 18 pose:
errore massimo 0,01071 m contro ricerca CPU densa a 2,5 m; mediana 0,09425 ms,
p95 0,23850 ms, massimo 0,31521 ms e massimo 207 sonde. Questi valori descrivono
il campione CPU; non certificano la distanza da ogni filamento o il costo GPU.

Il riferimento del trasporto omogeneo concorda con l'integrale analitico entro
3,42 × 10⁻¹⁴ su 8/16/64/384/8192 segmenti. L'ordine sequenziale precedente
produce nel caso di prova un errore massimo 0,001361 a 384 segmenti. Il vero
baker conserva ombre anche in celle di densità nulla, con sole alto e basso:
non è stato introdotto un nuovo cache solo sulla base di un sospetto.
Questo audit usa Float64/Float32 CPU, non precisione o compilazione WGSL.

Evidenze: [frontiera](measurements/approach-cpu-2026-10-15.json),
[anatomia baseline](measurements/morphology-baseline-cpu-2026-10-15.json),
[anatomia finale](measurements/morphology-cpu-2026-10-15.json),
[trasporto](measurements/light-transport-cpu-2026-10-15.json).

## Verifica nel browser e limiti

Il precedente rifiuto non è stato aggirato. Nel nuovo contesto la stessa
superficie IAB ha consentito la stessa preview `127.0.0.1:4177`; nessun browser
alternativo o accesso diretto al protocollo è stato impiegato. Vite preview è
stato avviato dal checkout corrente dopo le build. Gli hash degli asset
identificano la provenienza, oltre al marker `observatory-v22`.

Il renderer finale ha compilato e disegnato su Chromium / Apple Metal-3.
Le immagini effettive e il concept sono stati letti con `view_image`; lo sfondo
generato del concept non è stato usato come prova del renderer.

La cavità centrale è meno dominante nella vista frontale; restano un'incudine
con andamento a gancio e rigonfiamenti talvolta troppo compatti. La resa non è
accettata come fotografica. La prima misura con campionamento fine nell'intero
box è conservata, anche se insufficiente: 27,9 rAF/s su 30 s a 1672×941.
La prova successiva, prima della calibrazione materiale, con bounds della
pioggia conserva 6 m e misura 54,3 rAF/s,
p95 33,30 ms, 69 intervalli oltre 33,34 ms, massimo 34,40 ms. Forma e stato
atmosferico differiscono: non è un A/B che isola il beneficio dei soli bounds.

Con il coefficiente finale 0,85, main, stessa risoluzione, pioggia 80%, nube
animata: 54,8319 rAF/s in 30,019 s, p95 33,30 ms, 62 intervalli oltre 33,34 ms,
massimo 34,30 ms; rendering GPU medio 34,218 ms. Il fondo della cortina è meno
opaco nella nuova vista mobile; una cortina larga resta visibile e non è
accettata come precipitazione fotografica. Non è una prova di 60 fps stabili.

| Materiale finale, 1672×941, pioggia 80%, animata | rAF/s | p95 rAF | >33,34 ms | Massimo rAF | Media GPU rendering |
| --- | ---: | ---: | ---: | ---: | ---: |
| Main, 30,019 s | 54,8319 | 33,30 ms | 62 | 34,30 ms | 34,218 ms |
| Worker, 30,002 s | 54,5965 | 33,30 ms | 68 | 50,40 ms | 50,726 ms |

Nel worker il p95 GPU è 77,726 ms e il massimo 136,249 ms; nel main 39,649 ms
e 51,839 ms. Le misure sono sequenziali, non coppie di frame identiche; non
dimostrano un vantaggio del worker. I picchi e la prova iniziale lenta restano
nel dossier. Nessun errore/warning console pertinente osservato nelle due
prove finali. [JSON worker](measurements/worker-rain-calibrated-30s-2026-10-15.json).

Sono conservati i JSON completi di
[primo tentativo](measurements/main-rain-before-bounds-30s-2026-10-15.json),
[bounds prima della calibrazione](measurements/main-rain-bounded-30s-2026-10-15.json),
[main calibrato](measurements/main-rain-calibrated-30s-2026-10-15.json),
[avvicinamento](measurements/main-near95-sun-30s-2026-10-15.json) e i manifest
[prima](measurements/build-manifest-2026-10-15.json) /
[finale](measurements/build-manifest-final-2026-10-15.json).

La verifica al 95–100% mostra che il campo vicino può riempire l'inquadratura
con una foschia quasi uniforme: il test CPU della frontiera non basta a
certificare leggibilità fotografica o dettaglio vicino.

Desktop 1672×941, mobile 390×844 e vista bassa 1280×432: nessun overflow
orizzontale; larghezza documento uguale al viewport. Pannelli scorrevoli,
Nuova forma raggiunta con tastiera anche quando inizialmente sotto il bordo,
focus visibile, chiusura Escape e clic sul dock esterno verificati. Le tab
rispondono a frecce/Home/End e conservano la scelta alla riapertura. I quattro
range hanno i nomi accessibili nel DOM reale. Il dock desktop è circa 740 px;
il pannello 432 px. Contenuto e scorrimento aggiuntivi rispetto al concept
sono intenzionali per preservare i controlli effettivi. Confrontati gerarchia,
testi, tipografia, palette, icone, geometria e stati. L'unica modifica alla
copia esistente descrive il paesaggio attivo anche con pioggia.

L'ultima rifinitura dispone Raffica/Disperdi/Ricondensa in una riga sul solo
desktop ampio: Nuova forma è interamente visibile alla prima apertura
(rettangolo y 686,8–730,8 contro fondo del corpo pannello y 765). Mobile e vista
bassa conservano le due colonne. La build successiva cambia solo CSS/import;
gli hash del render worker e del volume worker coincidono con le misure
calibrate. Il manifest del materiale misurato è conservato separatamente in
`measurements/build-manifest-material-2026-10-15.json`.

Worker: disegno WebGPU e cambio Sole/Tramonto osservati; vista sheared a −88°
e 180° salvate. Non sono emerse giunzioni orizzontali nuove nelle pose viste.
La prova main vicina al 95%, sole, animata, 30 s registra 59,9964 rAF/s,
p95 17,40 ms, massimo 17,80 ms e zero intervalli oltre 33,34 ms; media GPU
30,227 ms. Cadenza rAF e timestamp GPU sono livelli differenti e campioni
non accoppiati: nessuna equivalenza con immagini presentate è dedotta.

Le limitazioni di dispositivi
fisici, audio, sole libero continuo e presentazione del compositore restano
separate. Safe area reali e preferenza reduced motion sono implementate ma
non simulate in questo browser; non sono prove su un telefono fisico.
Nessuna camera o riproduzione audio è stata attivata.

La coda generale rimane in `docs/plans/2026-10-13-product-roadmap.md`.
Nessun merge su main o deploy fa parte di questo checkpoint.

Preview lasciata in modalità ordinaria main, Sole, nube matura in pausa,
Panorama e nessun pannello aperto. Override viewport rimosso: CSS 926×900,
buffer nativo 1852×1800, solo Massima/384 e Schermo disponibili. Audio
disattivato e nessun errore console osservato. I benchmark a 1672×941 non
sono misure di questo buffer nativo più grande.

## Gate ancora aperti e continuazione

Questo è un checkpoint verificabile, non il raggiungimento dell'obiettivo
fotografico. Il goal rimane attivo.

| Criterio | Stato del checkpoint |
| --- | --- |
| Baseline, qualità configurata, audit riproducibili | Verificati |
| Nucleo sheared meno scheletrico | Miglioramento visibile nella vista frontale, confermato da lato/retro |
| Corpo compatto in tutte le famiglie | Ancora insufficiente nel congestus e multicell; sola connessione numerica non basta |
| Incudine tridimensionale e non laminare | Ancora insufficiente |
| Trasporto congiunto, clipping e luce macro | Implementati, test numerici e WGSL reale verificati |
| Dettaglio ravvicinato e accettazione in movimento | Ancora insufficienti; 80–100% può risultare molto morbido o uniforme |
| Pioggia nella scena e paesaggio | Implementati e visti nel browser; calibrazione migliora la trasmissione, qualità artistica aperta |
| UI desktop/mobile/vista bassa, focus, Esc/clic esterno | Verificati nel browser; safe area fisiche/reduced motion/touch fisico non verificati |
| 60 fps sostenuti e presentazione | Non raggiunti/certificati; conservate le prove da circa 54–55 rAF/s |

Proseguire prima sull'anatomia ancora vuota di congestus/multicell e sul cap, poi sul
materiale vicino con un confronto fisso e lente orbite. Non attribuire il
difetto a celle di luce vuote: il baker è già coperto da una prova mirata.
Qualunque integrazione luminosa locale aggiuntiva richiede un costo misurato;
nessun downscale o filtro temporale implicito è una scorciatoia autorizzata.

Le immagini in `docs/images/qualification-2026-10-15/` sono screenshot reali,
non concept. `desktop-inspector-after` e le viste solari precedono soltanto la
calibrazione del coefficiente pioggia, che è inattivo nelle viste senza pioggia;
le immagini con `calibrated` usano il materiale finale. I nomi `near80` e
`near-sun-orbit` conservano anche gli esiti visivi insufficienti.

## Secondo ciclo: masse locali e frontiera filtrata

Continuazione dal commit `2a265bb`. Questa sezione aggiorna il checkpoint
precedente; le sue misure e immagini rimangono riferimenti storici distinti.
Il goal resta attivo e la qualità fotografica ravvicinata non è raggiunta.

### Anatomia e prove reali

Congestus e multicell ricevono nuclei verticali sepolti derivati da fondazione
e summit. Il piccolo cap del congestus parte dal summit dominante; ogni cella
matura della multicell alimenta un proprio cap a quota e profondità locali.
Billow del cap più profondi e filamenti ai margini sostituiscono il precedente
tetto comune. Nella multicell, un impulso giovane fra i siti maturi alza la
sella dal basso; le torri principali hanno maturità differenti.

Il riferimento strutturale è coerente con le descrizioni del
[congestus](https://cloudatlas.wmo.int/cl-2.html) e delle
[specie di cumulonembo](https://cloudatlas.wmo.int/species-cumulonimbus-cb.html)
nell'Atlante WMO. Le modifiche sono geometria procedurale propria, non una
simulazione meteorologica né una riproduzione di quelle fotografie.

Le nuove viste IAB frontale/laterale/posteriore mostrano il congestus più pieno
e privo del tetto comune. La prima revisione multicell lasciava ancora una U
troppo grande; la revisione successiva la riduce con la nuova cella giovane.
Restano riconoscibili una sommità piuttosto piatta e una separazione fra i
montanti: miglioramento osservato, non accettazione di ogni incudine.

L'audit macro a 128³/dettaglio 128³ conserva separatamente massa e connessione:

| Seme | Densità integrata precedente → finale | Massa densa connessa finale |
| --- | --- | --- |
| 72, congestus | 21,2538 → 22,2276 | 99,9943% |
| 73, multicell | 26,2130 → 23,9000 | 99,9714% |
| 74, sheared | 18,7487 → 18,7487 | 99,9036% |
| 1571198069, sheared | 14,1570 → 14,1570 | 99,9932% |

La densità integrata è un indicatore nel volume della scena, non una massa
d'acqua fisicamente misurata.

La sheared conserva anche l'uguaglianza byte per byte dei dati macro, dettaglio
e sunset nel confronto a 64³ dei due semi. I test aggiunti misurano il
riempimento delle sezioni basse/medie, mentre la separazione elevata multicell
preesistente resta richiesta. Nessuna percentuale di connessione certifica da
sola una silhouette compatta. Dati:
[morfologia finale](measurements/morphology-final-cycle2-cpu-2026-10-15.json).

### Errore concreto della camera e correzione

Il vecchio audit della frontiera confrontava due ricerche della stessa densità
CPU con spostamento analitico. Quel centimetro di precisione non verificava la
rappresentazione disegnata dal renderer: quest'ultimo campiona invece un campo
16³ half-float con filtro trilineare.

Un confronto delle rappresentazioni su 18 pose ha trovato spostamenti della
frontiera fino a circa 137 m. In 8 pose la camera al 100% risultava sopra la
soglia di densità nel riferimento filtrato, con penetrazione massima di circa
133 m. All'80% nessuna delle pose campionate era dentro: il difetto della camera
non spiega tutta la sfocatura. Evidenza precedente alla correzione:
[divario analitico/filtrato](measurements/near-flow-discrepancy-cpu-2026-10-15.json).

La ricerca usa ora lo stesso tipo di campo filtrato, incluso il canale di
erosione. Un buffer CPU riusabile di 32768 byte viene ricostruito quando cambia
tempo o dispersione e serve solo alla navigazione; macro 256³ e dettaglio 128³
rimangono invariati. Stato congelato, cambio seme e sonda senza flusso hanno
invalidazione esplicita. La cache CPU viene riutilizzata nella nube ferma.

Nel nuovo audit a 256³/128³, su 18 pose, errore massimo rispetto alla ricerca
densa CPU a 2,5 m: **0,00982 m**. Mediana della sola ricerca **0,0956 ms**;
campo più ricerca **2,3865 ms**, p95 **3,7304 ms**, massimo **4,2943 ms**.
La produzione rivaluta la stima non più di una volta ogni 150 ms durante
l'avvicinamento visibile; un frame lento può aumentarne l'età. Aritmetica CPU prima
della conversione half e compute GPU f32 non sono identità bit per bit.
Microerosione dipendente dalla camera e ulteriore erosione da dispersione
sono omesse sul lato prudente, poiché rimuovono densità. Non è una garanzia
fisica di 3 m da ogni filamento animato. Dati:
[frontiera filtrata](measurements/approach-filtered-cpu-2026-10-15.json).

### Diagnosi del materiale vicino

L'immagine reale al 100%, dopo la correzione, resta quasi uniforme. La prova
negativa è conservata. La cache luce è già costruita dalla densità con warp
ed erosione ordinaria: spostare nuovamente il lookup luce applicherebbe il
warp due volte e non è la correzione proposta.

Un'ulteriore sonda CPU usa cinque raggi dichiarati, tempo 60, vento e deriva
del runtime, camera corretta e quadrature a 3/6 m. Nei 15 raggi a 3 m nessun
contributo d'opacità arriva da raw ≥ 0,98: la saturazione dell'erosione non
spiega questo campione. La variabilità fra le sorgenti medie dei cinque raggi
scende da CV 54,82% all'80% a 17,46% al 95% e 5,36% al 100%. Al massimo, metà
dei contributi del raggio centrale arriva entro 70,5 m e il 90% entro 172,5 m.
I due passi cambiano la media luminosa meno dello 0,165% e quella di densità
meno dello 0,134% nel campione. Sono statistiche CPU pesate per opacità, prima
di aerial/tonemapping, non pixel finali o una diagnosi universale.

Questo restringe il prossimo esperimento alla scala del materiale e alla
leggibilità luminosa, prima di aumentare i passi. La banda ordinaria ha
strutture intorno a 104 m; quella metrica, circa 4 m, entra solo entro 300 m.
Una banda intermedia e un raffinamento locale della luce sono ipotesi da
confrontare isolatamente con camera/raggi fissi e costo misurato. Non sono
ancora implementate. Dati e script:
[sonda densità](measurements/near-density-cpu-2026-10-15.json),
`scripts/qa-near-density.ts`.

### Pioggia e controlli

La virga debole varia la caduta fra 0,98 e 1,82 km usando la lettura già
presente delle cortine ampie. Il campo segue la colonna emittente, non una
quota di caduta indipendente, per evitare nuovi lobi verticali nel profilo
di evaporazione. Con sorgente satura il fondo rimane il datum world fisso.
Nessuna nuova lettura texture, nessun aumento di risoluzione del rain map.

La regolazione della pioggia usa ora il tempo della transizione anche in
pausa, come già facevano cielo e luce; il movimento della nube e delle gocce
rimane fermo. Corretto anche il fondo dello scenario selezionato sotto il
puntatore: il precedente hover conservava testo scuro sopra un fondo scuro.

### Validazione e limiti del secondo ciclo

**140 test / 26 file**, TypeScript e build applicazione → hero superati.
Resta l'avviso Vite preesistente sui bundle grandi. Nessuna installazione;
esclusione locale di `node_modules` riletto a 1, Git ignore verificato e nessun
percorso tracciato al suo interno. `node_modules 2/` preesistente preservato.

La misura main a 1672×941, camera 100%, Sole, animata, registra **43,9636 rAF/s**
in 30,0021 s, p95 33,70 ms, massimo 49,80 ms e 212 intervalli oltre 33,34 ms.
Media GPU 42,2473 ms; CPU media 0,4371 ms, p95 1,10 ms, massimo 4,40 ms. Il
contesto iniziale conserva campo 0,90 ms e ricerca 0,20 ms: è un singolo
aggiornamento, non una distribuzione. Questa prova `observatory-v23` precede
la sola correzione del clock della pioggia (`v24`); usa pioggia zero. Non è un
confronto causale con il precedente 95% o con un altro tempo della nube.
[Report completo](measurements/main-near100-filtered-v23-30s-2026-10-15.json).

Nessuna equivalenza fra rAF, timestamp GPU e frame presentati è dedotta. I
gate del materiale vicino, dell'incudine, dell'accettazione in movimento e dei
60 fps sostenuti restano aperti; la qualità configurata è conservata.

La verifica finale `v24`, main, pioggia 100%, vento zero e nube in pausa
conferma intensità effettiva 0,999999999 e tempo della nube **60 → 60 s**.
Campione di 30,0019 s a 1672×941: **45,7971 rAF/s**, p95 33,40 ms, massimo
150 ms, 164 intervalli oltre 33,34 ms; GPU media 40,2933 ms, p95 49,5452 ms.
Il picco di 150 ms è conservato senza attribuirgli una causa non misurata.
Non è una misura animata né un confronto causale con il precedente 80%.
[Report finale](measurements/main-rain100-paused-v24-30s-2026-10-15.json).

Osservati nel browser anche virga al 45% con vento zero e massimo, cambi di
intensità in pausa e due campioni durante il movimento. Non sono emerse bande
sospese nelle pose campionate; il contrasto della precipitazione è tenue e la
sua accettazione artistica rimane aperta. Queste immagini non costituiscono un
video o una validazione fisica della pioggia.

Worker `v24`: disegno reale con flusso congelato e avvicinamento 100% al
tramonto, reset, nuova nube con seme 840455697 e nuova ricerca al massimo.
Console main/worker senza errori o warning osservati. Nessun nuovo benchmark
sostenuto worker è dedotto dalla lettura istantanea del pannello.

Ricontrollo UI mobile a 390×844: documento largo 390 px, focus visibile e
Nuova forma raggiunta con Shift+Tab senza attivarla; Escape richiude. Il
contrasto dello scenario selezionato è stato verificato nel DOM e nelle
immagini dopo la correzione hover. Le limitazioni dei dispositivi fisici e
del reduced motion restano quelle del primo ciclo.

Manifest distinti per [v23](measurements/build-manifest-cycle2-v23-2026-10-15.json)
e [v24 finale](measurements/build-manifest-cycle2-final-2026-10-15.json);
[inventario delle nuove immagini](measurements/screenshots-cycle2-2026-10-15.json).
I nomi `cycle2-multicell-front` e `cycle2-final-multicell-*` distinguono la
revisione ancora a U dalla successiva. Gli screenshot di sola anatomia del
congestus precedono anche la correzione del contrasto hover.

Preview finale ordinaria main: seme 72, Sole, nube matura in pausa, Panorama,
audio spento e nessun pannello aperto. Override viewport rimosso; lo stato
effettivo di questa finestra è CSS **1280×720**, canvas **2560×1440**. Le uniche
opzioni ordinarie sono Massima/384 e Schermo. I campioni a 1672×941 non misurano
questo buffer nativo più grande. Stato:
[preview finale](measurements/final-cycle2-preview-state-2026-10-15.json).
