# Witness meshR2 — review statica prima del freeze finale

17 ottobre2026. **PASS statico limitato sui file sotto identificati**, in attesa della sourceR2 congelata e del pre-run finale. Nessun programma eseguito, modello, test, build oGPU. Nessuna modifica ai programmi.

Gate coerenti: A autentica i6buffer storici e tutto lo streamF64; B confronta byte-esatti gli errori nearfit/holdout r<=I. Solo il farholdout r>J viene confrontato con lo scalare125m (tolleranza1e−9metri); nessuna falsa equivalenza al farfit o agli errori delle due fasce seam. Tutti gli errori rimangono nello streamlossless. Fit/holdout landRMS e p99/maxglobali saranno analizzati separatamente primaGPU; questo programma non dichiara artPASS.

Entrambi i fingerprintXYZ+surface pertriangolo inner/outer e le query congelate vengono confrontati A/B nel launcher, non soltanto emessi. Il controllo manifold usa ogni edge indicizzato, orientazione opposta, sole1024edge esterne aperte, tutti i vertici usati, windingpositivo ed Euler1; la codifica edge2*(min*V+max)+orient resta intera esatta entro1MV. Non certifica da sola la correttezza di ogni query: per questo c’è l’oracle completo indipendente sui32punti seam.

Incoerenza iniziale segnalata e corretta da root PRIMAfreeze: l’AABB broadphase indipendente usava1e−9km, meno dell’halo di acceptance baricentrica−1e−7. Ora ogni asse usa2e−7*span+1e−10km, conservativo per i pesi consentiti, e l’acceptance rimane invariata. Freeze.py genera32punti unici deterministici:2midstrip,4lati, t=−1/−.37/0/.37/1, con i4corner duplicati peranello rimossi. Nessuna ricerca postrisultato. Corner e doppie cuciture restano da esercitare anche con fixture/runtime reali.

Launcher: due child sequenziali20CPU/30wall/1,5GiB RSSterminale Darwin perPID, wait4 e killgruppo sewall, nessunAS/ps/retry. AFAIL impedisceB. Input/ignore1 controllati prima/dopo. Payloadtemporanei/topology possono costare memoria: il gate terminale reale deve decidere, non il bound nominale della sola geometria.

Digest file esaminati:
- `witness.ts` `597dfa5e9251911ccef4734aa88779f03b434c9f4d52f024d545f15709900f75`
- `run.py` `42bb3371ab6a94935105a7e0fb2a062fea128311c84730f1cc7c057e48660b9b`
- `freeze.py` `6bb64ce4158911a7d50e3193337686185cb5eeaf45c43daf18aa73480662df36`
- `PROTOCOL-DRAFT.md` `39be6bda8628bde74f72aa702f00ad2c9fb956f39fc1f6dac27321ab19258426`
