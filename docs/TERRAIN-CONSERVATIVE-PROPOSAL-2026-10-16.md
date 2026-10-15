# Terreno originale: proposta di intersezioni conservative

16 ottobre 2026. Analisi CPU e proposta; nessun nuovo solver nel prodotto.

L'[audit precedente](TERRAIN-INTERSECTION-AUDIT-2026-10-15.md) documenta
l'oscillazione delle sei iterazioni attuali e l'esclusione dei raggi che mancano
la sfera del mare. La nuova sonda aggiunge un caso costruito dalle formule di
framing correnti: target `[0,-3,0]`, yaw π/2, pitch 0, approach 0, inspection 0,
aspect 16/9 e UV `[0.5,0.42]`. Origine `[16,-3,≈0]`, direzione `[-1,0,≈0]`:
nessun hit mare, ma attraversamento del terreno nel bracket diagnostico CPU
`[22.1651363075,22.1660201201]` km. È una costruzione matematica, non una posa
già verificata nel browser o sulla GPU.

Il prototipo basato soltanto su un limite globale richiede da 129 a 1.788
valutazioni originali di altezza sui 14 raggi diagnostici. Non è una candidata
da trasferire direttamente nel pixel shader. Anche una bisezione da sola non
risolve il problema: due estremi esterni possono racchiudere due attraversamenti,
e il primo intervallo con segno opposto può non contenere il primo hit.

La [proposta completa](measurements/terrain-interval-proposal-2026-10-16/PROPOSAL.md)
usa una gerarchia di minimi/massimi analitici del campo originale come metadata
di ingombro. Non sostituisce `terrainHeight` con una superficie campionata.
Visita gli intervalli in ordine, certifica quelli vuoti e raffina il primo
attraversamento fino a un enclosure di 1 m lungo il raggio, con un punto
successivo non positivo che ne testimonia l'esistenza. Il fade sui raggi con
hit mare resta quello attuale; l'estensione ai raggi senza hit richiede una
definizione esplicita e separata.

**Prossima implementazione da qualificare:** builder analitico lazy sui soli tile
visitati dalla piccola matrice, poi gerarchia completa soltanto dopo la sua
verifica. Il budget proposto di 128 nodi / 16 valutazioni per passaggio e la
continuazione selettiva dei pixel irrisolti non sono ancora misurati. Un budget
esaurito, una tangente o una classificazione numerica incerta devono restare
`unresolved`; non diventano automaticamente `miss` o un hit del vecchio solver.

Il cost probe applica limiti matematici al riferimento CPU f32: non è un
certificato GPU. Le differenze delle builtin WGSL, il dominio di accuratezza
della costa e la sfera richiedono propagazione degli errori verso l'esterno e
controlli GPU indipendenti. La proposta conserva il campo e rende più larghi i
limiti dove non può giustificare una stima stretta. Non importa una riduzione
degli argomenti di `sin` dichiarandola una superficie identica.

[Script, risultati e manifest](measurements/terrain-interval-proposal-2026-10-16/manifest.json)
sono archiviati con hash verificati. Nessun volume generato, nessuna GPU o
accettazione visiva, nessuna promozione nel renderer. Restano necessarie prove
dei limiti analitici, intersezioni CPU/GPU, silhouette sopra l'orizzonte,
occlusione nube/pioggia, main/worker e costo a piena risoluzione.
