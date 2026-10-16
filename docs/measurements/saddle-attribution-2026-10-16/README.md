# Attribuzione baseline della sella, 16 ottobre 2026

Cinque posizioni già salvate dello stesso raggio, nessun candidato. Il supporto macro appartiene soprattutto al core comune 16, distinto dal rigonfiamento91 che produce il becco. Il risultato riguarda soltanto quei cinque punti: nessuna causa globale della U, ricostruzioneRGB o approvazione artistica.

`original-minimal.tar.gz` conserva 15 membri originali senza modifiche: nuovi raw/report/protocollo/script/manifest e i due input nuovi. Altri 16 input identici sono riusati byte per byte dal pacchetto body-bulge. Insieme ricostruiscono tutti i 30 payload originali e il loro manifest; nessun originale viene sostituito da un riassunto.

La dipendenza necessaria è:

```text
../body-bulge-orientation-2026-10-16/original-preflight.tar.gz
SHA-256 f4c39be94a349fdbf976a255242f2e5913b2dd9ea822f994e9dccb12eeb6d791
```

È un percorso relativo fra cartelle di `docs/measurements`, non un requisito di accesso a `/Users/enuzzo/Documents`. Per spostare la verifica, conservare questa cartella e quel file nella stessa relazione. `provenance.json` mappa ogni input condiviso al membro del tar e al digest esatto. L'archivio nuovo pesa 154.740 byte; non duplica layout/modulo/sorgenti già conservati.

```sh
python3 docs/measurements/saddle-attribution-2026-10-16/verify.py
```

Solo Python3 standard, nessuna rete/dipendenza eseguibile. Il verificatore legge i tar senza estrazione e controlla:

- tutti gli originali e le dipendenze per hash/dimensione;
- cinque densità/sigma/rawR8 filtrate/ice uguali alla vecchia baseline;
- 40 byte R8 discreti nuovi, identici fra prima fase e trace, non contro byte precedenti mai archiviati;
- field Float32 e prefissi tramite aritmetica dei passi salvati, senza rivalutare un solo SDF;
- carving/decodeR8, filtro trilineare, erosione fine e densità risultante;
- gruppo/parent e pesi del core comune 94,70–99,21%.

Il record continuo riguarda il field dei corner e i suoi passaggi prima della quantizzazione, non una nuova query continua fuori dai corner. I punti sorgente non sono nuovi pixel fuori immagine. La verifica non esegue JS, RNG, generatore, volume, bake, shader, luce o GPU. Il documento principale viene verificato se presente nella struttura del repository.
