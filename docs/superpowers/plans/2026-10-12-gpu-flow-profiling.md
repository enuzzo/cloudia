# GPU flow and frame cadence profiling

Approved scope: identify the missing costs and reach stable60 at the existing256³/128³,384-step,full-HD quality before visual refinements or gestures. Work inline; review at the final code boundary.

1. Add test-covered separate CPU compute/render, GPU compute/render, queue completion and rAF dispatch samples. Capture the measurement object when asynchronous probes start, reject late/cancelled samples, await probes during teardown. Queue completion is not compositor presentation.
2. Expose a profiling-only route with mature deterministic seed/time, explicit timing mode and frozen-flow control. Compare30-second runs using one visible browser scene: render timestamps, both stages, queue probes, no timestamps, frozen flow. Keep raw negative evidence. Probes themselves may perturb cadence.
3. Investigate the component indicated by the evidence; make one reversible quality-preserving fix at a time. Test readback overhead or opaque presentation only if controlled results justify them. Preserve density/detail/morphology, steps, output and animation quality.
4. Run49+tests, typecheck and application+hero builds before final benchmarks. Review lifecycle/timing correctness. Qualify growth, left/right and window/orbit for90 seconds, inspect the live renderer/console, document precise scope and remaining limits. No camera/gestures or online deployment.


Execution status12–13October: instrumentation and53-test checkpoint committed9ea9a0e; shared-engine/worker experiment adds58-test lifecycle coverage and browser evidence. Both builds pass. Full-HD growth holds60 in one90s run, but all-scenario stability is still open. Worker/cap remain diagnostic opt-ins; retain every failed row. See WORKER-2026-10-13.md for restart and presentation-trace boundary.
