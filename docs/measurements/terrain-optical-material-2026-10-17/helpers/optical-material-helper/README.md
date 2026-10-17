# Factory materiale ottico — proposta esterna singola

17 ottobre 2026. API esclusivamente
`terrainOpticalSurfaceWGSL(enabled=false): string`. Il helper non carica texture,
non crea binding o modelli, non cambia il prodotto e non contiene parametri da
ritarare. Base: `src/cumulonimbus/terrainSurface.ts` canonico; import relativo
`./terrainSurface` pronto per l’integrazione root.

## Derivazione immutabile

False (anche omesso) restituisce direttamente `TERRAIN_SURFACE_WGSL`, byte per
byte: 7.591 byte UTF-8, SHA256
`1099a97f339851e3d520a4e4cfdd3831f865832c98660c1535a7754d387e55df`.
Nessun argomento, sampler o default ottico entra nella libreria A.

True richiede una sola occorrenza esatta della firma materiale, riga albedo,
chiamata fallback e formula ground originale; rifiuta una libreria già ottica.
Cambia solo tre regioni: ultimo argomento `observed:vec4<f32>` nel materiale,
composizione albedo e `vec4<f32>(0.0)` aggiuntivo nella chiamata fallback.
L’inversione di queste tre modifiche recupera l’intera libreria canonica.
Rough, normali, illuminazione diretta/ambiente, shadow, inland water, mare,
coast, geometria e tutti i noise restano byte invariati.

Il wrapper root deve usare owner/pipeline immutabili distinti: A con firma e
binding originali; solo B campiona la texture ottica e passa `observed`.
La factory stessa non aggiunge alcuna istruzione textureSample.

## Significato dei canali, verificato nella fonte attuale

| Canale shader | Gruppo | Classi WCV1 originali |
|---|---|---|
| A.x | unknown/NoData | 0 |
| A.y | trees | 10,95 |
| A.z | low vegetation | 20,30,90,100 |
| A.w | crops | 40 |
| B.x | built | 50 |
| B.y | bare/rock palette | 60 |
| B.z | snow | 70 |
| B.w | water | 80 |

Questi sono gruppi materiali da frazioni di area, non densità fisica, stato del
bosco, geologia o una nuova classificazione. “Grass” nel materiale non significa
che tutte le classi20/90/100 siano letteralmente prato. Coltivato e costruito non
vengono riclassificati in foresta. Le frazioni sono già normalizzate e raccordate
dal wrapper esistente; K non ripete il blend48–64km.

```text
U = authored * coverA.x
P = forest*A.y + grass*A.z + crops*A.w + built*B.x + rock*B.y + snow*B.z
K = A.y + A.z + A.w + B.x + B.y + B.z
albedo = U + (1-observed.a)*P + K*observed.rgb
```

`observed=(RGB*valid,valid)` è già premoltiplicato **prima** del filtraggio.
Non viene diviso per alpha, applicato gain/gamma, clamp, normalizzazione o fit.
Con validità0 e RGB0 torna la palette in aritmetica reale; a validità1 il colore
osservato sostituisce solo l’area delle sei classi note. Unknown resta U; acqua
B.w e mare conservano i rami originali. Nel misto la copertura invalida mantiene
la palette e quella valida il colore osservato. L’alpha non è opacità del suolo.

Il composito osservato contiene illuminazione e residui atmosferici/BRDF: questo
uso sperimentale come colore diffuso **non** lo rende albedo fisicamente calibrato.
La formula originale ground moltiplica ancora quel colore per la luce corrente:
il rischio di doppia illuminazione resta nel protocollo root. Nessuna correzione
radiometrica è nascosta qui.

## Test e limiti

Test di default/SHA e inverse patch; nessun nuovo texture/noise lookup e coda
normal/light/water/sea identica; ancore mancanti/duplicate, ground alterato e
derivazione ripetuta rifiutate. La reference CPU vive solo nel test e confronta
U/P/K/Q con un oracle indipendente che somma sottoporzioni valide/invalide per
classe: pixel invalidi, validi e misti, unknown/acqua e filtraggio premoltiplicato.
Un caso prefissato distingue esplicitamente l’errata divisione per alpha.

Questi test verificano derivazione sorgente e algebra reale, **non eseguono WGSL**,
non sono un simulatore f32 e non provano la texture o il materiale GPU. Il nuovo
raggruppamento U+P può differire negli ultimi bit dalla vecchia somma anche con
validità0: non si promette bit-parità B nei pixel misti invalidi. Solo A è per
costruzione la libreria originale. Il root deve qualificare shader compilato,
buffer/PNG A, depth/alpha B, immagine nativa e costi secondo il protocollo unico.

Configurazioni, copie per qualifica, log e manifest sono limitati alla directory
`freeze/`; i file da integrare restano soltanto helper e test. Nessuna dipendenza
nuova, URL fisico, asset ID definitivo, shader nube o modifica modello.

Qualifica isolata R1: **15 test PASS**, typecheck PASS; log salvati in `freeze/`.
Nessuna esecuzione GPU, app/hero build, download o modello. Dipendenze esistenti
Git-ignored/non tracciate, xattr Dropbox1 verificato prima e dopo; niente install.
