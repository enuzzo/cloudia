# Seed 617 · A/B macro 256/detail 128 · R2

**A/B CPU concluso, R3 non adottata dal root per resa del corpo.** Un A e un B
sequenziali, stesso Bun e script, seed 617. Fonte A: v55-final/source manifest
`30c5448e87fb60c3bd3fdc8ca133993c49e54503a9950f9da1815fd59883171f`;
B: anatomy-r3-v55-source manifest
`e65c9209938773d3e4d1e3e6f649e4fb11bad01c731a4ee38258ebefdf39e3e9`.

| Metrica | Baseline A | Candidato B |
|---|---:|---:|
|Densità integrata [densità×km³] |14,56573057 |15,03127138 (+3,1961%) |
|Frazione voxel R>0 |.03532410 |.03628582 (+2,7226%) |
|Bulk 6 vicini R byte≥41 |8 componenti |9 componenti |
|Massa bulk nel maggiore |99,997604% |99,997631% |
|Profilo alto / supportBounds |identici |identici |
|R outer + second layer, 6 facce |tutti zero |tutti zero |

Centroide world Δ=[23,768;21,339;4,525] m. Incremento soprattutto a world Y 2–3,5 km;
nessun nuovo contatto osservato negli strati di bordo, nessuna prova universale
no-clipping, connettività ottica o arte. Le metriche macro non includono tutta
la densità fine deformata lungo il raggio; gli SHA array sono registrati, non
ricalcolati da raw conservati. Verifier da JSON con Decimal, senza nuovo bake.

Entrambi exit 0/reaped: wall 21,431/20,383 s, highwater 1.138.638.848/1.141.800.960 B,
entro CPU 180 s/wall 240 s e nuovo guard 2 GiB autorizzato su 64 GiB RAM. R1 resta
**FAIL RSS 1 GiB** del nostro guard interno; la precedente approach resta
**WRAPPERFAIL** con exit non catturato. Nessun occultamento o sostituzione.
Nessun prodotto, GPU, browser, FPS o qualità ridotta. Nessun fullsource/dist
necessario nel repo: solo script, manifest, due JSON, confronto/CSV e riferimenti.
