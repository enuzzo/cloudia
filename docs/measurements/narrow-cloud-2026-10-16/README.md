# Pacchetto esterno narrow-cloud

Proposta non applicata. Nessun generateVolume, build prodotto, GPU o benchmark.
Leggere DESIGN-PROOF.md e INDEPENDENT-REVIEW.md prima di integrare.

Ripetizione, senza installazioni:

```sh
bun build-narrow.ts
bun count-narrow.ts 16 9
bun count-narrow.ts 32 18
```

I comandi verificano i byte/hash della cache rain-work e i sorgenti modello;
non rigenerano macro, dettaglio o flow e non sovrascrivono i report originali.
La narrow è l'unico array nuovo. Il contatore confronta il percorso completo
con la sequenza baseline già archiviata e riporta un costo semantico netto;
non misura FPS e non è una prova del filtro/compilatore GPU.

- build-narrow.ts / build-result.json / narrow-r8.bin: builder e audit esaustivo.
- count-narrow.ts / work-16x9.json / work-32x18.json: due confronti leggeri.
- cloudShader.before.ts / cloudShader.after.ts / cloudShader.patch: singola patch
  shader esatta, richiede wiring nuova texture da parte del root.
- DESIGN-PROOF.md: coordinate, conservatività, margine f32, costo e gate.
- INDEPENDENT-REVIEW.md: review indipendente dell'agente anatomia.
- manifest.json: SHA256 e precondizioni dei file congelati.

Non applicare questa patch insieme a varianti precedenti ritirate. Il prodotto
resta invariato; il confronto usa l'hash specifico della sorgente before.
