# Native terrain shadow discrimination, rejected local-plane bias trial

Product base99fc989 /v57 stays unchanged. Two immutable external variants: material visibility1.0 for causal discrimination, then normal-clearance with real shadow compare retained. Both typecheck/app/hero exit0; no new Vitest suite or FPS qualification.

Same2474×1844 Sun camera/quality/state as the committed v57 main74-sun-terrain-native baseline in the sibling native-frame-export package. Candidate PNG + metadata + visible-part transfer ledgers are originals. Crops are derived from those native bitmap originals and the referenced baseline.

Ablation removes1778pixels and all selected geometric patches, identifying the visibility branch; it removes true cast shadows too and is not adopted. Normal-clearance changes1006pixels but preserves defects and adds a step; root+independent visualFAIL, no Rain/Sunset/worker/perf continuation on it and no margin retuning.

Run `python3 verify.py` for hash/decoded PNG/metadata/saved CPU-result and difference verification. Optional `--runtime-source /absolute/v57checkout` verifies all124base/current source hashes plus virtual candidate hashes. No model/helper/test/build/GPU/browser executes. Existing Pillow required.

External full source/dist snapshots remain in cycle25/unshadowed-source and normal-clearance-source. Package includes the candidate module and exact patch; no dependencies or cloned source tree copied here. CPUf32 surrogate is local and not GPUbit parity. R1 launcher failure before Bun preserved; R2 kernelCPU cap and terminal RSS gate distinguished.

The raw unshadowed-engine.patch contains standard unified-diff blank context lines (one literal space). They are preserved byte for byte; a package-local whitespace attribute excludes only that archived patch from trailing-space lint. Its original hash remains checked. All other paths retain the normal whitespace check.
