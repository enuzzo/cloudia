# R8 nella pioggia: archivio durevole

Sorgenti e patch v47/v48, prove main/worker, confronti A/B/A, audit GPU e
provenienza dei build. Gli asset compilati e i grandi input ricostruibili
rimangono esterni. I manifest includono i loro hash; nessuna dipendenza è copiata.

I report JSON grandi sono gzip deterministici che conservano tutti i byte
originali. `compression.json` registra dimensione e SHA sia originali sia
compressi. Gli originali esterni sono conservati. I due verificatori sotto
hanno soltanto un adattatore di lettura gzip rispetto agli script esterni;
calcolano gli SHA sui byte originali decompressi. Nessuna misura è rilanciata.

Dal checkout, con Python e Pillow già disponibili:

```
python3 docs/measurements/density-r8-2026-10-16/measurements/verify.py docs/measurements/density-r8-2026-10-16/measurements/near
python3 docs/measurements/density-r8-2026-10-16/measurements/verify.py docs/measurements/density-r8-2026-10-16/measurements/rain
python3 docs/measurements/density-r8-2026-10-16/v48-browser/verify.py
```

`gpu-audit/README.md` distingue il controllo SHA delle copie dalla verifica
indipendente dei readback. L'audit non richiede una nuova GPU per ricontrollare
i risultati esportati. La ricostruzione degli input esclusi va fatta fuori
da Dropbox, conservando gli SHA prescritti.

`frozen-source` è v47, `v48-source` è la versione finale. Le prove v47 A/B/A
qualificano il guadagno causale locale; le prove v48 qualificano i percorsi e
il completamento dei prefissi. La presentazione e l'accettazione artistica
rimangono aperte. I primi due tentativi near non assestati sono esplicitamente
separati in `preliminary-unsettled-start` e non entrano nella conclusione.
