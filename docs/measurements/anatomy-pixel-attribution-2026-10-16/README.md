# Attribuzione locale del becco, 16 ottobre 2026

**Diagnosi CPU conclusa; nessuna variante applicata o preparata.** I tre
raggi della baseline74 individuano la massa che produce il becco interno.
Il risultato spiega perché ruotare il cap alto non correggeva quel punto.

| Punto | Contributor del field ai campioni τ1 / τ3 |
|---|---|
| Becco interno | Core5, rigonfiamento laterale maturo:94,52% /100%; i restanti contributor aτ1 sono suoi billow |
| Polso | Spalla inclinata v50:76,13% /90,07%, oltre a testa/collo maturi |
| Spalla esterna | Core15, massa laterale preesistente:98,14% /100% |

I pesi derivano dalla catena delle unioni lisce e dagli otto corner della
macro interpolata; non sono percentuali additive di massa o RGB.
L'ablazione locale del gruppo core5+90 decorazioni azzera i soli due
campioni del becco e conserva sostanzialmente gli altri quattro. Non è
una prova che rimuoverlo migliori la fotografia: aprirebbe ancora la U.

Il gruppo rivolto alla cella giovane è j0 nel74, j1 nei77/80. Gli indici
servono alla diagnosi; una futura selezione deve usare parent semantico e
relazione geometrica. Il rientro proposto rimane **ineseguito e scartato
tecnicamente**, senza richiesta di approvazione pendente. Il prossimo
intervento dovrà valutare insieme alimentazione del corpo e vuoto della U.

Scope: tre raggi, sei stencil finali e sei controfattuali alle stesse
coordinate;465 campioni,1.636 texel macro su16.777.216 calcolati su richiesta.
256³/128³/16³ sono le griglie ricostruite localmente, non nuovi volumi interi.
La camera e il box sono ricavati dal sorgente10493 e dai precedenti raw
nativi v50. Arithmetic CPU binary64 con field Float32 e flow half filtrato:
non è un readback GPU, ricostruzione RGB o prova dell'intera fotografia.

`original-audit.tar.gz` conserva byte per byte i28 payload e il manifest
originale: relazione, decisione, JSON, codice, sorgenti congelati, immagine
e tabella HTML. Il JPEG originale CSS1280×720 resta invariato; la tabella
non contiene una sua versione annotata. Nessun clone completo o dist.

```sh
python3 docs/measurements/anatomy-pixel-attribution-2026-10-16/verify.py
```

Il verificatore legge il tar senza estrarre e controlla tutti gli hash,
dimensioni e membri. Non ripete calcoli, bake, test o rendering. Per leggere
`REPORT.md`/`pixel-map.html`, estrarre una copia verificata fuori dal checkout;
lo script di riproduzione storico richiede le dipendenze locali indicate.
