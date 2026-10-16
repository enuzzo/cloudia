# Preclamp causality — negative counterfactual, not promoted

The [causality report](PRECLAMP-CAUSALITY.md) supersedes the generic proposal to add another100–300m field. Those scales already exist. The frozen seed72 material places much of the visible optical contribution on a high-clamp plateau. The one scalar coefficient change `.6→.5` desaturates the center, but also erases every sampled point5m inside the previous front and one weak ray at deeper sampled locations. **Do not promote or repeat it as a frontier-preserving correction.**

## Preserved evidence

- `input/carving-causality.json.gz`: complete original sampled material diagnostics,52 positions,196 original stencil nodes and a short central opacity trace;252 unique reconstructed macro bytes match the existing cache exactly. Primitive construction metadata is included. This is sampled proof, not a256³ volume verification.
- `expected/interior-coefficient-scalar.json.gz`: complete frozen scalar counterfactual output, including196 node results and52 fixed-coordinate density results. No new frontier, shadows, volume or render was calculated.
- `replay.py`: self-contained Python standard-library replay. It reproduces196 original bytes, applies the exact coefficient formula, preserves Float32 density storage and JS nonnegative rounding, and compares the **complete** result with the frozen output. It writes nothing.
- `audit-code/`: exact external scalar reconstruction and counterfactual scripts. The original reconstruction needs the referenced existing material inputs; the portable replay does not.
- `sources/`: exact frozen baseline volume source and source hashes. Generated volumes, builds, dependencies and GPU caches are excluded.
- `input-references.json`: original material SHA256 references and uncompressed hashes for every gzip payload.

The `.6→.5` formula is `1-.5*smoothstep(.04,.28,F)`, not `max(.5,I)`. These interventions are not interchangeable. The code here implements only the former; no more favorable alternative was selected after its negative result.

The comparison uses the qualified external seed72 fixture, with the earlier CPU/JPEG agreement recorded in the parent folder. Retired meso/U experiments used a different seed/camera and a different material intervention. This archive does not classify that older camera using current seed72 data or declare the experiments equivalent.

## Replay and integrity

```sh
python3 verify.py
python3 replay.py
```

The commands work from any current directory when invoked by absolute path. Python built-ins suffice; there is no project install, bake, browser, GPU or product write. The manifest covers every archive payload except itself, its trust anchor. Compression is lossless. Neither an integrity PASS nor scalar replay PASS changes the **negative** intervention decision.
