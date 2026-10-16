# Pioggia nativa: confronto A/B/A della maschera v46

16 ottobre 2026, ciclo 11. **Beneficio locale confermato in questa sequenza;
60 FPS e gate visivi globali aperti.** La scheda diagnostica bloccata non era
più presente all'inizio del ciclo; rimaneva soltanto la scheda Cloudia usata per
le tre prove. Anche il PID precedentemente osservato non era più presente.
Non attribuiamo la causa della chiusura al proprietario o a un meccanismo preciso.
La precedente richiesta di chiusura manuale non serve più per questa sequenza.

## Stesso carico e due controlli

Controllo A: build del commit `0d0ab21`, renderer v40. Candidata B: build esterno
del commit `adba2c5`, renderer v46. I due asset sono stati verificati contro la
provenienza archiviata prima delle misure. Le correzioni focus successive non
sono presenti in questi build; non modificano lo shader.

Main, seed 72, t = 60 in pausa, forcing/precipitazione 0, vento 55%, dispersione
0, sole da sinistra, scenario Pioggia assestato. Identici camera, target,
bounds, direzione solare e campo terreno. Output e interno **2560×1440**,
**macro 256³, dettaglio 128³, Massima / 384 passi nominali**, flusso completo e
nessuna ablation. Un solo renderer browser attivo; nessun altro bake, replay,
test, build o audit GPU orchestrato durante le finestre temporizzate.

| Prova | Invii/s | Intervalli / durata | p95 | p99 | Chiusura prefisso |
| --- | ---: | ---: | ---: | ---: | ---: |
| A1 originale | 14,9831 | 450 / 30.033,9 ms | 83,4 ms | 85,0 ms | 250,6 ms |
| B v46 | **17,3227** | 520 / 30.018,4 ms | 66,8 ms | 68,2 ms | 243,7 ms |
| A2 originale | 15,7236 | 472 / 30.018,5 ms | 67,9 ms | 68,7 ms | 247,1 ms |

I controlli variano del **4,94%**. B supera A1 del **15,62%** e il controllo più
veloce A2 del **10,17%**; rispetto alla media aritmetica dei due, +12,83%.
Il dato prudente da riportare è il vantaggio su entrambi i controlli, senza
trasformare una sequenza in una garanzia per tutte le pose, seed o macchine.

Tutti i prefissi finali completati: nessun draw misurato rimasto non confermato.
Le frequenze limitate dal completamento sono 14,8582 / 17,1827 / 15,5948 invii/s.
Questa metrica comprende chiusura e notifica JS; non è throughput GPU isolato
o presentazione del compositore. `presentedCanvasFps` rimane null.

## Controlli indipendenti e immagine

Il verificatore ricalcola durata, numero intervalli, frequenza, prefissi e medie
su pass freschi; confronta le impostazioni fra A1/B/A2. Nessuna UID duplicata,
pass ambiguo, slot duplicato o pass invalido. Copertura render completa su
448/450, 518/520 e 471/472 draw; le code timestamp mancanti restano esplicite.
La media della somma dei pass è 130,430 / 113,048 / 124,886 ms: non la invertiamo
in FPS e non la dividiamo per due.

I tre JPEG CSS **1280×720 sono byte-identici** e le console warning/error sono
vuote. È una prova finita del fermo immagine, non del framebuffer nativo o della
continuità in moto. La specializzazione B resta rain/rain per tutta la misura;
le due prove A non contengono la nuova maschera.

**PASS circoscritto:** vantaggio della candidata su entrambe le prove di
controllo in questo stato statico nativo, senza il confondente precedente,
prefissi completati e fermo immagine invariato. **Ancora aperti:** rain in moto,
worker, altri seed/pose, near in contesto nuovo, presentazione, 60 sostenuti e
accettazione artistica. Il precedente +10,52% resta un risultato storico
preliminare e non viene rietichettato come questa misura.

[Report grezzi, immagini e script](measurements/fps-rain-aba-2026-10-16/manifest.json),
[verifica ripetibile](measurements/fps-rain-aba-2026-10-16/verification.json),
[implementazione e limiti del certificato](EXPERIMENT-NARROW-CLOUD-2026-10-16.md).
