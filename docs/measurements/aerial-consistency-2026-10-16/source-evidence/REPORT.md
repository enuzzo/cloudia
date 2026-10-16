# Candidata aerial-only: coerenza della foschia

Base `08c33cb`; snapshot finale del solo trial atmosferico, test revisione 2. Root ha compilato la candidata e la sta confrontando nella preview 4195. Questo archivio prepara le prove già disponibili: **non contiene ancora un giudizio browser, fisico, artistico o prestazionale**.

Il paesaggio usa il coefficiente atmosferico `.006+.004*haze`, nube e pioggia usavano `.0035*haze`. A distanza e haze uguali il contrasto rispetto al cielo dipendeva quindi dal ramo di rendering. Nel caso registrato Pioggia, a 16 km con haze 2,6, i fattori sono rispettivamente **0,7692032808507674** e **0,8645034354077514**. La differenza scalare è 0,09530015455698404; non è una differenza misurata fra pixel.

La candidata espone il coefficiente esistente del paesaggio tramite una helper CPU/WGSL comune. Il modulo `LANDSCAPE_WGSL` ne include una sola definizione; nube e pioggia la richiamano nei due punti precedenti. La struttura del calcolo rimane la stessa, senza un'ottimizzazione indipendente: nessun nuovo branch, loop, campione, uniforme o risorsa. Il coefficiente del paesaggio è conservato; l'aspetto finale composto deve ancora essere confrontato.

Restano macro **256³**, dettaglio **128³**, **384 passi nominali**, output pieno, campionamento pioggia da 6 m e selezione R8 preesistente. Sorgente della precipitazione, evaporazione, striature, occlusione, engine e volume non vengono modificati. L'API del factory conserva i tre argomenti.

È un **trial di mezzo omogeneo**, non una soluzione fisica completa. Una densità atmosferica dipendente dalla quota può giustificare attenuazioni diverse lungo percorsi diversi; il modello attuale non integra quella distribuzione. [NVIDIA GPU Gems 2, capitolo 16](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-16-accurate-atmospheric-scattering) descrive questo limite dell'approssimazione e il trattamento del percorso atmosferico verso terreno, nubi e altri oggetti. [PBRT, Transmittance](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance) fornisce il riferimento esponenziale omogeneo. Nessun codice esterno è stato copiato.

| Prova conservata | Cosa dimostra |
|---|---|
| `focused-test-tool-result.json` | **27/27 test, 4 file PASS**, 10:30:35, 504 ms. Primo test con witness fissi del replay baseline e distanza zero; conservate proprietà bounded/semigroup. |
| `template-contract-evidence.json` e test congelato | Invertendo soltanto le due sostituzioni aerial si recuperano gli SHA completi dry/rain qualificati. Registrazione WGSL unica e percorso R8 coperti usando nodi `wgslFn` effettivi. È una verifica CPU, non del binario driver. |
| `scalar-witnesses-selected.json` | Tre coppie prima/candidata dai replay già eseguiti. Il riferimento CPU candidato adotta il coefficiente del paesaggio. Nessun nuovo run eseguito per preparare l'archivio. |
| `withdrawn-growth-hypothesis.json` | L'ipotesi di scala errata della pioggia è **falsificata**: `growth` contiene reciproci; le trasformazioni esistenti sono coerenti. Nessuna correzione della scala è stata applicata. |

Le fotografie rain precedenti ispezionate erano dominate da nube e cortina e non isolavano un riferimento utile del territorio. Il prossimo controllo è l'A/B con camera, seed, tempo e qualità fissi, terreno e precipitazione contemporaneamente visibili; servono anche il controllo Sole e la virga debole. L'attenuazione maggiore potrebbe rendere la pioggia troppo tenue o appiattire l'immagine: in quel caso la candidata va ritirata. Restano aperti continuità temporale, accettazione artistica e 60 FPS stabili.

`candidate/` contiene i cinque snapshot finali; `before/` i due sorgenti baseline pertinenti. Il patch gzip conserva SHA e dimensione decompressi in `provenance.json`. Lo storico del test iniziale rimane nell'archivio esterno completo indicato dalle prove. Nessuna build, cache volumetrica o directory completa del progetto è inclusa.
