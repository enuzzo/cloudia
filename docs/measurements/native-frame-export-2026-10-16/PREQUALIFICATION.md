# Native export prequalification

Previous goal turn progressed through fixed-camera negative evidence and local checkpoint9b8f266. Renderer remains v56 before this feature.

Initial root typecheck returned TS2339 for ready-only PNG fields after handling the helper pending|cleared union member. An explicit state!==ready guard resolves narrowing without changing the helper. Second root typecheck exit0. Current targeted helper/lifecycle/inspector85/85 tests PASS across3files, before the new integration regressions. External helper24/24 and its independent review are separately frozen.

Preview-r1 snapshot is immutable124source files. It is a browser qualification build, not the final source freeze; later integration-test edits require a distinct final snapshot. No installs, lockfile edits or scans of node_modules2.

Preview-r1 browser export produced a valid806716B PNG internally, but the UItextarea read was truncated at200011characters. The149990decoded bytes failed the declared SHA; no partialPNG was saved. The negative metadata/transport record remains in browser-r1. This motivated an intentional visible65536-character pager; concatenate every part before base64 decoding.

Final freeze has124sourcefiles, SHA8dce2ed7a5843104c3b606c4223435d69408d43739712b1f722c7a1fa8a348f2. Four new integration regressions plus24helper tests are included in378/378tests45files, typecheck/app/hero PASS sequentially with terminal exit0; root runtime hashes match. The final720PNG matches the original declared806716B SHA, and native2474×1844 main/worker near60 PNG bytes match each other exactly. These qualify capture/transport, not photorealism or FPS.
