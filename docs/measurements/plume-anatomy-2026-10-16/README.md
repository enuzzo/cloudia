# Retired plume anatomy evidence

Read [the experiment report](../../EXPERIMENT-PLUME-ANATOMY-2026-10-16.md) for the decisions and scope. All three trials were rejected; no artistic PASS follows from these numerical checks.

## Contents

- `browser/`:21 original1280×720 JPEGs: baseline 7, candidate1 six, candidate2 six, candidate3 two. These are CSS screenshots of a session configured for 2560×1440 native output and 384 steps; they are not native pixel readbacks.
- `sources/`: exact59bb8d3 volume/test, and each candidate's owned volume/helper/test plus original owner hash manifest.
- `patches/`: gzip-compressed unified volume diffs, preserving exact decompressed bytes with SHA256 in `provenance.json`. Helpers/tests are preserved as complete source files.
- `numerical/`: sampled support/mass records, candidate2-versus3 contraction records, seed 74 material sections and primitive metadata.
- `audit-code/`: self-contained generated CPU audit modules and the corresponding contraction/material intervention sources. No project dependency is required to load the generated modules.
- `owner-reports/`: original handoffs and causal diagnosis, preserved verbatim. Their earlier “awaiting browser decision” wording is superseded by the final rejection documented in the experiment report.
- `provenance.json`: original external paths and excluded generated material.
- `manifest.json`: bytes/SHA256 for every archive payload; it is the trust anchor and cannot hash itself.

## Verification and portable replay

From the repository root:

```sh
node docs/measurements/plume-anatomy-2026-10-16/verify.mjs
node docs/measurements/plume-anatomy-2026-10-16/replay-contraction.mjs
```

Both scripts resolve relative to their own location, use Node built-ins only and write no files. The replay generates six 64³ volumes in memory. It compares the complete numerical contraction entries and density/RGBA/sunset hashes with the frozen record. Timestamps, source paths and elapsed timings are outside the compared record; substantive outputs are not filtered out. It is not a GPU or photographic test.

## Capture exclusions

Do not treat this image set as a pixel A/B. Each morphology's camera target follows its support center. The baseline seed 72 quarter used Home center-plus-drift, while the candidates used comparison reset-center; exclude it from strict pose matching. The baseline seed 72 front35 is context only. Candidate3 seeds 72/73 were not recaptured: their 64³ buffers match candidate2, but no new 256³ browser comparison is claimed.

No generated volume/light binaries, dependencies, builds or full duplicate 97-source trees are included. Those remain external to Dropbox. The archive is intentionally small enough to preserve the experiments without restoring the rejected product code.
