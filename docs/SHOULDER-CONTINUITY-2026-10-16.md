# v56 — correggere la spalla interna senza gonfiare il corpo

16 ottobre 2026. Goal attivo; adozione locale circoscritta, fotorealismo
complessivo, resa ravvicinata e60FPS ancora aperti.

La spalla della torre matura poteva sporgere nello spazio fra i due updraft,
formando un dente. v56 sposta quella spalla e i suoi90 discendenti soltanto
lungo la direzione verso l'altra cella, eliminando la componente inward.
Conserva lo scostamento perpendicolare, tutte le quote, i raggi, il corpo comune,
le altre primitive e i draw RNG del layout. Il guard dipende dalla geometria,
senza selettori per seed o soglie aggiustate sui casi mostrati.

Non vengono aggiunti pass, texture o espressioni dello shader. Cambia il campo
di densità iniziale: non si deduce per questo un costo GPU identico o la
conservazione dell'integrale della densità. Terreno Copernicus, frazioni
WorldCover, cromaticità Sentinel-2 v55 e fix focus Mani restano identici.
La preferenza del proprietario rimane geografia reale, comprese le aree abitate,
nelle stesse due mappe di materiale; nessun edificio3D aggiuntivo.

## Perché le altre trasformazioni sono state scartate

| Prova | Risultato e decisione |
|---|---|
| R3, roof del corpo incondizionato e ricentraggio completo | Sul617 il corpo cresce inY27,3% e diventa più a cuscino; vicino perde contesto. Stessa mira, ma superficie/origine della camera si spostano463,476m. Non adottata. Il bake256/128 misura densità integrata+3,1961%, non un miglioramento artistico. |
| R4, lift e ricentraggio soltanto inward | Preserva i18outward, ma conserva il costo vicino del74. Il massimo lift inward è29,04% sul260. Qualificata numericamente, non adottata. |
| R5R1, solo ricentraggio completo X/Z | Build e controlli mirati passano, nessuna prova browser. Sul917 eliminerebbe941,805m di offset per una protrusione inward di soli6,700m. Superata. |
| R5R2, sola componente inward, poi v56 | Il917 si sposta6,700m e conserva l'offset laterale. Nessun lift del corpo. Scelta dopo confronto visivo e qualificazione finale. |

Il primo bake diagnostico617 supera il guard RSS di1GiB: processo terminato e
atteso, B mai avviato. La successiva A/B è un protocollo distinto da2GiB su
Mac64GiB, stessa qualità256/128 e CPU/wall180/240s; entrambi exit0 e reaped.
Il vecchio qa-approach conserva18pose numeriche complete, ma il wrapper fallisce
e l'exit del figlio resta null: non viene chiamato PASS del comando.

## Qualificazione del prodotto adottato

122 sorgenti congelati, manifest SHA256
`e826b119ff2758fa51ed04cf8748d0d40ad1ff09516fc498826466ceae3974b7`.
Volume SHA256`c349e8f7526a2dafa0348516079f3f67ab7288a17769f28193ebcef7e124d34d`.
Soltanto sei percorsi differiscono dalla base119 v55: volume, versione del
report, sua attesa nel lifecycle, helper, nove regressioni e CLI opt-in.

- Typecheck,9 regressioni, suite350/350 in44file e build app→hero nello stesso
  dist PASS;7 mutanti reali respinti e anchor alterato rifiutato.
- Unico scanner0..1023 in3,0576sCPU con limite kernel5s:701 layout interi
  identici adA,323 inward corretti,341 corpi comuni identici adA; tutti gli
  attributi estranei a X/Z e le primitive non selezionate rimangono esatti.
  La sola componente parallela dei323 coincide conR3 entro4,44e−16km;
  non sono323 layout interi uguali aR3.
- Il helper usa componente residua, offset perpendicolare e relazioni fra
  discendenti osservati; non ricostruisce la formula di traslazione attesa.
  Il caso917 verifica la componente quasi laterale, il323 il grande offset.
- Il primo harness negativo aggiungeva testo dopo il marker, lasciandone la
  sottostringa intatta: FAIL conservato. HarnessR2 cambia davvero il marker;
  sorgenti122 immutati, scanner/typecheck/nove test riusati con hash, poi mutanti,
  suite completa e build eseguiti correttamente. Nessuno scanner ripetuto.

Il prefix esclude raster/bake e il cellular RNG indipendente: non è una prova
su tutti i seed o sul campo filtrato. Il run CLI qualificato fornisce entrambi
i riferimenti A/R3. Senza riferimenti opzionali il suo testo scope è troppo
ampio; non usare quella modalità per affermare un confronto fra tre prefix.

## Giudizio visivo e limiti

Confronti a1920×1080,256³/128³/384, t60 in pausa, vento55%, dispersione0,
flusso completo. Vicino reale senza override del probe su74/77/80 e sul926,
massimo inward della scansione807,388m; controllo917 quasi laterale e617outward.
Sole/Tramonto sul74, fronte/lato/retro926/917 e singola posa pioggia74.
Review indipendente favorevole al piccolo fix: dente ridotto, giovane e aperture
conservati, nessun nuovo cuscino o distacco visibile nella posa di pioggia.
La camera617 a approach1 recupera esattamente origine, mira e superficie A.

Sono JPEG CSS, non framebuffer nativi o identità pixel/raggi. Alcuni primi
scatti precedono l'assestamento del cielo: conservati come early-sky, esclusi
dal confronto della luce e ricatturati per926B/917A. I due scatti del moto R3
non qualificano la continuità temporale di v56. Grande U, collo alto, dettaglio
vicino troppo morbido, cortina uniforme e terminazione della pioggia fuori
quadro restano aperti. Nessun PASS anatomico o fotografico generale.

## Misure native e preview

Main,2474×1844 sia output sia interno, qualità massima256³/128³/384,
seme74/t60 in pausa, vento55%, dispersione0%, flusso completo, timing stages,
invio continuo. Stessa camera v55: yaw1,3852869846402587,
pitch0,2811279826464208, mira[0,2.7,0], origine
[15,108145390770279;7,1390324220971255;2,835301396133632].

| Scenario | Invii/s | Intervalli / durata | Mediana / p95 | Oltre33,34ms |
|---|---:|---:|---:|---:|
| Sole |59,9962|1800 /30.001,9ms|16,7 /18,3ms|0|
| Pioggia80% |18,3784|552 /30.035,2ms|50,1 /67,6ms|513|

Entrambi i prefissi inviati risultano completati, senza frame misurati non
confermati. Timestamp render/compute completi:1791/1800 Sole e548/552 pioggia;
9 e4 draw mancanti dichiarati, nessuna somma dei pass interpretata come frame
time. Pioggia effettiva0,799999999999919 e transizione1 all'avvio.
Singole finestre sequenziali, senza repliche A/B/A: nessun vantaggio causale
attribuito a v56 rispetto a v55. Presentazione del compositore non misurata;
la pioggia resta lontana dai60FPS. Worker Sole controllato funzionalmente allo
stesso canvas; non è un'altra misura prestazionale di30s.

Preview ordinaria main Sole animata su`http://localhost:4196/?seed=74`, senza
override diagnostici della camera e con output nativo. Misure e verificatore
sono nell'archivio curato
`docs/measurements/shoulder-continuity-2026-10-16`; il pacchetto completo
source/dist rimane esterno in`Cloudia-QA-2026-10-16-cycle22`.

Archivio:344 payload,7.066.492 byte; manifest SHA256
`c82f833c50b5ff8838c92198f08ff96e9e2e134709feb6f55ff5649d6bb8c97f`.
Verifica offline e122 hash runtime PASS. Preview nativa animata osservata
con tempo della nube131,7→152,6s; console main/worker/preview senza errori
o warning osservati. Nessuna nuova qualifica mobile o touch fisico.
