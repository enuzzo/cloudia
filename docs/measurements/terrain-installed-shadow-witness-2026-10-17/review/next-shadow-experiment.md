# Prossimo esperimento — contributo causale dell'ombra diretta

17ottobre2026. **Una sola proposta, non implementata né eseguita.** Sola lettura dei due JSON receiver e del materiale v59; nessun modello/raggio/test/build/GPU/browser o sorgente modificata.

🌟 **Counterfactual minimo:** nello stesso pipeline diagnostico, con un unico uniform, sostituire soltanto `solarVisibility` fornita al materiale con **1.0**. Catturare dal target RGBA32F esistente gli stessi12pixel prima e durante l'override, poi ripristinare il normale draw prima dell'await come nel probe appena qualificato. Geometria, camera, Sole, normali, rough, albedo/WorldCover, mip/derivate, ambient, acqua e cache ombre restano identici. Nessun nuovo bias, PCF, fonte luce o target fullsize.

## Perché è il test giusto ora

Gli indirizzi del fragment sono confermati12/12 e i segni coincidono con R32F; q differisce dal riferimento CPU al massimo0.029281m. Solo L1-artifact riceve visibility0; L1-control e tutti i punti L2/L3 ricevono1. Quindi una differenza RGB fra due punti non basta a chiamarla errore di ombra. L2-artifact è perfino più luminoso del suo control nel target lineare attuale: gli ID sono storici, non etichette del nuovo errore.

Il codice offre una separazione pulita: `terrainSurface.ts:190–197` calcola normale finale con rough, diffuse=max(0,dot(n,sun)), poi moltiplica per visibility **soltanto** `albedo*solar*.90*diffuse`. Ambient e inlandWater restano separati; sea/coast blend (`:198–203`) può annullare o ridurre il contributo diretto. `GPUSceneEngine.ts:316–333` inoltra la visibility al medesimo shade. Il test non richiede sapere o ricostruire Nshade: la lascia operare davvero nel fragment.

## Misura e falsificatore

Registrare per pixel RGB_live, RGB_forcedLit e **Δ=forcedLit−live**, prima di aerial/cloud/film; mantenere alpha=distanza originale e salvare i bit Float32. Una sola modalità di override nello stesso pipeline evita di confrontare shader separati. La versione mode0 va prima verificata contro il nativo v59; l'override deve stare a monte del solo argomento visibility, senza spostare textureSample/derivate del materiale in un altro ramo.

| Punto/i già fissati | Previsione falsificabile |
|---|---|
| L1-artifact (V0) | Δpositivo dimostra che l'ombra diretta contribuisce al suo RGB; Δ0 significa che qui diffuse/materiale non produce contributo diretto osservabile, quindi V0 non spiega quel colore scuro. |
| L1-control; L2/L3; altri controlli (V1) | Δ0 atteso, essendo già1 lo stesso input. Una variazione richiede invalidare/ispezionare il confronto, non cambiare bias o chiamarla beneficio fisico. |

Per ogni coppia Lk salvare il contrasto RGB signed `Dlive=C_artifact−C_control` e `Dlit=C1_artifact−C1_control`. `Dlit−Dlive=Δartifact−Δcontrol` quantifica la parte del contrasto rimossa dall'ombra, senza soglia adattiva. Il contrasto che resta con V1 dipende dal gruppo normali/rough/materiale/ambient/acqua: questo test **non** distingue ulteriormente quelle sottocause. Neppure Δpositivo attribuisce automaticamente tutta la macchia o la sua forma all'ombra.

## Scope operativo proposto

Riutilizzare il BBOX fisso dei12punti (1.049.267pixel), un draw forcedLit e un draw ordinario di ripristino;24read1×1RGBA, nessun nuovo raggio, readR32F o fulltarget. Cache shadow submissions/epoch invariati, stessa distanza alpha, fingerprint input stabile e normale bitmap prima/dopo identico sono guardie del confronto. Qualsiasi errore/lettura pendente segue il drain e cleanup esistenti. Salvare i raw, senza normalizzare differenze o scegliere altri pixel. Gli elapsed non diventano FPS.

Questi12punti non certificano l'intera area visibile L1/L2/L3: solo un eventuale confronto nativo counterfactual successivo potrebbe attribuire la forma completa delle macchie. Non modificare il caster per correggere un contrasto che resta invariato in questo test.

Input letti (nessun nuovo rendering):
- `browser/receiver-fragments.json`, 17324B, SHA256 `7a9f5b7b0a09dedd366049db1cd94b28bc89493d7ee0441c4abfbee7dd239436`.
- `browser/receiver-analysis-summary.json`, 9164B, SHA256 `4a5597d0a2c5689ebe4715888524cc0ddd239703bafffad932cb42108d19ba39`.
