# R8 / RGBA8.r raw sampler guard

Prepared inputs only. No GPU execution has been performed by the preparer.
Serve this directory over localhost, open `index.html`, and press **Avvia** once.
The page never starts GPU work automatically. The same button cancels an active
run; Esc and pagehide also request cancellation and call `device.destroy()`.
Visible phases and per-await 30 s timeouts expose an adapter/pipeline/readback stall.

`prepare.py` reads the original, already baked seed72 RGBA8 macro volume,
checks its pinned SHA-256, copies it here, and extracts `r8[i] = rgba8[4*i]`.
It does not import or run Cloudia volume generation. It preserves the frozen v46
shader fragment as provenance of the original linear/clamp/mip0 density lookup.
`inputs.json` records all binary lengths, dimensions, layouts and hashes.

The compute shader binds both textures simultaneously and samples them at the
**same f32 UV**, using **one shared sampler**, linear min/mag filtering,
clamp-to-edge on all three axes, one mip, and explicit level zero.
The textures have `TEXTURE_BINDING | COPY_DST` usage. `queue.writeTexture` rows
are `N*4` and `N` bytes, respectively; the 256-byte row restriction of encoded
buffer-to-texture copies does not apply to this API.

The finite set includes exact real positive/zero texel centres, stratified
centres, deterministic Halton/random probes, f32 neighbours of interpolation
planes and centres, and faces/edges/out-of-domain clamp coordinates. Three
16-cubed fixtures isolate R=0, R=255 and varying R while G/B/A vary independently.
Input query stride is 16 bytes. Output query stride is 48 bytes: four f32 samples,
four u32 bits/flags, and the echoed four f32 inputs. Four GPU atomic counters are
read back separately and checked against independent CPU counts.

The initial acceptance criterion is **identical f32 output bit patterns**.
Any mismatch, nonfinite value, out-of-unit value, echo/counter mismatch or missing
nonvacuous zero/positive/fractional coverage fails the appropriate dataset.
The first mismatches and maximum absolute/ULP differences are retained even
when they are small. Endpoint fixtures require their exact constant value.
The page provides the JSON report and complete per-dataset readback and paired
f32 output as download links. The readback includes the final 16-byte counters.

Peak nominal texture payload is 80 MiB for the real 256-cubed pair, released
before each 20 KiB fixture pair. Driver overhead and upload staging are excluded.
CPU input bytes and report downloads also remain resident during the audit.
All created buffers/textures receive destroy calls in success/error/cancel paths;
the report records device destruction, not a claim of immediate physical release.

A PASS qualifies only these queries and the adapter/backend recorded by this
raw WebGPU run. It does not prove universal format equivalence, Three.js binding
or compiled shader equivalence, whole-frame equality, lifecycle correctness,
visual acceptance, or performance improvement. No browser, GPU or renderer
benchmark is launched by the preparation/syntax checks.
