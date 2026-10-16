# Seed617 — one full-quality A/B macro-density diagnostic

Two sequential fresh Bun processes, identical binary and copied common script.
A is immutable v55-final/source manifest30c5448e…; B is immutable anatomy-r3-v55
manifest e65c9209…. All119 source hashes verified before creating two run roots.
Each scripts/qa-morphology.ts is copied; each src symlink targets ONLY its
explicit declared snapshot. No current checkout import or volume mutation.

One A and one B only, resolution256/detail128, seed617; no restart. CPU180s hard
RLIMIT_CPU per child; wall240s monitored by parent; RSS1GiB. Python owns Popen
for the direct Bun process, streams stdout/stderr to file, polls/waits/reaps,
and kills/waits its own process group on monitor/signal/limit failure. No ps.
A failure is recorded and reported, never retried automatically.

RSS is sampled every50ms using macOS libproc PROC_PIDTASKINFO resident bytes;
API/struct verified against installed Apple SDK headers. JS self RSS checks at
generation progress and diagnostic phase boundaries also throw over1GiB.
After child exit, RUSAGE_CHILDREN maxRSS checks the exact lifetime high-water
mark (one Bun child per Python wrapper). Sampled limit cannot prevent an
instantaneous unsampled spike; lifetime peak above cap is still a FAIL.
No virtual-address cap, forced GC, dependency install, GPU, browser or build.

Original qa-morphology moment/profile/six-neighbor bulk scan is unchanged.
Common diagnostic extension only reads generated arrays: supportBounds, six
outer and second layers (indices0,1,N-2,N-1), R nonzero/dense/max and macro data
SHA256. Progress callback monitors RSS without modifying values. No image,
full array output or synthetic approximation of256 density is substituted.

Compare integrated density, centroid/spread, largest bulk mass fraction and
components, vertical sections/upper profile, support bounds and boundary risks.
Density is dimensionless; integral units are authored density×km³, not physical
water mass. The outermost layer is forced zero by the generator, so even all
zero faces are not a universal no-clipping proof. Second-layer positives flag
near-domain occupancy, not automatically a visible clipping diagnosis.
No CPU/array result implies art acceptance, GPU parity, FPS or adoption.
