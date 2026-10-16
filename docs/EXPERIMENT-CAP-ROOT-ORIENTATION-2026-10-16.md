# Radice inclinata dell'incudine: candidato ritirato

**Non promosso:** orientare la radice dell'incus cambia soprattutto la calotta
alta e lascia quasi invariati il polso stretto e il becco interno dell'uncino.
Le due coppie frontale/laterale del seed 74 non mostrano un beneficio che
giustifichi la modifica. Il prodotto resta v50, sorgenti di `10493af`.

La prova nasce dalla distinzione fra radice e parte distale dell'incudine.
La [tavola 5 dell'atlante ospitato da WMO](https://cloudatlas.wmo.int/docs/ICA1930-optimized-for-web.pdf#page=63),
effettivamente osservata, mostra un incus spesso con fibre raccordate al
corpo e margini sfrangiati. È un riferimento artistico, non una formula per
la rotazione o una convalida fisica del modello.

Il candidato esterno orienta rigidamente **25 primitive**: primo core ice,
dieci billow e quattordici puff associati semanticamente. Ruota centri e
assi attorno al cap, lungo il vettore testa matura→cap. Torri, Lobe sorgenti,
RNG, incus distale, streaks e parametri della spalla v50 restano invariati.
Il raster conserva l'ordine dell'unione liscia, usando bounds derivati per
il campo negativo fino a −0,35. Non riusa la torre abbassata del trial precedente.

L'[archivio](measurements/cap-root-orientation-2026-10-16/README.md) conserva
i risultati di 20 volumi CPU a 32³/64³, senza duplicare buffer voxel.
72/73 sono byte-identici in tutti i canali; rivalutati 2.037.238 voxel
esclusi dal pre-filtro, zero omissioni registrate. Le 25 primitive sono
selezionate una volta, con geometria sorgente e flussi RNG invariati.
31 test esistenti passati; typecheck r2 e build app passati. Un errore del
tipo della tupla è stato corretto con la sola asserzione `!`: il JS emesso
r1/r2 è byte-identico, come documentato. Un audit separato controlla
ortogonalità/determinante, distanze, volume, bounds e input invalidi.

Il conteggio aritmetico dei box raster a 256³ aumenta del **43,0% / 56,0% /
41,6%** per 74/77/80. Non è stato eseguito un bake CPU a 256³ né misurato
il tempo relativo: è lavoro previsto di preparazione, non un costo FPS.

| Vista 74 | Baseline | Candidato | Giudizio |
|---|---|---|---|
| Frontale | [JPEG](measurements/cap-root-orientation-2026-10-16/browser/baseline-74-front.jpg) | [JPEG](measurements/cap-root-orientation-2026-10-16/browser/candidate-74-front.jpg) | Calotta diversa, raccordo e uncino ancora deboli |
| Laterale circa 88° | [JPEG](measurements/cap-root-orientation-2026-10-16/browser/baseline-74-side.jpg) | [JPEG](measurements/cap-root-orientation-2026-10-16/browser/candidate-74-side.jpg) | Nessun miglioramento convincente della massa dominante |

Stato fissato dalla UI: seed74, t60 in pausa, Sole, vento55%, dispersione0,
approach0, target `[0,2.7,0]`, `profile=1&surface=1`. Output osservato nativo
2560×1440; JPEG CUA 1280×720 CSS. Nessuna prova di identità del framebuffer,
misura FPS, video o accettazione fotografica generale. Baseline77/80 erano
state preparate, ma il candidato non è stato qualificato su quelle viste.

Il risultato negativo suggerisce di attribuire i pixel dell'uncino alle
primitive effettive prima di un'altra trasformazione. Il fatto che il centro
della testa entri nel cap orientato non dimostra di avere corretto la massa
che produce quel difetto nell'immagine.
