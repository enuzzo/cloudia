# Spalla alimentata sotto l'incudine — verifica locale

Il generatore sheared lasciava un vuoto tra il corpo superiore della cella matura e la sorgente dell'incudine. Le sezioni CPU dei seed 74, 77 e 80, individuate sul baseline reale `08c33cb`, risultano prive di densità dopo erosione anche a 256³. I collar esistenti partono dalla testa e non attraversano questa regione inferiore.

Il candidato aggiunge una sola massa ellissoidale inclinata, dal corpo superiore alla sorgente dell'incudine. Forma e dimensioni dipendono dall'anatomia contratta della cella; masse, decorazioni e sequenze casuali originali sono conservate. Il campo ruotato resta 1-Lipschitz ed entra nella medesima densità usata per luce e occupazione. Restano 256³ macro, 128³ dettaglio, 384 passi nominali, output pieno e tutti i coefficienti di luce, materiale ed erosione.

I 31 test mirati passano. La nuova regressione richiede soltanto presenza di densità fine nella sezione prima vuota del seed 74: non introduce una soglia artistica. A 256³, gli hash di densità, RGBA, tramonto e dettaglio dei seed 72 e 73 coincidono con il baseline. Sono stati rivalutati 140.692.504 campioni esclusi dal prefilter, considerando entrambe le versioni: nessuna densità persa. Tutti e sei i margini dalle facce restano invariati. L'opacità integrata Z delle tre sezioni passa da zero a 13,816658 / 11,575198 / 8,971558.

Le viste browser finora esaminate mostrano un sostegno locale più continuo sotto la calotta, senza la nuova parete cilindrica osservata nei precedenti tentativi. Il nucleo diventa più spesso e rotondo; la sagoma globale a uncino/U rimane. I confronti al tramonto non hanno una coppia baseline completa, quindi non provano un miglioramento comparativo della luce. Nessun PASS fotografico generale viene assegnato: il root sta completando la qualificazione browser e decide l'eventuale promozione locale.

Sorgenti, risultati CPU, snapshot dei test e replay sono contenuti nel pacchetto di revisione. Le prove numeriche, le immagini browser, i risultati FPS e i gate artistici restano dichiarati separatamente.
