# Independent review and closure

The review checked the restricted cubic/bilinear noise intervals, negative lattice
positions, transform ordering and negative coefficients, ridge squaring with
inflated noise, sine internal extrema, range composition and ordered traversal.
No further blocking algebraic bug was found in these parts for the declared CPU
rounded-expression target and guard assumptions.

One concrete bug was found and corrected: the outer-envelope precheck divided
sqrt(discriminant) by length(ray), while the quadratic requires dot(ray,ray).
The bundled non-unit regression (scales 0.5 and 2) exercises the former false miss
and validates the corrected physical hit interval and 1m tolerance.

Deferred point evaluation is compatible with the traversal invariant: bounds
prove the empty prefix; midpoint/lookahead samples provide a nonpositive witness
and do not discard the earlier unknown interval. The reference certifies a first
entry enclosure for the CPU occupied set under its bounds contract. It must not
be described as a literal zero proved by continuity of the f32 function.

The global-gradient version is a cost comparator, not a Lipschitz certificate of
the stepped CPU field. Host sin/pow allowances and CPU-to-real/GPU equivalence
remain unproved universally. No GPU source, GPU execution, browser or product
change was involved in this review.
