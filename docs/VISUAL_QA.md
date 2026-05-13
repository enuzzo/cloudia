# Cloudia Visual QA

This document records visual comparisons against the accepted benchmark.

## Benchmark

- Flow benchmark: provided screenshot of Maxime Heckel-style forward cloud deck.
- Key requirements: forward horizontal travel, pastel sky, soft horizon, cloud plane depth, creamy cloud edges.
- Cumulus benchmark: same quality bar, but staged as one central controllable cloud mass.

## QA Entries

### M2 Flow Cloud Deck

Status: first upgrade verified locally

Comparison points:

- Forward motion: shader advances both raymarch and screen-space fbm depth; needs stronger parallax/depth pass.
- Horizon placement: cloud mass sits near lower-mid viewport, close to target composition.
- Pastel palette: lavender/blue/peach target is present.
- Cloud volume/depth: improved over baseline; still needs more true layered cumulus structure and less airbrushed blending.
- Edge softness: soft, with visible belt structure; needs more creamy billowed edges.
- Performance: build passes; live browser render is responsive on current machine.
- Desktop screenshot: verified via Browser plugin at `http://127.0.0.1:5173/`, title `Cloudia Lab`, 1 canvas, no console warnings/errors.
- Hero 60vh screenshot: pending dedicated embed/fixture QA.
