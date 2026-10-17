# Pioggia: trial dell'hoist letterale della luce

17 ottobre 2026, ciclo 50. Candidata `experiment-v61-rain-light-hoist-r1` respinta: nessun vantaggio FPS utile. Canonico `observatory-v61-observed-terrain-material` invariato; goal attivo.

Il [rapporto](../../RAIN-LIGHT-HOIST-TRIAL-2026-10-17.md) distingue qualifica del sorgente, parità PNG, finestre attive, primo A invalido e stop. Il criterio del +5% era congelato prima di B; il confronto misura 19,924898 → 19,909961 → 19,946912 invii/s. Non misura presentazione del compositore.

- `source-overlay/`: quattro file candidati, da sovrapporre solo alla base autenticata dai 141 pin; non è la nuova base prodotto.
- `run/`: freeze, protocolli prima dei dati, unica riparazione UI esplicita, launcher CPU con receipt terminali, log grezzi, risultati test e controlli saved-only.
- `browser/`: PNG A completo, DTO A/B e alias B autenticato, parità degli input, quattro rapporti completi di performance (uno invalido e tre validi), ledger dei trasferimenti, confronto finale e preview v61 ripristinata.
- `review/`: sorgenti prima/dopo, patch reversibile, freeze autore, verifiche indipendenti e prossima azione proposta, senza nuovo trial.
- `analysis/verify-saved.py`: sola conservazione dei file e dei verdetti. Non riesegue modello, test, browser o GPU e non converte il FAIL in accettazione.

I chunk intermedi trasferiti via UI restano nella copia esterna `Cloudia-QA-2026-10-17-cycle46`; qui si conservano i PNG/JSON completi e i ledger con gli hash dei chunk, evitando di sincronizzare centinaia di copie intermedie in Dropbox. Nessun `dist`, cache o dipendenza viene archiviato. `MANIFEST.json` autentica ciascun payload per dimensione e SHA256; il suo digest è nel sidecar di integrità esterno al manifest.

Il controllo whitespace segnala soltanto una riga vuota finale già presente nello shader canonico, conservata byte per byte nelle copie before/after e nell'overlay congelato. Questi tre file sono verificati separatamente senza normalizzarli; la patch non contiene trailing whitespace. Il primo README attribuiva erroneamente un'eccezione alle righe di contesto della patch: README e manifest R1 sono conservati, insieme alla correzione documentale R2. Nessun sorgente, criterio o risultato è stato cambiato. Nessun push/deploy; server candidato chiuso, preview canonica 4196 conservata.
