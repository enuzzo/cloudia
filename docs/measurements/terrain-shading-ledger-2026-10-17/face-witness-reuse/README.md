# Riuso dei dodici receiver CPU — v61

**Record storici autenticati; riferimento CPU riutilizzabile con limite esplicito. Nessuna nuova prova dei quattro buffer del browser, nessuna faccia GPU attuale certificata.**

I12receiver completi provengono dal report installed-shadow-witness v59, autenticato contro il suo manifest. I corner Float32, normali geometriche e dotSun sono copiati senza ricampionamento in faces12.json. Originale62341B e helper effettivo conservati byte-identici. Camera nativa2474×1844 e Sole dei metadata coincidono esattamente con final-default-native v61; il frame CPU conserva invece la base fround e l'algebra Float64 Three originali.

Il blocco builder+lookup+camera è byte-identico (23204B, SHA fe855152…); DEM, sampler, split, fallback e camera sorgente coincidono con manifest vecchio e v61. Stesse opzioni256celle/9livelli/.032km, refinement125m/±48km/5m e stessi stats591788V/1182550T. I quattro digest canonici sono autenticati nel preflight ON archiviato: non sono stati misurati nel run browser originario, che lo dichiara, né nel browser attuale. Source/input/config continuity non sostituisce quel readback/hash. Non inferire buffer identity o winner GPU dai soli stats.

| ID storico | faceIndex CPU storico | Nx | Ny | Nz | Ngeom·Sun CPU |
|---|---:|---:|---:|---:|---:|
| L1-artifact | 471806 | 0.707466060 | 0.660457809 | -0.251569584 | -0.055775206 |
| L1-control | 471807 | 0.703713044 | 0.667704377 | -0.242814368 | -0.046231447 |
| L2-artifact | 461845 | 0.373757296 | 0.623876290 | -0.686355490 | 0.048156554 |
| L2-control | 461846 | 0.228815668 | 0.759252184 | -0.609245034 | 0.257960281 |
| L3-artifact | 446724 | 0.810987479 | 0.506630195 | -0.292617762 | -0.243344814 |
| L3-control | 446725 | 0.680951797 | 0.634152691 | -0.366271776 | -0.081330534 |
| C1-ocean | 249937 | -0.001758328 | 0.999996802 | -0.001817946 | 0.713452194 |
| C2-coastal-lowland | 426935 | 0.011674087 | 0.999918728 | -0.005123729 | 0.703715221 |
| C3-plain | 408902 | -0.003958065 | 0.999987809 | -0.002952251 | 0.714672973 |
| C4-ridge-L1 | 468996 | 0.224532274 | 0.823231335 | -0.521416749 | 0.325195780 |
| C5-ridge-L2 | 461127 | 0.555431694 | 0.831114927 | -0.027269236 | 0.215380454 |
| C6-ridge-L3 | 445322 | 0.125698550 | 0.852273635 | -0.507769166 | 0.414844607 |

I JSON conservano i numeri completi; tabella arrotondata. Ricostruzione aritmetica dei12cross/dot dai corner salvati, senza raggi: maxΔN=2.220446049250313e-16, maxΔdot=5.551115123125783e-17. Questi errori non sono tolleranze CPU/GPU.

La normale geometrica è la faccia del raycaster FrontSide, non normalWorld interpolata né n dopo rough; normalDotSun non predice RGB. La normale di vertice opzionale è copiata raw: Three può orientarla verso il raggio e la sua lunghezza non è necessariamente1. Non usarne il dot come normale finale del materiale. I nomi artifact/control sono etichette storiche, non classificazioni v61.

Il nuovo ledger GPU del parent deve mantenere ordinary full-target/PNG parity e confrontare le distanze ricevitore ai12punti; qualsiasi differenza invalida l'attribuzione storica al punto. Anche con distanza concorde questa è una reference CPU ideale, senza prova di raster winner, derivate finali o bit-identità della geometria browser. Source/header congelati consentono la tracciabilità; nessuna frequenza globale, verità del terreno, fotorealismo o FPS dedotta.

provenance.json elenca tutti i digest e le verifiche; INDEX.json indicizza i payload senza includere se stesso. Nessuna sorgente prodotto o vecchio archivio modificato.
