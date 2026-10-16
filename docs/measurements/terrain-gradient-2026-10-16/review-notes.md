# Independent mathematical review: gradient bounds

Scope: `src/cumulonimbus/landscape.ts`, read on 2026-10-16. No product changes, GPU runs, volume generation or heavy tests. This is a review of the proposed argument; it does not certify an implementation or an unprovided numerical ledger.

## Verdict

The central-value enclosure is mathematically sound **conditionally**:

`Hcpu(t) ∈ Hcpu(m) + (t−m) · [glo, ghi] + [−2E, +2E]`.

It requires an absolutely continuous *ideal* height along the entire segment from `m` to `t`, an almost-everywhere directional derivative enclosed by `[glo, ghi]`, and a uniform `|Hcpu(s)−Hideal(s)| ≤ E` at both endpoints and throughout the relevant domain. For `t−m < 0`, interval multiplication swaps the gradient endpoints. A central sample from a different cell cannot use only the destination cell's gradient: the bound must cover the entire connecting segment, or integrate the intervening cell bounds piecewise.

The ideal ridge cusp does not invalidate this argument. The CPU fround field is discontinuous and cannot itself be differentiated or assumed to satisfy an intermediate-value theorem. The ideal field plus an explicit error envelope supplies the enclosure.

## Noise: rectangle gradients

For one lattice cell, let the four hash values be `a,b,c,d`, local coordinates `s,t ∈ [0,1]`, and `u(s)=s²(3−2s)`, `v(t)=t²(3−2t)`. Then

```
Nx = 6s(1−s) · ((1−v)(b−a) + v(d−c))
Nz = 6t(1−t) · ((1−u)(c−a) + u(d−b))
```

On a clipped cell rectangle, bound each interpolation by its two endpoint values. For `6s(1−s)` and `6t(1−t)`, include the interior maximum `1.5` whenever the interval contains `0.5`; the minimum is at an endpoint. Multiply intervals with all endpoint sign combinations. These component bounds are tight for a single axis-aligned cell rectangle because the two factors depend on independent coordinates.

For a rectangle spanning several lattice cells, **clip to every intersected cell and union the derivative bounds**. Four outer rectangle corners are insufficient. Shared lattice boundaries cause no ideal noise jump; including either adjacent cell's closed edge is safe. The global fallback `Nx,Nz ∈ [−1.5,1.5]` is valid for hashes in `[0,1]`, but often loose. Negative coordinates require `floor`, not truncation. A rotated world rectangle may be enclosed by an axis-aligned octave rectangle; this widens, rather than invalidates, the result.

## Ridge, octaves, coast and product

Writing `n=Noise(q)`, the ridge-square scalar is `R(n)=4n²` below `0.5`, and `R(n)=4(1−n)²` above it. Its derivative is

```
R′(n) = 8n       for n < 0.5
R′(n) = 8n − 8   for n > 0.5
```

If the noise range crosses or touches `0.5`, include **both limiting branches**, up to `+4` and `−4`. Differentiating through `abs` with the sign at only the midpoint is unsound. If the noise range stays on one side, that branch gives a tighter interval. The cusp has bounded one-sided slopes, so the composed ideal field remains locally Lipschitz and absolutely continuous along each finite ray interval.

With `A = 2.17 · [[0.8,−0.6],[0.6,0.8]]`, octave Jacobians are `Jj = 0.065 · A^j`. The world gradient is `Jjᵀ · gradNoise`, not `Jj · gradNoise`. For a ray's horizontal velocity `w`, the directional noise derivative is directly `gradNoise · (Jj w)`. Include the octave weights before summing intervals; all four weights are positive. The ideal definition must state whether it uses decimal coefficients or their f32 values. Using the CPU's exact precomputed f32 amplitude sequence and f32 exponent avoids needless weight/exponent mismatch terms; coordinate recurrence rounding still needs its own bound.

For the ideal coast `C`, decimal-coefficient notation gives

```
Cx = −1 + 0.495 · Nx(0.055p)
Cz = 0.2 + 0.27 · cos(0.045z) + 0.495 · Nz(0.055p)
```

Bound the cosine over the **whole** argument interval, including internal extrema. For `I=smoothstep(0,13,C)`, `I′=6u(1−u)/13` inside the transition and zero on the plateaus; its global maximum is `1.5/13`. A range that intersects a plateau must include derivative zero. Let `P=h^α`, `α=f32(1.3)>1`, `B=0.55+0.45 Noise(0.018p+[3,7])`, and `Q=0.12+3.2PB`. Then

`gradH = Q·I′·gradC + I·3.2·(B·α·h^(α−1)·gradh + P·gradB)`.

Ordinary interval products safely cover dependencies, although they may be loose. At `h=0`, the first derivative of `h^α` is zero; no positive lower bound on `h` is required. Its **second** derivative is unbounded near zero because `α<2`, so a bounded-Hessian shortcut is not justified there.

## Numerical ledger requirements

The error `E` must cover the actual CPU expression order: initial `Math.fround(x,z)`, each octave coordinate operation, separate cubic/interpolation operations, `mul(mul(a,ridge),ridge)`, smoothstep divisions, all final products, and host `sin`/`pow` plus their fround. The CPU noise `mix` is a sequence of separately rounded operations, not an FMA. Rounding can move an octave coordinate across a lattice boundary; account for this using continuity/global Lipschitz bounds of the *ideal* noise or by expanding coordinate ranges, rather than assuming the lattice ID stays fixed.

For ordinary f32 arithmetic a local absolute rounding budget can use `u·M + η/2`, with `u=2^-24`, a valid magnitude bound `M` on the exact operation result, and the subnormal quantum `η=2^-149`; finite-range/overflow assumptions remain explicit. Coefficient mismatch must be added if the ideal uses decimal constants. Host transcendental errors need a stated contract or a separately qualified assumption: a finite scan alone does not prove an all-input `sin`/`pow` error bound. This CPU ledger is not automatically a WGSL contraction/transcendental ledger.

If `Hcpu` is sampled at rounded ray positions, include their coordinate error relative to the ideal affine ray. If `E` varies spatially, use `E(m)+sup E(interval)` rather than silently applying a local `2E`. Outward rounding is also required when serializing derivative/error metadata to f32 and when evaluating the final enclosure. Round-to-nearest metadata is not automatically conservative.

## First occupied entry without CPU continuity

Define the exact intended occupancy predicate, for example `Fcpu(t)=radialCpu(t)−R−relief·Hcpu(t) ≤ 0`. Include the radial and final-subtraction errors as well as the height ledger. For a ray-constant relief, no relief derivative is needed; if relief varies with `t`, its product derivative must be included.

An accepted enclosure `[lo,hit]` requires (1) **every earlier interval** in the search domain has been certified strictly outside, (2) the actual reference evaluation at `hit` is occupied, and (3) `hit−lo` is within tolerance. It encloses `inf {t : Fcpu(t)≤0}` and has an actual occupied witness. It does not assert an exact zero or that the infimum itself is attained. Opposite endpoint signs alone do not exclude an earlier occupied island. Zero-touching lower bounds, exhausted budgets and uncertain numerical classification must remain unresolved.

For an ideal radial norm with arbitrary nonzero ray velocity `v`, `ρ′(t)=(o·v+t|v|²)/|o+tv|` is nondecreasing away from the origin; endpoint values bound it. Do not assume `|v|=1`. This derivative fact can help build clearance bounds, but it does not replace certification of the CPU radial computation.

## Light code review of `gradient.ts`

The simultaneous `nx/nz` update preserves the original recurrence. Replacing `inland.v` and its derivatives by the monotone cubic bounds is sound: the old polynomial AD and the replacement enclose the same ideal scalar, while the already accumulated arithmetic error remains conservative. The clamp plateau shortcuts require both the ideal and expanded CPU interval to lie on that plateau, as the current tests do.

One concrete compositional-ledger defect remains in `sin()` and `power()`: the final `roundError(v)` uses only the ideal output interval. The CPU value being rounded can lie in its expansion by the propagated input error and declared host error. Use `roundError(expand(v,prior))`, where `prior=a.e+sinHostBudget` or `prior=L*a.e+powHostBudget`, then add `prior`. The omitted term is small, but is not available for free once the host budget is already spent.

The fixed noise interpolation budget `2^-19=32u` can be justified more tightly than a sample check, conditional on exact hashes in `[0,1]`, finite already-f32 coordinates and the source's separate rounded operations. Fraction subtraction has absolute error at most `u`. Define

```
u = 2^-24
K = 7u + 9u² + 3u³
D = 8.5u + 9u² + 3u³
B = u · (4 + 4u + 3K + u² + uK)
```

Here `K` bounds the cubic's arithmetic error relative to the cubic at the rounded fraction, so its computed output lies in `[0,1+K]`; `D` additionally covers the fraction error using the cubic's `1.5` Lipschitz constant. For one mix with endpoint magnitudes bounded by `M`, separate subtraction/products/addition incur at most `M·B`. The three nested mixes therefore contribute at most `B·(2+3K+B)`, including amplification of the inner errors by the outer weights. The perturbation of the ideal bilinear interpolant from the two cubic errors contributes at most `2D·(1+2K)`. At this fixed `u`, their sum is below `26u`, hence below the chosen `32u`. This covers fraction/cubic/mix rounding, independently of the separate coordinate-recurrence error. It does not cover a mismatched integer hash, out-of-range conversion semantics, or GPU contraction/precision.

Minor formal point: `noiseRect` value corners and `power` endpoints are evaluated without the `out` padding used by most other interval primitives. Existing later padding and the much larger CPU error ledger likely dominate their double-rounding errors in this domain, but an all-steps outward-interval claim should explicitly pad those endpoint calculations too rather than rely on that incidental margin. No source edit was made during this review.

## Optional local noise arithmetic ledger

A local replacement for the fixed `32u` is feasible without differentiating the CPU field. Keep the coordinate-error term already present in `noise()`. Separately, for **each cell intersecting the expanded coordinate rectangle**, compute the following error for the interpolation at an already-f32 coordinate, and take the maximum across cells. Keep `32u` as the fallback when enumerating the cells would be expensive. All intervals below must be outward enclosures.

Let `M(X)=max(abs(X.lo),abs(X.hi))`, `X±e` mean interval expansion, and `r(X)` be an upper bound on absolute fround error for every exact value in `X` (the existing `u*M(X)+η` suffices). Let `F⊂[0,1]` be an exact fractional-coordinate interval. A useful exactness fact is that `q−floor(q)` is exactly representable for already-f32 `q` **outside `q∈(−0.5,0)`**: subtracting zero is exact, other nonzero cases satisfy Sterbenz's condition, and sufficiently large f32 coordinates are integral. Thus set fractional error `eF=0` when the cell/interval excludes that exceptional region; otherwise use `r(F)`. This statement concerns the actual already-f32 coordinate, not the unrounded ideal octave coordinate.

For the cubic source `RN(RN(Fhat*Fhat) * RN(3−2Fhat))`, scaling the f32 fraction by two is exact. Define

```
B = F²                    // exact interval, not generic F*F when signs vary
C = 3−2F
S = smooth(F)             // exact monotone endpoint range
pB = 2*M(F)*eF + eF²
eB = pB + r(B±pB)
eC = 2eF + r(C±2eF)
pS = M(B)*eC + M(C)*eB + eB*eC
eS = pS + r(S±pS)
```

This is the standard product ledger, with the final fround bounded against the **true cubic range** rather than the dependency-inflated product interval. It gives `eU/eV` for the two cubic weights. It includes all fraction/cubic source rounding and often becomes substantially smaller near low values or exactly representable constants.

For source `mix(Ahat,Bhat,Uhat)`, let ideal input intervals be `A,B,U` with errors `eA,eB,eU`. Preserve the ideal difference `D=B−A` as tightly as available. For inner mixes, `D` is the exact hash difference. For the outer mix it is `lerp(c−a,d−b,Ux)`, which preserves the shared horizontal weight. With `Ahat=A±eA`, `Bhat=B±eB`, and `Uhat=U±eU`, use

```
p = M(1−Uhat)*eA + M(Uhat)*eB + M(D)*eU
rw = r(1−Uhat)
What = (1−Uhat)±rw
ra = r(Ahat*What)
rb = r(Bhat*Uhat)
aerr = M(Ahat)*rw + ra + rb
eMix = p + aerr + r(Mideal±(p+aerr))
```

Here `Mideal` is an enclosure of the **ideal mix value**, using the actual shared-variable algebra; a Cartesian product enclosure is also safe, just wider. `p` bounds the exact arithmetic input perturbation, while `aerr` covers the separately rounded subtraction and two products. The final term covers the source addition. In particular, an inner mix's cubic-error contribution is `abs(b−a)*eU`, rather than `(abs(a)+abs(b))*eU`. This cancellation is exact before counting rounding, so using it does not assume correlated rounding errors cancel.

Run this ledger for the two horizontal mixes, then the outer vertical mix, taking the maximum local result across cells. It is a concrete, compositional tightening; its benefit remains unmeasured. Do not globally shrink the declared bound from a finite favorable scan. The single-center metadata enclosure with derivative radius and `2E` remains sound under the earlier whole-cell/uniform-error conditions, and can be intersected with another independently valid height enclosure.

## Review of implemented local ledger and signed advance

The implemented `cubicError` / `mixError` / `localNoiseError` follow the proposal. In particular, the final fround terms use expanded intervals, hash differences preserve the weight-error cancellation, and the per-cell maximum covers the expanded octave-coordinate rectangle. The fractional exactness condition is conservative. The existing `32u` remains an independently justified ceiling, so taking the minimum with it is sound under that contract. No concrete undercount was found in this light read; no extended CPU run was performed.

For an anchor `m`, the lower linear inclusion uses slope `D.hi` to its left and `D.lo` to its right. The two cut formulas implement the descending roots on the appropriate side. More importantly, a candidate cut is accepted only after `lower([a,cut],anchor)>0`; therefore, the cut formula itself cannot discard an uncertain prefix. Anchors are preserved only inside the same leaf cell; child traversal drops the old anchor. This satisfies the whole-connecting-segment condition, subject to conservative clipping.

Remaining qualification details:

- `minimumIntervalKm` is used as a physical width at the final contact check, but as raw `t` in `cut > a+minWidth`. Use `(cut−a)*speed > minWidth` for consistent behavior with nonunit rays. This affects work/budget behavior, not the cut's positive-prefix proof.
- The `relief===0` branch returns the analytic sphere result without an occupied CPU witness. Keep its interpretation separate from a CPU-predicate first-entry certificate, or qualify a witness separately. A rounded analytic root need not make the separately evaluated norm exactly nonpositive.
- A certificate using the declared ledger requires `errorScale>=1`. Values below one are diagnostic sensitivity experiments. The output's `roundingQualified:false` remains essential until the radial arithmetic, root endpoints and cell clipping have their own conservative implementation bounds.
- Require a finite, nonzero ray before constructing `tc`, roots and derivative bounds. The current fixture rays satisfy this, but the exported trace entry point does not enforce it.

## Sea-witness extension and physical fade

Extending the search from `sea` to `sea+tol/(4*|ray|)` does **not** change the terrain height or the solid's occupancy predicate. It permits a reference query just inside the already defined sea sphere, where a nonpositive witness can be demonstrated despite rounding at the analytic root. Acceptance still needs the normal positive-prefix proof and an enclosure no wider than `tol`. A very grazing ray may leave the sphere before the extended endpoint; this can prevent finding a witness and should remain unresolved, rather than authorize a hit. If a renderer later chooses the witness endpoint as its shading location, its displacement from the true first entry is an explicit within-band approximation, not exact surface coincidence.

For `relief===0`, the ideal radial clearance is nonincreasing on `[0,tc]`. Therefore a sea-only bracket ending around the *near* root can use monotonicity instead of subdividing the full prefix, provided `lo<=tc`. However, with only `|Fcpu−Fideal|<=radialError`, transferring a CPU sample at `lo` to every earlier CPU query costs **two** endpoint errors:

`Fcpu(s) >= Fideal(s)−e >= Fideal(lo)−e >= Fcpu(lo)−2e`.

Consequently use `before.clear−2*radialError>0` for that argument, or calculate a directly outward lower bound on the ideal prefix minimum and subtract one error there. A single `before.clear−radialError>0` establishes positivity of the ideal endpoint, which alone is insufficient to transfer positivity back to arbitrary earlier CPU values. This qualification is independent of continuity of the fround terrain field.

Using physical fade distance `(sea or tc)*|ray|` restores invariance under positive rescaling of a ray. It is identical to the former expression for an exactly unit ray. For nonunit rays it changes the previous prototype's fade value; record this as a correction to the intended world-distance convention, not as byte-identical behavior of that older parametrized prototype. The fallback based on closest approach remains the explicitly chosen sea-miss fade extension. Root, discriminant, endpoint and radial arithmetic still carry the existing `roundingQualified:false`; the observed removal of finite replay contacts does not certify arbitrary grazing inputs.
