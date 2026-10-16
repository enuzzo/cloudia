# Ombre per triangolo: trial respinto, prodotto v58 conservato

16 ottobre 2026. **Goal attivo; nessuna adozione runtime.** La nuova mappa passa
le verifiche CPU, typecheck e build, ma crea puntini e tratteggi nel rendering
nativo. Un controesempio separato dimostra inoltre un limite della sua stessa
rappresentazione. Il trial viene conservato per evitare di ripetere questa
strada; preview e sorgenti prodotto restano v58 `9080780`.

## Esito e implicazione pratica

La proposta conservava il triangolo che vince il depth al centro di ciascun
texel e calcolava il minimo solo sull'intersezione di quel triangolo col texel.
Questo riduceva la perdita di ombra osservata nel riferimento CPU precedente,
ma non rappresenta tutte le facce che possono contenere il ricevitore nello
stesso texel. Anche due triangoli di un unico piano illuminato possono così
generare un'ombra falsa. Non promuovere questo metodo né cercare altri bias
per far passare le immagini.

| Evidenza | Esito | Limite |
|---|---|---|
| 12 pixel prefissati, 36 raggi sulla mesh Float32 | 6 schermati + 6 non schermati | Campione locale, non certificato globale |
| Riferimento CPU triangolo∩texel sui 12 record | Tutti classificati correttamente | Non è rasterizzazione GPU |
| Trial esterno | 440/440 test, 47 file; APP→hero PASS | Test e build non sono giudizio fotografico |
| PNG GPU Sole 2474×1844 | FAIL visivo root e indipendente | Nuovi puntini/tratteggi; scaglie sinistre persistenti |
| Sonda effettiva R32F | 12 record / 11 texel, mappa stabile | Non legge ricevitore GPU o triangolo vincente |
| Controesempio complanare prefissato | Falso shadow ≥5,75 m in Float64/Float32 | Non identifica la causa concreta dei puntini GPU |

## Controlli fisici prima del trial

Ai sei pixel già usati nel ciclo precedente sono stati aggiunti sei controlli
scelti prima dei raggi, senza sostituire i casi sfavorevoli. I nomi «ocean»,
«plain» o «ridge» indicano l'intenzione di selezione, non la classificazione.
Il run unico conserva 12 record / 36 raggi, CPU3,061125s, wall2,7710925s,
RSS877.789.184 B, exit0 e limiti prefissati20sCPU/40swall/2GiB gate finale.

I sei vecchi punti sono tutti schermati, inclusi i tre che il riferimento
shadow precedente lascia illuminati; i sei controlli nuovi sono tutti
fisicamente non schermati. Il minimo margine positivo del clipping CPU è
75,0475m. I sei vecchi record coincidono col ciclo precedente esclusi i tempi.
Questo giustificava un trial GPU, senza dimostrarne correttezza o costo.

## Implementazione esterna e costo strutturale

Il caster usa un draw instanziato di 929.792 triangoli con tre vertici reali,
indici copiati e posizioni vec4 possedute dall'owner. Non modifica attributi o
geometria del pass colore. I tre corner UVQ flat arrivano dal medesimo triangolo;
il clipping Sutherland–Hodgman ha cap7vertici, deduplica e fallback alla baseline.
Le derivate della baseline sono calcolate prima dei rami divergenti.

Il costo nominale aggiuntivo è18.604.084B di payload e2.789.376 possibili
invocazioni vertex nel caster, contro465.409 vertici condivisi. Non è un costo
gratuito o equivalente. La cache v58 resta attiva e il trial richiederebbe una
nuova qualificazione di lifecycle e prestazioni prima di qualunque adozione.
Questa fase non è stata svolta dopo il FAIL visivo.

I controlli mirati preservano errori e correzioni R1/R2. Il candidato definitivo
ha128sorgenti congelati, SHA del manifest
`dfa3ec97b2c606f6fa1d1cd2f6d21dad44026095228026270fc02e150cb56921`;
440/440test47file e build APP→hero terminati exit0, senza timeout. Non è stato
copiato nel prodotto. La geometria immutabile è parte del contratto: modificare
la sorgente richiederebbe ricreare il caster copiato, non soltanto invalidarlo.

## Prova nativa e stop rule

Seed74, t60 in pausa, surface0,7227685139973958,
target[0,3515625;3,119140625;−0,0546875], stessa camera/Sole della baseline;
output2474×1844 pieno,256³macro/128³dettaglio/384passi. L'unico PNG trasferito
completo ha2.989.801B, SHA256
`576b35cc44d09b7fe271bbec942dc9f9cd4d0a5105a82dafd17b43ffb766bdc6`;
61parti visibili controllate e decodifica IHDR corrispondente.

Il compilatore GPU esegue il nuovo shader senza warn/error osservati. La scena
introduce regolari puntini/tratteggi sulle pianure costiere e altre piccole
facce scure sulle colline; le larghe discontinuità sinistre restano. I76.544pixel
RGB diversi dalla baseline non sono una misura della visibilità shadow; i12pixel
prefissati restano byte-identici. Il normale geometrico dei tre controlli vecchi
ha N·Sun negativo, ma questo da solo non prova quale normale/ramo GPU produca
gli RGB, e il mare non usa il cast visibility del terreno.

La stop rule pre-run è stata rispettata: **nessuna ulteriore acquisizione
Rain/worker o misura FPS del trial dopo il FAIL**. È seguita soltanto una sonda
diagnostica R32F intenzionale per separare numeri GPU e riferimento CPU.

## Cosa sappiamo dalla GPU e cosa resta indeterminato

La sonda è disponibile soltanto con profile=1 e shadowProbe=1, a scena ferma,
assestata e fuori da acquisizioni/benchmark. Usa l'API pubblica Three
readRenderTargetPixelsAsync su11texel unici e conserva12record Float32+bit.
Prima/dopo: stesso owner/target/Sole, cache valida, epoch0, draw1→1, quattro hit.
Tsc e APP→hero PASS per128sorgenti diagnostici; nessuna nuova suite Vitest.

Confrontando **qLookup CPU** con l'altezza effettiva GPU, tre dei sei punti
fisicamente schermati CPU risultano illuminati e nessuno dei sei controlli
non schermati CPU risulta in ombra. Alcuni valori restano vicini alla baseline;
questo non identifica fallback o triangolo vincente. La sonda non legge q del
ricevitore GPU, ID/corner o ramo attivo. Non attribuire ai dati la causa dei
puntini o una spiegazione degli RGB invariati. Il successivo hash PNG calcolato
dall'owner è identico al trial; il bitmap non è stato trasferito una seconda volta.

## Controesempio indipendente e prossima direzione

Due triangoli complanari illuminati, con ricevitore nell'altro triangolo del
medesimo texel, bastano a falsificare la rappresentazione: baseline lit,
minimum-clipped shadow con margine5,7500m. Il caso è fissato prima del run,
non cercato per scansione; CPU0,034299s, wall0,131956s, RSS30.507.008B entro
1sCPU/10swall/512MiB gate finale. Float32 non emula l'intero percorso matrice/FMA.
È prova del limite del metodo, distinta dalla causalità dell'immagine reale.

Il prossimo ramo riguarda la fedeltà della mesh ai rilievi: nel core DEM125m,
alcune zone usano celle256/512m. Lo studio conservato descrive un raffinamento
statico locale con edge condivisi e figli contigui per mantenere heightAt e
normali coerenti. Una passata512→256m non raggiunge125m; i soli midpoint possono
perdere picchi interni. Prima di adottare triangoli in più servono errori edge e
interni osservati su punti indipendenti, costo reale e confronto nativo.
Una mesh più fedele non risolve automaticamente il problema multifaccia delle
ombre. Materiali uniformi, anatomia grandeU, morbidezza vicina, cortina di pioggia,
continuità in moto/UI e60FPS stabili globali restano aperti.

## Riproducibilità e stato locale

Pacchetto [triangle-shadow-trial-2026-10-16](measurements/triangle-shadow-trial-2026-10-16/README.md)
con manifest SHA/byte, sorgenti differenziali, risultati, PNG e verificatore
saved-evidence senza replay. Baseline prodotto124file SHA-manifest
`21cda2a07fdc8896b78885beac706fb81b435a659120060949e7f78dfdb86ee2`.
140payload/4.448.729B, manifest SHA256
`fac1e021241a455faa47aeac69868d35da3af0c49f4ee0a05c86867656818248`.
Verificatore saved-evidence exit0: base124 byte per byte, overlay trial e
diagnostica128, dist30/30 ciascuno, PNG/ledger/crop/record PASS. Nessun replay
di test, mesh, shader o GPU. La review indipendente precede solo l'aggiunta di
questi conteggi finali e non è una verifica completa del manifest.
Snapshot/dist esterni cycle27; dipendenze ignorate Dropbox verificate, nessuna
installazione. `node_modules 2/` estraneo preservato.

Preview4196 v58 ripristinata: Sole animata, canvas2474×1844/CSS1237×922,
controlli diagnostici assenti e console warn/error vuota. Server trial53764 e
diagnostica53765 chiusi con exit0; listener4201 estraneo non toccato.
Questo checkpoint è locale, senza push o deploy.
