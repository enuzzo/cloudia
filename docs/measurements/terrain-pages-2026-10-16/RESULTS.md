# Compact analytic terrain pages: qualified CPU results

The compact representation passes the geometry-preservation test. The first paging policy fails the prospective full-grid efficiency gate. **Do not promote the paging candidate or infer GPU/FPS benefit.** The product terrain is untouched.

## Frozen geometry and compact access

The source SHA is `72a15a3c6b422405324b2006d94e5074c33eb272bbbe51e123a79eb3b2b90d99`; fixture SHA `cfad064c4dbe4b100294222c8c12a4fbcd98cf8f5316f0f1a3a10494543800a1`; old metadata SHA `69b2b49c06eddb8c582b9f1b14cdb944f707488fd73a4f5f17d6e261f62b12c4`. Every phase rechecked these exact bytes. The original metadata binary was reused, without another 8-second builder run.

On all 5198 rays, the repacked trace has exactly the same status, enclosure, witness, point count, visit count and derivative-query count as the frozen tracer. There are zero comparison failures. Both produce 1911 hits, 1777 metadata-traversal misses, 844 outer-envelope misses and 666 explicit height-budget unresolved states, with 31226 original point evaluations and 106949 visits. No cap or error margin changed.

All 109141 rectangles and pointers, 218282 height endpoints and 327424 leaf-gradient components were checked after serialization. Leaf E values were checked without shrinking them. The original 5238768-byte tree becomes 3055952 bytes, 2.914 MiB: one base record per node and one gradient record per leaf.

The frozen CPU access model fetches three RGBA32F records for each of its 250382 node accesses, or 751146 records. The compact reference accesses 95087 base and 4419 lazily cached gradient records, 99506 total, an 86.7528% reduction. Child clipping happens before its base fetch. These are logical record reads in this CPU reference, not measured GPU texture transactions. The CPU `Work` objects retain full Node objects, an anchor and lazy gradient cache across subintervals, while a global per-ray point cache retains evaluations. A proposed 16-byte GPU stack cannot assume that all those values are retained with no further loads or storage; its real loads, registers/spills and compiled cost remain unqualified.

The raw first `packing.json` uses the initial label `original.metadataRecordLoads` for the old node-access count, 250382. Its already-correct `recordsBefore=751146` and `recordsAfter=99506` are authoritative for record counts. `packing-normalized-summary.json` corrects only that label, records the original result hash and leaves every geometric value intact. The exact executed phase-1 driver is preserved under `executed/packing/run.ts`; the current driver reports the corrected units and adds separate phase timings. No phase-1 replay was repeated for this reporting correction.

## Fixed policy and results

Before page preparation, the protocol fixed 27 training rays in three 3 × 3 bundles, a maximum of three refill rounds, 250 m target leaves, four-face neighbor prefetch and an 8 MiB resident serialized limit. The only primary request was a pending leaf key from a normal cap-16 unresolved result. The fixture's `cpu` result objects never entered the selector or builder. Full-grid outcomes did not influence page selection.

Twenty-four pages became resident: six primary blockers and eighteen face-neighbor prefetches. Four refine 32 km leaves, twenty refine 2 km leaves. Fifty requests were already at the target. No budget overrun or rejected page occurred. The resulting tree has 198197 nodes and 148648 leaves, requiring **5549520 bytes, 5.292 MiB**, of base plus gradient metadata. The serialized limit excludes the external mutable CPU builder and temporary arrays; it is not a total peak-heap measurement. Keeping the old compact tree and the new residency alive together requires 8605472 bytes, **8.207 MiB**, before any other allocation. A future GPU double-buffered replacement must budget that peak explicitly; this run does not qualify an 8 MiB total-allocation design.

| Corpus | Unresolved before | Unresolved after | New conflicts / invalid witnesses / resolved-to-unresolved |
| --- | ---: | ---: | ---: |
| Nearby holdout, 48 rays | 32 | 21 | 0 / 0 / 0 |
| Yaw holdout, 18 rays | 12 | 7 | 0 / 0 / 0 |
| Two excluded controls | 2 | 2 | 0 / 0 / 0 |
| Complete matrix, 5198 rays | 666 | 660 | 0 / 0 / 0 |

After paging, logical compact record reads rise slightly from 99506 to 99662, **+0.1568%**; 31207 point queries replace 31226 and visits rise from 106949 to 107038. More local detail is not a free reduction in traversal work.

The complete result is 1917 hits, 1777 misses and 844 outer-envelope misses, plus 660 unresolved. The six newly resolved matrix rays are `home-down-0-5` through `home-down-5-5`. There are zero new misses, disjoint qualified entry enclosures, invalid witness signs, oversized hit brackets or resolved-to-unresolved changes in the finite comparison. The prospective unresolved gate was at most 333, so **660 is a FAIL**, despite the local holdout gain. All 660 unresolved cases, including pending keys and causes, are exported.

New-page metadata passed 10240 independent finite tests on 2048 new leaves: original CPU height within its enclosure, independent ideal derivative within gx/gz, and CPU-versus-ideal deviation within E. There were zero violations; the maximum observed deviation/E ratio was 0.1986854. These tests do not prove a universal host ledger, a GPU ledger or the behavior of an uncompiled GPU implementation.

## What limited this attempt

The nearby and yaw gains are entirely around the `home-down-1-5` view. The `coastal-horizon-0-14` holdout remains fully unresolved, while the designed coast-transition bundle was already resolved before any paging. The matrix is a much wider camera-ray corpus than the narrow training angular offsets; preparation of a few view-local tiles therefore gives little full-grid coverage.

Of the remaining 660 pending leaves, 415 are still 2 km, seven are 32 km and **238 are already 250 m**. The wide unprepared regions remain a real coverage limitation, but more 250 m pages alone are not established as the solution: many cap-16 traces already stop in that spacing. This run does not justify an unlimited refill, deeper subdivision, a larger point cap or training on oracle hit distances. The four large prefetched pages also dominated preparation cost and demonstrate why a bounded streaming schedule must be measured before any renderer use.

For 647 unresolved rays an occupied sample is already known, but their earlier prefixes are still unproved. That observation is exported only as a diagnostic; a known later occupied point does not authorize accepting a hit. The two declared difficult controls remain unresolved under the normal cap.

## Separate CPU times and execution boundary

Phase 1 finished in 0.224 s wall time, including process/file overhead. Its two trace observations were 81.397 ms for the frozen CPU representation and 80.416 ms for the compact one. These are one ordered pair with warmup effects, not a performance certificate.

The single command for phases 2 and 3 took 5.787 s, below the predeclared 180-second total limit. Page phase exit code was 0. Full phase exit code was 1 because the unresolved-efficiency gate failed; it did not crash or time out. There was no sweep or automatic replay/retry.

- Analytical preparation of accepted pages: 4961.953 ms.
- Refill work including preflight/accounting: 5011.027 ms.
- Serialization across the three training rounds: 133.913 ms.
- All three training traces: 6.838 ms.
- Finite metadata structure/bounds verification: 98.992 ms.
- Nearby holdout before/after: 1.735 / 1.700 ms; yaw before/after 0.609 / 0.709 ms.
- Full-grid compact baseline/paged trace: 84.123 / 69.293 ms. This single ordered CPU pair is descriptive and does not prove a stable speedup.

Every replay/builder process has exited. No browser, GPU, product shader, build, installation, Git mutation, or renderer frame measurement was started by this task. The original point field, error ledger, point cap 16, visit cap 256, stack 48 and 1 m geometry band are preserved. The compact format is a qualified CPU representation candidate; the particular paging policy is not promoted.

Derived base and gradient binaries remain outside Dropbox. Their exact bytes/SHA are in `results/analysis.json`; code, all request logs, per-ray results and unfiltered unresolved states are available for durable archival. The independent review is in `review-notes.md`. Its README observation was resolved by replacing the pre-execution state. Other GPU-only cautions remain explicit: check stack capacity before writing each push (the dynamic CPU array did not overflow on this corpus, whose observed maximum was 18), and do not transfer CPU caches into a 16-byte GPU stack by assumption. The executed full-phase loader verifies source hashes and resident byte sizes but did not hash-bind the two prepared resident binaries at the phase boundary. Their current SHA values are preserved in analysis.json; this runner guard should be strengthened before another qualification run, without relabelling the present single execution.
