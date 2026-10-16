# Diagnostica esterna r2

Congelare prima dei bake. `python3 run.py --preflight` verifica solo manifest/input/snapshot122/xattr dipendenze e libproc del proprio PID: nessun modulo volume viene eseguito. Il comando autorizzato separatamente è `python3 run.py --execute --output-dir ../interior05-diagnostic-results-r2`.

A poiB in due processi Bun separati. Per variante: RSS2GiB monitorato ogni~.25s da libproc sul solo figlio Popen; limiteCPU180s di kernel; wall240s. Heartbeat15s. Popen.poll/wait conserva stato terminale ed exitcode. Niente ps, retry, concorrenza fra volumi o qualità ridotta. Il piccoRSS terminale getrusage di tutti i figli è un bound superiore conservativo per ciascuna variante; su Darwin è espresso in byte. Un superamento termina la qualifica anche se sfuggito tra campioni.

Esegue generateVolume reale256/128 e importa i moduli reali congelati. Traccia13UV e soltanto il centro ripetuto.5m. Usa microinspection.6,screenY−.064,flow16³half filtrato,occupancyalpha e bbox resa; non inventa un render RGB. Una comune scatola globale BOUNDS+drift±[1.3,0,.65] include le AABB A∪B. Verifica bound terreno con DEM reale+costante authored3.31km e slackf32 esplicito1cm; se non prova l'assenza di occlusione lo dichiara. Non ricostruisce terrainRasterGPU.

Scrive digest di buffer, piccoli stencilR8 sui punti primo materiale/τ1/media pesata e statistiche13raggi. Nessun buffer enorme salvato. L'output va in una cartella nuova esterna, senza modificare il pacchetto sorgente congelato. La misura è CPUFloat64 a1m midpoint; non replica jitter,marcia adattiva o shaderf32 bitexact. La variante resta non adottata anche se questa misura termina correttamente.

R1 è conservata come preparazione NON ESEGUITA: review Solar ha trovato il solo halo engine mancante. R2 corregge soltanto i due box; nessuna nuova formula di densità/ottica.
