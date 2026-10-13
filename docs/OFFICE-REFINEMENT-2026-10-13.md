# Cloudia office refinement

13 October 2026. Start `864f5c1`, feature branch `codex/cumulonimbus-webgpu`.

## Checkout and runtime

The checkout initially had no uncommitted changes and matched GitHub. On this
ARM64 Mac, 746 of 758 loose Git objects were Dropbox placeholders. This caused
`git fetch` and ancestry checks to fail with `mmap failed: Operation timed out`.
A separate temporary bare clone supplied 693 identical objects; every recovered
object was checked against its Git SHA-1 before replacing its placeholder.
Fetch and the `59c5b20` ancestry check then succeeded. All 743 objects reachable
from the local refs were independently hash-verified. Another 53 unreachable
placeholders were preserved; this is not a full `git fsck` of unreachable history.
No branch, commit, working file or ref was reset.

Runtime: darwin/arm64, Bun 1.3.11. `bun install --frozen-lockfile` installed the
locked dependencies; Bun required sandbox access to its temporary directory.
Initial 88 tests, typecheck and application → hero builds passed. The first
application build waited on file-provider reads, taking 97 seconds; a later
fully local build took approximately 2 seconds. Preview was reloaded after
the completed build rather than accepting a stale/error document.

## Conservative empty traversal

The original v14 used ordinary steps whenever wind or dispersion was active.
The new bound uses the actual flow-expanded occupancy mask, retaining 256³
macro density, 128³ detail, 384 nominal steps and the configured full output.

For each axis, the reference-space empty margin is
`(r + 0.5 + 0.5 * detail/macro) * maskVoxel - warp - flow - macroVoxel`,
where `r = ceil((warp + flow + macroVoxel) / maskVoxel)`. The half-texel filter
support and the maximum offset of a macro center inside its assigned mask cell
are included. Subtract 0.001 world units for numerical rounding. With the
fixed 256/128 grids this leaves approximately 0.0654/0.0653/0.0849 units.

For inverse growth, bound each row of the reference transform's Jacobian.
The shear slope is at most `1.5/6.2`; the ice blend slope is at most
`1.5/(height * iceTransitionSpan)`. The cross-axis term also includes the
full ray box's x extent and the difference between width and anvil growth.
The smallest axis margin divided by its row norm bounds a safe world segment.
Round down to an integer multiple of the original step. Early growth retains
ordinary steps; mature windy clouds allow three steps through empty sky.
Local flow need not enter the Jacobian because the occupancy halo already
covers every saturated flow displacement, including held dispersion.

Tests independently probe reference-segment motion over growth/ice transitions,
both wind signs and oblique rays; sparse 256³ islands verify that skipped
baseline samples have no raw density even with saturated dispersion and extreme
fine warp. Coarse quality retains ordinary steps. Integer advances retain the
occupied sampling grid mathematically; floating-point accumulation is not
claimed to be bit-identical to sequential additions.

The general principle is consistent with [Donnelly's GPU Gems distance-mapping
chapter](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-8-pixel-displacement-mapping-distance-functions):
choose advances from a conservative empty-distance bound. Cloudia uses its
existing binary mask and an authored deformation bound, not that chapter's
distance texture or shader implementation. No external code was imported.

## Ice material candidate

The material retains a thicker attachment and downwind taper. Ribbon coordinates
now vary through depth and bend more irregularly; the existing blue detail
channel interrupts ribbon density. Both channels come from the same GPU lookup.
CPU light baking uses the same material formula. This changes material detail,
not the seed's macro anatomy. Cached lighting during animated deformation remains
approximate. Visual acceptance must follow rendered comparison and owner review.

## Qualification record

One live Cloudia renderer in the Codex in-app Chromium browser, Apple/Metal-3
adapter, darwin/arm64. Dedicated Browser plugin was not listed; the available
`cua_repl` in-app browser supplied supported native and Playwright controls.
Desktop screenshots are 1031×954; the benchmark output/internal buffer is
explicitly 1920×1080. Quality: 256³/128³/384, full animated flow, stages timing,
continuous submission, 55% wind, neutral storm sky, left light, no orbit, no
automatic flashes or held dispersion. Each complete sample has 2 seconds of
warmup and 90 seconds of visible RAF intervals. No test/build/screenshot ran
while sampling. The cancelled first attempt had manual camera/control changes
and no usable result.

| Version / sample | RAF fps | p95 / p99 ms | Max interval ms | >33.34ms | GPU rendering mean ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| [Original v14](benchmarks/2026-10-13-office-baseline-v14-worker-1080p-90s.json) | 59.996 | 17.6 / 17.7 | 24.2 | 0 | 13.242 |
| [Traversal only v15](benchmarks/2026-10-13-office-traversal-v15-worker-1080p-90s.json) | 59.985 | 17.4 / 17.6 | 33.3 | 0 | 13.431 |
| [Final v16](benchmarks/2026-10-13-office-final-v16-worker-1080p-90s.json) | 59.996 | 17.6 / 17.7 | 17.8 | 0 | 11.143 |

v14/v15 start at 65.53/60.57 cloud seconds and differ slightly in camera focus
(the v14 recenter includes a small current drift). Thus these are bounded
same-settings samples, not bit-identical causal A/B trials. The v15 empty
advance is 0.0546875 units versus the v14 0.01822917. Its GPU mean did not
improve. v16's roughly 16% lower mean includes the material change and is not
attributed exclusively to traversal. GPU timestamp samples are asynchronous;
RAF is submission cadence, not compositor presentation.

### Rendered verification

- Worker v16 compiled actual WGSL and displayed the sheared seed1571198069.
  Main v16 displayed congestus seed72. Both inspected console logs were empty.
  Meaningful page/title/content and no framework error overlay were observed.
- Front, keyboard-oblique and native two-axis side drag preserved cloud support;
  Ricentra returned the displayed view to0°/0°. Keyboard/Home were also exercised
  in main mode, but immediate main status reads did not resolve intermediate
  angles; do not count those reads as numeric rotation proof.
- New-form visibly regenerated congestus1581730950 and multicell3422955289;
  mature views of all three families were captured. Old cloud stayed displayed
  while the next one was prepared.
- Held dispersion reached100%, gust was exercised, Ricondensa was invoked, and
  the manual flash reported a3km/8.7s thunder plan with audio disabled. Acoustic
  output/listening was not checked in this office session.
- Main mode at390×844 showed all controls; the open weather panel stayed inside
  the viewport and `scrollWidth=clientWidth=390`. Temporary viewport override
  was reset. This is browser responsive QA, not physical-phone acceptance.

### Visual evidence and remaining work

[Original front](images/office-2026-10-13/before-v14.png),
[new front](images/office-2026-10-13/after-v16-front.png),
[oblique](images/office-2026-10-13/after-v16-oblique.png),
[side](images/office-2026-10-13/after-v16-side.png),
[congestus](images/office-2026-10-13/after-v16-congestus.png),
[multicell](images/office-2026-10-13/after-v16-multicell.png),
[dispersion](images/office-2026-10-13/after-v16-dispersed.png),
[narrow main](images/office-2026-10-13/main-v16-narrow.png),
[narrow controls](images/office-2026-10-13/main-v16-narrow-controls.png),
[final benchmark](images/office-2026-10-13/final-v16-benchmark.png),
[animated-preview still](images/office-2026-10-13/final-v16-preview.png).
`images/office-2026-10-13/SHA256SUMS` checks all11 screenshots. Front snapshots
are qualitative comparisons with close mature times, not registered image-diff
proof. The final preview uses explicit window-sized output rather than the
benchmark's FullHD buffer; no quality was reduced for the measurement.

Ribbons have more depth variation and irregular edge detail, but the cap still
appears smooth/roof-like from some angles. Photographic microstructure and owner
visual acceptance remain open. All three successful90s samples are mature,
fixed-view worker scenarios on this Mac. Formation, storm/orbit, compositor,
main-mode sustained cadence and other-device qualification remain open.

Final implementation: `c457bfcf4c39ad60a75a684af03fae91e7766f8a`, renderer
`fibrous-flow-v16`. Final 91 tests/20 files, typecheck and application → hero
builds passed. The retained Vite large-chunk warning is unchanged in kind.
Source and evidence are published only to the established feature branch;
main merge and website deployment are outside this continuation. Hand recognition,
its owner-agreed mapping, camera permission and rain remain pending.
