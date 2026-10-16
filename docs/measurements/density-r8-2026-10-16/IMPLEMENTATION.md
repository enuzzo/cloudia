# v47 density R8 — candidata congelata

Base v46 6a7df91. Patch density-r8-v47.patch,9 file sorgente/test congelati
in frozen-source; i6 snapshot preesistenti coincidono byte per byte con la base.
Nessun commit, installazione o modifica UI/lockfile; node_modules2 preservata.

La macro RGBA originale resta intatta. Il worker estrae R in un buffer distinto
una volta per nube e trasferisce5buffer. Solo payload dimensionalmente valido,
Uint8Array e non alias del buffer macro abilita la variante R8. Legacy o payload
non valido usa il template macro originale e lo dichiara nel report.

createCloudIntegrator aggiunge il terzo argomento defaultfalse. I due shader
v46 default conservano gli SHA bloccati. La candidata modifica soltanto la
texture del sample warped, con lo stesso volumeSampler, coordinate e LOD0;
il sample voxel della luce rimane RGBA. La nuova texture usa linear/clamp,
NoColorSpace,noMip,flipYfalse,unpack1. Nessuna nuova allocazione per frame.

I report includono densitySamplingStart/End: percorso,formato,dimensioni,
textureBytes,+CPU/+GPU payload bytes e fallback. RendererVersionv47trial.
I test coprono legacy/invalid,diagnostics,seed swap,destroy,stale iniziale,
stale durante drain,drain respinto e device lost. Il transfer reale con
structuredClone verifica anche detachment sorgenti e integrità dei5buffer.

Verifiche locali:52/5 test mirati,229/34 suite completa,typecheck e app→hero
esterne tutti PASS. Attributo node_modules ignore1 prima/dopo,Git ignored e
zero file tracciati. Log e hash nel build-provenance.json. I comandi Vite
hanno usato soltanto trial-dist/trial-hero,senza emptyOutDir o rm.

Questi esiti non compilano WGSL sulla GPU e non dimostrano parità del sampler,
immagini o vantaggi FPS. La qualifica rawGPU,draw Three reale e A/B/A contro
v46 restano al root secondo QUALIFICATION.md. Il costo nominale aggiunto è
16MiBCPU+16MiBGPU,senza dedurre speedup dal rapporto dei byte per texel.
