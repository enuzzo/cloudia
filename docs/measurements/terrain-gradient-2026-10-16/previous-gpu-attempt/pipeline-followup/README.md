# Single-pipeline follow-up v1

Prepared separately after the original two-pipeline audit stalled. Original audit
files and shader/data assets remain unchanged. No retry or GPU execution was
started by this agent. Root must recover/finish the original page before choosing
whether to use this follow-up.

Open `/pipeline-followup/index.html` on the same server. Select matrix14 rays,
all rays, or rectangles, then click the stage button. Each explicit run creates
one device and **one compute pipeline**, not two concurrent pipelines.

The module includes only the selected compute kernel. Rectangle-only mode also
omits the unused terrain trace entry, retaining the exact original field and
interval helper source. Runtime JSON records the executed module SHA as well as
the original source-asset SHA. A completed stage always reports
`completeCombinedAudit:false` and `productPromotionGatePassed:false`.

Only `#audit-summary` is visible. Full JSON is stored in a hidden `#audit-json`
element, accessible through DOM textContent or the explicit download button.
This avoids layout/accessibility work on the multi-megabyte result; it does not
prove that publication was the cause of the original stall. Pipeline compilation,
local-array lowering, loop optimization and result publication remain separate
hypotheses until the original state is recovered.

No new metadata, geometry, shader arithmetic, quality setting or external
package is introduced by the follow-up. Node syntax check passes. No WGSL compiler
or GPU execution has validated the candidate yet.
