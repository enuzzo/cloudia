# Candidata UI: contrasto locale stabile

## Decisione

Propongo due fondi carbone compatti, uno dietro il marchio e il sottotitolo e uno dietro l'aiuto in basso. Il materiale `#202a2deb` riprende quello dei controlli esistenti. I fondi sono pseudo-elementi limitati al rettangolo del testo con un piccolo margine; non occupano tutta la fascia superiore o inferiore. Nessuna lettura della GPU, animazione, sfocatura, nuovo controllo o condizione su meteo e distanza.

Il testo conserva dimensioni, font, peso, colore e coordinate. Le vecchie ombre vengono eliminate. L'isolamento CSS mantiene il fondo sotto i glifi e sopra il canvas; i due blocchi restano `pointer-events:none`, quindi i fondi non intercettano trascinamento e rotella. Non serve modificare `sceneMarkup.ts`.

## Evidenza letta

Ho ispezionato direttamente i tre JPEG `sun-approach-0.jpg`, `sun-approach-70.jpg`, `sun-approach-100.jpg`. A 0 il sottotitolo ha già poco margine sul cielo; a 70 lo sfondo sotto i singoli glifi varia molto; a 100 marchio, sottotitolo e aiuto si confondono con il bianco della nube. Le superfici carbone dei controlli restano leggibili nei tre casi. Non ho eseguito browser o GPU e non ho modificato le immagini.

## Limite matematico

Con testo `#eeeee7`, sfondo `#202a2deb` e scena bianca pura, il rapporto nominale vale 9,895:1 per composizione dei canali sRGB. Anche calcolando la composizione in luce lineare, come alternativa conservativa, vale 6,077:1. Il bianco puro massimizza ogni canale del fondo, quindi una scena più scura non riduce questi rapporti nel modello dichiarato. I numeri e il metodo sono in `contrast-bound.json`. Il limite vale per il colore pieno dei glifi entro il fondo, non per ogni pixel antialias della fotografia e non certifica tutta l'interfaccia.

La [spiegazione W3C di SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) indica 4,5:1 per testo normale e 3:1 per testo grande. Il marchio ha un'esenzione formale, ma visivamente deve restare riconoscibile. I caratteri sottili richiedono comunque giudizio visivo. La [tecnica G145](https://www.w3.org/WAI/WCAG22/Techniques/general/G145) ammette di trattare localmente il fondo dietro al testo; qui uso un supporto uniforme senza dipendere dal contenuto della scena.

## Giudizio critico e verifica necessaria

Questa soluzione rinuncia al marchio completamente sospeso sul cielo e aggiunge un piccolo rettangolo visibile anche nel panorama. E' il costo esplicito della leggibilità costante. Ho evitato una vignetta ampia perché oscurerebbe più nube e una semplice ombra perché il testo piccolo rimarrebbe dipendente dal fondo. L'opacità è volutamente alta: abbassarla fino a rendere il supporto impercettibile richiede di riqualificare il margine di contrasto.

La candidata non è un PASS artistico. Root deve verificare in browser le stesse tre pose, una scena scura, i controlli aperti, il viewport mobile e quello basso già previsto dal CSS. In particolare: il marchio non deve sembrare un pulsante; i fondi devono restare aderenti ai testi e non toccare il bordo; il rettangolo superiore non deve competere con il cielo. Se la prima prova appare troppo massiccia, ridurre prima i margini del fondo, non la sua opacità né le dimensioni del testo. Nei viewport bassi l'aiuto continua a essere nascosto dalla regola esistente.

## Applicazione e recupero

`scene-contrast.patch` contiene soltanto due sostituzioni e due regole aggiunte in `src/cumulonimbus/scene.css`; `scene.before.css` e `scene.after.css` sono copie complete. Applicare solo se il CSS prodotto coincide ancora con `scene.before.css`, oppure adattare le quattro regole preservando eventuali modifiche concorrenti. I file di prodotto non sono stati toccati da questo agente. `sceneMarkup.reference.ts` serve solo a riprodurre la lettura del markup. Gli hash sono in `manifest.json`.
