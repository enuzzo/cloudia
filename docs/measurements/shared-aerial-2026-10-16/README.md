# Shared aerial, trial ritirato

Archivio curato del solo ciclo15 a partire da 10493af. Il guadagno FPS iniziale non si riproduce: B2 rientra fra A2 e A3. Nessuna modifica del trial promossa nel prodotto.

- measurements/: cinque raw JSON gzip lossless, provenienza e statistiche compatte.
- browser/: cinque JPEG e metadata originali, due console catturate e confronto qualificato del root.
- source-changes/: i soli cinque file candidati cambiati e i quattro corrispondenti baseline, gzip lossless, manifest sorgenti/build e log di test/typecheck/build. Nessun dist o intero clone.
- gpu/: package autonomo curato dal near agent: app originale in tar.gz lossless, estraibile fuori dal repository, input, sorgenti, 216 record e verifier; manifest interno e provenienza separati. Include i 24 witness dei template.
- verify.py: integrità dei file, gzip, invarianti delle cinque misure e confronto dei record GPU catturati; non esegue GPU/browser/render/bake.

La proposta di test portabile non eseguita è irrilevante dopo il ritiro, quindi è omessa. Il test esterno qualificato dipende intenzionalmente dal clone baseline; i 40 PASS non riguardano una suite già trasferita nel prodotto.

Limiti e verdetto completi: ../../EXPERIMENT-SHARED-AERIAL-2026-10-16.md.
