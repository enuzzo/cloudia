# Visible density and source audit — 15 October 2026

This CPU audit separates visible density variation from variation in the existing
lighting source. It adds joint moments and physical-window residuals to the earlier
near-density measurements. It does not establish image sharpness, photographic
acceptance, crop fidelity or equivalence to GPU transport.

## Baseline and provenance

- Material: the restored v34 baseline at checkpoint `b3270f9`; no powder,
  reconstructed RG field, sharpened interface or additional density band.
- Camera/focus source can include subsequent navigation fixes. The diagnostic pins
  the reference target and radius rather than deriving them from new support bounds.
- Script: `scripts/qa-visible-source.ts`.
- Complete output: `docs/measurements/visible-source-2026-10-15/baseline.json`.
- Output SHA-256: `cbbbabef4fb94b012ebca668f3b8c0205c4afe527456d49e02a7feba611f6efb`.
- Script SHA-256: `3bfec59e05066c74ea75100367d8b2e3aed7bd6d1281f8c8bc9cc940c364b923`.
- Volume source SHA-256: `86a575e16bd23439f72ebe0ebc24cb6cea5900b22ac79321ca3e4366ac7afd74`.
- Shader source SHA-256: `d80225521258edb4beed2e713afe3c6b97fad5eca79d7dcdc657f9f47c1deddd`.
- The JSON also records motion, flow-filter, camera, light, sun and atmosphere
  source hashes before and after the run; `changedSourceFiles` is empty.
- One generation only: 256³ macro, 128³ detail, 16³ filtered half-float flow.
  Generation 24.230 s; sampling 0.200 s; total 24.431 s. These are CPU audit durations,
  not GPU performance measurements.
- Local `node_modules` ignore xattr was 1 before and after. Targeted TypeScript
  checking and `--check` mathematical controls passed without generation.

## Fixed conditions and method

Seed 1571198069, cloud time 60 s, wind 0.55, clear daylight/left sun, mature growth;
no dispersion, gust, precipitation or flash. Units are kilometres. Reference
aspect is 1672/941 and tangent of half vertical field of view is 0.2867.

The fixed target is `[0.4296875, 2.9365234375, 0]` and near radius is
`0.6045067691053366`. Exact origins, independent of support bounds, are:

| Approach | Origin z |
|---|---:|
|80 |1.1639784268955404 |
|95 |0.712093643489751 |
|100 |0.6045067691053366 |

All origins share the target x/y. Five reference UV rays are center, left, right,
up and down at `(0.5,0.5)`, `(0.35,0.5)`, `(0.65,0.5)`, `(0.5,0.35)` and
`(0.5,0.65)`. Midpoint intervals are 1.5/3/6 m with the existing 0.006 transmittance
cutoff. The JSON preserves every positive-opacity contribution on those rays at 3 m.
An additional 9×9 grid over UV `[0.35,0.65]²` has 3 m summaries; it is not an image.

Material evaluation includes the filtered flow and its erosion channel, the
existing detail warp, phase-dependent material and camera inspection micro erosion.
Lighting samples the existing solar/vertical-sky optical-depth cache at the filtered
local position, retaining the co-deformed static-light approximation. Source
components are direct, ambient and multiple; each already includes its applicable
constant term. The separately reported floor is ambient×0.18 plus
`[0.028,0.032,0.04]`, and must not be added again.

Moments use opacity weights `T_before × (1 − exp(−rho × extinction × ds))`.
Residuals subtract a segment-length-weighted local linear trend over full physical
windows 16/32/64 m, including marched empty segments. These are detrending windows,
not Fourier bands. Correlations are descriptive, not causal.

## Center 100: broad correlation versus local residual

At 1.5 m steps, weighted mean rho is 0.739242660 and mean source is 0.255538090.
Their overall Pearson correlation is −0.915380, with standard deviation/mean
22.81% for rho and39.34% for source. Removing a local trend changes the picture:

| Window | Rho RMS / mean rho | Source RMS / mean source | Residual Pearson |
|---|---:|---:|---:|
|16m |0.657% |0.273% |−0.344 |
|32m |1.541% |0.908% |−0.689 |
|64m |4.995% |3.327% |−0.936 |

A high overall correlation alone is insufficient evidence of useful fine coupling.
In this ray, the residual at 16 m is small in both rho and source; the audit does not
reveal a large hidden fine density signal that lowering a constant fill would
necessarily recover. It also does not prove that lighting is adequate.

Source fractions at center100 are direct 15.84%, ambient 30.76%, multiple 53.40%.
The constant floor accounts for 19.87% of the total and is contained within those
ambient/multiple fractions. Camera micro changes rho by RMS 0.013113 relative to
its no-micro value on the visible samples; this is not itself a fine-band RMS.

## Grid 9×9 and convergence

The grid samples the following distributions of per-ray integrated source:

| Approach | Mean source | Across-ray SD | CV | Across-ray CV of mean rho |
|---|---:|---:|---:|---:|
|80 |0.297562 |0.158347 |53.21% |8.45% |
|95 |0.267613 |0.048468 |18.11% |1.28% |
|100 |0.257658 |0.014163 |5.50% |0.72% |

At 100, subtracting the constant floor algebraically changes the integrated-source
SD from 0.014162631 to 0.014161755, while CV rises from 5.497% to 6.835% because the
mean falls. That CV increase alone does not demonstrate added detail. All grid
rays are nearly opaque in this integration: mean opacity 0.994120 at 100.
A constant unit source integrates exactly to opacity; its across-ray CV is 0.0080%.
This is an algebraic control, not a replacement physical lighting model.

Center 100 mean source varies by at most 0.080% and mean rho by 0.091% across
1.5/3/6m steps. The 16 m source residual is more step-sensitive: RMS
0.000698 /0.000563 /0.000794 respectively. At 1.5 m, center source residual/mean
is 0.266%, 0.275%, 0.273% for 80/95/100. Do not treat metre-scale detail as fully
resolved or the 16 m residual coefficient as precisely converged.

The five reference-ray 3 m source means reproduce the earlier near-density audit:
0.301494745 /0.266967511 /0.258743705 at 80/95/100. This check establishes
continuity with that CPU model, not with rendered pixels.

## Limits and decision scope

The terrain is excluded: there is no Earth/landscape clipping, terrain occlusion,
ground bounce or terrain color in these calculations. The audit evaluates cloud
source before aerial mixing, tone mapping and display. It does not execute WGSL,
reproduce its jitter/adaptive march/occupancy decisions, read back GPU pixels or
validate transport and compositing. No conclusion about an image crop follows.

These three front poses, one mature seed, one lighting state and one fixed target
do not establish a result for every pose, family, seed or lifecycle stage. The
numbers do not justify introducing a powder term on the premise that a large fine
density signal is merely hidden by constant fill. Further variants require their
own explicit hypothesis and real visual guard; no candidate was implemented here.

To reproduce, coordinate CPU/GPU audit timing and run
`bun scripts/qa-visible-source.ts <output.json>` once. `--check` runs only the
mathematical controls and never generates a volume.
