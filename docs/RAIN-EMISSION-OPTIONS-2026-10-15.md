# Emissione della pioggia durante la dispersione

15 ottobre 2026. **PROPOSTA NON IMPLEMENTATA. Nessuna prova visiva** della
variante, nessuna nuova cache. La priorità successiva è il solver di occlusione
del terreno e il costo della pioggia a risoluzione nativa.

La mappa sorgente resta statica mentre la dispersione assottiglia la nube.
Nel [ramo pioggia](../src/cumulonimbus/cloudShader.ts), forza e sopravvivenza
non dipendono da `massFactor=(1−0.9*forcing.x)^1.3`: a dispersione massima
questo fattore della nube scende a circa 0,0501, senza ridurre la cortina.
È una disconnessione del modello, non la prova che la pioggia debba cessare
immediatamente: materiale già cadente può persistere.

## Ipotesi minima da valutare

```text
e = massFactor corrente
R_next = e + (R−e)*exp(−dt/τ)
descent = max(0, baseWorld−worldY)
supply = mix(e, R, smoothstep(0,H,descent))
rainDensity *= supply
```

`e` è un proxy globale di emissione, non acqua precipitabile misurata.
Il reservoir scalare `R` conserva memoria della dispersione: vicino alla base
conta maggiormente l'emissione attuale; più in basso persiste il valore ritardato.
**τ e H restano da fissare**, con unità esplicite di secondi e chilometri.
Il profilo di evaporazione già qualificato rimarrebbe invariato.

Inizializzare `R=e` al nuovo volume/reset e alla prima attivazione della pioggia;
durante uno stato asciutto mantenere `R=e`, evitando una riserva invisibile
prima dell'accensione. Il controllo intensità conserva il comportamento attuale.

`dt` userebbe il delta della forzante già esistente, nullo in pausa.
**L'ipotesi di clock errato è stata falsificata:** `forcingTime` resta fermo
in pausa; è `weatherTime` ad avanzare. La transizione dell'intensità continua
correttamente sul tempo reale, separata dal moto. Nessun nuovo clock proposto.

Costo atteso: un float e un flag CPU, un'uniforme scalare, un'esponenziale
CPU per aggiornamento e poche ALU per campione; nessuna texture/bake aggiunta.
Non è una misura GPU. Con valori limitati a [0,1] il supporto rimane conservativo.

È memoria empirica, senza fronte causale, conservazione dell'acqua, vento
storico o colonne indipendenti. Non dedurre velocità di gocce dalla fase delle
streak. Prima di implementare servono evidenza visiva del problema e un
controllo che preservi la precipitazione già cadente durante la dispersione.
