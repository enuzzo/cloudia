# Witness delle dodici UV sulla geometria già installata

Proposta esterna preparata il17ottobre2026, **NON eseguita**. Nessun Bun/test/typecheck/build/browser/GPU, DEM o mesh generata; nessuna sorgente prodotto modificata. Il root integra il helper in GPUSceneEngine, non in terrainMesh, evitando il ciclo di import.

API: `auditTerrainShadowWitness(geometry,frame,sun,width,height,points)`. `TERRAIN_SHADOW_WITNESS_POINTS` esporta le dodici UV top-origin ricavate dalle pixelCentre archiviate /[2474,1844]. Ingresso con set/ordine/UV diverso viene rifiutato. PixelCentre originali conservate nel report; gli ID storici non classificano la nuova mesh o il materiale. Nessun vecchio RGB, faceID, risultato6+6 o esito v58 viene riutilizzato.

R2 richiesta dal root prima della qualifica: cap espliciti700000vertici/1300000triangoli, BufferAttributeXYZFloat32 e indiceUint32, più hit.normal quando fornita da Three. R1 non eseguita preservata byte-identica in preparation/r1; nessun risultato viene riassegnato alla revisione nuova.

Vincoli input:12punti, output positivo intero entro il cap8388608pixel dell'export; geometria indicizzata entro i cap, drawRange completo/groupsnone, boundingBox e boundingSphere esistenti finite. La sphere serve perché Three Mesh.raycast altrimenti la calcolerebbe mutando la geometria condivisa. L'owner TerrainMesh crea già entrambe. Nessuna scansione/copia/hash dei buffer originali e nessun aggiornamento normali/bounds.

Ogni punto ha massimo3raggi: ricevitore FrontSide con configureTerrainCamera e basis/scalar fround; caster FrontSide al centro del texel della lookup radiale corrente; raggio fisico DoubleSide dal ricevitore+1cm verso Sole per20km. Il caster usa il vincitore RAW, derivata affine per texel e `terrainShadowCasterMinimum` originale: nessun nuovo clipping, filtro, bias o algoritmo correttivo. Coordinate XYUV, sensi q e light frame sono quelli degli helper attuali. Miss/out-of-map/camera clipping non sicuro sono record espliciti, senza replacement.

Proxy Mesh con la geometry originale e world identity. Crea un solo piccolo MeshBasicNodeMaterial, cambia side solo su quello e lo dispone in finally anche con errore o budget; non dispone o muta la geometry o i suoi attributi. Geometria/camera/light appartengono al riferimento CPU, non al vecchio snapshot costruito da DEM.

Massimo36Raycaster call. Snapshot40s wall cooperativo, controllato prima di ogni raggio; un singolo intersect sincrono non è preemptibile e può sforare. In quel caso report parziale con fase/tempi/numero raggi, senza retry o punti nuovi. Misura soltanto performance.now browser elapsed, non CPUusage/RSS/GPUtime. JSONASCII<128KiB. Per hit si salvano indice faccia, tre indici/vertici, punto e normale geometrica; caster include UVQ dei corner, qmin e margine. Hit extra limitati; conteggi integrali rimangono.

Classificazione fisica UNOCCLUDED_ENTIRE_MESH solo senza blocker e con estremo positivoY del raggio sopra il massimoY dell'intera mesh; altrimenti NO_BLOCKER_WITHIN_20KM_ONLY. Le facce proprie e i contatti con vertici condivisi entro1cm sono esclusi come nel witness originale.

Limiti: Float64 Three+fround input non è parità raster/filter/f32/reversedZGPU; un winner centrale può differire per coverage/tie. La normale geometrica non è normale shading interpolata+rough: NdotSun non predice RGB. Quando presente, hit.normal viene salvata separatamente con dotSun grezzo e lunghezza: è l'interpolazione barycentrica CPU di Three, orientata contro il raggio da Three, non necessariamente unitaria e non normalWorld+rough finale. I termini ambient/water/sea possono non usare ombra diretta. Una still invariata non prova visibility1. Questi12punti non certificano acne globale, luce fisica continua, qualità artistica o FPS.

Integrazione readback: baselineLookup.pixel è opzionale per lookup fuori mappa; prima di destruct/join controllare pixel, non soltanto la presenza di baselineLookup. Miss/clipping/budget restano record espliciti; nessun punto sostitutivo.

Tre test analitici piccoli scritti, **NON eseguiti**: piano orizzontale non schermato con36raggi e ownership; input/UV/bounds failclosed senza mutation; budget cooperativo fra raggi e cleanup. Nessuna installazione o dipendenza nuova.
