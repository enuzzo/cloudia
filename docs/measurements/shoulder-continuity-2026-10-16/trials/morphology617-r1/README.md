# Seed617 full-quality A/B — R1 terminale

**FAIL del guard interno RSS, nessun confronto di densità disponibile.**
A baseline 256³/detail128³ seed 617 è stato terminato dal monitor a 20,474 s:
resident massimo osservato 1.096.548.352 byte (1045,75 MiB), sopra il guard 1 GiB.
Questo cap era una scelta interna dell'audit, non un requisito del prodotto.
Il figlio Bun ha exit −15 ed è stato atteso/reaped; nessun processo orfano.
Nessun JSON finale A esiste; B non è stato avviato. Nessun riavvio.

Protocollo, script identici per i due lati, sorgenti dichiarati, SHA e patch
read-only erano congelati prima dell'avvio. La failure non è un giudizio
sull'anatomia R3, sul prodotto, sulla connettività, sul clipping o sull'arte.
Tutta la risoluzione richiesta 256/128 è rimasta invariata. Non usare il vecchio
preflight R3 come sostituto di questo confronto non completato.

`TERMINAL-R1.json` registra lo stato definitivo; `FAILURE-A.json` conserva lo
stato intermedio di notifica precedente allo stop del root. Un eventuale R2
richiede un protocollo distinto dopo verifica autorevole del margine hardware;
nessun rerun o aumento del limite è autorizzato da questi file.
