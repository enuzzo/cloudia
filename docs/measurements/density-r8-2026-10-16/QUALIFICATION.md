# R8 density trial: prospective qualification

Baseline: 6a7df91, v46, external UI build on port 4185. Candidate v47 will
change the density texture source only. Baseline controls retain the v46 rain
point mask; comparing to v40 would confound the two optimizations.

1. Worker extraction preserves every original R byte in order and an
   independent transferable buffer. RGBA8 remains the light texture. Legacy
   packets use the original shader, with the actual path explicit in reports.
2. Finite raw GPU audit starts with exact f32 bit equality, no nonfinite
   results, correctly echoed inputs and nontrivial zero/positive/gradient
   coverage. This does not establish universal sampler equivalence or the
   Three binding path. Any discrepancy is investigated before performance
   adoption; no tolerance is silently widened.
3. Main browser must compile dry and rainy candidate paths and exercise a
   rain→dry transition. Lifecycle tests cover swap/cancel/release. New CPU
   payload and nominal GPU texture cost are each 16 MiB at 256³, with no
   compressed data, reduced resolution, mipmap or new approximation.
4. Native 2560×1440, macro256³/detail128³/384/full flow, seed72, t60 paused,
   forcing/rain uniform time0, comparison surface0.4km and fixed target.
   Near Sun uses approach1, yaw/pitch0; rain uses approach0, pitch−.92,
   rain.8 settled, atmosphere1. One browser renderer, no orchestrated build,
   bake, test, replay or other GPU audit during timed windows.
5. Separate 30s A/B/A sequences on each state. Check exact camera/quality and
   scene fields, frame interval arithmetic, completed prefix, pass coverage,
   console and CSS image equality (UI hover may be identified separately).
   These are submissions, not compositor presentations or sustained60 proof.
6. A useful first result exceeds both controls in at least one expensive
   state and shows no clear regression in the other. A candidate more than3%
   below the slower control in either state fails the first performance gate.
   Small or control-drift-sized gains need repetition rather than promotion.
   Static image equality does not close motion or artistic gates.

If the trial fails, preserve its immutable source/build/proof externally and
restore only its owned product paths to6a7df91. Keep unrelated work intact.
