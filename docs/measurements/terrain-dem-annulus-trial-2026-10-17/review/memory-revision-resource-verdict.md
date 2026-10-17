# Final saved-only resource verdict — FAIL_STOPPED

The revised B child exited0 and completed its geometry/error checks, but terminal RSS was1,634,467,840 B against the declared1,610,612,736 B cap: excess23,855,104 B. CPU6.020296 s and wall5.409140666 s are within20/30 s. Overall status remains **FAIL_STOPPED**. The predeclared stop applies: no further witness adjustment, model execution, build or GPU for this trial.

Independent saved-only checks after the run:

- All164 frozen input byte counts and SHA256 match; no source/input drift found. FreezeSHA `dc62ef00bb270432b7a6b0a29d7cb1b8dd00c1925f735e1583a291d685820fbf`.
- All six mesh buffer digests equal the preserved previous R2 B result: position, normal, surface, index and both legacy lookup buffers.
- Both saved gzip streams were independently decompressed and hashed:9,449,480 raw bytes each, identical SHA `ff89b192199a6ffe766ff49090d342c09b302715aab5d216ce0a04afdc9a461f`. The new gzip digest also matches its result metadata.
- Mesh statistics, inner/outer ordered XYZ/surface identities, near/far parity counts and all seam-oracle records equal the previous R2 B result.
- New resultSHA `2fb4bda5748dcca0a2b76378691298049e96eb998468bc8ffcf038e12c47fe7e` matches the link in run.json.

These checks authenticate unchanged geometry and saved data; they do not override the failed resource gate. Terminal RSS covers the entire qualification child, including builder, witness and runtime allocations. It does not isolate builder peak memory, browser/renderer startup, GPU memory or FPS. No new execution was performed for this review; only saved files were read, hashed and decompressed. No next trial is proposed here.
