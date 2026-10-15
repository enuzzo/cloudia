# Estinzione liquida 60/km: guardia visiva

15 ottobre 2026. **Variante non promossa.** Aumentare l'estinzione da 18 a 60/km
rafforza il contrasto, ma nelle due pose all'80% i lobi rimangono lisci e
percettivamente sfocati. Il valore attivo viene riportato a 18/km; la patch
[liquid-extinction60](experiments/liquid-extinction60.patch) conserva l'esperimento.
Non è raggiunta la qualità ravvicinata richiesta.

## Ipotesi e cambiamento isolato

L'ipotesi era ridurre la profondità visibile e la media di molte strutture lungo
il raggio. Cambia solo il coefficiente liquido; quello del ghiaccio resta 6,5/km.
Le cache solari diurne, al tramonto e quella verso il cielo vengono rigenerate
coerentemente. Densità, sonda camera, 256³ macro, 128³ dettaglio, 384 passi e
output pieno restano configurati; nessuna banda nuova o lettura texture aggiunta.

Manifesti con hash: [baseline v27](measurements/extinction-baseline-build-2026-10-15.json)
e [candidata v28](measurements/extinction60-candidate-build-2026-10-15.json).
Il coefficiente moltiplica una densità procedurale senza calibrazione fisica.
Come solo ordine di grandezza, la relazione visibile
`beta ≈ 3 LWC / (2 rho_w r_e)` collega acqua liquida e raggio efficace
([University of Wisconsin, cloud optical parameters](https://profhorn.aos.wisc.edu/wxwise/satmet/lesson3/cloudoptical.html)).
Con LWC ipotetica 0,3 g/m³, rho_w 1000 kg/m³ e r_e 7,5 µm si ottiene 60/km.
Questi valori non sono misurati o simulati da Cloudia e non validano la scelta.

## Evidenze e limiti del confronto

La guardia si ferma dopo due immagini: fronte e quarto sinistro, all'80%,
Sole, seme 1571198069, nube ferma a 60 s, vento 55%, senza pioggia/dispersione.
La candidata usa raggi diagnostici fissati: 0,6045067691053366 km per il fronte
e circa 1,0175727911860888 km per il quarto, ricavati dalla baseline.

| Vista | Baseline 18/km | Candidata 60/km |
| --- | --- | --- |
| Fronte 80% | [Immagine precedente a origine fissata](measurements/meso-2026-10-15/meso-baseline-near80-sun.jpg) | [Immagine](measurements/extinction-2026-10-15/extinction60-front80-sun.jpg) |
| Quarto 80% | [Immagine v27](measurements/extinction-2026-10-15/v27-quarter-left-near80-sun.jpg) | [Immagine](measurements/extinction-2026-10-15/extinction60-quarter80-sun.jpg) |

I dump DOM [fronte](measurements/extinction-2026-10-15/extinction60-front80-state.txt)
e [quarto](measurements/extinction-2026-10-15/extinction60-quarter80-state.txt)
registrano il badge diagnostico, qualità completa, output/interno 1672×941,
384 passi, 256³/128³, assenza di TAA e pausa. Non sono report numerici completi
della camera candidata: non certificano da soli l'uguaglianza esatta delle origini.
I dump console [fronte](measurements/extinction-2026-10-15/extinction60-front80-console.json) e
[quarto](measurements/extinction-2026-10-15/extinction60-quarter80-console.json) sono `[]`; i valori istantanei DOM non costituiscono benchmark.

I due report v27 del quarto sono **solo baseline**, con sonda ordinaria:

| Pose baseline | rAF/s | GPU media, ms | Report |
| --- | ---: | ---: | --- |
| 80% | 59,9966 | 23,7797 | [JSON](measurements/extinction-2026-10-15/extinction-baseline-quarter80-30s.json) |
| 100% | 49,9637 | 38,3123 | [JSON](measurements/extinction-2026-10-15/extinction-baseline-quarter100-30s.json) |

La [vista baseline al 100%](measurements/extinction-2026-10-15/v27-quarter-left-near100-sun.jpg)
è conservata come contesto. **Nessun benchmark GPU candidato**, confronto causale
di prestazioni, panorama candidato o matrice completa viene eseguito dopo
il mancato miglioramento visivo iniziale. rAF e timestamp GPU non sono fps presentati.

## Interpretazione e conservazione

L'estinzione più forte accorcia il contributo dei volumi profondi, ma non crea
nuove forme nel primo strato. Aumenta anche il ricorso al limite tau 16 della
cache UNORM8; la diffusione multipla rimane un'approssimazione, non una nuova
soluzione fisica. Il contrasto più forte non basta per accettare il materiale.
L'esperimento viene fermato e il coefficiente originale ripristinato nel sorgente.
Una preview già caricata con v28 resta candidata fino alla build successiva:
queste immagini documentano v28, non attestano il ripristino della preview.

Dieci file sono copiati byte per byte dalla cartella privata di QA, con SHA256
verificati e originali preservati. Nessun risultato qualifica moto, sole basso,
worker o dispositivi fisici; la qualità artistica e il goal rimangono aperti.
