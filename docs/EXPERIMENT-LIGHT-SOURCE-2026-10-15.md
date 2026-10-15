# Fase locale e visibilità del cielo: quarto ciclo

15 ottobre 2026. **Entrambe le varianti ritirate dopo la guardia visiva frontale
all'80%. Qualità ravvicinata non raggiunta; goal attivo.** Il materiale e lo
shader finali tornano a `d4c01ac`. Resta una correzione indipendente al rilascio
delle texture non installate quando fallisce l'attesa della coda GPU.

## Confronto comune

Seme 1571198069, tempo nube 60 s, pausa, vento 55%, dispersione/pioggia/lampi 0,
Sole sinistro alto, cielo assestato. Mira `[.4296875,2.9365234375,0]`, raggio
vicino `.6045067691053366` km e avvicinamento 80%; origine in tutti e tre i report
`[.4296875,2.9365234375,1.1639784268955404]`. Macro 256³, dettaglio 128³,
Massima/384, output e interno 1672×941, modalità main, flusso completo.
L'output diagnostico Finestra usa un pixel per CSS pixel, distinto dall'output
nativo DPR della preview ordinaria finale.

| Stato | Immagine | Report 30 s | GPU media, ms | rAF/s |
| --- | --- | --- | ---: | ---: |
| Baseline v31 | [fronte80](measurements/light-source-2026-10-15/baseline-front80.jpg) | [JSON](measurements/light-source-2026-10-15/baseline-front80.json) | 22,4106 | 59,9964 |
| Fase120 v32 | [fronte80](measurements/light-source-2026-10-15/phase120-front80.jpg) | [JSON](measurements/light-source-2026-10-15/phase120-front80.json) | 19,7353 | 59,8643 |
| Cielo5 v33 | [fronte80](measurements/light-source-2026-10-15/sky-five-front80.jpg) | [JSON](measurements/light-source-2026-10-15/sky-five-front80.json) | 20,7663 | 59,9631 |

Una sola misura per stato nell'ordine A/B/C, senza alternanza: questi tempi
**non dimostrano un'accelerazione**. Temperatura, frequenze e carico esterno
non sono isolati. rAF, timestamp GPU e presentazione del compositore sono
misure diverse; non è una nuova qualifica nativa a 60 fps sostenuti.
I report registrano cielo pronto, transizione 1 e camera identica. Le console
candidate acquisite sono vuote: [fase](measurements/light-source-2026-10-15/phase120-console.json),
[cielo](measurements/light-source-2026-10-15/sky-five-console.json).

La guardia non mostra bordi o rilievi sufficientemente leggibili. Le immagini
rimangono percettivamente sfocate; la fase modifica poco i margini, la cache
cielo produce soprattutto oscuramento. Non sono eseguite matrici lato/retro,
sole basso, due qualità, moto, worker o dispositivi fisici per queste varianti.

## Fase locale v32

Si riusano i due HG normalizzati già calcolati fuori dal ciclo:
`H=.82*HG(.68)+.18*HG(-.25)`. La miscela diventa
`P=(1-a)+a*H`, con `a=.55+.30*(1-ice)*exp(-rhoLocal*beta*.12 km)`.
`rhoLocal` include erosione, flusso e massa; esclude soltanto la microerosione
dipendente da camera/zoom. Nessuna nuova texture, nessuna variazione di densità,
estinzione, ambient, multiple, pioggia o paesaggio. Il ghiaccio completo conserva
la miscela precedente. La lunghezza è una stima omogenea locale, non lo spessore
misurato della materia circostante.

La [normalizzazione delle miscele di fase](https://pbr-book.org/3ed-2018/Volume_Scattering/Phase_Functions)
motiva i pesi convessi. [Patry, slide97](https://www.glowybits.com/talks/real-time_samurai_cinema/real-time_samurai_cinema.pdf#page=97)
motiva una risposta diversa fra regioni sottili e dense; lunghezza fissa, pesi
e assenza del suo guadagno2,16 sono scelte nostre. Non si usa l'opacità del
segmento di marcia come proprietà del materiale.

L'[audit matematico](measurements/light-source-2026-10-15/cloudia-phase120-audit.json)
in float64 verifica normalizzazione (errore massimo1,776e−15), positività,
endpoint ghiaccio e integrazione omogenea su passi1,5–48m (scarto2,331e−15).
Un controllo negativo che usa il passo al posto dei120m cambia la radiance
di0,0138807. Non è una verifica numerica WGSL o di un volume eterogeneo reale.
Lo script ricostruisce in memoria i3hunk della patch e verifica gli hash Git
del parent e del candidato; non descrive il sorgente finale come v32.

## Visibilità cielo v33

La variante mantiene la densità originale e cambia soltanto l'ambient:
zenit peso1/4, quattro direzioni cardinali con componente verticale unitaria1/3,
peso3/16 ciascuna. I pesi integrano costante, primo momento verticale1/2 e
secondi momenti1/3 dell'emisfero. Nessun coseno di superficie: lo scattering
volumetrico integra radiance per fase [PBRT, §11.1.4](https://pbr-book.org/3ed-2018/Volume_Scattering/Volume_Scattering_Processes).

La risposta è `sum(w_i*exp(-.35*massFactor*tau_i))`: il fattore.35 conserva
l'ammorbidimento precedente. Non è la sola trasmittanza fisica `exp(-tau)`.
La massa si applica prima della media; tutte le tau uguali recuperano la risposta
verticale precedente. Restano densità statica co-deformata, erosione dinamica
approssimata e limite tau16 della cache. Le quattro tau aggiunte sono RGBA8
256³: **64MiB GPU più64MiB backing CPU**, una lettura extra per campione e
quattro sweep di generazione. Il bake è sequenziale e non conserva quattro
array Float32 intenzionalmente; GC, staging e memoria del driver restano costi
non misurati. I soli payload finali salgono da104 a168MiB per copia CPU/GPU;
questo non certifica il picco RAM.

L'[audit CPU completo](measurements/light-source-2026-10-15/sky-five-potential-cpu.json)
genera una sola nube256³/128³ e confronta gli stessi campioni con quadrature3/6m.
Cinque raggi frontali, prima di atmosfera e tono; nessuna misura dei pixel.

| Avvicinamento | Sorgente media prima → dopo | CV fra cinque raggi prima → dopo |
| --- | ---: | ---: |
| 80% | 0,301495 → 0,274136 | 54,821% → 59,395% |
| 95% | 0,266968 → 0,235284 | 17,461% → 19,278% |
| 100% | 0,258744 → 0,227039 | 5,356% → 5,826% |

Il CV maggiore segue soprattutto la media più bassa: al100% la deviazione
standard assoluta scende da0,013859 a0,013228. L'ambient medio scende del40,2%
e il suo CV da1,525% a1,075%. Diretto e multiple sono identici per costruzione
e verificati nel report. Scarto massimo delle medie candidate fra3/6m:0,180%.
Non emerge maggiore articolazione dell'ambient nelle sonde scelte.
Le [statistiche JPEG](measurements/light-source-2026-10-15/front80-image-statistics.json)
confermano un cambiamento piccolo del contrasto globale nel crop, ma includono
il varco di cielo e RGB codificato: non misurano nitidezza né qualità fotografica.

## Conservazione e stato finale

I [manifesti v32](measurements/light-source-2026-10-15/phase120-candidate-build.json)
e [v33](measurements/light-source-2026-10-15/sky-five-candidate-build.json)
registrano hash di sorgenti e asset allora serviti. Le patch
[v32](experiments/phase120-v32.patch) e [v33](experiments/sky-five-v33.patch)
sono alternative indipendenti contro `d4c01ac`; non applicarle in sequenza né
alla build finale presumendo assenza di conflitti. `git apply --check` passa
per entrambe su copie temporanee dei file parent. v33 include helper, test,
worker e script CPU necessari. Gli originali privati sono preservati; le13
copie di misure sono verificate SHA256 nell'[archivio](measurements/light-source-2026-10-15/archive-manifest.json).
Patch e snapshot parent conservano spazi e terminatori originali, inclusa la
riga vuota finale del parent: escluderli dal controllo whitespace del codice
evita di alterare gli hash usati dalla verifica di provenienza.

L'audit della fase si può ripetere senza riattivare il renderer candidato:

```sh
bun docs/experiments/phase120-audit.ts /private/tmp/phase120.json docs/experiments/phase120-parent.txt docs/experiments/phase120-v32.patch
```

La candidata v33 passa153test/27file e app build prima della guardia; questi
numeri non qualificano il sorgente finale. Dopo il ritiro, v34 conserva soltanto
il rilascio dei pacchetti texture non installati se il drain GPU rigetta, con
quattro prove mock su swap, teardown e drain. Shader, volume e worker tornano
identici al parent. Verifica finale:147test/26file, app build e hero build.
Nessun push, merge o deploy. Nessuna riduzione256³/128³/384/output.

Il prossimo esperimento prioritario è l'ordine di ricostruzione della densità
[già circoscritto](RECONSTRUCTION-OPTIONS-2026-10-15.md), con stesso materiale,
camera e profilo nel controllo. Questa prova non ha ancora dimostrato un
beneficio: la sorgente poco articolata e i limiti geometrici restano distinti.
