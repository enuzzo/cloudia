# Witness allocation revision — limited static PASS

No concrete blocker found in the reviewed witness/launcher/freeze preparation. Review only; no model, test, compilation, runtime or GPU execution.

Reviewed SHA256: witness.ts `c74e6187eb46504c303ea8787cfd301e074d183b0417ce3bcb66f52080d7fd53`; run.py `a5ab39783cab27541ccefadb9df8a0a540a1948beab5e60744d38af50aea25ef`; freeze.py `b7388af8f349f76475935b85483d14f7a61d035489946b57b13d94bc4c59844f`; MEMORY-REVISION.md `ca02624a6ec84662650f55edf3ad59a722df4b289d9cbfa474180e923ec14ad0`.

Primitive corner IDs/radii preserve the original face selectors and encoded edge values. The 61,440 B identity scratch writes the same ordered Float32 XYZ+surface records, flushes at complete1024-triangle chunks and hashes exactly the written tail. It retains count checks and exact comparisons against the reused A identities. The27,443,392 B AABB oracle remains; its full-mesh plane computation, probes and tolerances are unchanged. The revision removes the complete64,863,540 B identity payload buffers and per-face ids/radii arrays, without assuming a particular RSS reduction.

The launcher runs only B, checks terminal wait4 resource use for that PID and keeps20CPU/30wall/1.5GiB. The witness additionally requires all six saved B buffer hashes and the entire F64 raw error digest. Static I/O verification found all143 source hashes unchanged. The preserved A run has statusPASS_EXECUTION_AND_PARITY_ONLY, links to actual result SHA `30a99d855c0c10a9b29d2ad4a629d61efa98b8d24cb49907a6788e704d9a1a97`, and declares historical parity. Its complete raw A stream is `ef4836dae907207f904b851db56404df9f5cc40e370f56852246d9b2aac2189d`; required previous B stream is `ff89b192199a6ffe766ff49090d342c09b302715aab5d216ce0a04afdc9a461f`.

Minor stale wording: run.py's opening docstring still says two sequential children; actual loop is B only. This does not alter execution. Source/freeze verification and root's final frozen manifest remain execution prerequisites. The earlier resource failure stays preserved; a later resource PASS would qualify this whole witness child, without isolating builder or renderer memory.
