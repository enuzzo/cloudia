# Primo trial rain-light hoist — sorgente congelato

Solo `cloudShader.ts` della copia esterna cycle46. Le due dichiarazioni `forwardRain` e `rainLight` vengono rimosse dalla posizione originale e reinserite con espressioni identiche, indentazione di due spazi, prima del loop. La modifica avviene soltanto nella derivazione `rainIntegrationSource`; il template asciutto non cambia. Nessun commento o riga vuota aggiunto al WGSL. Il mix aerial dipendente da t rimane al suo posto. Nessuna firma, binding, texture, campione, passo o formula di integrazione cambia.

Conservati originale e patch. La verifica I/O dell’inversione del solo blocco di derivazione restituisce byte per byte l’intero file originale; il template `integrationSource` è identico nei byte e nello SHA riportato dal freeze. Non sono stati eseguiti factory WGSL, prefix, modelli, test, typecheck, build o GPU. Root possiede il test di inverse relocation, Engine/version e qualifica.

È una rimozione di lavoro ripetuto a livello sorgente, non un risparmio hardware dimostrato: LICM/CSE possono averlo già eliminato; l’allungamento della vita dei registri e il calcolo su raggi senza R positiva possono annullare o invertire il beneficio. Nessuna adozione o previsione FPS.
