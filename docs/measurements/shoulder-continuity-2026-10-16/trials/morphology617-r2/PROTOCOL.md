# Seed617 full-quality A/B — R2, one newly authorized pair

R1 is terminal FAIL and preserved separately: immutable baseline exceeded our
internal1GiB guard at20.47s, was terminated/reaped, no final JSON, B never started.
The1GiB guard was not a product requirement. Root verified physical RAM using
`sysctl -n hw.memsize`:68,719,476,736bytes=64GiB, read escalation auto approved.
Root explicitly authorized this distinct R2 with RSS2GiB(3.125%physical RAM),
CPU180s and wall240s per process unchanged. No resolution reduction or fitting.

Same immutable source manifests30c5448…/e65c9209…, same Bun binary SHA and same
copied diagnostic script on both sides. All119 source hashes verified again.
The only common-script change from R1 is the literal diagnostic self-guard
RSS_CAP1GiB→2GiB, required to actually apply the new bound; its new SHA is
explicit and equal A/B. No generator or value calculation changes. The parent
was informed of this literal/SHA exception before any R2 run. Guard-only patch
and both R1 code snapshots are retained. No monkeypatch of RSS or forced GC.

One fresh A Bun, then one fresh B Bun only after A exit0 and a separately
validated final JSON(quality256/128,seed617,finite statistics and array schema).
No retries. CPU hard RLIMIT180s; wall240s; live RSS via libproc every50ms and
self-guards; exact highwater on exit via RUSAGE_CHILDREN. One direct owned Bun
child per Python wrapper, streamed logs, poll/wait and kill/reap on failure.
No ps, orphan wrapper, dependency install, GPU, browser, product or Git writes.

Unchanged original moments/profiles/six-neighbor bulk diagnostics plus the
already frozen read-only extension: six outer/second layers, supportBounds,
macro data SHA. Outer layers are forced zero; boundary results are empirical
risk indicators, not a universal no-clipping proof. Same dimensionless density
integral units density×km³, not physical water mass. CPU results do not imply
visual/anatomy acceptance or FPS/GPU performance. Raw generated arrays are not
archived; both small diagnostic JSON and independently recomputed comparisons
are retained. R1 failure stays visible in every R2 conclusion.
